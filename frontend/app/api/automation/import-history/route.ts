/**
 * 過去ツイート一括インポートAPI
 *
 * X APIから自分のアカウントの過去ツイートを取得し、
 * posts_history.jsonにインポートする
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchHistoricalTweets, AccountType, ACCOUNTS } from '@/lib/dm-hunter/sns-adapter';
import { bulkImportPosts } from '@/lib/analytics/posts-history';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { secret, account, maxTweets = 100 } = body;

    // 認証チェック
    const expectedSecret = process.env.AUTO_POST_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // アカウント指定がない場合は全Twitterアカウント
    const targetAccounts: AccountType[] = account
      ? [account as AccountType]
      : ACCOUNTS.filter(a => a.platform === 'twitter').map(a => a.id);

    console.log(`[ImportHistory] Starting import for accounts: ${targetAccounts.join(', ')}`);

    const results: {
      account: string;
      fetched: number;
      imported: number;
      skipped: number;
      hasMore: boolean;
    }[] = [];

    for (const acc of targetAccounts) {
      console.log(`[ImportHistory] Fetching tweets for ${acc}...`);

      // 過去ツイートを取得
      const { tweets, totalFetched, hasMore } = await fetchHistoricalTweets(acc, maxTweets);

      if (tweets.length === 0) {
        results.push({
          account: acc,
          fetched: 0,
          imported: 0,
          skipped: 0,
          hasMore: false,
        });
        continue;
      }

      // posts_historyにインポート
      const postsToImport = tweets.map(t => ({
        tweetId: t.tweetId,
        text: t.text,
        account: acc,
        postedAt: t.createdAt,
        impressions: t.metrics.impressions,
        likes: t.metrics.likes,
        retweets: t.metrics.retweets,
        replies: t.metrics.replies,
      }));

      const importResult = await bulkImportPosts(postsToImport);

      results.push({
        account: acc,
        fetched: totalFetched,
        imported: importResult.imported,
        skipped: importResult.skipped,
        hasMore,
      });

      console.log(`[ImportHistory] ${acc}: ${importResult.imported} imported, ${importResult.skipped} skipped`);

      // アカウント間でレート制限対策
      if (targetAccounts.indexOf(acc) < targetAccounts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
    const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0);

    console.log(`[ImportHistory] Complete: ${totalImported} posts imported from ${totalFetched} fetched`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalFetched,
        totalImported,
        totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
      },
      accounts: results,
    });
  } catch (error: any) {
    console.error('[ImportHistory] Error:', error);
    return NextResponse.json(
      { error: 'Failed to import history', details: error.message },
      { status: 500 }
    );
  }
}

// GET: 現在の履歴状況を取得
export async function GET() {
  try {
    const { getHistorySummary } = await import('@/lib/analytics/posts-history');
    const summary = getHistorySummary();

    return NextResponse.json({
      status: 'ready',
      currentHistory: summary,
      supportedAccounts: ACCOUNTS.filter(a => a.platform === 'twitter').map(a => ({
        id: a.id,
        name: a.name,
        handle: a.handle,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

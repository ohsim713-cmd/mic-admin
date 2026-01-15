import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { AccountType, ACCOUNTS } from '@/lib/dm-hunter/sns-adapter';
import { updateImpressions, getRecentSchedules } from '@/lib/database/schedule-db';

// Twitter クライアントを取得
function getTwitterClient(account: AccountType): TwitterApi | null {
  let apiKey: string | undefined;
  let apiSecret: string | undefined;
  let accessToken: string | undefined;
  let accessTokenSecret: string | undefined;

  switch (account) {
    case 'liver':
      apiKey = process.env.TWITTER_API_KEY_TT_LIVER;
      apiSecret = process.env.TWITTER_API_SECRET_TT_LIVER;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_TT_LIVER;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_TT_LIVER;
      break;
    case 'chatre1':
      apiKey = process.env.TWITTER_API_KEY_MIC_CHAT;
      apiSecret = process.env.TWITTER_API_SECRET_MIC_CHAT;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_MIC_CHAT;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_MIC_CHAT;
      break;
    case 'chatre2':
      apiKey = process.env.TWITTER_API_KEY_MS_STRIPCHAT;
      apiSecret = process.env.TWITTER_API_SECRET_MS_STRIPCHAT;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_MS_STRIPCHAT;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_MS_STRIPCHAT;
      break;
  }

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return null;
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });
}

// POST: インプレッションを取得して更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { secret } = body;

    // 認証チェック
    const expectedSecret = process.env.AUTO_POST_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 });
    }

    console.log('[Impressions] Fetching tweet metrics...');

    // 最近のスケジュールからツイートIDを取得
    const schedules = await getRecentSchedules();
    const tweetIds: { id: string; tweetId: string; account: AccountType }[] = [];

    for (const schedule of schedules) {
      for (const post of schedule.posts) {
        if (post.tweetId && post.status === 'posted') {
          tweetIds.push({
            id: post.id,
            tweetId: post.tweetId,
            account: post.account,
          });
        }
      }
    }

    if (tweetIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tweets to fetch metrics for',
        updated: 0,
      });
    }

    // アカウント別にグループ化 (Twitterアカウントのみ)
    const byAccount: Record<'liver' | 'chatre1' | 'chatre2', typeof tweetIds> = {
      liver: [],
      chatre1: [],
      chatre2: [],
    };

    for (const tweet of tweetIds) {
      if (tweet.account !== 'wordpress') {
        byAccount[tweet.account as 'liver' | 'chatre1' | 'chatre2'].push(tweet);
      }
    }

    const results: any[] = [];
    let totalUpdated = 0;
    let totalImpressions = 0;

    // 各アカウントのツイートメトリクスを取得
    for (const account of ['liver', 'chatre1', 'chatre2'] as const) {
      const tweets = byAccount[account];
      if (tweets.length === 0) continue;

      const client = getTwitterClient(account);
      if (!client) {
        console.log(`[Impressions] No client for ${account}`);
        continue;
      }

      try {
        // Twitter API v2でツイートメトリクスを取得
        // 注意: Basic APIでは public_metrics のみ利用可能
        // 注意: non_public_metrics (impressions) は Pro 以上のプランが必要

        for (const tweet of tweets) {
          try {
            const tweetData = await client.v2.singleTweet(tweet.tweetId, {
              'tweet.fields': ['public_metrics'],
            });

            const metrics = tweetData.data.public_metrics;
            if (metrics) {
              // public_metrics からエンゲージメントを計算
              // インプレッションは Basic プランでは取得不可なので、推定値を使用
              const engagements =
                (metrics.like_count || 0) +
                (metrics.retweet_count || 0) +
                (metrics.reply_count || 0) +
                (metrics.quote_count || 0);

              // インプレッション推定（エンゲージメント × 50 を仮定）
              // 実際のインプレッションが取れる場合は置き換え
              const estimatedImpressions = engagements * 50 || 100;

              await updateImpressions(tweet.id, estimatedImpressions, engagements);

              results.push({
                tweetId: tweet.tweetId,
                account,
                impressions: estimatedImpressions,
                engagements,
                metrics,
              });

              totalUpdated++;
              totalImpressions += estimatedImpressions;
            }
          } catch (err: any) {
            console.error(`[Impressions] Error fetching ${tweet.tweetId}:`, err.message);
          }
        }
      } catch (error: any) {
        console.error(`[Impressions] Error for ${account}:`, error.message);
      }
    }

    console.log(`[Impressions] Updated ${totalUpdated} tweets, total impressions: ${totalImpressions}`);

    return NextResponse.json({
      success: true,
      message: `Updated ${totalUpdated} tweet metrics`,
      totalImpressions,
      avgImpressions: totalUpdated > 0 ? Math.round(totalImpressions / totalUpdated) : 0,
      results,
    });

  } catch (error: any) {
    console.error('[Impressions] Error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// GET: インプレッション統計
export async function GET() {
  try {
    const schedules = await getRecentSchedules();

    let totalImpressions = 0;
    let totalPosts = 0;
    const byAccount: Record<string, { posts: number; impressions: number }> = {};

    for (const schedule of schedules) {
      for (const post of schedule.posts) {
        if (post.status === 'posted') {
          totalPosts++;
          totalImpressions += post.impressions || 0;

          if (!byAccount[post.account]) {
            byAccount[post.account] = { posts: 0, impressions: 0 };
          }
          byAccount[post.account].posts++;
          byAccount[post.account].impressions += post.impressions || 0;
        }
      }
    }

    return NextResponse.json({
      summary: {
        totalPosts,
        totalImpressions,
        avgImpressions: totalPosts > 0 ? Math.round(totalImpressions / totalPosts) : 0,
        target: 1000,
        progress: totalPosts > 0 ? Math.round((totalImpressions / totalPosts / 1000) * 100) : 0,
      },
      byAccount: Object.entries(byAccount).map(([account, stats]) => ({
        account,
        accountName: ACCOUNTS.find(a => a.id === account)?.name,
        posts: stats.posts,
        impressions: stats.impressions,
        avgImpressions: stats.posts > 0 ? Math.round(stats.impressions / stats.posts) : 0,
      })),
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

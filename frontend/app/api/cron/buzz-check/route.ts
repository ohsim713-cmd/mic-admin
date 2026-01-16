/**
 * バズ検知 Cron ジョブ
 *
 * Vercel Cron: 4時間ごと実行
 * X APIからメトリクスを取得し、バズ投稿を検出
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllAccountsMetrics,
  calculateEngagementRate,
  TweetMetrics,
  AccountType,
} from '@/lib/dm-hunter/sns-adapter';
import { detectBuzz, getBuzzStats } from '@/lib/agent/buzz-detector';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('[CRON/BuzzCheck] Starting buzz detection...');

    // 全アカウントのメトリクスを取得
    const allMetrics = await getAllAccountsMetrics(20);

    // バズ検知用のフォーマットに変換
    const postsForDetection: Array<{
      id: string;
      text: string;
      account: string;
      platform: 'x' | 'tiktok' | 'instagram';
      impressions: number;
      engagements: number;
      postedAt: string;
    }> = [];

    for (const accountData of allMetrics) {
      for (const tweet of accountData.metrics) {
        const engagements =
          tweet.metrics.likes +
          tweet.metrics.retweets +
          tweet.metrics.replies +
          tweet.metrics.quotes;

        postsForDetection.push({
          id: tweet.tweetId,
          text: tweet.text,
          account: accountData.account,
          platform: 'x',
          impressions: tweet.metrics.impressions,
          engagements,
          postedAt: tweet.createdAt,
        });
      }
    }

    console.log(`[CRON/BuzzCheck] Found ${postsForDetection.length} tweets to analyze`);

    // バズ検知実行
    const detected = await detectBuzz(postsForDetection, {
      minImpressions: 1000,
      minEngagementRate: 3,
      minBuzzScore: 70,
    });

    const stats = getBuzzStats();

    console.log(`[CRON/BuzzCheck] Detected ${detected.length} new buzz posts`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      analyzed: postsForDetection.length,
      newBuzzPosts: detected.length,
      buzzPosts: detected.map(p => ({
        id: p.id,
        account: p.account,
        text: p.text.slice(0, 50) + '...',
        impressions: p.impressions,
        engagementRate: p.engagementRate.toFixed(1) + '%',
        buzzScore: p.buzzScore,
      })),
      stats,
    });
  } catch (error: any) {
    console.error('[CRON/BuzzCheck] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check buzz', details: error.message },
      { status: 500 }
    );
  }
}

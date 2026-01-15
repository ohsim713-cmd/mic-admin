/**
 * エンゲージメント取得API
 *
 * GET: 各アカウントの最近のツイートのエンゲージメントを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllAccountsMetrics,
  getTweetMetrics,
  calculateEngagementRate,
  AccountType,
} from '@/lib/dm-hunter/sns-adapter';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const account = searchParams.get('account') as AccountType | null;
  const maxResults = parseInt(searchParams.get('max') || '10', 10);

  try {
    if (account) {
      // 特定アカウントのみ
      const metrics = await getTweetMetrics(account, maxResults);

      // エンゲージメント率を追加
      const withEngagement = metrics.map((m) => ({
        ...m,
        engagementRate: calculateEngagementRate(m).toFixed(2) + '%',
      }));

      // 統計
      const totalImpressions = metrics.reduce((sum, m) => sum + m.metrics.impressions, 0);
      const totalLikes = metrics.reduce((sum, m) => sum + m.metrics.likes, 0);
      const avgEngagement =
        metrics.length > 0
          ? (metrics.reduce((sum, m) => sum + calculateEngagementRate(m), 0) / metrics.length).toFixed(2)
          : '0';

      return NextResponse.json({
        account,
        count: metrics.length,
        stats: {
          totalImpressions,
          totalLikes,
          avgEngagementRate: avgEngagement + '%',
        },
        tweets: withEngagement,
      });
    }

    // 全アカウント
    const allMetrics = await getAllAccountsMetrics(maxResults);

    const summary = allMetrics.map(({ account, metrics }) => {
      const totalImpressions = metrics.reduce((sum, m) => sum + m.metrics.impressions, 0);
      const totalLikes = metrics.reduce((sum, m) => sum + m.metrics.likes, 0);
      const avgEngagement =
        metrics.length > 0
          ? (metrics.reduce((sum, m) => sum + calculateEngagementRate(m), 0) / metrics.length).toFixed(2)
          : '0';

      return {
        account,
        count: metrics.length,
        stats: {
          totalImpressions,
          totalLikes,
          avgEngagementRate: avgEngagement + '%',
        },
      };
    });

    return NextResponse.json({
      accounts: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Engagement API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagement', details: error.message },
      { status: 500 }
    );
  }
}

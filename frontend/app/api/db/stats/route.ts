/**
 * DB統計情報API
 * GET /api/db/stats
 */

import { NextResponse } from 'next/server';
import { getStats as getPostsStats } from '../../../../lib/database/generated-posts';
import { getDBStats as getPatternsStats } from '../../../../lib/database/success-patterns';

export async function GET() {
  try {
    // Vercelのサーバーレス環境ではファイルシステムに書き込めないため
    // エラー時はデフォルト値を返す
    const postsStats = await getPostsStats().catch(() => ({
      total: 0,
      byStatus: {},
      byAccount: {},
      avgScore: 0,
      todayGenerated: 0,
      todayPosted: 0,
    }));

    const patternsStats = await getPatternsStats().catch(() => ({
      totalPatterns: 0,
      byCategory: {},
      avgScore: 0,
      lastUpdated: new Date().toISOString(),
    }));

    return NextResponse.json({
      posts: postsStats,
      patterns: patternsStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('統計取得エラー:', error);
    // エラー時でもデフォルト値を返す
    return NextResponse.json({
      posts: {
        total: 0,
        byStatus: {},
        byAccount: {},
        avgScore: 0,
        todayGenerated: 0,
        todayPosted: 0,
      },
      patterns: {
        totalPatterns: 0,
        byCategory: {},
        avgScore: 0,
        lastUpdated: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }
}

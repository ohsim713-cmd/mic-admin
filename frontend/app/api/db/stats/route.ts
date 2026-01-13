/**
 * DB統計情報API
 * GET /api/db/stats
 */

import { NextResponse } from 'next/server';
import { getStats as getPostsStats } from '../../../../lib/database/generated-posts';
import { getDBStats as getPatternsStats } from '../../../../lib/database/success-patterns';

export async function GET() {
  try {
    const [postsStats, patternsStats] = await Promise.all([
      getPostsStats(),
      getPatternsStats(),
    ]);

    return NextResponse.json({
      posts: postsStats,
      patterns: patternsStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('統計取得エラー:', error);
    return NextResponse.json(
      { error: '統計情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

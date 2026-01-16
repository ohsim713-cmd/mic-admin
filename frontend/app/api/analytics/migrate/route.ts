/**
 * データ移行API
 * post_stock.json から posts_history.json へのデータ移行
 */

import { NextResponse } from 'next/server';
import { migrateFromPostStock, getHistorySummary, loadPostsHistory } from '@/lib/analytics/posts-history';

export async function POST() {
  try {
    // post_stock.json から移行
    const result = await migrateFromPostStock();

    // サマリーを取得
    const summary = getHistorySummary();

    return NextResponse.json({
      success: true,
      migration: result,
      summary,
      message: `${result.migrated}件のデータを移行しました（${result.skipped}件はスキップ）`,
    });
  } catch (error: any) {
    console.error('[Migrate API] Error:', error);
    return NextResponse.json(
      { error: 'データ移行に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const history = loadPostsHistory();
    const summary = getHistorySummary();

    return NextResponse.json({
      success: true,
      summary,
      history: {
        totalPosts: history.posts.length,
        lastUpdated: history.lastUpdated,
        recentPosts: history.posts.slice(-5).reverse(),
      },
    });
  } catch (error: any) {
    console.error('[Migrate API] Error:', error);
    return NextResponse.json(
      { error: 'データ取得に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

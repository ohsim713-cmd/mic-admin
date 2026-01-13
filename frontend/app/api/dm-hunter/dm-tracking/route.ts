import { NextRequest, NextResponse } from 'next/server';
import {
  recordDM,
  updateDMStatus,
  getTodayStats,
  getHistoricalStats,
  getRecentDMs,
  setDailyGoal,
  checkGoalAlert,
  analyzePostPerformance,
} from '@/lib/dm-hunter/dm-tracker';
import { AccountType } from '@/lib/dm-hunter/sns-adapter';

// GET: 統計情報を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'today';
    const days = parseInt(searchParams.get('days') || '7');

    if (view === 'today') {
      const stats = await getTodayStats();
      const alert = await checkGoalAlert();
      return NextResponse.json({ ...stats, alert });
    }

    if (view === 'history') {
      const stats = await getHistoricalStats(days);
      return NextResponse.json(stats);
    }

    if (view === 'recent') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const entries = await getRecentDMs(limit);
      return NextResponse.json({ entries });
    }

    if (view === 'analysis') {
      const analysis = await analyzePostPerformance();
      return NextResponse.json(analysis);
    }

    // デフォルト: 全情報を返す
    const [today, history, recent, alert] = await Promise.all([
      getTodayStats(),
      getHistoricalStats(days),
      getRecentDMs(10),
      checkGoalAlert(),
    ]);

    return NextResponse.json({
      today,
      history,
      recent,
      alert,
    });

  } catch (error: any) {
    console.error('[DM Tracking] GET error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// POST: DMを記録
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // DMを新規記録
    if (!action || action === 'record') {
      const { account, source, linkedPostId, notes } = params;

      if (!account || !['liver', 'chatre1', 'chatre2'].includes(account)) {
        return NextResponse.json({
          error: 'Invalid account. Must be liver, chatre1, or chatre2',
        }, { status: 400 });
      }

      const entry = await recordDM({
        account: account as AccountType,
        source,
        linkedPostId,
        notes,
      });

      // 目標達成チェック
      const alert = await checkGoalAlert();

      return NextResponse.json({
        success: true,
        entry,
        alert,
      });
    }

    // ステータス更新
    if (action === 'update-status') {
      const { id, status, conversionValue } = params;

      if (!id || !status) {
        return NextResponse.json({
          error: 'id and status are required',
        }, { status: 400 });
      }

      const entry = await updateDMStatus(id, status, conversionValue);

      if (!entry) {
        return NextResponse.json({
          error: 'Entry not found',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        entry,
      });
    }

    // 目標設定
    if (action === 'set-goal') {
      const { goal } = params;

      if (typeof goal !== 'number' || goal < 1) {
        return NextResponse.json({
          error: 'goal must be a positive number',
        }, { status: 400 });
      }

      await setDailyGoal(goal);

      return NextResponse.json({
        success: true,
        goal,
      });
    }

    return NextResponse.json({
      error: 'Unknown action',
    }, { status: 400 });

  } catch (error: any) {
    console.error('[DM Tracking] POST error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

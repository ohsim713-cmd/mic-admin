import { NextRequest, NextResponse } from 'next/server';
import {
  checkAllAndAlert,
  getUnreadAlerts,
  getRecentAlerts,
  getAlertSummary,
  markAsRead,
  markAllAsRead,
  dismissAlert,
  createDailySummary,
  updateSettings,
} from '@/lib/dm-hunter/alert-system';

// GET: アラートを取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary';

    if (view === 'summary') {
      const summary = await getAlertSummary();
      return NextResponse.json(summary);
    }

    if (view === 'unread') {
      const alerts = await getUnreadAlerts();
      return NextResponse.json({ alerts });
    }

    if (view === 'recent') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const alerts = await getRecentAlerts(limit);
      return NextResponse.json({ alerts });
    }

    if (view === 'check') {
      // 全システムをチェックしてアラート生成
      const newAlerts = await checkAllAndAlert();
      const summary = await getAlertSummary();
      return NextResponse.json({
        newAlerts,
        summary,
      });
    }

    // デフォルト
    const summary = await getAlertSummary();
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('[Alerts] GET error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// POST: アラート操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // アラートを既読にする
    if (action === 'mark-read') {
      const { alertId } = params;
      if (alertId) {
        await markAsRead(alertId);
      } else {
        await markAllAsRead();
      }
      return NextResponse.json({ success: true });
    }

    // アラートを非表示にする
    if (action === 'dismiss') {
      const { alertId } = params;
      if (!alertId) {
        return NextResponse.json({
          error: 'alertId is required',
        }, { status: 400 });
      }
      await dismissAlert(alertId);
      return NextResponse.json({ success: true });
    }

    // 設定を更新
    if (action === 'update-settings') {
      const { settings } = params;
      if (!settings) {
        return NextResponse.json({
          error: 'settings is required',
        }, { status: 400 });
      }
      await updateSettings(settings);
      return NextResponse.json({ success: true });
    }

    // 日次サマリーを生成
    if (action === 'daily-summary') {
      const alert = await createDailySummary();
      return NextResponse.json({ success: true, alert });
    }

    // 手動でチェック実行
    if (action === 'check') {
      const newAlerts = await checkAllAndAlert();
      return NextResponse.json({
        success: true,
        newAlerts,
      });
    }

    return NextResponse.json({
      error: 'Unknown action',
    }, { status: 400 });

  } catch (error: any) {
    console.error('[Alerts] POST error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

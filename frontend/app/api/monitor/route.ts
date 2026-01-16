/**
 * Monitor API - 24時間監視システム エンドポイント
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMonitorAgent } from '@/lib/agent/sub-agents/monitor-agent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    const monitor = getMonitorAgent();

    switch (action) {
      // 監視対象を追加
      case 'add_target': {
        const { url, name, selector } = params;
        if (!url || !name) {
          return NextResponse.json({ error: 'url and name are required' }, { status: 400 });
        }

        monitor.addTarget({ url, name, selector });

        return NextResponse.json({
          success: true,
          message: `Added monitor target: ${name}`,
          targets: monitor.getTargets().length,
        });
      }

      // 監視対象を削除
      case 'remove_target': {
        const { url } = params;
        if (!url) {
          return NextResponse.json({ error: 'url is required' }, { status: 400 });
        }

        const removed = monitor.removeTarget(url);

        return NextResponse.json({
          success: removed,
          message: removed ? 'Target removed' : 'Target not found',
        });
      }

      // 監視開始
      case 'start': {
        monitor.start();

        return NextResponse.json({
          success: true,
          message: 'Monitoring started',
        });
      }

      // 監視停止
      case 'stop': {
        monitor.stop();

        return NextResponse.json({
          success: true,
          message: 'Monitoring stopped',
        });
      }

      // 今すぐチェック実行
      case 'check_now': {
        await monitor.runCheck();

        return NextResponse.json({
          success: true,
          message: 'Check completed',
          stats: monitor.getStats(),
        });
      }

      // アラート確認済みにする
      case 'acknowledge': {
        const { alertId } = params;
        if (!alertId) {
          return NextResponse.json({ error: 'alertId is required' }, { status: 400 });
        }

        const acknowledged = monitor.acknowledgeAlert(alertId);

        return NextResponse.json({
          success: acknowledged,
          message: acknowledged ? 'Alert acknowledged' : 'Alert not found',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Monitor API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ステータス取得
export async function GET() {
  try {
    const monitor = getMonitorAgent();
    const stats = monitor.getStats();
    const targets = monitor.getTargets();
    const alerts = monitor.getUnacknowledgedAlerts();

    return NextResponse.json({
      status: 'ok',
      stats,
      targets: targets.map(t => ({
        name: t.name,
        url: t.url,
        lastChecked: t.lastChecked,
      })),
      unacknowledgedAlerts: alerts.length,
      alerts: alerts.slice(0, 10),
      endpoints: {
        'POST /api/monitor': {
          actions: {
            add_target: {
              description: '監視対象を追加',
              params: {
                url: 'string (required)',
                name: 'string (required)',
                selector: 'string (optional)',
              },
            },
            remove_target: {
              description: '監視対象を削除',
              params: { url: 'string (required)' },
            },
            start: { description: '監視開始' },
            stop: { description: '監視停止' },
            check_now: { description: '今すぐチェック実行' },
            acknowledge: {
              description: 'アラートを確認済みにする',
              params: { alertId: 'string (required)' },
            },
          },
        },
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Events API - エージェント間通信のモニタリング
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEventBus, AgentEventType } from '@/lib/agent/event-bus';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    const bus = getEventBus();

    switch (action) {
      // イベントを手動発行
      case 'emit': {
        const { type, source, data, priority = 'normal' } = params;

        if (!type || !source) {
          return NextResponse.json(
            { error: 'type and source are required' },
            { status: 400 }
          );
        }

        bus.emit({
          type: type as AgentEventType,
          source,
          data: data || {},
          priority,
        });

        return NextResponse.json({
          success: true,
          message: `Event emitted: ${type}`,
        });
      }

      // 最近のイベントを取得
      case 'recent': {
        const { count = 50, type, source } = params;
        const events = bus.getRecentEvents(count, { type, source });

        return NextResponse.json({
          success: true,
          count: events.length,
          events,
        });
      }

      // 統計情報
      case 'stats': {
        const stats = bus.getStats();

        return NextResponse.json({
          success: true,
          stats,
        });
      }

      // ログをクリア
      case 'clear': {
        bus.clearLog();

        return NextResponse.json({
          success: true,
          message: 'Event log cleared',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Events API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const bus = getEventBus();
    const stats = bus.getStats();
    const recentEvents = bus.getRecentEvents(20);

    return NextResponse.json({
      success: true,
      stats,
      recentEvents,
      endpoints: {
        'POST /api/events': {
          actions: {
            emit: {
              description: 'イベントを手動発行',
              params: {
                type: 'AgentEventType (required)',
                source: 'string (required)',
                data: 'object (optional)',
                priority: '"low" | "normal" | "high" | "urgent" (default: normal)',
              },
            },
            recent: {
              description: '最近のイベントを取得',
              params: {
                count: 'number (default: 50)',
                type: 'AgentEventType (optional filter)',
                source: 'string (optional filter)',
              },
            },
            stats: {
              description: '統計情報を取得',
            },
            clear: {
              description: 'イベントログをクリア',
            },
          },
        },
      },
      eventTypes: [
        'post:generated', 'post:scheduled', 'post:published', 'post:failed',
        'stock:low', 'stock:replenished', 'stock:empty',
        'analytics:report', 'analytics:alert',
        'scout:collected', 'scout:trend',
        'system:error', 'system:health',
        'cycle:start', 'cycle:end',
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

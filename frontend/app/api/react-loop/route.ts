/**
 * ReAct Loop API - 自律型エージェントの制御
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReActLoop, resetReActLoop, ReActConfig } from '@/lib/agent/react-loop';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, config } = body;

    switch (action) {
      case 'start': {
        const loop = getReActLoop(config as Partial<ReActConfig>);
        loop.start();

        return NextResponse.json({
          success: true,
          message: 'ReAct loop started',
          status: loop.getStatus(),
        });
      }

      case 'stop': {
        const loop = getReActLoop();
        loop.stop();

        return NextResponse.json({
          success: true,
          message: 'ReAct loop stopped',
          status: loop.getStatus(),
        });
      }

      case 'reset': {
        resetReActLoop();

        return NextResponse.json({
          success: true,
          message: 'ReAct loop reset',
        });
      }

      case 'status': {
        const loop = getReActLoop();

        return NextResponse.json({
          success: true,
          status: loop.getStatus(),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[ReAct Loop API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const loop = getReActLoop();
    const status = loop.getStatus();

    return NextResponse.json({
      status,
      endpoints: {
        'POST /api/react-loop': {
          actions: {
            start: {
              description: 'ReActループを開始（自律モード開始）',
              config: {
                cycleIntervalMs: 'number (default: 300000 = 5分)',
                maxActionsPerCycle: 'number (default: 3)',
                sleepStartHour: 'number (default: 1)',
                sleepEndHour: 'number (default: 5)',
                minConfidenceToAct: 'number (default: 0.6)',
              },
            },
            stop: {
              description: 'ReActループを停止',
            },
            reset: {
              description: 'ReActループをリセット',
            },
            status: {
              description: '現在の状態を取得',
            },
          },
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

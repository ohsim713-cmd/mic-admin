/**
 * 自律型エージェント API
 *
 * GET: 現在の状態を取得
 * POST: 自律チェックを実行
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runAutonomousCheck,
  executeManualAction,
  getAutonomousState,
  runFullAutonomousLoop,
} from '@/lib/agent/autonomous-loop';

export const maxDuration = 120; // 最大2分

export async function GET() {
  try {
    const state = getAutonomousState();
    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, prompt, iterations } = body;

    // 特定のアクションを手動実行
    if (action) {
      console.log('[Autonomous API] Manual action:', action);
      const result = await executeManualAction(action, prompt);
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // 複数回ループ実行
    if (iterations && iterations > 1) {
      console.log('[Autonomous API] Running loop:', iterations);
      const result = await runFullAutonomousLoop(iterations);
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // 通常の自律チェック
    console.log('[Autonomous API] Running check...');
    const result = await runAutonomousCheck();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Autonomous API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

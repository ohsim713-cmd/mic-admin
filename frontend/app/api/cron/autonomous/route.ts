/**
 * 自律型エージェント Cron ジョブ
 *
 * Vercel Cron: 4時間ごとに実行
 * - 状況を自動で判断
 * - 必要なアクションを実行
 * - 学習・最適化を継続
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAutonomousCheck, runFullAutonomousLoop } from '@/lib/agent/autonomous-loop';

export const runtime = 'nodejs';
export const maxDuration = 120; // 最大2分

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // ローカル開発用: CRON_SECRETがない場合はスキップ
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('[CRON Autonomous] Starting autonomous check...');

    // 自律チェックを実行
    const result = await runAutonomousCheck();

    console.log('[CRON Autonomous] Result:', {
      timestamp: new Date().toISOString(),
      actionsExecuted: result.actions.filter(a => a.status === 'completed').length,
      health: result.state.health,
      insights: result.insights,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[CRON Autonomous] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute autonomous check', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: 強化された自律実行（複数回ループ）
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const iterations = body.iterations || 3;

    console.log('[CRON Autonomous] Running full loop:', iterations);

    const result = await runFullAutonomousLoop(iterations);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[CRON Autonomous] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute autonomous loop', details: String(error) },
      { status: 500 }
    );
  }
}

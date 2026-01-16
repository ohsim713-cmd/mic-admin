/**
 * 自律型エージェント Cron ジョブ
 *
 * Vercel Cron: 定期実行（推奨: 5-10分間隔）
 * Cloud Scheduler からも呼び出し可能
 *
 * 機能:
 * - if-then 判断ルールに基づく自律行動
 * - 状況を自動で判断
 * - 必要なアクションを実行
 * - 学習・最適化を継続
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAutonomousCheck, runFullAutonomousLoop } from '@/lib/agent/autonomous-loop';
import { evaluateAndExecuteRules, getRuleStatus } from '@/lib/agent/decision-rules';
import { cronLogger } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const maxDuration = 120; // 最大2分

export async function GET(request: NextRequest) {
  // Vercel Cron / Cloud Scheduler からの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // ローカル開発用: CRON_SECRETがない場合はスキップ
    if (process.env.CRON_SECRET) {
      cronLogger.warn('Unauthorized autonomous cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    cronLogger.info('Starting autonomous check with decision rules...');

    // ========================================
    // Phase 1: if-then 判断ルールを評価・実行
    // ========================================
    const rulesResult = await evaluateAndExecuteRules();
    cronLogger.info('Decision rules evaluated', {
      triggered: rulesResult.triggeredCount,
      executed: rulesResult.executedCount,
    });

    // ========================================
    // Phase 2: 従来の自律チェックも実行
    // ========================================
    const autonomousResult = await runAutonomousCheck();

    // 結果をマージ
    const mergedResult = {
      timestamp: new Date().toISOString(),
      // 判断ルール結果
      decisionRules: {
        triggered: rulesResult.triggeredCount,
        executed: rulesResult.executedCount,
        details: rulesResult.results.filter(r => r.triggered || r.executed),
      },
      // 自律エージェント結果
      autonomous: {
        actionsExecuted: autonomousResult.actions.filter(a => a.status === 'completed').length,
        health: autonomousResult.state.health,
        insights: autonomousResult.insights,
      },
      // 全体
      totalActionsExecuted:
        rulesResult.executedCount +
        autonomousResult.actions.filter(a => a.status === 'completed').length,
    };

    cronLogger.info('Autonomous check completed', mergedResult);

    return NextResponse.json({
      success: true,
      ...mergedResult,
    });
  } catch (error: any) {
    cronLogger.error('Autonomous check failed', error);
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
      cronLogger.warn('Unauthorized autonomous POST attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const iterations = body.iterations || 3;
    const includeRules = body.includeRules !== false; // デフォルトでルール評価を含む

    cronLogger.info('Running full autonomous loop', { iterations, includeRules });

    const results: any[] = [];

    // 各イテレーションで判断ルールも評価
    for (let i = 0; i < iterations; i++) {
      cronLogger.info(`Iteration ${i + 1}/${iterations}`);

      // 判断ルールを先に評価
      if (includeRules) {
        const rulesResult = await evaluateAndExecuteRules();
        results.push({
          iteration: i + 1,
          type: 'decision-rules',
          triggered: rulesResult.triggeredCount,
          executed: rulesResult.executedCount,
        });
      }

      // 自律ループ実行
      const loopResult = await runAutonomousCheck();
      results.push({
        iteration: i + 1,
        type: 'autonomous-check',
        actionsExecuted: loopResult.actions.filter(a => a.status === 'completed').length,
        health: loopResult.state.health,
      });

      // 次のイテレーション前に少し待機
      if (i < iterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // ルール状態も返す
    const ruleStatus = getRuleStatus();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      iterations,
      results,
      ruleStatus,
    };

    cronLogger.info('Full autonomous loop completed', {
      totalResults: results.length,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    cronLogger.error('Autonomous loop failed', error);
    return NextResponse.json(
      { error: 'Failed to execute autonomous loop', details: String(error) },
      { status: 500 }
    );
  }
}

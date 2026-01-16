/**
 * 仮説生成・検証API
 *
 * GET: 仮説一覧とサマリー取得
 * POST: 新規仮説生成 or 仮説検証
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateHypotheses,
  validateHypothesis,
  validateAllPendingHypotheses,
  applyValidatedHypothesis,
  getHypothesisSummary,
  loadHypotheses,
} from '@/lib/analytics/hypothesis-engine';

export async function GET() {
  try {
    const summary = getHypothesisSummary();
    const hypotheses = loadHypotheses();

    return NextResponse.json({
      success: true,
      summary,
      hypotheses: hypotheses.slice(-20), // 最新20件
    });
  } catch (error: any) {
    console.error('[Hypothesis API] GET error:', error);
    return NextResponse.json(
      { error: '仮説データの取得に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, hypothesisId, count = 3 } = body;

    switch (action) {
      case 'generate': {
        // 新規仮説を生成
        const newHypotheses = await generateHypotheses(count);
        return NextResponse.json({
          success: true,
          action: 'generate',
          hypotheses: newHypotheses,
          message: `${newHypotheses.length}件の仮説を生成しました`,
        });
      }

      case 'validate': {
        // 特定の仮説を検証
        if (!hypothesisId) {
          return NextResponse.json(
            { error: 'hypothesisId が必要です' },
            { status: 400 }
          );
        }
        const result = await validateHypothesis(hypothesisId);
        if (!result) {
          return NextResponse.json(
            { error: '仮説が見つかりません' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          action: 'validate',
          hypothesis: result,
          message: `仮説を検証しました: ${result.status}`,
        });
      }

      case 'validate-all': {
        // 全pending仮説を検証
        const results = await validateAllPendingHypotheses();
        return NextResponse.json({
          success: true,
          action: 'validate-all',
          results,
          message: `検証完了 - 支持:${results.validated}, 棄却:${results.rejected}, 保留:${results.inconclusive}`,
        });
      }

      case 'apply': {
        // 検証済み仮説をナレッジに反映
        if (!hypothesisId) {
          return NextResponse.json(
            { error: 'hypothesisId が必要です' },
            { status: 400 }
          );
        }
        const applyResult = await applyValidatedHypothesis(hypothesisId);
        return NextResponse.json({
          success: applyResult.success,
          action: 'apply',
          actions: applyResult.actions,
        });
      }

      default: {
        // デフォルト: 仮説生成
        const hypotheses = await generateHypotheses(count);
        return NextResponse.json({
          success: true,
          hypotheses,
        });
      }
    }
  } catch (error: any) {
    console.error('[Hypothesis API] POST error:', error);
    return NextResponse.json(
      { error: '仮説処理に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PDCA分析API
 * Check: 投稿実績を分析
 * Act: 分析結果をナレッジに反映
 */

import { NextRequest, NextResponse } from 'next/server';
import { runPDCACheck, runPDCAAct, runFullPDCACycle } from '@/lib/analytics/pdca-analyzer';

/**
 * GET: Check（分析のみ）
 */
export async function GET() {
  try {
    const checkResult = runPDCACheck();

    return NextResponse.json({
      success: true,
      phase: 'check',
      result: checkResult,
    });
  } catch (error: any) {
    console.error('[PDCA API] Check error:', error);
    return NextResponse.json(
      { error: 'PDCA分析に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST: 完全サイクル（Check + Act）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { checkOnly = false } = body;

    if (checkOnly) {
      const checkResult = runPDCACheck();
      return NextResponse.json({
        success: true,
        phase: 'check',
        result: checkResult,
      });
    }

    // 完全サイクル実行
    const { check, act } = runFullPDCACycle();

    return NextResponse.json({
      success: true,
      phase: 'full_cycle',
      check,
      act,
      summary: {
        analyzed: check.totalAnalyzed,
        correlationStrength: check.scoreCorrelation.correlationStrength,
        updatedFiles: act.updated,
        actions: act.actions,
        recommendations: check.recommendations,
      },
    });
  } catch (error: any) {
    console.error('[PDCA API] Error:', error);
    return NextResponse.json(
      { error: 'PDCAサイクルに失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

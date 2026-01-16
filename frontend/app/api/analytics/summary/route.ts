/**
 * SDK分析サマリーAPI
 * Agent SDKが効率的に分析できるようサマリーを生成
 */

import { NextResponse } from 'next/server';
import { generateSDKSummary, saveSDKSummary, loadSDKSummary } from '@/lib/analytics/sdk-summary';

export async function GET() {
  try {
    // 既存のサマリーを確認
    const existing = loadSDKSummary();

    // 1時間以内なら既存を返す
    if (existing) {
      const generatedAt = new Date(existing.generatedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);

      if (hoursDiff < 1) {
        return NextResponse.json({
          cached: true,
          summary: existing,
        });
      }
    }

    // 新規生成
    const summary = generateSDKSummary();
    saveSDKSummary();

    return NextResponse.json({
      cached: false,
      summary,
    });
  } catch (error: any) {
    console.error('[Analytics Summary] Error:', error);
    return NextResponse.json(
      { error: 'サマリー生成に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // 強制的に新規生成
    const summary = generateSDKSummary();
    const filePath = saveSDKSummary();

    return NextResponse.json({
      success: true,
      filePath,
      summary,
    });
  } catch (error: any) {
    console.error('[Analytics Summary] Error:', error);
    return NextResponse.json(
      { error: 'サマリー生成に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

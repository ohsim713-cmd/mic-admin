import { NextRequest, NextResponse } from 'next/server';
import {
  analyzePerformance,
  analyzeABTest,
  generateWeeklyReport,
  getLatestAnalysis,
} from '@/lib/dm-hunter/performance-analyzer';

// GET: 分析結果を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'latest';
    const days = parseInt(searchParams.get('days') || '7');

    if (view === 'latest') {
      // キャッシュされた最新の分析結果を返す
      const analysis = await getLatestAnalysis();
      if (analysis) {
        return NextResponse.json(analysis);
      }
      // なければ新規分析
      const newAnalysis = await analyzePerformance(days);
      return NextResponse.json(newAnalysis);
    }

    if (view === 'fresh') {
      // 強制的に再分析
      const analysis = await analyzePerformance(days);
      return NextResponse.json(analysis);
    }

    if (view === 'report') {
      // 週次レポート
      const report = await generateWeeklyReport();
      return NextResponse.json(report);
    }

    return NextResponse.json({
      error: 'Unknown view type',
    }, { status: 400 });

  } catch (error: any) {
    console.error('[Analysis] GET error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// POST: A/Bテスト分析
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (action === 'ab-test') {
      const { variantA, variantB } = params;

      if (!variantA || !variantB) {
        return NextResponse.json({
          error: 'variantA and variantB are required',
        }, { status: 400 });
      }

      const result = await analyzeABTest({ variantA, variantB });
      return NextResponse.json(result);
    }

    if (action === 'analyze') {
      const days = params.days || 7;
      const analysis = await analyzePerformance(days);
      return NextResponse.json(analysis);
    }

    return NextResponse.json({
      error: 'Unknown action',
    }, { status: 400 });

  } catch (error: any) {
    console.error('[Analysis] POST error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

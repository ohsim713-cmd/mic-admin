import { NextRequest, NextResponse } from 'next/server';
import {
  runCompetitorAnalysis,
  getCompetitorStats,
  getTopPatterns,
} from '@/lib/agent/competitor-analyzer';
import fs from 'fs';
import path from 'path';

const CREDENTIALS_FILE = path.join(process.cwd(), 'knowledge', 'x_credentials.json');

function getBearerToken(): string | null {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
      return data.tt_liver?.bearerToken || null;
    }
  } catch {
    return null;
  }
  return null;
}

// POST: 競合分析を実行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { secret, accounts, industry = 'liver' } = body;

    // 認証チェック
    const expectedSecret = process.env.AUTO_POST_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bearerToken = getBearerToken();
    if (!bearerToken) {
      return NextResponse.json(
        { error: 'Bearer token not configured' },
        { status: 400 }
      );
    }

    console.log(`[CompetitorAnalysis] Starting analysis for ${industry}...`);

    const result = await runCompetitorAnalysis(bearerToken, accounts, industry);

    console.log(`[CompetitorAnalysis] Done: ${result.postsCollected} posts, ${result.patternsExtracted} patterns`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error('[CompetitorAnalysis] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis', details: error.message },
      { status: 500 }
    );
  }
}

// GET: 統計・パターン取得
export async function GET() {
  try {
    const stats = getCompetitorStats();
    const topPatterns = getTopPatterns(5);

    return NextResponse.json({
      stats,
      topPatterns: topPatterns.map(p => ({
        type: p.type,
        pattern: p.pattern,
        lesson: p.lesson,
        score: p.score,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

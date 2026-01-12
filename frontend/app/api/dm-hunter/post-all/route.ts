import { NextRequest, NextResponse } from 'next/server';
import { formatForSNS, postToAllSNS } from '@/lib/dm-hunter/sns-adapter';
import { checkQuality } from '@/lib/dm-hunter/quality-checker';

// POST: 全SNSに投稿
export async function POST(request: NextRequest) {
  try {
    const { text, skipQualityCheck = false } = await request.json();

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'text is required',
      }, { status: 400 });
    }

    // 品質チェック（オプションでスキップ可能）
    if (!skipQualityCheck) {
      const score = checkQuality(text);
      if (!score.passed) {
        return NextResponse.json({
          success: false,
          error: 'Quality check failed',
          score,
        }, { status: 400 });
      }
    }

    // SNS別にフォーマット
    const formattedPosts = formatForSNS(text);

    // ベースURLを取得
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // 全SNSに投稿
    const results = await postToAllSNS(formattedPosts, baseUrl);

    // 成功/失敗をカウント
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount}/${results.length} platforms posted`,
      results,
      formattedPosts,
    });

  } catch (error: any) {
    console.error('Post all error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

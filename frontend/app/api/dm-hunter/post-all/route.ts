import { NextRequest, NextResponse } from 'next/server';
import { formatForTwitter, postToTwitterAccount, AccountType } from '@/lib/dm-hunter/sns-adapter';
import { checkQuality } from '@/lib/dm-hunter/quality-checker';

// POST: 指定アカウントに投稿
export async function POST(request: NextRequest) {
  try {
    const { text, account, target, benefit, score: inputScore, skipQualityCheck = false } = await request.json();

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'text is required',
      }, { status: 400 });
    }

    if (!account) {
      return NextResponse.json({
        success: false,
        error: 'account is required',
      }, { status: 400 });
    }

    // 品質チェック（オプションでスキップ可能）
    let score = inputScore;
    if (!skipQualityCheck && !inputScore) {
      const qualityResult = checkQuality(text);
      score = qualityResult.total;
      if (!qualityResult.passed) {
        return NextResponse.json({
          success: false,
          error: 'Quality check failed',
          score: qualityResult,
        }, { status: 400 });
      }
    }

    // Twitter投稿
    const result = await postToTwitterAccount(text, account as AccountType);

    // ログ保存
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    await fetch(`${baseUrl}/api/dm-hunter/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        target: target || 'unknown',
        benefit: benefit || 'unknown',
        account,
        score: score || 0,
        results: [result],
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: result.success,
      account,
      result,
    });

  } catch (error: any) {
    console.error('Post error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { checkQuality } from '@/lib/dm-hunter/quality-checker';

// POST: 投稿の品質をチェック
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'text is required',
      }, { status: 400 });
    }

    const score = checkQuality(text);

    return NextResponse.json({
      success: true,
      score,
    });

  } catch (error: any) {
    console.error('Quality check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * 自動学習 Cron ジョブ
 *
 * Vercel Cron: 毎日 UTC 15:30 (JST 00:30)
 * fetch-impressionsの30分後に実行
 * 高パフォーマンス投稿から成功パターンを学習
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // 学習APIを呼び出し
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/automation/learn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    console.log('[CRON] auto-learn result:', {
      timestamp: new Date().toISOString(),
      success: response.ok,
      result,
    });

    return NextResponse.json({
      success: response.ok,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('[CRON] auto-learn error:', error);
    return NextResponse.json(
      { error: 'Failed to run auto-learn', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 自動投稿 Cron ジョブ
 *
 * Vercel Cron: 毎時実行（JST 07:00-23:00）
 * UTC: 22,23,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14時
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // 最大60秒

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // ローカル開発用: CRON_SECRETがない場合はスキップ
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // 既存の自動投稿APIを呼び出し
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/automation/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.AUTO_POST_SECRET,
        dryRun: false,
      }),
    });

    const result = await response.json();

    // 結果をログ
    console.log('[CRON] Auto-post result:', {
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
    console.error('[CRON] Auto-post error:', error);
    return NextResponse.json(
      { error: 'Failed to execute auto-post', details: String(error) },
      { status: 500 }
    );
  }
}

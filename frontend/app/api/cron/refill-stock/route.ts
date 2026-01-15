/**
 * ストック補充 Cron ジョブ
 *
 * Vercel Cron: 毎日 UTC 21:00 (JST 06:00)
 * 朝の投稿前にストックを補充
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 最大5分（生成に時間がかかる）

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    // ストック状況を確認
    const statusResponse = await fetch(`${baseUrl}/api/automation/stock?view=full`);
    const status = await statusResponse.json();

    console.log('[CRON] Stock status:', status);

    // 補充が必要な場合のみ実行
    if (status.needsRefill && status.needsRefill.length > 0) {
      const refillResponse = await fetch(`${baseUrl}/api/automation/stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refill-all',
          secret: process.env.AUTO_POST_SECRET,
        }),
      });

      const refillResult = await refillResponse.json();

      console.log('[CRON] Refill result:', refillResult);

      return NextResponse.json({
        success: true,
        action: 'refilled',
        timestamp: new Date().toISOString(),
        before: status.counts,
        result: refillResult,
      });
    }

    return NextResponse.json({
      success: true,
      action: 'skipped',
      reason: 'Stock is sufficient',
      timestamp: new Date().toISOString(),
      counts: status.counts,
    });
  } catch (error) {
    console.error('[CRON] Refill error:', error);
    return NextResponse.json(
      { error: 'Failed to refill stock', details: String(error) },
      { status: 500 }
    );
  }
}

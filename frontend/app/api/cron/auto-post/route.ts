/**
 * 自動投稿 Cron ジョブ
 *
 * Vercel Cron: 毎時実行（JST 07:00-23:00）
 * UTC: 22,23,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14時
 *
 * 機能:
 * 1. 通常の自動投稿実行
 * 2. 失敗キューからのリトライ処理
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withTwitterRetry,
  getRetryablePosts,
  removeFromFailedQueue,
  addToFailedQueue,
} from '@/lib/utils/retry';

export const runtime = 'nodejs';
export const maxDuration = 120; // 最大120秒（リトライ含む）

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // ローカル開発用: CRON_SECRETがない場合はスキップ
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results: any[] = [];

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    // === 1. 失敗キューからのリトライ処理 ===
    const retryablePosts = getRetryablePosts();
    if (retryablePosts.length > 0) {
      console.log(`[CRON] Found ${retryablePosts.length} posts in retry queue`);

      for (const failedPost of retryablePosts) {
        console.log(`[CRON] Retrying post ${failedPost.id} (attempt ${failedPost.retryCount + 1})`);

        const retryResult = await withTwitterRetry(async () => {
          const res = await fetch(`${baseUrl}/api/automation/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: process.env.AUTO_POST_SECRET,
              dryRun: false,
              retryPost: failedPost,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        });

        if (retryResult.success) {
          console.log(`[CRON] Retry successful for ${failedPost.id}`);
          removeFromFailedQueue(failedPost.id);
          results.push({ type: 'retry', id: failedPost.id, success: true });
        } else {
          console.log(`[CRON] Retry failed for ${failedPost.id}: ${retryResult.error}`);
          // 再度キューに追加（retryCountが増加）
          addToFailedQueue({
            id: failedPost.id,
            account: failedPost.account,
            content: failedPost.content,
            failedAt: new Date().toISOString(),
            error: retryResult.error || 'Unknown error',
          });
          results.push({ type: 'retry', id: failedPost.id, success: false, error: retryResult.error });
        }
      }
    }

    // === 2. 通常の自動投稿実行（リトライ付き） ===
    const postResult = await withTwitterRetry(async () => {
      const res = await fetch(`${baseUrl}/api/automation/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.AUTO_POST_SECRET,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 400) {
        // 400はスケジュール外等の正常系なのでリトライしない
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return { ok: res.ok, status: res.status, data };
    });

    // 結果をログ
    console.log('[CRON] Auto-post result:', {
      timestamp: new Date().toISOString(),
      success: postResult.success,
      attempts: postResult.attempts,
      result: postResult.data,
    });

    results.push({
      type: 'scheduled',
      success: postResult.success,
      attempts: postResult.attempts,
      data: postResult.data,
    });

    return NextResponse.json({
      success: postResult.success,
      timestamp: new Date().toISOString(),
      results,
      retryQueueProcessed: retryablePosts.length,
    });
  } catch (error) {
    console.error('[CRON] Auto-post error:', error);
    return NextResponse.json(
      { error: 'Failed to execute auto-post', details: String(error), results },
      { status: 500 }
    );
  }
}

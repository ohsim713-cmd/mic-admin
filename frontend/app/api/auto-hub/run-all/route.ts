/**
 * Auto Hub - 全自動実行API
 * テキスト・画像・動画を一括で自動生成・投稿
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const LOGS_PATH = path.join(process.cwd(), 'knowledge', 'auto_hub_logs.json');

interface RunResult {
  type: 'text' | 'image' | 'video';
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  processingTime: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const {
      dryRun = false,
      runText = true,
      runImage = true,
      runVideo = true,
      secret
    } = body;

    // 認証チェック（オプション）
    const expectedSecret = process.env.AUTO_POST_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 });
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const results: RunResult[] = [];

    // 並列実行
    const promises: Promise<RunResult>[] = [];

    // テキスト投稿（DM Hunter）
    if (runText) {
      promises.push(
        (async (): Promise<RunResult> => {
          const textStart = Date.now();
          try {
            const res = await fetch(`${baseUrl}/api/dm-hunter/auto-run`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dryRun }),
            });
            const data = await res.json();
            return {
              type: 'text',
              success: data.success || res.ok,
              message: data.message || (dryRun ? 'テキストプレビュー生成完了' : 'テキスト投稿完了'),
              data: dryRun ? data.posts : data.results,
              processingTime: Date.now() - textStart,
            };
          } catch (error: any) {
            return {
              type: 'text',
              success: false,
              message: 'テキスト投稿エラー',
              error: error.message,
              processingTime: Date.now() - textStart,
            };
          }
        })()
      );
    }

    // 画像生成
    if (runImage) {
      promises.push(
        (async (): Promise<RunResult> => {
          const imageStart = Date.now();
          try {
            const res = await fetch(`${baseUrl}/api/auto-hub/generate-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dryRun, saveToStockOnly: !dryRun }),
            });
            const data = await res.json();
            return {
              type: 'image',
              success: data.success,
              message: dryRun ? '画像プレビュー生成完了' : (data.savedToStock ? 'ストックに保存完了' : '画像生成完了'),
              data: { theme: data.theme, imageUrl: dryRun ? null : data.imageUrl?.substring(0, 50) + '...' },
              processingTime: Date.now() - imageStart,
            };
          } catch (error: any) {
            return {
              type: 'image',
              success: false,
              message: '画像生成エラー',
              error: error.message,
              processingTime: Date.now() - imageStart,
            };
          }
        })()
      );
    }

    // 動画スクリプト生成
    if (runVideo) {
      promises.push(
        (async (): Promise<RunResult> => {
          const videoStart = Date.now();
          try {
            const res = await fetch(`${baseUrl}/api/auto-hub/generate-video`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dryRun, saveToStockOnly: true }),
            });
            const data = await res.json();
            return {
              type: 'video',
              success: data.success,
              message: dryRun ? '動画スクリプトプレビュー完了' : 'スクリプト生成完了',
              data: { topicId: data.topicId, script: data.script },
              processingTime: Date.now() - videoStart,
            };
          } catch (error: any) {
            return {
              type: 'video',
              success: false,
              message: '動画スクリプト生成エラー',
              error: error.message,
              processingTime: Date.now() - videoStart,
            };
          }
        })()
      );
    }

    // 全て実行
    const allResults = await Promise.all(promises);
    results.push(...allResults);

    const successCount = results.filter(r => r.success).length;
    const totalTime = Date.now() - startTime;

    console.log(`[Auto Hub] Run completed: ${successCount}/${results.length} success in ${totalTime}ms`);

    return NextResponse.json({
      success: successCount > 0,
      dryRun,
      message: `${successCount}/${results.length} 完了`,
      results,
      processingTime: totalTime,
    });

  } catch (error: any) {
    console.error('[Auto Hub] Run all error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// GET: 実行履歴を取得
export async function GET() {
  try {
    let logs: any = { text: [], image: [], video: [] };
    try {
      const data = await fs.readFile(LOGS_PATH, 'utf-8');
      logs = JSON.parse(data);
    } catch {}

    const today = new Date().toISOString().split('T')[0];

    const getStats = (items: any[]) => {
      const todayItems = items.filter((item: any) => item.timestamp?.startsWith(today));
      return {
        today: todayItems.length,
        success: todayItems.filter((item: any) => item.success).length,
        lastRun: items[0]?.timestamp || null,
      };
    };

    return NextResponse.json({
      text: getStats(logs.text || []),
      image: getStats(logs.image || []),
      video: getStats(logs.video || []),
      recentLogs: {
        text: (logs.text || []).slice(0, 5),
        image: (logs.image || []).slice(0, 5),
        video: (logs.video || []).slice(0, 5),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

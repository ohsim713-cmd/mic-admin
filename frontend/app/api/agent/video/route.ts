/**
 * 動画生成 API
 *
 * バズ投稿から台本生成 → HeyGenで動画化
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  detectBuzz,
  getBuzzQueue,
  getBuzzStats,
  getPendingForScript,
  analyzeBuzzTrends,
} from '@/lib/agent/buzz-detector';
import {
  generateScript,
  getScripts,
  processForVideo,
  getVideoProducerStats,
} from '@/lib/agent/video-producer';
import {
  generateVideo,
  getVideoStatus,
  getUsageStatus,
  createVideoFromScript,
} from '@/lib/agent/heygen-client';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats': {
        const buzzStats = getBuzzStats();
        const videoStats = getVideoProducerStats();
        const heygenUsage = getUsageStatus();

        return NextResponse.json({
          success: true,
          buzz: buzzStats,
          video: videoStats,
          heygen: heygenUsage,
        });
      }

      case 'queue': {
        const status = searchParams.get('status') as any;
        const queue = getBuzzQueue(status);
        return NextResponse.json({
          success: true,
          queue,
          count: queue.length,
        });
      }

      case 'scripts': {
        const status = searchParams.get('status') as any;
        const scripts = getScripts(status);
        return NextResponse.json({
          success: true,
          scripts,
          count: scripts.length,
        });
      }

      case 'trends': {
        const trends = await analyzeBuzzTrends();
        return NextResponse.json({
          success: true,
          ...trends,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      // バズ投稿を検出
      case 'detect': {
        const { posts, thresholds } = body;

        if (!posts || !Array.isArray(posts)) {
          return NextResponse.json(
            { error: 'posts 配列が必要です' },
            { status: 400 }
          );
        }

        const detected = await detectBuzz(posts, thresholds);

        return NextResponse.json({
          success: true,
          detected,
          count: detected.length,
        });
      }

      // 台本を生成
      case 'script': {
        const { buzzPostId, duration } = body;
        const pending = getPendingForScript();

        let targetPost;
        if (buzzPostId) {
          targetPost = pending.find(p => p.id === buzzPostId);
        } else {
          // 最もスコアの高いものを選択
          targetPost = pending.sort((a, b) => b.buzzScore - a.buzzScore)[0];
        }

        if (!targetPost) {
          return NextResponse.json({
            success: false,
            error: '台本生成対象のバズ投稿がありません',
          });
        }

        const script = await generateScript(targetPost, duration || 30);

        return NextResponse.json({
          success: true,
          script,
        });
      }

      // バズ投稿から動画素材を一括生成（台本+画像）
      case 'prepare': {
        const { buzzPostId, duration, generateImages } = body;
        const pending = getPendingForScript();

        let targetPost;
        if (buzzPostId) {
          targetPost = pending.find(p => p.id === buzzPostId);
        } else {
          targetPost = pending.sort((a, b) => b.buzzScore - a.buzzScore)[0];
        }

        if (!targetPost) {
          return NextResponse.json({
            success: false,
            error: '対象のバズ投稿がありません',
          });
        }

        const result = await processForVideo(targetPost, {
          duration: duration || 30,
          generateImages: generateImages ?? true,
        });

        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      // HeyGenで動画生成
      case 'generate': {
        const { scriptId, script: directScript } = body;

        // 使用量チェック
        const usage = getUsageStatus();
        if (!usage.canGenerate) {
          return NextResponse.json({
            success: false,
            error: `月間上限（${usage.limit}本）に達しました。残り: ${usage.remaining}本`,
          });
        }

        let scriptText = directScript;

        // scriptIdが指定されていたら取得
        if (scriptId && !scriptText) {
          const scripts = getScripts();
          const targetScript = scripts.find(s => s.id === scriptId);
          if (!targetScript) {
            return NextResponse.json({
              success: false,
              error: '台本が見つかりません',
            });
          }
          scriptText = targetScript.script;
        }

        if (!scriptText) {
          return NextResponse.json(
            { error: 'script または scriptId が必要です' },
            { status: 400 }
          );
        }

        const result = await createVideoFromScript(scriptText, {
          aspectRatio: '9:16',
          waitForCompletion: false,
        });

        return NextResponse.json(result);
      }

      // 動画ステータス確認
      case 'status': {
        const { videoId } = body;

        if (!videoId) {
          return NextResponse.json(
            { error: 'videoId が必要です' },
            { status: 400 }
          );
        }

        const status = await getVideoStatus(videoId);

        return NextResponse.json({ ...status, success: true });
      }

      // フルパイプライン（バズ→台本→動画）
      case 'full_pipeline': {
        const { buzzPostId, duration } = body;

        // 使用量チェック
        const usage = getUsageStatus();
        if (!usage.canGenerate) {
          return NextResponse.json({
            success: false,
            error: `月間上限（${usage.limit}本）に達しました`,
            usage,
          });
        }

        // バズ投稿を取得
        const pending = getPendingForScript();
        let targetPost;

        if (buzzPostId) {
          targetPost = pending.find(p => p.id === buzzPostId);
        } else {
          targetPost = pending.sort((a, b) => b.buzzScore - a.buzzScore)[0];
        }

        if (!targetPost) {
          return NextResponse.json({
            success: false,
            error: '対象のバズ投稿がありません',
          });
        }

        // 台本生成
        console.log('[Video API] Step 1: Generating script...');
        const script = await generateScript(targetPost, duration || 30);

        // 動画生成
        console.log('[Video API] Step 2: Generating video with HeyGen...');
        const videoResult = await createVideoFromScript(script.script, {
          aspectRatio: '9:16',
          waitForCompletion: false,
        });

        return NextResponse.json({
          success: videoResult.success,
          buzzPost: {
            id: targetPost.id,
            text: targetPost.text.slice(0, 100) + '...',
            buzzScore: targetPost.buzzScore,
          },
          script: {
            id: script.id,
            duration: script.duration,
          },
          video: videoResult,
          usage: getUsageStatus(),
        });
      }

      default:
        return NextResponse.json(
          { error: 'action が必要です (detect, script, prepare, generate, status, full_pipeline)' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Video API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

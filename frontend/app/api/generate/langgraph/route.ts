/**
 * LangGraph 投稿生成API
 * POST /api/generate/langgraph
 *
 * ストリーミングで進捗を返しながら投稿を生成
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateMultiplePosts,
  GenerationProgress,
} from '../../../../lib/langgraph/post-generator';
import { addPosts } from '../../../../lib/database/generated-posts';
import { learnFromPost } from '../../../../lib/database/success-patterns';
import { ACCOUNTS } from '../../../../lib/dm-hunter/sns-adapter';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5分

interface RequestBody {
  count: number;
  account: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { count = 15, account = 'liver' } = body;

    // アカウント情報取得
    const accountInfo = ACCOUNTS.find((a) => a.id === account);
    if (!accountInfo) {
      return NextResponse.json(
        { error: 'アカウントが見つかりません' },
        { status: 400 }
      );
    }

    // ストリーミングレスポンス
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // 進捗送信ヘルパー
    const sendProgress = async (progress: GenerationProgress) => {
      const data = JSON.stringify({
        type: 'progress',
        ...progress,
      });
      await writer.write(encoder.encode(`data: ${data}\n\n`));
    };

    // 生成処理を非同期で実行
    (async () => {
      try {
        const results = await generateMultiplePosts(
          count,
          account,
          accountInfo.type,
          sendProgress
        );

        // DBに保存
        const postsToSave = results.map((r) => ({
          text: r.text,
          target: r.target,
          benefit: r.benefit,
          score: r.score,
          account,
          accountType: accountInfo.type,
          revisionCount: r.revisionCount,
        }));

        const savedPosts = await addPosts(postsToSave);

        // 成功パターンを学習（スコア8以上）
        for (const result of results) {
          const scoreTotal = result.score?.total ?? 0;
          if (scoreTotal >= 8) {
            await learnFromPost(result.text, scoreTotal, false);
          }
        }

        // 完了メッセージ
        const avgScore =
          results.reduce((sum, r) => sum + (r.score?.total ?? 0), 0) / results.length;

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              totalGenerated: results.length,
              avgScore: avgScore.toFixed(1),
              posts: savedPosts.map((p) => ({
                id: p.id,
                text: p.text,
                target: p.target,
                score: p.score?.total ?? 0,
              })),
            })}\n\n`
          )
        );
      } catch (error) {
        console.error('生成エラー:', error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : '生成に失敗しました',
            })}\n\n`
          )
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * GET: 生成状況の確認
 */
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    description: 'LangGraph投稿生成API',
    usage: {
      method: 'POST',
      body: {
        count: '生成する投稿数（デフォルト: 15）',
        account: 'アカウントID（liver, chatre1, chatre2）',
      },
    },
  });
}

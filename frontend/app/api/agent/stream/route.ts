/**
 * SNS Agent Streaming API
 * Server-Sent Events で思考過程をリアルタイム配信
 */

import { NextRequest } from 'next/server';
import { chatStream, AgentMessage, AgentEvent } from '@/lib/agent/sns-agent';

// チャット履歴をメモリに保持
let chatHistory: AgentMessage[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { message, image } = body;

    if (!message && !image) {
      return new Response(JSON.stringify({ error: 'message または image が必要です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[Agent Stream] Starting stream for:', message?.slice(0, 50) || '(image only)', image ? '+ image' : '');

    // Server-Sent Events ストリームを作成
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = chatStream(message || '', chatHistory, image);

          for await (const event of generator) {
            // SSE形式でイベントを送信
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));

            // 完了イベントで履歴を更新
            if (event.type === 'done' && event.content) {
              try {
                const result = JSON.parse(event.content);
                chatHistory = result.history;
              } catch (e) {
                console.error('[Agent Stream] Failed to parse done event:', e);
              }
            }
          }

          // ストリーム終了
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: any) {
          console.error('[Agent Stream] Stream error:', error);
          const errorEvent = `data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[Agent Stream] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

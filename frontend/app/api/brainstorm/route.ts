/**
 * 壁打ちチャットAPI
 * Gemini Flashでの壁打ち用。気軽にアイデア出し。
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Gemini初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: string; // base64
}

const SYSTEM_PROMPT = `あなたは優秀なビジネスコンサルタントです。
ユーザーのビジネスアイデアや気づき、観察をもとに、一緒に考えを深めていきます。

ユーザーの事業:
- ライバー（ライブ配信者）の事務所運営
- チャットレディ事務所運営
- SNSマーケティング自動化ツール開発

壁打ちの目的:
- 競合分析（Stripchat、ポコチャなど）
- 採用マーケティングの改善
- 新しいアイデアの検討
- 業界トレンドの分析

対話のスタイル:
- 短くシンプルな返答を心がける
- 相手の考えを引き出す質問をする
- 具体的なアクションにつながるヒントを提供
- 必要に応じて構造化して整理する

画像が送られた場合は、その内容を分析して気づきを抽出してください。`;

export async function POST(request: NextRequest) {
  try {
    const { message, history, image } = await request.json() as {
      message: string;
      history?: ChatMessage[];
      image?: string; // base64 encoded
    };

    if (!message && !image) {
      return NextResponse.json({ error: 'Message or image required' }, { status: 400 });
    }

    // モデル初期化
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    // チャット履歴を構築
    const chatHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // 新しいメッセージのパーツを構築
    const messageParts: any[] = [];

    // 画像がある場合は追加
    if (image) {
      // base64からMIMEタイプを抽出
      const mimeMatch = image.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Data = image.replace(/^data:[^;]+;base64,/, '');

      messageParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    if (message) {
      messageParts.push({ text: message });
    } else if (image) {
      messageParts.push({ text: 'この画像について分析して、気づきを教えてください。' });
    }

    // システムプロンプトを最初に追加
    const fullHistory = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'はい、壁打ち相手として対応します。何でも話してください。' }] },
      ...chatHistory,
    ];

    // チャット開始
    const chat = model.startChat({
      history: fullHistory,
    });

    // メッセージ送信
    const result = await chat.sendMessage(messageParts);
    const responseText = result.response.text();

    return NextResponse.json({
      success: true,
      response: responseText,
    });
  } catch (error) {
    console.error('[Brainstorm API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', details: String(error) },
      { status: 500 }
    );
  }
}

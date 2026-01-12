import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 環境変数から API キーを取得
const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
}
const genAI = new GoogleGenerativeAI(apiKey);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { originalPost, userRequest, chatHistory, businessType } = await request.json();

    if (!originalPost || !userRequest) {
      return NextResponse.json(
        { error: '元の投稿と修正リクエストが必要です' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // チャット履歴を文字列に変換
    const historyText = (chatHistory || [])
      .map((msg: ChatMessage) => `${msg.role === 'user' ? 'ユーザー' : 'AI'}: ${msg.content}`)
      .join('\n');

    const prompt = `あなたはSNS投稿の編集アシスタントです。
ユーザーのリクエストに基づいて、元の投稿文を修正してください。

【元の投稿文】
${originalPost}

${historyText ? `【これまでの会話】\n${historyText}\n` : ''}
【ユーザーの修正リクエスト】
${userRequest}

【ルール】
1. ユーザーの指示に従って投稿文を修正する
2. 修正した投稿文のみを返す（説明は不要）
3. 元の投稿の良い部分は残しつつ、指示に沿って改善する
4. 140〜280文字程度に収める
5. 絵文字は適度に使用
6. ハッシュタグは必要に応じて含める

修正後の投稿文:`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const refinedPost = response.text() || '';

    // 「修正後の投稿文:」などのプレフィックスを除去
    const cleanedPost = refinedPost
      .replace(/^(修正後の投稿文[:：]?\s*)/i, '')
      .trim();

    return NextResponse.json({
      refinedPost: cleanedPost,
      response: cleanedPost,
    });

  } catch (error: any) {
    console.error('Refine error:', error);
    return NextResponse.json(
      { error: '修正に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

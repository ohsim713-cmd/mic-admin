import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
    try {
        const { topic, mood } = await request.json();

        if (!topic) {
            return NextResponse.json(
                { error: 'トピックまたはテーマが必要です' },
                { status: 400 }
            );
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEYが設定されていません' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const prompt = `
あなたはショート動画（TikTok/Reels/Shorts）のプロ脚本家です。
以下のテーマに基づいて、15秒程度のショート動画の台本（セリフのみ）を作成してください。

【テーマ】: ${topic}
【ムード】: ${mood || 'happy'}

【出力ルール】
- 15秒で話しきれる長さ（約60文字前後）にしてください。
- 視聴維持率を高めるため、冒頭にフック（興味を引く言葉）を入れてください。
- セリフのみを出力してください。ト書きや説明は不要です。
- 文字数は厳守してください。

出力例:
「実は、この方法を知るだけで月収が5万アップするんです。誰でもできる簡単なコツ、今から教えちゃいますね！詳しくはプロフのリンクをチェック！」
`;

        const result = await model.generateContent(prompt);
        const script = result.response.text().trim();

        return NextResponse.json({ script });

    } catch (error: any) {
        console.error('Script generation failed:', error);
        return NextResponse.json(
            { error: '台本生成に失敗しました', detail: error.message },
            { status: 500 }
        );
    }
}

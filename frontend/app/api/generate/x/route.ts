import { NextResponse } from 'next/server';
import { getModel } from '@/lib/vertex-ai';

export async function POST(request: Request) {
    try {
        const { topic, tone = 'friendly' } = await request.json();

        if (!topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }

        const model = getModel();

        const prompt = `
    あなたはプロのSNSマーケターです。チャットレディ事務所の求人応募を増やすために、以下のトピックでX（旧Twitter）の投稿文を作成してください。
    
    トピック: ${topic}
    トーン: ${tone}
    
    条件:
    - 140文字以内
    - 絵文字を適切に使用して目を引くようにする
    - 最後に共感を呼ぶ一言を入れる
    - ハッシュタグを3つ程度提案する
    - 生成結果は投稿文のみを出力してください（「はい、作成します」などの前置きは不要）
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.candidates?.[0].content.parts[0].text;

        return NextResponse.json({ content: text });
    } catch (error) {
        console.error('Error generating content:', error);
        return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
    }
}

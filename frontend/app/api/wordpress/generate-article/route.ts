import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    buildEnrichedKnowledgeContext,
    buildChatladyKnowledgeContext,
} from '@/lib/langgraph/knowledge-loader';

const apiKey = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
    try {
        const { keyword, targetAudience, articleLength = 'medium', tone = 'professional', businessType = 'chat-lady' } = await request.json();

        if (!keyword) {
            return NextResponse.json(
                { error: 'キーワードが必要です' },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        // ビジネスタイプに応じたナレッジコンテキストを取得
        const knowledgeContext = businessType === 'liver-agency'
            ? await buildEnrichedKnowledgeContext()
            : await buildChatladyKnowledgeContext();

        const businessLabel = businessType === 'liver-agency' ? 'ライバー事務所' : 'チャットレディ事務所';

        // 記事の長さに応じた文字数を設定
        let charCount = '2000-2500';
        if (articleLength === 'short') charCount = '1000-1500';
        if (articleLength === 'long') charCount = '3000-4000';

        // トーンに応じたスタイルを設定
        let styleGuide = '';
        if (tone === 'professional') {
            styleGuide = '専門的で信頼感のある文体。データや具体例を多用。';
        } else if (tone === 'casual') {
            styleGuide = '親しみやすく、読者に語りかけるような文体。';
        } else if (tone === 'persuasive') {
            styleGuide = '行動を促す、説得力のある文体。問題提起と解決策を明確に。';
        }

        const prompt = `あなたは${businessLabel}の代表で、SEO最適化されたブログ記事を書くプロのライターです。

【事務所の知識・業界情報】
${knowledgeContext}

以下の情報に基づいて、SEO最適化されたブログ記事を作成してください。

【メインキーワード】
${keyword}

【ターゲット読者】
${targetAudience || '一般読者'}

【文字数】
${charCount}文字程度

【文体・トーン】
${styleGuide}

【記事構成の要件】
1. **タイトル（H1）**: キーワードを含む魅力的なタイトル（32文字以内推奨）
2. **導入文（リード）**: 読者の悩みに共感し、この記事を読むメリットを明確に
3. **本文**: 
   - H2見出しを3-5個使用
   - 各H2の下にH3見出しを適宜使用
   - 具体例、データ、体験談を含める
   - 読みやすい短い段落（2-3文ごと）
4. **まとめ**: 要点を簡潔に、明確なCTA（行動喚起）を含める

【SEO要件】
- タイトルと最初のH2にキーワードを含める
- メタディスクリプション（120文字以内）を別途作成
- 共起語・関連キーワードを自然に織り込む

【出力形式】
以下のJSON形式で出力してください：
{
  "title": "記事タイトル",
  "metaDescription": "メタディスクリプション",
  "content": "記事本文（HTMLタグ使用可）",
  "suggestedTags": ["タグ1", "タグ2", "タグ3"]
}

JSONのみを出力してください。`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // JSONを抽出
        let articleData;
        try {
            // JSONブロックを探す
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                articleData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('JSON not found in response');
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            // パースに失敗した場合は、テキストをそのまま返す
            return NextResponse.json({
                title: keyword + 'について',
                metaDescription: '',
                content: responseText,
                suggestedTags: [keyword],
                rawResponse: true
            });
        }

        return NextResponse.json({
            ...articleData,
            keyword,
            generatedAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Article generation failed:', error);
        return NextResponse.json(
            { error: '記事生成に失敗しました', detail: error.message },
            { status: 500 }
        );
    }
}

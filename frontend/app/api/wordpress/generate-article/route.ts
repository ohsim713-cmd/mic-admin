import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    buildEnrichedKnowledgeContext,
    buildChatladyKnowledgeContext,
} from '@/lib/langgraph/knowledge-loader';
import {
    buildAIOOptimizedPrompt,
    getDefaultFAQs,
    enhanceContentForAIO,
    generateFAQSchema,
    generateArticleSchema,
    getAuthorityStats,
    type FAQItem,
} from '@/lib/seo/aio-optimizer';

const apiKey = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
    try {
        const {
            keyword,
            targetAudience,
            articleLength = 'medium',
            tone = 'professional',
            businessType = 'chat-lady',
            enableAIO = true  // AIO最適化を有効化（デフォルト: true）
        } = await request.json();

        if (!keyword) {
            return NextResponse.json(
                { error: 'キーワードが必要です' },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

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

        // 権威性データを取得
        const authorityStats = getAuthorityStats(businessType as 'liver-agency' | 'chat-lady').slice(0, 4);
        const authorityContext = authorityStats.map(s => `- ${s.stat}${s.context}`).join('\n');

        // AIO最適化プロンプトを構築
        const prompt = enableAIO
            ? `あなたは${businessLabel}の代表で、Google AI Overviewsに引用されやすいSEO記事を書くプロです。

【事務所の知識・業界情報】
${knowledgeContext}

【権威性データ（必ず記事内に含める）】
${authorityContext}

【メインキーワード】
${keyword}

【ターゲット読者】
${targetAudience || '一般読者'}

【文字数】
${charCount}文字程度

【文体・トーン】
${styleGuide}

【AIO最適化要件】
1. **定義セクション**: 冒頭で「〇〇とは、△△です。」と明確に定義
2. **数字を含む文章**: 統計、実績、期間など具体的な数字を多用
3. **リスト形式**: 箇条書きや番号リストを活用（AIが抽出しやすい）
4. **FAQ形式**: よくある質問と回答を3-5個含める
5. **ステップガイド**: 手順を含める場合は番号付きリストで

【構成】
1. H1: キーワードを含む魅力的なタイトル（32文字以内）
2. 導入文: 定義 + 読者のメリット
3. H2: 〇〇のメリット（リスト形式）
4. H2: 〇〇の始め方/選び方（ステップ形式）
5. H2: よくある質問（FAQ 3-5個）
6. H2: まとめ + CTA

【SEO要件】
- タイトルと最初のH2にキーワードを含める
- メタディスクリプション（120文字以内）を別途作成
- 共起語・関連キーワードを自然に織り込む

【出力形式】
JSON:
{
  "title": "記事タイトル",
  "metaDescription": "メタディスクリプション",
  "content": "記事本文（HTML）",
  "faqs": [{ "question": "質問", "answer": "回答" }],
  "suggestedTags": ["タグ1", "タグ2"]
}

JSONのみを出力してください。`
            : `あなたは${businessLabel}の代表で、SEO最適化されたブログ記事を書くプロのライターです。

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
JSON:
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
        let articleData: any;
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

        // AIO最適化: FAQと構造化データを追加
        let schemas: object[] = [];
        let faqs: FAQItem[] = articleData.faqs || [];

        if (enableAIO) {
            // FAQがなければデフォルトを使用
            if (!faqs || faqs.length === 0) {
                faqs = getDefaultFAQs(keyword, businessType as 'liver-agency' | 'chat-lady');
            }

            // FAQ構造化データ
            const faqSchema = generateFAQSchema(faqs);

            // Article構造化データ
            const articleSchema = generateArticleSchema({
                title: articleData.title,
                description: articleData.metaDescription,
                datePublished: new Date().toISOString(),
                author: businessLabel,
                publisher: businessLabel,
            });

            schemas = [faqSchema, articleSchema];

            // コンテンツにFAQセクションがなければ追加
            if (articleData.content && !articleData.content.includes('よくある質問')) {
                const { enhancedContent } = enhanceContentForAIO(
                    articleData.content,
                    faqs,
                    businessType as 'liver-agency' | 'chat-lady'
                );
                articleData.content = enhancedContent;
            }
        }

        return NextResponse.json({
            ...articleData,
            keyword,
            faqs,
            schemas,
            schemaScripts: schemas.map(s =>
                `<script type="application/ld+json">${JSON.stringify(s)}</script>`
            ).join('\n'),
            generatedAt: new Date().toISOString(),
            aioOptimized: enableAIO
        });

    } catch (error: any) {
        console.error('Article generation failed:', error);
        return NextResponse.json(
            { error: '記事生成に失敗しました', detail: error.message },
            { status: 500 }
        );
    }
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    buildEnrichedKnowledgeContext,
    buildChatladyKnowledgeContext,
} from "@/lib/langgraph/knowledge-loader";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(request: Request) {
    try {
        const { title, keywords, targetLength, tone, businessType = 'chat-lady' } = await request.json();

        if (!title) {
            return new Response(JSON.stringify({
                error: "タイトルは必須です"
            }), { status: 400 });
        }

        // ビジネスタイプに応じたナレッジコンテキストを取得
        const knowledgeContext = businessType === 'liver-agency'
            ? await buildEnrichedKnowledgeContext()
            : await buildChatladyKnowledgeContext();

        // ビジネスタイプに応じた用語設定
        const businessLabel = businessType === 'liver-agency' ? 'ライバー事務所' : 'チャットレディ事務所';

        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `
あなたは${businessLabel}の代表で、プロのコンテンツライターです。
SEOに強く、読者を惹きつけるWordPress記事を作成してください。

### 記事情報
タイトル: ${title}
${keywords ? `キーワード: ${keywords}` : ""}
目標文字数: ${targetLength || "2000-3000"}文字
トーン: ${tone || "親しみやすく、専門的"}

### 事務所の知識・業界情報
${knowledgeContext}

### 執筆ルール
1. **構成**:
   - 導入（問題提起・共感）
   - 本文（見出しを使った構造化された内容）
   - まとめ（行動を促す結論）

2. **見出しの使い方**:
   - H2: ## 大見出し
   - H3: ### 小見出し
   - 適切に階層化して可読性を高める

3. **スタイル**:
   - 段落は3-4文で区切る
   - 箇条書きを活用して読みやすく
   - 専門用語は分かりやすく説明
   - 実例や具体的な数字を盛り込む

4. **SEO対策**:
   - 自然にキーワードを含める（キーワードスタッフィングNG）
   - メタディスクリプション用の要約を最後に含める

5. **禁止事項**:
   - ハッシュタグは使わない
   - 過度な装飾や絵文字
   - 誇大表現

記事本文のみを出力してください。挨拶や前置きは不要です。
`;

        // ストリーミングで出力
        const result = await model.generateContentStream(prompt);

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        controller.enqueue(encoder.encode(chunkText));
                    }
                    controller.close();
                } catch (e) {
                    controller.error(e);
                }
            },
        });

        return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });

    } catch (error: any) {
        console.error('WordPress Generation Error:', {
            message: error.message,
            stack: error.stack,
        });
        return new Response(JSON.stringify({
            error: error.message,
            detail: "記事生成中にエラーが発生しました"
        }), { status: 500 });
    }
}

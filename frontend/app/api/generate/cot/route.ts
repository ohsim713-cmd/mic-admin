/**
 * CoT (Chain of Thought) 投稿生成API
 * 思考過程を段階的に見せながら投稿を生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSuccessPatterns } from '@/lib/database/success-patterns-db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface CoTStep {
  step: 'thinking' | 'draft' | 'analysis' | 'improvement' | 'final';
  title: string;
  content: string;
  timestamp: string;
}

export interface CoTResult {
  steps: CoTStep[];
  finalPost: string;
  score: number;
}

// ストリーミング用のエンコーダー
function createSSEMessage(data: CoTStep): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { topic, target, benefit, stream = true } = body;

    // 成功パターンを取得
    let patterns: string[] = [];
    try {
      patterns = await getSuccessPatterns();
    } catch {
      patterns = ['ぶっちゃけ〜って思ってる人へ', '気になったらDMで💬'];
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // ストリーミングレスポンス
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const steps: CoTStep[] = [];

          // Step 1: 思考（何を書くか考える）
          const thinkingStep: CoTStep = {
            step: 'thinking',
            title: '🤔 考え中...',
            content: '',
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(encoder.encode(createSSEMessage(thinkingStep)));

          const thinkingPrompt = `あなたはSNS投稿のプロです。
以下の条件で投稿を作成する前に、まず何を書くべきか考えてください。

【条件】
- トピック: ${topic || 'ライバーの魅力'}
- ターゲット: ${target || '20-30代女性'}
- 訴求ポイント: ${benefit || '高収入・自由な働き方'}
- 成功パターン参考: ${patterns.slice(0, 3).join(', ')}

【思考すべきこと】
1. ターゲットの悩みは何か？
2. どんな感情に訴えかけるか？
3. どんなフックで注目を引くか？
4. どんなCTAで行動を促すか？

箇条書きで簡潔に思考過程を出力してください（200文字以内）`;

          const thinkingResult = await model.generateContent(thinkingPrompt);
          const thinkingText = thinkingResult.response.text();

          const thinkingComplete: CoTStep = {
            step: 'thinking',
            title: '🤔 分析完了',
            content: thinkingText,
            timestamp: new Date().toISOString(),
          };
          steps.push(thinkingComplete);
          controller.enqueue(encoder.encode(createSSEMessage(thinkingComplete)));

          // Step 2: 原案作成
          const draftStep: CoTStep = {
            step: 'draft',
            title: '✍️ 原案を作成中...',
            content: '',
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(encoder.encode(createSSEMessage(draftStep)));

          const draftPrompt = `以下の思考をもとに、SNS投稿の原案を作成してください。

【思考】
${thinkingText}

【条件】
- 140文字以内
- 絵文字を1-2個使用
- 自然な口語体

投稿文のみを出力してください：`;

          const draftResult = await model.generateContent(draftPrompt);
          const draftText = draftResult.response.text();

          const draftComplete: CoTStep = {
            step: 'draft',
            title: '✍️ 原案',
            content: draftText,
            timestamp: new Date().toISOString(),
          };
          steps.push(draftComplete);
          controller.enqueue(encoder.encode(createSSEMessage(draftComplete)));

          // Step 3: 自己分析
          const analysisStep: CoTStep = {
            step: 'analysis',
            title: '🔍 自己分析中...',
            content: '',
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(encoder.encode(createSSEMessage(analysisStep)));

          const analysisPrompt = `以下の投稿を自己分析してください。

【投稿】
${draftText}

【分析項目】
1. 良い点（1-2個）
2. 改善点（1-2個）
3. スコア（10点満点）

簡潔に出力してください（150文字以内）：`;

          const analysisResult = await model.generateContent(analysisPrompt);
          const analysisText = analysisResult.response.text();

          const analysisComplete: CoTStep = {
            step: 'analysis',
            title: '🔍 分析結果',
            content: analysisText,
            timestamp: new Date().toISOString(),
          };
          steps.push(analysisComplete);
          controller.enqueue(encoder.encode(createSSEMessage(analysisComplete)));

          // Step 4: 改善
          const improvementStep: CoTStep = {
            step: 'improvement',
            title: '💡 改善中...',
            content: '',
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(encoder.encode(createSSEMessage(improvementStep)));

          const improvementPrompt = `以下の原案と分析をもとに、投稿を改善してください。

【原案】
${draftText}

【分析】
${analysisText}

【改善の方針】
- 分析で指摘した改善点を反映
- 140文字以内を維持
- より刺さる表現に

改善した投稿文のみを出力してください：`;

          const improvementResult = await model.generateContent(improvementPrompt);
          const improvedText = improvementResult.response.text();

          const improvementComplete: CoTStep = {
            step: 'improvement',
            title: '💡 改善版',
            content: improvedText,
            timestamp: new Date().toISOString(),
          };
          steps.push(improvementComplete);
          controller.enqueue(encoder.encode(createSSEMessage(improvementComplete)));

          // Step 5: 最終評価
          const finalStep: CoTStep = {
            step: 'final',
            title: '✨ 完成',
            content: '',
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(encoder.encode(createSSEMessage(finalStep)));

          const scorePrompt = `以下の投稿を10点満点で評価してください。数字のみ出力：

${improvedText}`;

          const scoreResult = await model.generateContent(scorePrompt);
          const scoreText = scoreResult.response.text();
          const score = parseInt(scoreText.match(/\d+/)?.[0] || '7', 10);

          const finalComplete: CoTStep = {
            step: 'final',
            title: '✨ 完成！',
            content: `${improvedText}\n\n📊 スコア: ${score}/10`,
            timestamp: new Date().toISOString(),
          };
          steps.push(finalComplete);
          controller.enqueue(encoder.encode(createSSEMessage(finalComplete)));

          // 終了シグナル
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 非ストリーミング（一括レスポンス）
    const steps: CoTStep[] = [];

    // 簡略版の一括生成
    const fullPrompt = `SNS投稿を作成してください。

【条件】
- トピック: ${topic || 'ライバーの魅力'}
- ターゲット: ${target || '20-30代女性'}
- 訴求: ${benefit || '高収入・自由な働き方'}

以下の形式で出力：
【思考】（50文字）
【原案】（140文字以内）
【分析】（50文字）
【改善版】（140文字以内）
【スコア】（数字/10）`;

    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();

    return NextResponse.json({
      success: true,
      steps,
      rawOutput: text,
    });

  } catch (error: unknown) {
    console.error('[CoT Generate] Error:', error);
    return NextResponse.json(
      { error: '生成に失敗しました', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

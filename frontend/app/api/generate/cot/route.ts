/**
 * CoT (Chain of Thought) 投稿生成API
 * 思考過程を段階的に見せながら投稿を生成
 * 豊富なナレッジベースを活用した高品質な投稿生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getWeightedPatternsByCategory } from '@/lib/database/success-patterns-db';
import { promises as fs } from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ナレッジベースのキャッシュ
let knowledgeCache: {
  successStories: any[];
  viralStructures: any[];
  templates: any;
  loadedAt: number;
} | null = null;

/**
 * ナレッジベースを読み込む
 */
async function loadKnowledgeBase() {
  // キャッシュが5分以内なら再利用
  if (knowledgeCache && Date.now() - knowledgeCache.loadedAt < 5 * 60 * 1000) {
    return knowledgeCache;
  }

  const knowledgePath = path.join(process.cwd(), 'knowledge');

  try {
    // 成功事例を読み込み
    const successStoriesRaw = await fs.readFile(
      path.join(knowledgePath, 'success_stories.json'),
      'utf-8'
    );
    const successStoriesData = JSON.parse(successStoriesRaw);

    // バイラルテンプレートを読み込み
    const viralTemplatesRaw = await fs.readFile(
      path.join(knowledgePath, 'liver_viral_templates.json'),
      'utf-8'
    );
    const viralTemplatesData = JSON.parse(viralTemplatesRaw);

    // Xテンプレートを読み込み
    const xTemplatesRaw = await fs.readFile(
      path.join(knowledgePath, 'x_templates.json'),
      'utf-8'
    );
    const xTemplatesData = JSON.parse(xTemplatesRaw);

    knowledgeCache = {
      successStories: successStoriesData.successStories || [],
      viralStructures: viralTemplatesData.viral_structures || [],
      templates: xTemplatesData,
      loadedAt: Date.now(),
    };

    console.log('[CoT] ナレッジ読み込み完了:', {
      successStories: knowledgeCache.successStories.length,
      viralStructures: knowledgeCache.viralStructures.length,
      templates: Object.keys(xTemplatesData).length,
    });

    return knowledgeCache;
  } catch (error) {
    console.error('[CoT] Failed to load knowledge base:', error);
    return {
      successStories: [],
      viralStructures: [],
      templates: {},
      loadedAt: Date.now(),
    };
  }
}

/**
 * ランダムに成功事例を選択
 */
function selectRandomStories(stories: any[], count: number = 2): any[] {
  const shuffled = [...stories].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * バイラル構造を選択
 */
function selectViralStructure(structures: any[]): any {
  if (structures.length === 0) return null;
  return structures[Math.floor(Math.random() * structures.length)];
}

export interface CoTStep {
  step: 'thinking' | 'draft' | 'analysis' | 'improvement' | 'final' | 'sources';
  title: string;
  content: string;
  timestamp: string;
  sources?: {
    files: string[];
    stories: Array<{ persona: string; result: string }>;
    viralStructure: string | null;
    patterns: { hooks: number; ctas: number; benefits: number };
  };
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

    // ナレッジベースを読み込み
    const knowledge = await loadKnowledgeBase();

    // カテゴリ別成功パターンを取得
    let patterns = { hooks: [] as any[], ctas: [] as any[], benefits: [] as any[] };
    try {
      patterns = await getWeightedPatternsByCategory();
    } catch {
      patterns = {
        hooks: [{ text: 'ぶっちゃけ〜って思ってる人へ', score: 8.5 }],
        ctas: [{ text: '気になったらDMで💬', score: 8.3 }],
        benefits: [{ text: '月30万以上', score: 8.4 }],
      };
    }

    // 成功事例をランダム選択
    const selectedStories = selectRandomStories(knowledge.successStories, 2);

    // バイラル構造を選択
    const viralStructure = selectViralStructure(knowledge.viralStructures);

    // テンプレートからバズりやすいフックを取得
    const viralFormulas = knowledge.templates?.viralFormulas || {};
    const openingHooks = knowledge.templates?.postingPatterns?.openingHooks || [];

    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    // ストリーミングレスポンス
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const steps: CoTStep[] = [];

          // Step 0: 使用データソースを表示
          const sourcesStep: CoTStep = {
            step: 'sources',
            title: '📚 使用データソース',
            content: '',
            timestamp: new Date().toISOString(),
            sources: {
              files: [
                'knowledge/success_stories.json',
                'knowledge/liver_viral_templates.json',
                'knowledge/x_templates.json',
                'DB: success_patterns',
              ],
              stories: selectedStories.map(s => ({
                persona: s.persona,
                result: `${s.results.initialMonth}→${s.results.peakMonth}(${s.period})`,
              })),
              viralStructure: viralStructure?.name || null,
              patterns: {
                hooks: patterns.hooks.length,
                ctas: patterns.ctas.length,
                benefits: patterns.benefits.length,
              },
            },
          };
          steps.push(sourcesStep);
          controller.enqueue(encoder.encode(createSSEMessage(sourcesStep)));

          // Step 1: 思考（何を書くか考える）
          const thinkingStep: CoTStep = {
            step: 'thinking',
            title: '🤔 考え中...',
            content: '',
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(encoder.encode(createSSEMessage(thinkingStep)));

          // 成功事例データを整形
          const storyExamples = selectedStories.map(s =>
            `【${s.persona}】${s.period}で初月${s.results.initialMonth}→${s.results.peakMonth}達成。ポイント: ${s.keyFactors.join('/')}。本人コメント:「${s.quote}」`
          ).join('\n');

          console.log('[CoT] 投入データ:', {
            selectedStoriesCount: selectedStories.length,
            storyExamples: storyExamples.substring(0, 200),
            viralStructure: viralStructure?.name || 'なし',
          });

          // 成功パターンを整形
          const hookPatterns = patterns.hooks.slice(0, 5).map(h => h.text).join('、');
          const ctaPatterns = patterns.ctas.slice(0, 3).map(c => c.text).join('、');
          const benefitPatterns = patterns.benefits.slice(0, 3).map(b => b.text).join('、');

          // バイラル構造情報
          const viralInfo = viralStructure
            ? `【今回使うバイラル構造: ${viralStructure.name}】\n流れ: ${viralStructure.flow}\n参考フック: ${viralStructure.example_hook}`
            : '';

          const thinkingPrompt = `あなたは10年以上の経験を持つSNSマーケターです。
以下の豊富なデータを分析し、高品質な投稿戦略を立ててください。

━━━━━━━━━━━━━━━━━━━━
📌 基本条件
━━━━━━━━━━━━━━━━━━━━
- トピック: ${topic || 'ライバーの魅力'}
- ターゲット: ${target || '20-30代女性'}
- 訴求ポイント: ${benefit || '高収入・自由な働き方'}

━━━━━━━━━━━━━━━━━━━━
📊 成功事例データ（実績ベース）
━━━━━━━━━━━━━━━━━━━━
${storyExamples || '成功事例なし'}

━━━━━━━━━━━━━━━━━━━━
🎯 高スコア成功パターン（実証済み）
━━━━━━━━━━━━━━━━━━━━
【フック（書き出し）】: ${hookPatterns || 'ぶっちゃけ〜、正直〜'}
【CTA（誘導）】: ${ctaPatterns || '気になったらDMで💬'}
【ベネフィット表現】: ${benefitPatterns || '月30万以上'}

━━━━━━━━━━━━━━━━━━━━
🔥 バイラル構造
━━━━━━━━━━━━━━━━━━━━
${viralInfo || 'PAS公式: 問題提起 → 煽り → 解決策'}

━━━━━━━━━━━━━━━━━━━━
💡 分析してほしいこと
━━━━━━━━━━━━━━━━━━━━

1. 【ターゲットインサイト】
   - 成功事例の人物像とターゲットの共通点は？
   - 彼女たちが「最初の一歩」を踏み出した理由は？
   - どの成功事例の要素が今回一番刺さる？

2. 【最強フックの設計】
   - 上記の成功パターンから、今回使うべきフックは？
   - なぜそれが刺さる？（心理的根拠）

3. 【差別化ポイント】
   - 「怪しい」と思われない具体的な数字は？
   - 他の求人投稿と違う切り口は？

4. 【CTAの選択】
   - どのCTAパターンを使う？なぜ？

各項目を2-3文で具体的に出力してください：`;


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

          const draftPrompt = `以下の分析をもとに、SNS投稿の原案を作成してください。

【戦略分析】
${thinkingText}

【成功パターンから学んだルール】
- フック例: ${hookPatterns || 'ぶっちゃけ〜'}
- CTA例: ${ctaPatterns || 'DMで💬'}
- ベネフィット例: ${benefitPatterns || '月30万以上'}

【必須条件】
- 140文字以内
- 絵文字は最後に1個だけ
- 自然な口語体（「〜だよね」「〜じゃん」OK）
- 成功パターンのフックを1つ取り入れる
- 具体的な数字を1つ入れる

投稿文のみを出力してください（解説不要）：`;

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

          const analysisPrompt = `あなたはSNS投稿の改善スペシャリストです。
以下の投稿を分析し、「問題点 → 具体的な直し方」をセットで提案してください。

【投稿】
${draftText}

【分析フォーマット】

## 📊 現状スコア: ?/10

## 🔍 改善ポイント（最大3つ）

【1】○○が弱い
→ 直し方: 「〜〜」を「〜〜」に変える
→ 例文: ここをこう変えると...

【2】○○が足りない
→ 直し方: 〜〜を追加する
→ 例文: ...

【3】（あれば）
→ 直し方: ...

## ✨ このまま活かすべき点
- （良い部分を1-2個）

※批判だけで終わらず、必ず「→ 直し方」「→ 例文」をつける
※現状スコアは正直に（5-7点が普通）`;

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

          // 成功事例から具体的な数字を抽出
          const concreteNumbers = selectedStories.length > 0
            ? selectedStories.map(s => `${s.results.initialMonth}→${s.results.peakMonth}(${s.period})`).join('、')
            : '月8万→月32万(3ヶ月)';

          const improvementPrompt = `あなたはバズ投稿を量産するプロです。
以下の原案と分析をもとに、劇的に改善してください。

【原案】
${draftText}

【分析結果】
${analysisText}

【実際の成功数字（使っていい）】
${concreteNumbers}

【改善ルール（厳守）】
1. 冒頭3文字で「え？」と思わせる
   - 使えるフック: ${openingHooks.slice(0, 5).join('、') || '【衝撃】、ぶっちゃけ、正直、実は'}
   - 数字で始めるのも効果的

2. 「あるある」を1つ入れる
   - ターゲットが「それ私！」と思う具体的シーン
   - 例: 「給料日前はカツカツ」「通勤電車がしんどい」

3. 怪しさを消す
   - 上記の実際の成功数字を使う
   - 「簡単」「誰でも」「楽して」は絶対禁止
   - 体験談風の表現を使う

4. CTAは1つだけ
   - 使えるCTA: ${ctaPatterns || '気になったらDMで💬'}

5. 絵文字は最後に1個だけ

改善した投稿文のみを出力（140文字以内、解説不要）：`;

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

          const scorePrompt = `以下の投稿を10点満点で評価。
8点以上: バズる可能性あり
6-7点: まあまあ
5点以下: 作り直し

【投稿】
${improvedText}

【評価基準】
- 冒頭のインパクト（2点）
- 共感ポイント（2点）
- 信頼性（2点）
- 行動喚起力（2点）
- 独自性（2点）

数字のみ出力：`;

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

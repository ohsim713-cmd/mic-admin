/**
 * LangGraph 投稿生成ワークフロー
 * RESEARCH → DRAFT → REVIEW → REVISE → POLISH
 */

import { StateGraph, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  PostGeneratorState,
  PostGeneratorStateType,
  TARGETS,
  BENEFITS,
  QualityScore,
  WorkflowStep,
} from './state';
import { getSuccessPatterns } from '../database/success-patterns-db';
import { getRandomHook, buildEnrichedKnowledgeContext, buildChatladyKnowledgeContext } from './knowledge-loader';
import { initPhoenix, tracePostGeneration, recordQualityScore } from '../phoenix/client';

// Phoenix 初期化（サーバー起動時に1回だけ）
try {
  initPhoenix();
} catch {
  // Phoenix が起動していない場合は無視
}

// Gemini モデル初期化（GEMINI_API_KEY を使用）
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  temperature: 0.8,
  apiKey,
});

const reviewModel = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  temperature: 0.3,
  apiKey,
});

// ========== ノード関数 ==========

/**
 * RESEARCH: メリットをメイン軸にし、ターゲットをサブ要素として選定
 */
async function researchNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  // メリットをメイン軸として使用（必須）、ターゲットはサブ要素としてランダム付与
  const benefit = state.benefit || BENEFITS[Math.floor(Math.random() * BENEFITS.length)];
  const target = state.target || TARGETS[Math.floor(Math.random() * TARGETS.length)];

  // 成功パターンをDBから取得
  let successPatterns: string[] = [];
  try {
    const patterns = await getSuccessPatterns();
    successPatterns = patterns.slice(0, 3);
  } catch {
    // DBがない場合はデフォルトパターン
    successPatterns = [
      'ぶっちゃけ〜って思ってる人へ',
      '正直、〜だと思ってない？',
      '〜なんて無理って思ってた私が',
    ];
  }

  // ナレッジベースからフックパターンを追加
  try {
    const hook = await getRandomHook();
    if (hook && !successPatterns.includes(hook)) {
      successPatterns.push(hook);
    }
  } catch {
    // エラーは無視
  }

  return {
    target,
    benefit,
    successPatterns,
    currentStep: 'draft' as WorkflowStep,
  };
}

/**
 * DRAFT: 投稿文を生成（ナレッジベース活用）
 */
async function draftNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const { target, benefit, accountType, successPatterns, feedback } = state;

  // ナレッジコンテキストを取得（毎回新鮮な情報を使う - バリエーション向上のため）
  let knowledgeContext = '';
  try {
    if (accountType === 'ライバー') {
      // ライバー用はリッチなコンテキストを毎回生成（ランダム情報が含まれる）
      knowledgeContext = await buildEnrichedKnowledgeContext();
    } else {
      // チャトレ用は既存のコンテキストを使用
      knowledgeContext = await buildChatladyKnowledgeContext();
    }
  } catch {
    // ナレッジ取得失敗は無視
  }

  const patternsText = successPatterns.length > 0
    ? `\n\n【参考にする成功パターン】\n${successPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  const feedbackText = feedback
    ? `\n\n【前回のフィードバック（必ず改善すること）】\n${feedback}`
    : '';

  const prompt = `あなたは${accountType}事務所のSNS担当者です。DMでの問い合わせ獲得を目的とした投稿文を作成してください。

【ターゲット】${target}
【訴求ポイント】${benefit}
${knowledgeContext}
${patternsText}
${feedbackText}

【絶対に守るルール】
- 一人称は「事務所」「当事務所」「うち」など事務所視点で書く
- ※「私」「僕」など個人の一人称は絶対に使わない（事務所が発信している文章）
- 所属ライバーの実績を紹介する形で書く（「うちのライバーさんが〜」「所属メンバーの○○さんは〜」など）

【重要な条件】
- ★★冒頭は必ず【今回使う冒頭フレーズ】をそのまま使う（「ぶっちゃけ」で始めない）
- 280〜320文字（中長文で深く刺す）
- ★上記の【今回使う具体的な情報】を必ず1つ以上盛り込む（実例、年齢戦略、収入シミュレーション、統計など）
- 具体的な数字を入れる（バリエーションを持たせて毎回違う数字を使う）
  例: 月20万〜50万、週2〜4日、初月10万、3ヶ月で月収○万円達成 など
- ※「時給16,500円」は使用禁止（他の表現で収入を伝える）
- 実績や事例を自然に盛り込む（「うちの30代のライバーさんが3ヶ月で〜」「40代で始めた方が今では〜」など具体的に）
- プラットフォーム名（Pococha、17LIVE、IRIAM等）を自然に入れる
- 最後に「DMで」「気軽に」などCTAを入れる
- 絵文字は1-2個程度
- ハッシュタグは不要
- 2-3行ごとに空行を入れて読みやすく

投稿文のみを出力してください:`;

  const response = await model.invoke(prompt);
  const draftText = response.content as string;

  return {
    draftText,
    currentStep: 'review' as WorkflowStep,
  };
}

/**
 * REVIEW: 品質スコアを評価（LLM as a Judge - 15点満点）
 */
async function reviewNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const { draftText, target, benefit } = state;

  const prompt = `あなたは「SNSマーケティングの厳格な批評家」です。

【あなたの役割】
- 100件以上の募集投稿を分析してきたプロの目線で評価
- 甘い評価は禁止。「まあまあ」「普通」は存在しない
- ターゲットの立場になって「本当にDMしたくなるか？」を厳しく判断

【評価の哲学】
- 「見慣れた表現」は即減点
- 「具体性のない約束」は信用しない
- 「押しつけがましいCTA」は逆効果と判断
- タイムライン上で「1秒で目に留まるか」を重視

---

【評価対象の投稿文】
${draftText}

【ターゲット】${target}
【訴求ポイント】${benefit}

---

以下の基準で厳格に採点してください。甘い評価は禁止です。

=== 既存評価項目（10点満点） ===

1. empathy (共感・本音感): 0-3点
   - 0点: 機械的、宣伝臭い
   - 1点: 多少の共感要素があるが表面的
   - 2点: ターゲットの悩みに寄り添っている
   - 3点: 「この人、分かってる」と思わせる深い共感

2. benefit (メリット提示): 0-2点
   - 0点: 抽象的な約束のみ
   - 1点: 数字はあるが具体性に欠ける
   - 2点: 具体的で信憑性のあるメリット提示

3. cta (行動喚起): 0-2点
   - 0点: CTAがない、または押しつけがましい
   - 1点: CTAはあるがありきたり
   - 2点: 自然にDMしたくなる導線

4. credibility (信頼性): 0-2点
   - 0点: 怪しい、詐欺っぽい
   - 1点: 事務所としての信頼感が薄い
   - 2点: 実績・事例があり信頼できる

5. urgency (緊急性): 0-1点
   - 0点: 「いつでもいい」感
   - 1点: 「今」行動したくなる要素がある

=== 新規評価項目（5点満点）===

6. originality (独自性・差別化): 0-2点
   - 0点: 「どこかで見た」感がある、テンプレート的
   - 1点: 部分的に新しい要素がある
   - 2点: 明確に差別化、独自の視点・エピソード

7. engagement (エンゲージメント予測): 0-2点
   - 0点: 一方的な宣伝、問いかけなし
   - 1点: 共感要素あり、ただし会話誘発は弱い
   - 2点: 「自分のことだ」と思わせる、リプしたくなる

8. scrollStop (スクロール停止力): 0-1点
   - 0点: 冒頭が平凡、タイムラインで流される
   - 1点: 冒頭3-5文字で「え？」と思わせる

---

=== 出力形式（JSONのみ） ===

{
  "empathy": 数値,
  "benefit": 数値,
  "cta": 数値,
  "credibility": 数値,
  "urgency": 数値,
  "originality": 数値,
  "engagement": 数値,
  "scrollStop": 数値,
  "total": 合計値(0-15),
  "feedback": "12点未満の場合の具体的な改善指示",
  "strengths": ["良い点1", "良い点2", "良い点3"],
  "weaknesses": ["改善点1", "改善点2", "改善点3"]
}

【重要】
- 各項目を独立して厳格に評価
- 「なんとなく良い」は禁止。根拠を持って採点
- feedbackは具体的に（「〇〇を△△に変えると良い」）`;

  const response = await reviewModel.invoke(prompt);
  const content = response.content as string;

  // JSON部分を抽出
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      score: {
        empathy: 2, benefit: 1, cta: 1, credibility: 1, urgency: 0,
        originality: 0, engagement: 0, scrollStop: 0, total: 5,
        strengths: [], weaknesses: ['評価の解析に失敗']
      },
      feedback: '評価の解析に失敗しました。再生成が必要です。',
      currentStep: 'revise' as WorkflowStep,
    };
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    const score: QualityScore = {
      empathy: result.empathy || 0,
      benefit: result.benefit || 0,
      cta: result.cta || 0,
      credibility: result.credibility || 0,
      urgency: result.urgency || 0,
      originality: result.originality || 0,
      engagement: result.engagement || 0,
      scrollStop: result.scrollStop || 0,
      total: result.total || 0,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
    };

    // 合格ライン: 12点以上（15点満点の80%）
    return {
      score,
      feedback: result.feedback || '',
      currentStep: score.total >= 12 ? 'polish' as WorkflowStep : 'revise' as WorkflowStep,
    };
  } catch {
    return {
      score: {
        empathy: 2, benefit: 1, cta: 1, credibility: 1, urgency: 0,
        originality: 0, engagement: 0, scrollStop: 0, total: 5,
        strengths: [], weaknesses: ['JSONパースエラー']
      },
      feedback: 'JSONパースエラー。再生成が必要です。',
      currentStep: 'revise' as WorkflowStep,
    };
  }
}

/**
 * REVISE: フィードバックに基づいて修正（最大3回）
 */
async function reviseNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const newRevisionCount = state.revisionCount + 1;

  // 3回以上リビジョンしたら強制的にPOLISHへ
  if (newRevisionCount >= 3) {
    return {
      revisionCount: newRevisionCount,
      currentStep: 'polish' as WorkflowStep,
    };
  }

  return {
    revisionCount: newRevisionCount,
    currentStep: 'draft' as WorkflowStep,
  };
}

/**
 * POLISH: 最終調整
 */
async function polishNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const { draftText } = state;

  const prompt = `以下の投稿文を最終調整してください。

【投稿文】
${draftText}

【調整ポイント】
- 280〜320文字に収める（短すぎず長すぎず）
- 2-3行ごとに空行を入れて読みやすく
- CTAが弱ければ「気になったらDMで💬」を追加
- 絵文字は1-2個に調整
- 全角/半角の統一
- 宣伝臭さを消して自然な語り口に

調整後の投稿文のみを出力:`;

  const response = await model.invoke(prompt);
  const finalText = response.content as string;

  return {
    finalText: finalText.trim(),
    currentStep: 'complete' as WorkflowStep,
  };
}

// ========== ルーティング ==========

function routeAfterReview(state: PostGeneratorStateType): string {
  if (state.currentStep === 'polish') {
    return 'polish';
  }
  return 'revise';
}

function routeAfterRevise(state: PostGeneratorStateType): string {
  if (state.currentStep === 'polish') {
    return 'polish';
  }
  return 'draft';
}

// ========== グラフ構築 ==========

export function createPostGeneratorGraph() {
  const workflow = new StateGraph(PostGeneratorState)
    .addNode('research', researchNode)
    .addNode('draft', draftNode)
    .addNode('review', reviewNode)
    .addNode('revise', reviseNode)
    .addNode('polish', polishNode)
    .addEdge('__start__', 'research')
    .addEdge('research', 'draft')
    .addEdge('draft', 'review')
    .addConditionalEdges('review', routeAfterReview, {
      polish: 'polish',
      revise: 'revise',
    })
    .addConditionalEdges('revise', routeAfterRevise, {
      polish: 'polish',
      draft: 'draft',
    })
    .addEdge('polish', END);

  return workflow.compile();
}

// ========== 実行ヘルパー ==========

export interface GenerationProgress {
  postNumber: number;
  totalPosts: number;
  currentStep: WorkflowStep;
  score?: QualityScore;
  revisionCount: number;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

/**
 * 単一投稿を生成（Phoenix トレース付き）
 */
export async function generateSinglePost(
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  target?: string,
  benefit?: string,
  onProgress?: (step: WorkflowStep, score?: QualityScore) => void
): Promise<{
  text: string;
  target: string;
  benefit: string;
  score: QualityScore;
  revisionCount: number;
}> {
  return tracePostGeneration(
    'generate',
    { account, target, benefit },
    async () => {
      const graph = createPostGeneratorGraph();

      const initialState = {
        account,
        accountType,
        target: target || '',
        benefit: benefit || '',
      };

      // ストリーミング実行 - 状態を累積
      let accumulatedState: Partial<PostGeneratorStateType> = { ...initialState };

      for await (const event of await graph.stream(initialState)) {
        const nodeStates = Object.values(event) as Partial<PostGeneratorStateType>[];
        if (nodeStates.length > 0) {
          // 各ノードの出力を累積
          accumulatedState = { ...accumulatedState, ...nodeStates[0] };
          if (onProgress && accumulatedState.currentStep) {
            onProgress(accumulatedState.currentStep, accumulatedState.score);
          }
        }
      }

      if (!accumulatedState.currentStep) {
        throw new Error('生成に失敗しました');
      }

      const finalState = accumulatedState as PostGeneratorStateType;

      // デフォルトスコア（scoreがundefinedの場合）
      const defaultScore: QualityScore = {
        empathy: 0,
        benefit: 0,
        cta: 0,
        credibility: 0,
        urgency: 0,
        originality: 0,
        engagement: 0,
        scrollStop: 0,
        total: 0,
        strengths: [],
        weaknesses: [],
      };

      const result = {
        text: finalState.finalText || finalState.draftText || '',
        target: finalState.target || '',
        benefit: finalState.benefit || '',
        score: finalState.score || defaultScore,
        revisionCount: finalState.revisionCount || 0,
      };

      // 品質スコアをPhoenixに記録
      if (result.score) {
        recordQualityScore('quality-score', result.score);
      }

      return result;
    }
  );
}

/**
 * 複数投稿を一括生成（メリットベース - 15投稿で全メリット網羅）
 */
export async function generateMultiplePosts(
  count: number,
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  onProgress?: ProgressCallback
): Promise<Array<{
  text: string;
  target: string;
  benefit: string;
  score: QualityScore;
  revisionCount: number;
}>> {
  const results: Array<{
    text: string;
    target: string;
    benefit: string;
    score: QualityScore;
    revisionCount: number;
  }> = [];

  // メリットをメイン軸として使用（15投稿 = 15メリット重複なし）
  const shuffledBenefits = [...BENEFITS].sort(() => Math.random() - 0.5);
  // ターゲットはサブ要素としてランダム付与
  const shuffledTargets = [...TARGETS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    // メリットは重複なしで順番に使用
    const benefit = shuffledBenefits[i % shuffledBenefits.length];
    // ターゲットはランダムに付与
    const target = shuffledTargets[Math.floor(Math.random() * shuffledTargets.length)];

    try {
      const result = await generateSinglePost(
        account,
        accountType,
        target,
        benefit,
        (step, score) => {
          if (onProgress) {
            onProgress({
              postNumber: i + 1,
              totalPosts: count,
              currentStep: step,
              score,
              revisionCount: 0,
            });
          }
        }
      );

      results.push(result);

      if (onProgress) {
        onProgress({
          postNumber: i + 1,
          totalPosts: count,
          currentStep: 'complete',
          score: result.score,
          revisionCount: result.revisionCount,
        });
      }
    } catch (error) {
      console.error(`投稿 ${i + 1} の生成に失敗:`, error);
      // 失敗しても続行
    }
  }

  return results;
}

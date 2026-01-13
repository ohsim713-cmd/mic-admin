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
import { getSuccessPatterns } from '../database/success-patterns';
import { getKnowledgeContext, getRandomHook } from './knowledge-loader';

// ナレッジキャッシュ（同じ生成セッション内で再利用）
let cachedKnowledge: { accountType: string; context: string } | null = null;

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

  // ナレッジコンテキストを取得（キャッシュ利用）
  let knowledgeContext = '';
  try {
    if (cachedKnowledge && cachedKnowledge.accountType === accountType) {
      knowledgeContext = cachedKnowledge.context;
    } else {
      knowledgeContext = await getKnowledgeContext(accountType);
      cachedKnowledge = { accountType, context: knowledgeContext };
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

【重要な条件】
- 280〜320文字（中長文で深く刺す）
- 本音感・共感を重視（「ぶっちゃけ」「正直」など）
- 具体的な数字を入れる（月30万、週3日、時給16,500円など）
- 実績や事例を自然に盛り込む
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
 * REVIEW: 品質スコアを評価
 */
async function reviewNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const { draftText, target, benefit } = state;

  const prompt = `以下の投稿文を評価してください。

【投稿文】
${draftText}

【ターゲット】${target}
【訴求ポイント】${benefit}

以下の基準で各項目を採点し、JSON形式で出力してください:

1. empathy (共感・本音感): 0-3点
   - 「ぶっちゃけ」「正直」など本音を感じる表現があるか
   - ターゲットの悩みに寄り添っているか

2. benefit (メリット提示): 0-2点
   - 具体的な数字（月30万、週3日など）があるか
   - ターゲットにとって魅力的なベネフィットか

3. cta (行動喚起): 0-2点
   - 「DMで」「気軽に」など明確なCTAがあるか
   - 行動のハードルを下げる表現があるか

4. credibility (信頼性): 0-2点
   - 実績や事例の言及があるか
   - 事務所としての信頼感があるか

5. urgency (緊急性): 0-1点
   - 「今なら」「募集中」など行動を促す表現があるか

また、8点未満の場合は改善点をfeedbackとして記載してください。

JSONのみを出力:
{
  "empathy": 数値,
  "benefit": 数値,
  "cta": 数値,
  "credibility": 数値,
  "urgency": 数値,
  "total": 合計値,
  "feedback": "改善点（8点以上なら空文字）"
}`;

  const response = await reviewModel.invoke(prompt);
  let content = response.content as string;

  // JSON部分を抽出
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      score: { empathy: 2, benefit: 1, cta: 1, credibility: 1, urgency: 0, total: 5 },
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
      total: result.total || 0,
    };

    return {
      score,
      feedback: result.feedback || '',
      currentStep: score.total >= 8 ? 'polish' as WorkflowStep : 'revise' as WorkflowStep,
    };
  } catch {
    return {
      score: { empathy: 2, benefit: 1, cta: 1, credibility: 1, urgency: 0, total: 5 },
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
 * 単一投稿を生成
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
    total: 0,
  };

  return {
    text: finalState.finalText || finalState.draftText || '',
    target: finalState.target || '',
    benefit: finalState.benefit || '',
    score: finalState.score || defaultScore,
    revisionCount: finalState.revisionCount || 0,
  };
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

// 1号機【脳：Product Director】
// 機会の評価・承認、仕様策定を行うAgent

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getOpportunities, updateOpportunityStatus, setAgentStatus, getAgentState, getTemplates } from './state';
import type { Opportunity, Template } from './types';

// 評価基準
interface EvaluationCriteria {
  marketSize: number;      // 1-10: 市場規模
  competition: number;     // 1-10: 競合の少なさ
  feasibility: number;     // 1-10: 実現可能性
  profitPotential: number; // 1-10: 収益性
  timeToMarket: number;    // 1-10: 市場投入までの速さ
}

interface EvaluationResult {
  approved: boolean;
  score: number;
  criteria: EvaluationCriteria;
  reasoning: string;
  suggestedSpec?: ProductSpec;
}

interface ProductSpec {
  name: string;
  tagline: string;
  targetAudience: string;
  coreFeatures: string[];
  differentiators: string[];
  monetization: string;
  templateId: string;
  customizations: Record<string, string>;
}

// AI評価プロンプト
function buildEvaluationPrompt(opportunity: Opportunity, templates: Template[]): string {
  return `あなたはプロダクト責任者です。以下のビジネス機会を評価し、JSONで回答してください。

## 機会情報
タイトル: ${opportunity.title}
説明: ${opportunity.description}
ターゲット: ${opportunity.targetAudience}
ペインポイント: ${opportunity.painPoints.join(', ')}
キーワード: ${opportunity.keywords.join(', ')}
推定需要: ${opportunity.estimatedDemand}

## 利用可能なテンプレート
${templates.map(t => `- ${t.id}: ${t.name} (${t.features.join(', ')})`).join('\n')}

## 評価項目 (1-10で採点)
- marketSize: 市場規模
- competition: 競合の少なさ (多いと低スコア)
- feasibility: 実現可能性
- profitPotential: 収益ポテンシャル
- timeToMarket: 市場投入までの速さ

## JSON形式で回答
{
  "criteria": { "marketSize": 7, "competition": 6, "feasibility": 8, "profitPotential": 7, "timeToMarket": 9 },
  "reasoning": "評価理由...",
  "approved": true/false (合計スコア35以上で承認),
  "spec": { // approvedがtrueの場合のみ
    "name": "プロダクト名",
    "tagline": "キャッチコピー",
    "targetAudience": "具体的なターゲット",
    "coreFeatures": ["機能1", "機能2"],
    "differentiators": ["差別化ポイント"],
    "monetization": "収益モデル",
    "templateId": "使用するテンプレートID",
    "customizations": { "フィールド名": "カスタマイズ値" }
  }
}`;
}

// AI による機会評価
export async function evaluateOpportunity(opportunityId: string): Promise<EvaluationResult | null> {
  setAgentStatus('director', 'working', `機会${opportunityId}を評価中`);

  try {
    const { opportunities } = getOpportunities();
    const opportunity = opportunities.find(o => o.id === opportunityId);
    if (!opportunity) {
      setAgentStatus('director', 'error', '機会が見つかりません');
      return null;
    }

    const { templates } = getTemplates();
    const prompt = buildEvaluationPrompt(opportunity, templates);

    // Gemini API呼び出し
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // JSON抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const evaluation = JSON.parse(jsonMatch[0]);
    const { criteria, reasoning, approved, spec } = evaluation;

    // スコア計算
    const score = Object.values(criteria as EvaluationCriteria).reduce((sum: number, val) => sum + (val as number), 0);

    // 機会ステータス更新
    const newStatus = approved ? 'approved' : 'rejected';
    updateOpportunityStatus(opportunityId, newStatus, reasoning);

    // Director統計更新
    const state = getAgentState();
    state.agents.director.tasksCompleted++;

    setAgentStatus('director', 'idle', undefined);

    return {
      approved,
      score,
      criteria,
      reasoning,
      suggestedSpec: approved ? spec : undefined,
    };
  } catch (error) {
    console.error('[Director] Evaluation error:', error);
    setAgentStatus('director', 'error', String(error));
    return null;
  }
}

// バッチ評価 (複数機会を一括評価)
export async function evaluatePendingOpportunities(): Promise<{
  evaluated: number;
  approved: number;
  rejected: number;
}> {
  const { pipeline } = getOpportunities();
  const pendingIds = pipeline.discovered;

  let approved = 0;
  let rejected = 0;

  for (const id of pendingIds) {
    const result = await evaluateOpportunity(id);
    if (result) {
      if (result.approved) approved++;
      else rejected++;
    }
    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    evaluated: pendingIds.length,
    approved,
    rejected,
  };
}

// 仕様書生成 (承認済み機会から詳細仕様を生成)
export async function generateProductSpec(opportunityId: string): Promise<ProductSpec | null> {
  const { opportunities } = getOpportunities();
  const opportunity = opportunities.find(o => o.id === opportunityId);

  if (!opportunity || opportunity.status !== 'approved') {
    console.error('[Director] Cannot generate spec: opportunity not approved');
    return null;
  }

  // 評価時に生成された仕様があればそれを返す
  // なければ再生成
  const result = await evaluateOpportunity(opportunityId);
  return result?.suggestedSpec || null;
}

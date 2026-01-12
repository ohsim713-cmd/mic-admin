// 2号機【目：Opportunity Hunter】
// 市場からビジネス機会を発見するAgent

import { addOpportunity, setAgentStatus, getAgentState } from './state';
import type { Opportunity } from './types';

// 機会発見のキーワードパターン
const PAIN_POINT_KEYWORDS = [
  '困ってる',
  '不便',
  'めんどくさい',
  '欲しい',
  'あったらいいな',
  '誰か作って',
  'いいツールない',
  '探してる',
  '自動化したい',
];

const OPPORTUNITY_CATEGORIES = [
  { keywords: ['SNS', '投稿', '自動'], category: 'sns-automation' },
  { keywords: ['予約', 'スケジュール', '管理'], category: 'scheduling' },
  { keywords: ['EC', '販売', 'ショップ'], category: 'ecommerce' },
  { keywords: ['分析', 'レポート', 'データ'], category: 'analytics' },
];

// ユニークID生成
function generateOpportunityId(): string {
  return `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 需要レベル判定
function assessDemand(engagementCount: number, sourceReliability: number): 'low' | 'medium' | 'high' {
  const score = engagementCount * sourceReliability;
  if (score > 100) return 'high';
  if (score > 30) return 'medium';
  return 'low';
}

// ペインポイント抽出
function extractPainPoints(text: string): string[] {
  const points: string[] = [];
  PAIN_POINT_KEYWORDS.forEach(keyword => {
    if (text.includes(keyword)) {
      // キーワード周辺のコンテキストを抽出
      const index = text.indexOf(keyword);
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + keyword.length + 30);
      points.push(text.slice(start, end).trim());
    }
  });
  return points;
}

// カテゴリ推定
function estimateCategory(text: string): string {
  for (const cat of OPPORTUNITY_CATEGORIES) {
    if (cat.keywords.some(kw => text.includes(kw))) {
      return cat.category;
    }
  }
  return 'general';
}

// テンプレート推薦
function suggestTemplate(category: string): string | undefined {
  const templateMap: Record<string, string> = {
    'sns-automation': 'mic-admin-v1',
  };
  return templateMap[category];
}

export interface HuntResult {
  success: boolean;
  opportunitiesFound: number;
  opportunities: Opportunity[];
  errors?: string[];
}

// X (Twitter) からの機会発見 (モック実装 - 実際はAPI必要)
export async function huntFromX(searchQueries: string[]): Promise<HuntResult> {
  setAgentStatus('hunter', 'working', 'X検索中');

  const opportunities: Opportunity[] = [];
  const errors: string[] = [];

  try {
    // 実際の実装ではX APIを使用
    // ここではモックデータで構造を示す
    console.log('[Hunter] Searching X with queries:', searchQueries);

    // モック: 実際のAPI実装時に置き換え
    /*
    for (const query of searchQueries) {
      const response = await fetch('https://api.twitter.com/2/tweets/search/recent', {
        headers: { 'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
        body: JSON.stringify({ query, max_results: 20 })
      });
      const data = await response.json();
      // 結果を解析して機会に変換
    }
    */

    setAgentStatus('hunter', 'idle', undefined);

    return {
      success: true,
      opportunitiesFound: opportunities.length,
      opportunities,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    setAgentStatus('hunter', 'error', `Error: ${error}`);
    return {
      success: false,
      opportunitiesFound: 0,
      opportunities: [],
      errors: [String(error)],
    };
  }
}

// 手動で機会を追加
export async function addManualOpportunity(input: {
  title: string;
  description: string;
  targetAudience: string;
  painPoints: string[];
  keywords: string[];
}): Promise<{ success: boolean; opportunity?: Opportunity; error?: string }> {
  try {
    const opportunity: Opportunity = {
      id: generateOpportunityId(),
      title: input.title,
      description: input.description,
      source: 'manual',
      keywords: input.keywords,
      painPoints: input.painPoints,
      targetAudience: input.targetAudience,
      estimatedDemand: 'medium', // 手動は中程度デフォルト
      suggestedTemplate: suggestTemplate(estimateCategory(input.description)),
      status: 'discovered',
      discoveredAt: new Date().toISOString(),
    };

    const saved = addOpportunity(opportunity);
    if (saved) {
      // Hunter統計更新
      const state = getAgentState();
      state.agents.hunter.opportunitiesFound++;

      return { success: true, opportunity };
    }
    return { success: false, error: 'Failed to save opportunity' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// 定期実行用ハント
export async function runScheduledHunt(): Promise<HuntResult> {
  console.log('[Hunter] Starting scheduled hunt...');

  const queries = PAIN_POINT_KEYWORDS.map(kw => `${kw} ツール OR アプリ`);
  const result = await huntFromX(queries);

  // スケジュール更新
  const state = getAgentState();
  state.agents.hunter.schedule.lastRun = new Date().toISOString();
  state.agents.hunter.schedule.nextRun = new Date(
    Date.now() + state.agents.hunter.schedule.intervalHours * 60 * 60 * 1000
  ).toISOString();

  console.log(`[Hunter] Hunt complete. Found ${result.opportunitiesFound} opportunities`);
  return result;
}

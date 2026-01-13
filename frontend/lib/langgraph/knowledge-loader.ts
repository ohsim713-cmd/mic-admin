/**
 * ナレッジベースローダー
 * liver_trends.json, liver_recruitment_copy.json 等から情報を取得
 */

import { promises as fs } from 'fs';
import path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

interface LiverTrends {
  industryTrends: {
    marketSize: string;
    mainPlatforms: Array<{
      name: string;
      bestFor: string;
      features: string[];
      incomeExpectation: string;
    }>;
    latestTrends: string[];
  };
  recruitmentAppealPoints: {
    forBeginners: string[];
    forIncome: string[];
    forSafety: string[];
  };
}

interface LiverRecruitmentCopy {
  objectionHandling: Array<{
    objection: string;
    response: string;
  }>;
  ctaPatterns: {
    direct: string[];
    soft: string[];
  };
  hookPatterns: string[];
}

/**
 * JSONファイルを読み込み
 */
async function loadJson<T>(filename: string): Promise<T | null> {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * テキストファイルを読み込み
 */
async function loadText(filename: string): Promise<string | null> {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * ライバー用のナレッジコンテキストを構築
 */
export async function buildLiverKnowledgeContext(): Promise<string> {
  const trends = await loadJson<LiverTrends>('liver_trends.json');
  const copy = await loadJson<LiverRecruitmentCopy>('liver_recruitment_copy.json');
  const internalData = await loadText('liver_agency_internal_data.txt');

  let context = '';

  // トレンド情報
  if (trends) {
    context += `
【ライバー業界最新トレンド】
市場: ${trends.industryTrends.marketSize}

主要プラットフォーム:
${trends.industryTrends.mainPlatforms.map(p =>
  `- ${p.name}: ${p.bestFor} / ${p.incomeExpectation}`
).join('\n')}

最新トレンド:
${trends.industryTrends.latestTrends.map(t => `- ${t}`).join('\n')}

求人訴求ポイント:
- 未経験向け: ${trends.recruitmentAppealPoints.forBeginners.join('、')}
- 収入面: ${trends.recruitmentAppealPoints.forIncome.join('、')}
- 安全面: ${trends.recruitmentAppealPoints.forSafety.join('、')}
`;
  }

  // 不安解消パターン
  if (copy) {
    context += `
【よくある不安への回答】
${copy.objectionHandling.map(o =>
  `「${o.objection}」→ ${o.response}`
).join('\n')}

【効果的なフックパターン】
${copy.hookPatterns.map(h => `- ${h}`).join('\n')}

【CTAパターン】
ソフト: ${copy.ctaPatterns.soft.join(' / ')}
`;
  }

  // 内部ノウハウ
  if (internalData) {
    // 重要な部分のみ抽出
    const lines = internalData.split('\n').filter(l => l.trim());
    const highlights = lines.slice(0, 15).join('\n');
    context += `
【事務所の強み・ノウハウ】
${highlights}
`;
  }

  return context;
}

/**
 * チャトレ用のナレッジコンテキストを構築
 */
export async function buildChatladyKnowledgeContext(): Promise<string> {
  const trends = await loadJson<any>('chatlady_trends.json');
  const internalData = await loadText('chat_lady_internal_data.txt');

  let context = '';

  if (trends) {
    context += `
【チャトレ業界トレンド】
${JSON.stringify(trends, null, 2).slice(0, 500)}
`;
  }

  if (internalData) {
    const lines = internalData.split('\n').filter(l => l.trim());
    const highlights = lines.slice(0, 15).join('\n');
    context += `
【事務所の強み】
${highlights}
`;
  }

  return context;
}

/**
 * アカウントタイプに応じたナレッジを取得
 */
export async function getKnowledgeContext(accountType: 'ライバー' | 'チャトレ'): Promise<string> {
  if (accountType === 'ライバー') {
    return buildLiverKnowledgeContext();
  } else {
    return buildChatladyKnowledgeContext();
  }
}

/**
 * ランダムなフックパターンを取得
 */
export async function getRandomHook(): Promise<string | null> {
  const copy = await loadJson<LiverRecruitmentCopy>('liver_recruitment_copy.json');
  if (copy && copy.hookPatterns.length > 0) {
    return copy.hookPatterns[Math.floor(Math.random() * copy.hookPatterns.length)];
  }
  return null;
}

/**
 * 収入情報を取得
 */
export async function getIncomeInfo(): Promise<string | null> {
  const trends = await loadJson<LiverTrends>('liver_trends.json');
  if (trends) {
    const platform = trends.industryTrends.mainPlatforms[
      Math.floor(Math.random() * trends.industryTrends.mainPlatforms.length)
    ];
    return `${platform.name}では${platform.incomeExpectation}`;
  }
  return null;
}

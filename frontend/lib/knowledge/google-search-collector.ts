/**
 * Google検索でナレッジを収集
 * Gemini APIのグラウンディング機能を使用
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// グラウンディング対応のGeminiモデル
const searchModel = new ChatGoogleGenerativeAI({
  model: 'gemini-3-flash-preview',
  temperature: 0.3,
  apiKey,
});

export interface KnowledgeSearchResult {
  topic: string;
  insights: string[];
  trends: string[];
  statistics: string[];
  examples: string[];
  source: 'google_search';
  timestamp: string;
}

/**
 * ライバー関連のナレッジを検索・収集
 */
export async function collectLiverKnowledge(
  searchTopics?: string[]
): Promise<KnowledgeSearchResult[]> {
  const topics = searchTopics || [
    'ライブ配信 始め方 2024 収入',
    'Pococha ライバー 稼ぎ方 コツ',
    '17LIVE 新人ライバー 月収',
    'ライブ配信 副業 主婦 体験談',
    'IRIAM Vライバー 初心者',
    'ライバー事務所 選び方 メリット',
    '配信者 スマホだけ 稼ぐ',
  ];

  const results: KnowledgeSearchResult[] = [];

  for (const topic of topics) {
    try {
      const result = await searchAndExtract(topic, 'ライバー');
      results.push(result);
      // APIレート制限対策
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Knowledge Collector] Failed to search: ${topic}`, error);
    }
  }

  return results;
}

/**
 * チャットレディ関連のナレッジを検索・収集
 */
export async function collectChatladyKnowledge(
  searchTopics?: string[]
): Promise<KnowledgeSearchResult[]> {
  const topics = searchTopics || [
    'チャットレディ 在宅 始め方 2024',
    'チャットレディ 稼げる時間帯',
    '主婦 副業 在宅 高収入 体験談',
    'メールレディ チャットレディ 違い',
    'チャットレディ 事務所 サポート',
    '30代 40代 チャットレディ 需要',
  ];

  const results: KnowledgeSearchResult[] = [];

  for (const topic of topics) {
    try {
      const result = await searchAndExtract(topic, 'チャットレディ');
      results.push(result);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Knowledge Collector] Failed to search: ${topic}`, error);
    }
  }

  return results;
}

/**
 * Google検索して情報を抽出
 */
async function searchAndExtract(
  query: string,
  category: 'ライバー' | 'チャットレディ'
): Promise<KnowledgeSearchResult> {
  const prompt = `あなたは${category}業界のマーケティングリサーチャーです。

以下のキーワードについて、最新の情報を検索して整理してください。
【検索キーワード】${query}

以下の形式でJSON出力してください：
{
  "insights": ["業界の重要な洞察1", "洞察2", "洞察3"],
  "trends": ["最新トレンド1", "トレンド2"],
  "statistics": ["具体的な統計・数字1", "数字2"],
  "examples": ["成功事例や体験談1", "事例2"]
}

【重要】
- 実際の数字やデータを含める（月収○万円、○%など）
- 2024年以降の最新情報を優先
- SNS投稿で使えるような具体的なフレーズを含める
- 嘘やでっち上げは禁止。分からない場合は空配列でOK

JSONのみ出力:`;

  const response = await searchModel.invoke(prompt);
  const content = response.content as string;

  // JSON抽出
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  let parsed = {
    insights: [],
    trends: [],
    statistics: [],
    examples: [],
  };

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // パース失敗
    }
  }

  return {
    topic: query,
    insights: parsed.insights || [],
    trends: parsed.trends || [],
    statistics: parsed.statistics || [],
    examples: parsed.examples || [],
    source: 'google_search',
    timestamp: new Date().toISOString(),
  };
}

/**
 * 収集したナレッジをファイルに保存
 */
export async function saveKnowledgeToFile(
  results: KnowledgeSearchResult[],
  category: 'liver' | 'chatlady'
): Promise<string> {
  const knowledgePath = path.join(process.cwd(), 'knowledge');

  // ディレクトリ作成
  if (!fs.existsSync(knowledgePath)) {
    fs.mkdirSync(knowledgePath, { recursive: true });
  }

  const filename = `${category}_google_knowledge.json`;
  const filepath = path.join(knowledgePath, filename);

  // 既存データとマージ
  let existingData: KnowledgeSearchResult[] = [];
  if (fs.existsSync(filepath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    } catch {
      // パース失敗
    }
  }

  // 新しいデータを追加（重複トピックは更新）
  const topicMap = new Map<string, KnowledgeSearchResult>();
  for (const item of existingData) {
    topicMap.set(item.topic, item);
  }
  for (const item of results) {
    topicMap.set(item.topic, item);
  }

  const mergedData = Array.from(topicMap.values());
  fs.writeFileSync(filepath, JSON.stringify(mergedData, null, 2), 'utf-8');

  return filepath;
}

/**
 * ナレッジを投稿生成用の形式に変換
 */
export function convertToPostKnowledge(results: KnowledgeSearchResult[]): {
  hooks: string[];
  statistics: string[];
  successStories: string[];
  trendPhrases: string[];
} {
  const hooks: string[] = [];
  const statistics: string[] = [];
  const successStories: string[] = [];
  const trendPhrases: string[] = [];

  for (const result of results) {
    // インサイトからフックを抽出
    hooks.push(...result.insights.filter((i) => i.length < 50));

    // 統計データ
    statistics.push(...result.statistics);

    // 成功事例
    successStories.push(...result.examples);

    // トレンドフレーズ
    trendPhrases.push(...result.trends);
  }

  return {
    hooks: [...new Set(hooks)].slice(0, 20),
    statistics: [...new Set(statistics)].slice(0, 15),
    successStories: [...new Set(successStories)].slice(0, 10),
    trendPhrases: [...new Set(trendPhrases)].slice(0, 10),
  };
}

/**
 * 一括でナレッジ収集を実行
 */
export async function runKnowledgeCollection(
  category: 'liver' | 'chatlady' | 'both' = 'both'
): Promise<{
  liver?: { results: KnowledgeSearchResult[]; savedPath: string };
  chatlady?: { results: KnowledgeSearchResult[]; savedPath: string };
}> {
  const output: {
    liver?: { results: KnowledgeSearchResult[]; savedPath: string };
    chatlady?: { results: KnowledgeSearchResult[]; savedPath: string };
  } = {};

  if (category === 'liver' || category === 'both') {
    console.log('[Knowledge Collector] Starting liver knowledge collection...');
    const liverResults = await collectLiverKnowledge();
    const liverPath = await saveKnowledgeToFile(liverResults, 'liver');
    output.liver = { results: liverResults, savedPath: liverPath };
    console.log(`[Knowledge Collector] Liver: ${liverResults.length} topics collected`);
  }

  if (category === 'chatlady' || category === 'both') {
    console.log('[Knowledge Collector] Starting chatlady knowledge collection...');
    const chatladyResults = await collectChatladyKnowledge();
    const chatladyPath = await saveKnowledgeToFile(chatladyResults, 'chatlady');
    output.chatlady = { results: chatladyResults, savedPath: chatladyPath };
    console.log(`[Knowledge Collector] Chatlady: ${chatladyResults.length} topics collected`);
  }

  return output;
}

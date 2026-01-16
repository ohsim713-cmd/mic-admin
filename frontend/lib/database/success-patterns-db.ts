/**
 * 成功パターン データベース - Supabase版
 * 高スコアの投稿パターンを自動蓄積・学習
 */

import { supabase, SuccessPattern as DBSuccessPattern } from './supabase';

export interface SuccessPattern {
  id: string;
  pattern: string;
  category: 'hook' | 'cta' | 'benefit' | 'empathy';
  score: number;
  usageCount: number;
  dmRate?: number;
  engagementRate?: number;
  createdAt: string;
  updatedAt: string;
}

// デフォルトパターン（初期データ）
const DEFAULT_PATTERNS: Omit<DBSuccessPattern, 'id' | 'created_at'>[] = [
  { text: 'ぶっちゃけ、〜って思ってる人へ', target: 'hook', score: 8.5 },
  { text: '正直、〜だと思ってない？', target: 'hook', score: 8.2 },
  { text: '〜なんて無理って思ってた私が', target: 'hook', score: 8.0 },
  { text: '気になったらDMで💬', target: 'cta', score: 8.3 },
  { text: '気軽に話聞かせて', target: 'cta', score: 8.1 },
  { text: '月30万以上', target: 'benefit', score: 8.4 },
  { text: 'スマホ1台で', target: 'benefit', score: 8.2 },
  { text: '初月から稼げた', target: 'benefit', score: 8.6 },
];

/**
 * 初期データを投入（テーブルが空の場合）
 */
async function ensureDefaultPatterns(): Promise<void> {
  const { count } = await supabase
    .from('success_patterns')
    .select('*', { count: 'exact', head: true });

  if (count === 0) {
    await supabase.from('success_patterns').insert(DEFAULT_PATTERNS);
  }
}

/**
 * 成功パターン一覧を取得
 */
export async function getSuccessPatterns(
  category?: 'hook' | 'cta' | 'benefit' | 'empathy'
): Promise<string[]> {
  await ensureDefaultPatterns();

  let query = supabase
    .from('success_patterns')
    .select('text')
    .order('score', { ascending: false });

  if (category) {
    query = query.eq('target', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[SuccessPatterns] Error fetching patterns:', error);
    return [];
  }

  return (data || []).map(d => d.text);
}

/**
 * カテゴリ別に成功パターンを取得（重み付け選択用）
 * スコアが高いパターンほど選ばれやすい
 */
export async function getWeightedPatternsByCategory(): Promise<{
  hooks: Array<{ text: string; score: number }>;
  ctas: Array<{ text: string; score: number }>;
  benefits: Array<{ text: string; score: number }>;
}> {
  await ensureDefaultPatterns();

  const { data, error } = await supabase
    .from('success_patterns')
    .select('text, target, score')
    .gte('score', 7.5) // 7.5点以上のみ
    .order('score', { ascending: false });

  if (error || !data) {
    return { hooks: [], ctas: [], benefits: [] };
  }

  const hooks: Array<{ text: string; score: number }> = [];
  const ctas: Array<{ text: string; score: number }> = [];
  const benefits: Array<{ text: string; score: number }> = [];

  for (const row of data) {
    const item = { text: row.text, score: row.score || 0 };
    switch (row.target) {
      case 'hook':
        hooks.push(item);
        break;
      case 'cta':
        ctas.push(item);
        break;
      case 'benefit':
        benefits.push(item);
        break;
    }
  }

  return { hooks, ctas, benefits };
}

/**
 * 重み付けでランダム選択
 * スコアが高いほど選ばれやすい
 */
export function selectWeighted<T extends { score: number }>(items: T[]): T | null {
  if (items.length === 0) return null;

  // スコアを重みに変換（スコア7.5以上を想定、最小1）
  const weights = items.map(item => Math.max(1, item.score - 6));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }

  return items[items.length - 1];
}

/**
 * 成功パターンの詳細を取得
 */
export async function getPatternDetails(): Promise<SuccessPattern[]> {
  await ensureDefaultPatterns();

  const { data, error } = await supabase
    .from('success_patterns')
    .select('*')
    .order('score', { ascending: false });

  if (error) {
    console.error('[SuccessPatterns] Error fetching pattern details:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: String(d.id),
    pattern: d.text,
    category: (d.target || 'benefit') as 'hook' | 'cta' | 'benefit' | 'empathy',
    score: d.score || 0,
    usageCount: 1,
    engagementRate: d.engagement_rate,
    createdAt: d.created_at,
    updatedAt: d.created_at,
  }));
}

/**
 * 新しい成功パターンを追加
 */
export async function addSuccessPattern(
  pattern: string,
  category: 'hook' | 'cta' | 'benefit' | 'empathy',
  score: number
): Promise<SuccessPattern | null> {
  // 既存パターンをチェック
  const { data: existing } = await supabase
    .from('success_patterns')
    .select('*')
    .ilike('text', pattern)
    .single();

  if (existing) {
    // 既存パターンのスコアを更新（平均）
    const newScore = (existing.score + score) / 2;
    const { data, error } = await supabase
      .from('success_patterns')
      .update({ score: newScore })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) return null;

    return {
      id: String(data.id),
      pattern: data.text,
      category: (data.target || category) as 'hook' | 'cta' | 'benefit' | 'empathy',
      score: data.score,
      usageCount: 1,
      createdAt: data.created_at,
      updatedAt: data.created_at,
    };
  }

  // 新規追加
  const { data, error } = await supabase
    .from('success_patterns')
    .insert({
      text: pattern,
      target: category,
      score,
    })
    .select()
    .single();

  if (error) {
    console.error('[SuccessPatterns] Error adding pattern:', error);
    return null;
  }

  return {
    id: String(data.id),
    pattern: data.text,
    category: category,
    score: data.score,
    usageCount: 1,
    createdAt: data.created_at,
    updatedAt: data.created_at,
  };
}

/**
 * 投稿からパターンを抽出して学習
 */
export async function learnFromPost(
  postText: string,
  score: number,
  gotDM: boolean
): Promise<void> {
  if (score < 8.0) return; // 高スコアのみ学習

  // フック（書き出し）を抽出
  const hookPatterns = [
    /^(ぶっちゃけ[、,]?[^。\n]{0,20})/,
    /^(正直[、,]?[^。\n]{0,20})/,
    /^([^。\n]{0,15}って思ってる人)/,
  ];

  for (const regex of hookPatterns) {
    const match = postText.match(regex);
    if (match) {
      await addSuccessPattern(match[1], 'hook', score);
      break;
    }
  }

  // CTA（最後の誘導）を抽出
  const ctaPatterns = [
    /(DM[でへ][^。\n]{0,10}[💬✨🌟]?)/,
    /(気軽に[^。\n]{0,15})/,
  ];

  for (const regex of ctaPatterns) {
    const match = postText.match(regex);
    if (match) {
      await addSuccessPattern(match[1], 'cta', score);
      break;
    }
  }

  // ベネフィット表現を抽出
  const benefitPatterns = [
    /(月[0-9０-９]+万[円以上]{0,3})/,
    /(スマホ[0-9１]台[でで]{0,2})/,
    /(初月から[^。\n]{0,10})/,
  ];

  for (const regex of benefitPatterns) {
    const match = postText.match(regex);
    if (match) {
      await addSuccessPattern(match[1], 'benefit', score);
      break;
    }
  }
}

/**
 * DB統計情報を取得
 */
export async function getDBStats(): Promise<{
  totalPatterns: number;
  byCategory: Record<string, number>;
  avgScore: number;
  lastUpdated: string;
}> {
  const { data, error } = await supabase
    .from('success_patterns')
    .select('target, score, created_at');

  if (error || !data) {
    return {
      totalPatterns: 0,
      byCategory: {},
      avgScore: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  const byCategory: Record<string, number> = {};
  let totalScore = 0;
  let lastUpdated = '';

  for (const row of data) {
    const cat = row.target || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    totalScore += row.score || 0;
    if (row.created_at > lastUpdated) {
      lastUpdated = row.created_at;
    }
  }

  return {
    totalPatterns: data.length,
    byCategory,
    avgScore: data.length > 0 ? totalScore / data.length : 0,
    lastUpdated: lastUpdated || new Date().toISOString(),
  };
}

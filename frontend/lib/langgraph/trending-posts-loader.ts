/**
 * お手本投稿（trending_posts.json）のローダー
 * 投稿生成時にランダムに1つ選んで参照する
 */

import fs from 'fs/promises';
import path from 'path';

interface TrendingPost {
  id: string;
  text: string;
  source: string;
  category: string;
  whyWorks: string;
  addedAt: string;
}

interface TrendingPostsData {
  description: string;
  lastUpdated: string;
  posts: TrendingPost[];
}

// 禁止ワード/フレーズリスト（存在しないサービス、不適切な表現）
export const PROHIBITED_PHRASES = [
  // 存在しないサービス・機能
  '無料診断',
  '無料カウンセリング',
  '適性診断',
  '収入シミュレーター',
  '無料相談会',
  '説明会',
  '体験会',
  // 過大な約束
  '確実に稼げる',
  '絶対に',
  '100%',
  '必ず成功',
  // 法的リスク
  '税金対策',
  '節税',
];

// CTA許可リスト（これ以外のCTAは使わない）
export const ALLOWED_CTAS = [
  'DMください',
  'DM待ってます',
  'DMで気軽に',
  '気軽にDMで',
  '気軽に問い合わせください',
  'DMで相談乗ります',
  '質問あればDMで',
];

const TRENDING_POSTS_FILE = path.join(process.cwd(), 'knowledge', 'trending_posts.json');

// キャッシュ（5分間有効）
let cachedData: TrendingPostsData | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分

/**
 * お手本投稿データを読み込む
 */
async function loadTrendingPosts(): Promise<TrendingPostsData> {
  const now = Date.now();

  // キャッシュが有効な場合は返す
  if (cachedData && (now - cacheTime) < CACHE_TTL) {
    return cachedData;
  }

  try {
    const content = await fs.readFile(TRENDING_POSTS_FILE, 'utf-8');
    cachedData = JSON.parse(content);
    cacheTime = now;
    return cachedData!;
  } catch {
    // ファイルがない場合は空データ
    return {
      description: '',
      lastUpdated: new Date().toISOString(),
      posts: [],
    };
  }
}

/**
 * ランダムにお手本投稿を1つ取得
 */
export async function getRandomTrendingPost(): Promise<TrendingPost | null> {
  const data = await loadTrendingPosts();
  if (data.posts.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * data.posts.length);
  return data.posts[randomIndex];
}

/**
 * カテゴリ指定でランダムに取得
 */
export async function getRandomTrendingPostByCategory(category: string): Promise<TrendingPost | null> {
  const data = await loadTrendingPosts();
  const filtered = data.posts.filter(p => p.category === category);

  if (filtered.length === 0) {
    // カテゴリがない場合は全体からランダム
    return getRandomTrendingPost();
  }

  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}

/**
 * 複数のお手本を取得（重複なし）
 */
export async function getMultipleTrendingPosts(count: number): Promise<TrendingPost[]> {
  const data = await loadTrendingPosts();
  const shuffled = [...data.posts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * お手本投稿のコンテキストを生成
 * プロンプトに追加する形式で返す
 */
export async function buildTrendingPostContext(): Promise<string> {
  const post = await getRandomTrendingPost();

  if (!post) {
    return '';
  }

  return `
【🔥 今回参考にするお手本投稿】
カテゴリ: ${post.category}
---
${post.text}
---
なぜ伸びた: ${post.whyWorks}

※このお手本の「構造」「言い回し」「テンション」を参考に、ライバー/チャトレ業界向けにアレンジして書く
※丸パクリは絶対NG！エッセンスだけ取り入れてオリジナルな投稿にする
`;
}

/**
 * テキストに禁止ワードが含まれているかチェック
 */
export function containsProhibitedPhrase(text: string): { contains: boolean; phrases: string[] } {
  const found = PROHIBITED_PHRASES.filter(phrase => text.includes(phrase));
  return {
    contains: found.length > 0,
    phrases: found,
  };
}

/**
 * CTAが許可リストに含まれているかチェック
 * 含まれていない場合は推奨CTAを返す
 */
export function validateCTA(text: string): { valid: boolean; suggestion?: string } {
  // CTAっぽい部分を検出
  const ctaPatterns = /(?:DM|問い合わせ|相談|連絡)[^。]*(?:ください|待って|乗り|で)[^。]*/g;
  const matches = text.match(ctaPatterns);

  if (!matches) {
    // CTAがない場合はOK（10回に1回だけCTAを入れる方針）
    return { valid: true };
  }

  // 許可されたCTAに近いかチェック
  for (const match of matches) {
    const isAllowed = ALLOWED_CTAS.some(cta =>
      match.includes(cta) || cta.includes(match.trim())
    );
    if (!isAllowed) {
      // 許可されていないCTAがある
      return {
        valid: false,
        suggestion: ALLOWED_CTAS[Math.floor(Math.random() * ALLOWED_CTAS.length)],
      };
    }
  }

  return { valid: true };
}

/**
 * CTAを入れるかどうかをランダムに決定（10%の確率）
 */
export function shouldIncludeCTA(): boolean {
  return Math.random() < 0.1; // 10%
}

/**
 * ランダムに許可されたCTAを取得
 */
export function getRandomAllowedCTA(): string {
  return ALLOWED_CTAS[Math.floor(Math.random() * ALLOWED_CTAS.length)];
}

export default {
  getRandomTrendingPost,
  getRandomTrendingPostByCategory,
  getMultipleTrendingPosts,
  buildTrendingPostContext,
  containsProhibitedPhrase,
  validateCTA,
  shouldIncludeCTA,
  getRandomAllowedCTA,
  PROHIBITED_PHRASES,
  ALLOWED_CTAS,
};

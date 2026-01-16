/**
 * バズ検知エージェント（Analyst）
 *
 * Xの投稿パフォーマンスを監視し、バズった投稿を検出
 * バズ投稿は動画化候補としてキューに追加
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DATA_DIR = path.join(process.cwd(), 'data');
const BUZZ_QUEUE_PATH = path.join(DATA_DIR, 'buzz_queue.json');
const BUZZ_HISTORY_PATH = path.join(DATA_DIR, 'buzz_history.json');

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// ========================================
// 型定義
// ========================================

export interface BuzzPost {
  id: string;
  text: string;
  account: string;
  platform: 'x' | 'tiktok' | 'instagram';
  impressions: number;
  engagements: number;
  engagementRate: number;
  postedAt: string;
  detectedAt: string;
  buzzScore: number;
  status: 'detected' | 'scripted' | 'video_created' | 'published';
  videoUrl?: string;
  script?: string;
}

export interface BuzzThresholds {
  minImpressions: number;
  minEngagementRate: number;
  minBuzzScore: number;
}

export interface BuzzQueue {
  posts: BuzzPost[];
  lastCheck: string;
  totalDetected: number;
  totalVideoized: number;
}

// ========================================
// デフォルト閾値
// ========================================

const DEFAULT_THRESHOLDS: BuzzThresholds = {
  minImpressions: 1000,      // 最低1,000インプレッション
  minEngagementRate: 3,      // 最低3%エンゲージメント率
  minBuzzScore: 70,          // 最低スコア70点
};

// ========================================
// バズスコア計算
// ========================================

export function calculateBuzzScore(
  impressions: number,
  engagements: number,
  hoursElapsed: number
): number {
  // エンゲージメント率
  const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

  // 時間当たりインプレッション（バイラル速度）
  const impPerHour = hoursElapsed > 0 ? impressions / hoursElapsed : impressions;

  // スコア計算（100点満点）
  let score = 0;

  // インプレッション（40点）
  if (impressions >= 10000) score += 40;
  else if (impressions >= 5000) score += 30;
  else if (impressions >= 2000) score += 20;
  else if (impressions >= 1000) score += 10;

  // エンゲージメント率（30点）
  if (engagementRate >= 10) score += 30;
  else if (engagementRate >= 5) score += 20;
  else if (engagementRate >= 3) score += 10;

  // バイラル速度（30点）
  if (impPerHour >= 1000) score += 30;
  else if (impPerHour >= 500) score += 20;
  else if (impPerHour >= 100) score += 10;

  return score;
}

// ========================================
// キュー管理
// ========================================

function loadBuzzQueue(): BuzzQueue {
  try {
    if (fs.existsSync(BUZZ_QUEUE_PATH)) {
      return JSON.parse(fs.readFileSync(BUZZ_QUEUE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[BuzzDetector] Failed to load queue:', e);
  }
  return {
    posts: [],
    lastCheck: '',
    totalDetected: 0,
    totalVideoized: 0,
  };
}

function saveBuzzQueue(queue: BuzzQueue): void {
  try {
    fs.writeFileSync(BUZZ_QUEUE_PATH, JSON.stringify(queue, null, 2));
  } catch (e) {
    console.error('[BuzzDetector] Failed to save queue:', e);
  }
}

// ========================================
// バズ検知
// ========================================

export async function detectBuzz(
  posts: Array<{
    id: string;
    text: string;
    account: string;
    platform: 'x' | 'tiktok' | 'instagram';
    impressions: number;
    engagements: number;
    postedAt: string;
  }>,
  thresholds: Partial<BuzzThresholds> = {}
): Promise<BuzzPost[]> {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const queue = loadBuzzQueue();
  const existingIds = new Set(queue.posts.map(p => p.id));
  const newBuzzPosts: BuzzPost[] = [];

  const now = new Date();

  for (const post of posts) {
    // 既に検出済みならスキップ
    if (existingIds.has(post.id)) continue;

    // 経過時間を計算
    const postedAt = new Date(post.postedAt);
    const hoursElapsed = (now.getTime() - postedAt.getTime()) / (1000 * 60 * 60);

    // エンゲージメント率
    const engagementRate = post.impressions > 0
      ? (post.engagements / post.impressions) * 100
      : 0;

    // バズスコア計算
    const buzzScore = calculateBuzzScore(
      post.impressions,
      post.engagements,
      hoursElapsed
    );

    // 閾値チェック
    if (
      post.impressions >= config.minImpressions &&
      engagementRate >= config.minEngagementRate &&
      buzzScore >= config.minBuzzScore
    ) {
      const buzzPost: BuzzPost = {
        ...post,
        engagementRate,
        buzzScore,
        detectedAt: now.toISOString(),
        status: 'detected',
      };

      newBuzzPosts.push(buzzPost);
      queue.posts.push(buzzPost);
      queue.totalDetected++;
    }
  }

  queue.lastCheck = now.toISOString();
  saveBuzzQueue(queue);

  console.log(`[BuzzDetector] Detected ${newBuzzPosts.length} new buzz posts`);

  return newBuzzPosts;
}

// ========================================
// バズキュー取得
// ========================================

export function getBuzzQueue(status?: BuzzPost['status']): BuzzPost[] {
  const queue = loadBuzzQueue();
  if (status) {
    return queue.posts.filter(p => p.status === status);
  }
  return queue.posts;
}

export function getPendingForScript(): BuzzPost[] {
  return getBuzzQueue('detected');
}

export function getPendingForVideo(): BuzzPost[] {
  return getBuzzQueue('scripted');
}

// ========================================
// ステータス更新
// ========================================

export function updateBuzzStatus(
  postId: string,
  status: BuzzPost['status'],
  data?: Partial<BuzzPost>
): BuzzPost | null {
  const queue = loadBuzzQueue();
  const index = queue.posts.findIndex(p => p.id === postId);

  if (index < 0) return null;

  queue.posts[index] = {
    ...queue.posts[index],
    ...data,
    status,
  };

  if (status === 'video_created') {
    queue.totalVideoized++;
  }

  saveBuzzQueue(queue);
  return queue.posts[index];
}

// ========================================
// バズ分析（AIによる傾向分析）
// ========================================

export async function analyzeBuzzTrends(): Promise<{
  topPatterns: string[];
  recommendations: string[];
  summary: string;
}> {
  const queue = loadBuzzQueue();
  const recentBuzz = queue.posts.slice(-20);

  if (recentBuzz.length === 0) {
    return {
      topPatterns: [],
      recommendations: ['まだバズ投稿のデータがありません'],
      summary: 'データ収集中',
    };
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `あなたはSNSマーケティングのアナリストです。
バズ投稿のパターンを分析し、再現性のある戦略を提案してください。`,
  });

  const prompt = `
以下のバズ投稿を分析してください:

${recentBuzz.map((p, i) => `
${i + 1}. [${p.platform}] スコア: ${p.buzzScore}点
   インプ: ${p.impressions} / エンゲージ率: ${p.engagementRate.toFixed(1)}%
   投稿: "${p.text.slice(0, 100)}..."
`).join('\n')}

以下の形式で回答:
1. 共通パターン（箇条書き3つ）
2. 再現のための推奨事項（箇条書き3つ）
3. 一言サマリー
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // 簡易パース（実際はもっと精密に）
    const lines = text.split('\n').filter(l => l.trim());

    return {
      topPatterns: lines.slice(0, 3),
      recommendations: lines.slice(3, 6),
      summary: lines[lines.length - 1] || 'バズパターン分析完了',
    };
  } catch (e: any) {
    console.error('[BuzzDetector] Analysis failed:', e);
    return {
      topPatterns: [],
      recommendations: ['分析エラー: ' + e.message],
      summary: 'エラー',
    };
  }
}

// ========================================
// 統計情報
// ========================================

export function getBuzzStats(): {
  totalDetected: number;
  totalVideoized: number;
  pendingScript: number;
  pendingVideo: number;
  avgBuzzScore: number;
  topPlatform: string;
} {
  const queue = loadBuzzQueue();

  const pendingScript = queue.posts.filter(p => p.status === 'detected').length;
  const pendingVideo = queue.posts.filter(p => p.status === 'scripted').length;

  const avgBuzzScore = queue.posts.length > 0
    ? queue.posts.reduce((a, p) => a + p.buzzScore, 0) / queue.posts.length
    : 0;

  // プラットフォーム別集計
  const platformCounts: Record<string, number> = {};
  for (const post of queue.posts) {
    platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1;
  }
  const topPlatform = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

  return {
    totalDetected: queue.totalDetected,
    totalVideoized: queue.totalVideoized,
    pendingScript,
    pendingVideo,
    avgBuzzScore: Math.round(avgBuzzScore),
    topPlatform,
  };
}

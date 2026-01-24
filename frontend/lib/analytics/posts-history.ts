/**
 * 投稿履歴管理
 * SDK分析用のデータを posts_history.json に保存・管理
 */

import fs from 'fs';
import path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(KNOWLEDGE_DIR, 'posts_history.json');

export interface PostHistoryEntry {
  id: string;
  text: string;
  account: string;
  target: string;
  benefit: string;
  score: number;
  tweetId?: string;
  timestamp: string;
  // インプレッション（後から更新）
  impressions?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  engagementRate?: number;
  metricsUpdatedAt?: string;
}

interface PostsHistoryData {
  posts: PostHistoryEntry[];
  lastUpdated: string;
}

/**
 * 投稿履歴を読み込み
 */
export function loadPostsHistory(): PostsHistoryData {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      return {
        posts: data.posts || [],
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error('Failed to load posts history:', e);
  }
  return { posts: [], lastUpdated: new Date().toISOString() };
}

/**
 * 投稿履歴を保存
 */
function savePostsHistory(data: PostsHistoryData): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    // Production環境では読み取り専用なのでエラーを無視
    if (process.env.NODE_ENV === 'production') {
      console.warn('[PostsHistory] Cannot save in production (read-only filesystem):', error);
    } else {
      throw error;
    }
  }
}

/**
 * 新規投稿を履歴に追加
 */
export async function addToPostsHistory(entry: Omit<PostHistoryEntry, 'engagementRate'>): Promise<void> {
  try {
    const history = loadPostsHistory();

    // 重複チェック
    if (!history.posts.find(p => p.id === entry.id)) {
      history.posts.push({
        ...entry,
        engagementRate: undefined,
      });
      history.lastUpdated = new Date().toISOString();
      savePostsHistory(history);
      console.log(`[PostsHistory] Added: ${entry.id}`);
    }
  } catch (error) {
    // Production環境では読み取り専用なのでエラーを無視
    if (process.env.NODE_ENV === 'production') {
      console.warn('[PostsHistory] Cannot add in production (read-only filesystem):', error);
    } else {
      throw error;
    }
  }
}

/**
 * インプレッションデータを更新
 */
export async function updatePostMetrics(
  tweetId: string,
  metrics: {
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
  }
): Promise<boolean> {
  const history = loadPostsHistory();

  const post = history.posts.find(p => p.tweetId === tweetId);
  if (!post) {
    return false;
  }

  post.impressions = metrics.impressions;
  post.likes = metrics.likes;
  post.retweets = metrics.retweets;
  post.replies = metrics.replies;
  post.engagementRate = metrics.impressions > 0
    ? (metrics.likes + metrics.retweets + metrics.replies) / metrics.impressions * 100
    : 0;
  post.metricsUpdatedAt = new Date().toISOString();

  history.lastUpdated = new Date().toISOString();
  savePostsHistory(history);

  console.log(`[PostsHistory] Updated metrics for: ${tweetId}`);
  return true;
}

/**
 * post_stock.json から投稿済みデータを移行
 */
export async function migrateFromPostStock(): Promise<{
  migrated: number;
  skipped: number;
}> {
  const stockPath = path.join(DATA_DIR, 'post_stock.json');
  let migrated = 0;
  let skipped = 0;

  try {
    if (fs.existsSync(stockPath)) {
      const stockData = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
      const stocks = stockData.stocks || [];
      const history = loadPostsHistory();
      const existingIds = new Set(history.posts.map(p => p.id));

      for (const stock of stocks) {
        // 投稿済み（usedAt がある）データのみ移行
        if (stock.usedAt && !existingIds.has(stock.id)) {
          history.posts.push({
            id: stock.id,
            text: stock.text,
            account: stock.account || 'liver',
            target: stock.target || '不明',
            benefit: stock.benefit || '不明',
            score: typeof stock.score === 'object' ? stock.score.total : (stock.score || 0),
            tweetId: stock.tweetId,
            timestamp: stock.usedAt,
            impressions: stock.impressions,
            likes: stock.likes,
            retweets: stock.retweets,
            replies: stock.replies,
            engagementRate: stock.impressions > 0
              ? ((stock.likes || 0) + (stock.retweets || 0) + (stock.replies || 0)) / stock.impressions * 100
              : undefined,
            metricsUpdatedAt: stock.impressions ? new Date().toISOString() : undefined,
          });
          migrated++;
        } else {
          skipped++;
        }
      }

      if (migrated > 0) {
        history.lastUpdated = new Date().toISOString();
        savePostsHistory(history);
        console.log(`[PostsHistory] Migrated ${migrated} posts from post_stock.json`);
      }
    }
  } catch (e) {
    console.error('Failed to migrate from post stock:', e);
  }

  return { migrated, skipped };
}

/**
 * インプレッションがある投稿のみを取得（分析用）
 */
export function getPostsWithMetrics(): PostHistoryEntry[] {
  const history = loadPostsHistory();
  return history.posts.filter(p => p.impressions && p.impressions > 0);
}

/**
 * 分析用のサマリーを取得
 */
export function getHistorySummary(): {
  totalPosts: number;
  postsWithMetrics: number;
  avgEngagementRate: number;
  recentPosts: PostHistoryEntry[];
} {
  const history = loadPostsHistory();
  const withMetrics = history.posts.filter(p => p.impressions && p.impressions > 0);

  const avgEngagementRate = withMetrics.length > 0
    ? withMetrics.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / withMetrics.length
    : 0;

  return {
    totalPosts: history.posts.length,
    postsWithMetrics: withMetrics.length,
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
    recentPosts: history.posts.slice(-10).reverse(),
  };
}

/**
 * 外部からの投稿データを一括インポート
 * （X APIから取得した過去ツイートなど）
 */
export async function bulkImportPosts(
  posts: Array<{
    tweetId: string;
    text: string;
    account: string;
    postedAt: string;
    impressions?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
  }>
): Promise<{ imported: number; skipped: number; duplicates: string[] }> {
  const history = loadPostsHistory();
  const existingTweetIds = new Set(
    history.posts.filter(p => p.tweetId).map(p => p.tweetId)
  );

  let imported = 0;
  const duplicates: string[] = [];

  for (const post of posts) {
    // 重複チェック（tweetIdベース）
    if (existingTweetIds.has(post.tweetId)) {
      duplicates.push(post.tweetId);
      continue;
    }

    const totalEngagements = (post.likes || 0) + (post.retweets || 0) + (post.replies || 0);
    const engagementRate = post.impressions && post.impressions > 0
      ? (totalEngagements / post.impressions) * 100
      : undefined;

    history.posts.push({
      id: `imported_${post.tweetId}`,
      text: post.text,
      account: post.account,
      target: 'インポート', // 過去データなので不明
      benefit: 'インポート',
      score: 0, // 過去データなのでスコアなし
      tweetId: post.tweetId,
      timestamp: post.postedAt,
      impressions: post.impressions,
      likes: post.likes,
      retweets: post.retweets,
      replies: post.replies,
      engagementRate,
      metricsUpdatedAt: post.impressions ? new Date().toISOString() : undefined,
    });

    existingTweetIds.add(post.tweetId);
    imported++;
  }

  if (imported > 0) {
    // 日付順にソート
    history.posts.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    history.lastUpdated = new Date().toISOString();
    savePostsHistory(history);
    console.log(`[PostsHistory] Bulk imported ${imported} posts`);
  }

  return {
    imported,
    skipped: duplicates.length,
    duplicates,
  };
}

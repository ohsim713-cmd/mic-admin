/**
 * 生成済み投稿 データベース
 * 大量の投稿を蓄積・管理
 */

import { promises as fs } from 'fs';
import path from 'path';
import { QualityScore } from '../langgraph/state';

const DATA_DIR = path.join(process.cwd(), 'data');
const POSTS_FILE = path.join(DATA_DIR, 'generated_posts.json');

export interface GeneratedPost {
  id: string;
  text: string;
  target: string;
  benefit: string;
  score: QualityScore;
  account: string;
  accountType: 'ライバー' | 'チャトレ';
  status: 'draft' | 'pending' | 'approved' | 'posted' | 'archived' | 'rejected';
  scheduledAt?: string;
  postedAt?: string;
  tweetId?: string;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
  // 分析データ（投稿後に追加）
  analytics?: {
    impressions?: number;
    engagements?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
    dmReceived?: boolean;
  };
}

export interface GeneratedPostsDB {
  posts: GeneratedPost[];
  lastUpdated: string;
  version: number;
}

/**
 * データディレクトリを確保
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * DBを読み込み
 */
async function loadDB(): Promise<GeneratedPostsDB> {
  await ensureDataDir();

  try {
    const data = await fs.readFile(POSTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    const defaultDB: GeneratedPostsDB = {
      posts: [],
      lastUpdated: new Date().toISOString(),
      version: 1,
    };
    await saveDB(defaultDB);
    return defaultDB;
  }
}

/**
 * DBを保存
 */
async function saveDB(db: GeneratedPostsDB): Promise<void> {
  await ensureDataDir();
  db.lastUpdated = new Date().toISOString();
  await fs.writeFile(POSTS_FILE, JSON.stringify(db, null, 2));
}

/**
 * 投稿を追加
 */
export async function addPost(
  post: Omit<GeneratedPost, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<GeneratedPost> {
  const db = await loadDB();

  const newPost: GeneratedPost = {
    ...post,
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.posts.push(newPost);
  await saveDB(db);
  return newPost;
}

/**
 * 複数投稿を一括追加
 */
export async function addPosts(
  posts: Array<Omit<GeneratedPost, 'id' | 'createdAt' | 'updatedAt' | 'status'>>
): Promise<GeneratedPost[]> {
  const db = await loadDB();
  const newPosts: GeneratedPost[] = [];

  for (const post of posts) {
    const newPost: GeneratedPost = {
      ...post,
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    newPosts.push(newPost);
    db.posts.push(newPost);
  }

  await saveDB(db);
  return newPosts;
}

/**
 * 投稿を取得（フィルター付き）
 */
export async function getPosts(options?: {
  account?: string;
  status?: GeneratedPost['status'];
  minScore?: number;
  limit?: number;
  offset?: number;
}): Promise<GeneratedPost[]> {
  const db = await loadDB();
  let posts = [...db.posts];

  if (options?.account) {
    posts = posts.filter((p) => p.account === options.account);
  }

  if (options?.status) {
    posts = posts.filter((p) => p.status === options.status);
  }

  if (options?.minScore !== undefined) {
    posts = posts.filter((p) => p.score.total >= options.minScore!);
  }

  // 最新順にソート
  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (options?.offset) {
    posts = posts.slice(options.offset);
  }

  if (options?.limit) {
    posts = posts.slice(0, options.limit);
  }

  return posts;
}

/**
 * 投稿を更新
 */
export async function updatePost(
  postId: string,
  updates: Partial<GeneratedPost>
): Promise<GeneratedPost | null> {
  const db = await loadDB();
  const post = db.posts.find((p) => p.id === postId);

  if (!post) {
    return null;
  }

  Object.assign(post, updates, { updatedAt: new Date().toISOString() });
  await saveDB(db);
  return post;
}

/**
 * 投稿のステータスを更新
 */
export async function updatePostStatus(
  postId: string,
  status: GeneratedPost['status'],
  tweetId?: string
): Promise<void> {
  const db = await loadDB();
  const post = db.posts.find((p) => p.id === postId);

  if (post) {
    post.status = status;
    post.updatedAt = new Date().toISOString();

    if (status === 'posted') {
      post.postedAt = new Date().toISOString();
      if (tweetId) {
        post.tweetId = tweetId;
      }
    }

    await saveDB(db);
  }
}

/**
 * 投稿に分析データを追加
 */
export async function addAnalytics(
  postId: string,
  analytics: GeneratedPost['analytics']
): Promise<void> {
  const db = await loadDB();
  const post = db.posts.find((p) => p.id === postId);

  if (post) {
    post.analytics = { ...post.analytics, ...analytics };
    post.updatedAt = new Date().toISOString();
    await saveDB(db);
  }
}

/**
 * 次に投稿する投稿を取得
 */
export async function getNextPostToPublish(
  account: string
): Promise<GeneratedPost | null> {
  const posts = await getPosts({
    account,
    status: 'approved',
    minScore: 8,
    limit: 1,
  });

  return posts[0] || null;
}

/**
 * 今日の投稿予定を取得
 */
export async function getTodaySchedule(
  account?: string
): Promise<GeneratedPost[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const db = await loadDB();
  let posts = db.posts.filter((p) => {
    if (p.scheduledAt) {
      const scheduled = new Date(p.scheduledAt);
      return scheduled >= today && scheduled < tomorrow;
    }
    return false;
  });

  if (account) {
    posts = posts.filter((p) => p.account === account);
  }

  posts.sort((a, b) => {
    const aTime = new Date(a.scheduledAt!).getTime();
    const bTime = new Date(b.scheduledAt!).getTime();
    return aTime - bTime;
  });

  return posts;
}

/**
 * DB統計情報を取得
 */
export async function getStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byAccount: Record<string, number>;
  avgScore: number;
  todayGenerated: number;
  todayPosted: number;
}> {
  const db = await loadDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byStatus: Record<string, number> = {};
  const byAccount: Record<string, number> = {};
  let totalScore = 0;
  let todayGenerated = 0;
  let todayPosted = 0;

  for (const post of db.posts) {
    byStatus[post.status] = (byStatus[post.status] || 0) + 1;
    byAccount[post.account] = (byAccount[post.account] || 0) + 1;
    totalScore += post.score.total;

    const createdDate = new Date(post.createdAt);
    if (createdDate >= today) {
      todayGenerated++;
    }

    if (post.postedAt) {
      const postedDate = new Date(post.postedAt);
      if (postedDate >= today) {
        todayPosted++;
      }
    }
  }

  return {
    total: db.posts.length,
    byStatus,
    byAccount,
    avgScore: db.posts.length > 0 ? totalScore / db.posts.length : 0,
    todayGenerated,
    todayPosted,
  };
}

/**
 * 古い投稿をアーカイブ
 */
export async function archiveOldPosts(daysOld: number = 30): Promise<number> {
  const db = await loadDB();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  let archivedCount = 0;

  for (const post of db.posts) {
    if (
      post.status === 'posted' &&
      new Date(post.postedAt!) < cutoffDate
    ) {
      post.status = 'archived';
      archivedCount++;
    }
  }

  if (archivedCount > 0) {
    await saveDB(db);
  }

  return archivedCount;
}

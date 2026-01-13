/**
 * スケジュールDB - 投稿予定と実績を管理
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AccountType } from '../dm-hunter/sns-adapter';
import { ScheduledPost, generateTodaySchedule, POSTING_SCHEDULE } from './scheduler';

const SCHEDULE_DB_PATH = path.join(process.cwd(), 'data', 'schedule_db.json');

export interface PostRecord {
  id: string;
  account: AccountType;
  scheduledTime: string;
  slot: string;
  status: 'pending' | 'ready' | 'posted' | 'failed' | 'skipped';
  stockId?: string;
  text?: string;
  target?: string;
  benefit?: string;
  score?: number;
  postedAt?: string;
  tweetId?: string;
  impressions?: number;
  engagements?: number;
  error?: string;
}

export interface DailySchedule {
  date: string;
  posts: PostRecord[];
  stats: {
    total: number;
    posted: number;
    pending: number;
    failed: number;
    totalImpressions: number;
  };
}

interface ScheduleDB {
  schedules: Record<string, DailySchedule>; // key: YYYY-MM-DD
  stats: {
    totalPosted: number;
    totalImpressions: number;
    totalDMs: number;
    lastUpdated: string;
  };
}

async function loadDB(): Promise<ScheduleDB> {
  try {
    const data = await fs.readFile(SCHEDULE_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      schedules: {},
      stats: {
        totalPosted: 0,
        totalImpressions: 0,
        totalDMs: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

async function saveDB(db: ScheduleDB): Promise<void> {
  const dir = path.dirname(SCHEDULE_DB_PATH);
  await fs.mkdir(dir, { recursive: true });
  db.stats.lastUpdated = new Date().toISOString();
  await fs.writeFile(SCHEDULE_DB_PATH, JSON.stringify(db, null, 2));
}

// 今日のスケジュールを取得または初期化
export async function getTodaySchedule(): Promise<DailySchedule> {
  const db = await loadDB();
  const today = new Date().toISOString().split('T')[0];

  if (!db.schedules[today]) {
    // 新しい日のスケジュールを初期化
    const schedule = generateTodaySchedule();
    db.schedules[today] = {
      date: today,
      posts: schedule.map(s => ({
        id: s.id,
        account: s.account,
        scheduledTime: s.scheduledTime,
        slot: s.slot,
        status: 'pending' as const,
      })),
      stats: {
        total: schedule.length,
        posted: 0,
        pending: schedule.length,
        failed: 0,
        totalImpressions: 0,
      },
    };
    await saveDB(db);
  }

  return db.schedules[today];
}

// 投稿予定を更新（ストックを割り当て）
export async function assignStockToPost(
  postId: string,
  stockId: string,
  stockData: {
    text: string;
    target: string;
    benefit: string;
    score: number;
  }
): Promise<PostRecord | null> {
  const db = await loadDB();
  const today = new Date().toISOString().split('T')[0];

  if (!db.schedules[today]) return null;

  const post = db.schedules[today].posts.find(p => p.id === postId);
  if (!post) return null;

  post.stockId = stockId;
  post.text = stockData.text;
  post.target = stockData.target;
  post.benefit = stockData.benefit;
  post.score = stockData.score;
  post.status = 'ready';

  await saveDB(db);
  return post;
}

// 投稿完了を記録
export async function markPostAsPosted(
  postId: string,
  result: {
    tweetId: string;
    postedAt: string;
  }
): Promise<PostRecord | null> {
  const db = await loadDB();
  const today = new Date().toISOString().split('T')[0];

  if (!db.schedules[today]) return null;

  const post = db.schedules[today].posts.find(p => p.id === postId);
  if (!post) return null;

  post.status = 'posted';
  post.tweetId = result.tweetId;
  post.postedAt = result.postedAt;

  // 統計更新
  db.schedules[today].stats.posted++;
  db.schedules[today].stats.pending--;
  db.stats.totalPosted++;

  await saveDB(db);
  return post;
}

// 投稿失敗を記録
export async function markPostAsFailed(
  postId: string,
  error: string
): Promise<PostRecord | null> {
  const db = await loadDB();
  const today = new Date().toISOString().split('T')[0];

  if (!db.schedules[today]) return null;

  const post = db.schedules[today].posts.find(p => p.id === postId);
  if (!post) return null;

  post.status = 'failed';
  post.error = error;

  db.schedules[today].stats.failed++;
  db.schedules[today].stats.pending--;

  await saveDB(db);
  return post;
}

// インプレッションを更新
export async function updateImpressions(
  postId: string,
  impressions: number,
  engagements?: number
): Promise<void> {
  const db = await loadDB();

  // 全日程から検索
  for (const dateKey of Object.keys(db.schedules)) {
    const post = db.schedules[dateKey].posts.find(p => p.id === postId || p.tweetId === postId);
    if (post) {
      const oldImpressions = post.impressions || 0;
      post.impressions = impressions;
      if (engagements !== undefined) {
        post.engagements = engagements;
      }

      // 統計更新
      db.schedules[dateKey].stats.totalImpressions += (impressions - oldImpressions);
      db.stats.totalImpressions += (impressions - oldImpressions);

      await saveDB(db);
      return;
    }
  }
}

// 次に投稿すべきポストを取得
export async function getNextPendingPosts(): Promise<PostRecord[]> {
  const schedule = await getTodaySchedule();
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // 現在時刻以前で、まだ投稿されていないもの
  return schedule.posts.filter(post => {
    if (post.status !== 'pending' && post.status !== 'ready') return false;
    return post.scheduledTime <= currentTime;
  });
}

// 今後の投稿予定を取得
export async function getUpcomingPosts(): Promise<PostRecord[]> {
  const schedule = await getTodaySchedule();
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return schedule.posts.filter(post => post.scheduledTime > currentTime);
}

// 週間統計を取得
export async function getWeeklyStats(): Promise<{
  posts: number;
  impressions: number;
  avgImpressions: number;
  dailyBreakdown: { date: string; posts: number; impressions: number }[];
}> {
  const db = await loadDB();
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let totalPosts = 0;
  let totalImpressions = 0;
  const dailyBreakdown: { date: string; posts: number; impressions: number }[] = [];

  for (let d = new Date(weekAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    const schedule = db.schedules[dateKey];

    if (schedule) {
      totalPosts += schedule.stats.posted;
      totalImpressions += schedule.stats.totalImpressions;
      dailyBreakdown.push({
        date: dateKey,
        posts: schedule.stats.posted,
        impressions: schedule.stats.totalImpressions,
      });
    }
  }

  return {
    posts: totalPosts,
    impressions: totalImpressions,
    avgImpressions: totalPosts > 0 ? Math.round(totalImpressions / totalPosts) : 0,
    dailyBreakdown,
  };
}

// 月間統計を取得
export async function getMonthlyStats(): Promise<{
  posts: number;
  impressions: number;
  avgImpressions: number;
  dms: number;
}> {
  const db = await loadDB();
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  let totalPosts = 0;
  let totalImpressions = 0;

  for (const dateKey of Object.keys(db.schedules)) {
    const scheduleDate = new Date(dateKey);
    if (scheduleDate >= monthAgo && scheduleDate <= today) {
      const schedule = db.schedules[dateKey];
      totalPosts += schedule.stats.posted;
      totalImpressions += schedule.stats.totalImpressions;
    }
  }

  return {
    posts: totalPosts,
    impressions: totalImpressions,
    avgImpressions: totalPosts > 0 ? Math.round(totalImpressions / totalPosts) : 0,
    dms: db.stats.totalDMs,
  };
}

// DM件数を記録
export async function recordDM(): Promise<void> {
  const db = await loadDB();
  db.stats.totalDMs++;
  await saveDB(db);
}

// 全スケジュールを取得（直近7日間）
export async function getRecentSchedules(): Promise<DailySchedule[]> {
  const db = await loadDB();
  const today = new Date();
  const schedules: DailySchedule[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    if (db.schedules[dateKey]) {
      schedules.push(db.schedules[dateKey]);
    }
  }

  return schedules;
}

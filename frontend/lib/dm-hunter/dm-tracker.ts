/**
 * DM Hunter - DM問い合わせトラッカー
 * 問い合わせ件数を記録・分析し、目標達成を管理
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AccountType } from './sns-adapter';
import { loadPostsHistory, PostHistoryEntry } from '@/lib/analytics/posts-history';
import { learnFromPost } from '@/lib/database/success-patterns-db';

const DB_PATH = path.join(process.cwd(), 'data', 'dm_tracking.json');

export interface DMEntry {
  id: string;
  timestamp: string;
  account: AccountType;
  source: 'twitter' | 'manual';
  linkedPostId?: string;       // どの投稿からのDMか
  status: 'new' | 'replied' | 'converted' | 'lost';
  notes?: string;
  conversionValue?: number;    // 成約した場合の価値
}

export interface DailyStats {
  date: string;
  totalDMs: number;
  byAccount: Record<'liver' | 'chatre1' | 'chatre2', number>;
  byStatus: Record<string, number>;
  goal: number;
  goalAchieved: boolean;
}

interface DMTrackingDB {
  entries: DMEntry[];
  dailyStats: DailyStats[];
  settings: {
    dailyGoal: number;
    lastUpdated: string;
  };
}

/**
 * DBを読み込む
 */
async function loadDB(): Promise<DMTrackingDB> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      entries: [],
      dailyStats: [],
      settings: {
        dailyGoal: 3,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

/**
 * DBを保存する
 */
async function saveDB(db: DMTrackingDB): Promise<void> {
  const dir = path.dirname(DB_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * DM問い合わせを記録
 */
export async function recordDM(params: {
  account: AccountType;
  source?: 'twitter' | 'manual';
  linkedPostId?: string;
  notes?: string;
}): Promise<DMEntry> {
  const db = await loadDB();

  const entry: DMEntry = {
    id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    account: params.account,
    source: params.source || 'manual',
    linkedPostId: params.linkedPostId,
    status: 'new',
    notes: params.notes,
  };

  db.entries.push(entry);
  await updateDailyStats(db);
  db.settings.lastUpdated = new Date().toISOString();
  await saveDB(db);

  console.log(`[DMTracker] Recorded DM: ${entry.id} from ${entry.account}`);
  return entry;
}

/**
 * DMステータスを更新
 */
export async function updateDMStatus(
  id: string,
  status: DMEntry['status'],
  conversionValue?: number
): Promise<DMEntry | null> {
  const db = await loadDB();
  const entry = db.entries.find(e => e.id === id);

  if (!entry) return null;

  entry.status = status;
  if (conversionValue !== undefined) {
    entry.conversionValue = conversionValue;
  }

  await updateDailyStats(db);
  await saveDB(db);

  return entry;
}

/**
 * 日次統計を更新
 */
async function updateDailyStats(db: DMTrackingDB): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // 今日のエントリーを集計
  const todayEntries = db.entries.filter(
    e => e.timestamp.startsWith(today)
  );

  const byAccount: Record<'liver' | 'chatre1' | 'chatre2', number> = {
    liver: 0,
    chatre1: 0,
    chatre2: 0,
  };

  const byStatus: Record<string, number> = {
    new: 0,
    replied: 0,
    converted: 0,
    lost: 0,
  };

  for (const entry of todayEntries) {
    if (entry.account !== 'wordpress') {
      byAccount[entry.account as 'liver' | 'chatre1' | 'chatre2']++;
    }
    byStatus[entry.status]++;
  }

  const stats: DailyStats = {
    date: today,
    totalDMs: todayEntries.length,
    byAccount,
    byStatus,
    goal: db.settings.dailyGoal,
    goalAchieved: todayEntries.length >= db.settings.dailyGoal,
  };

  // 既存の今日のデータを更新または追加
  const existingIndex = db.dailyStats.findIndex(s => s.date === today);
  if (existingIndex >= 0) {
    db.dailyStats[existingIndex] = stats;
  } else {
    db.dailyStats.push(stats);
  }

  // 過去30日分のみ保持
  db.dailyStats = db.dailyStats
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
}

/**
 * 今日のDM統計を取得
 */
export async function getTodayStats(): Promise<{
  total: number;
  goal: number;
  progress: number;
  byAccount: Record<'liver' | 'chatre1' | 'chatre2', number>;
  byStatus: Record<string, number>;
  goalAchieved: boolean;
  remaining: number;
}> {
  const db = await loadDB();
  const today = new Date().toISOString().split('T')[0];

  const todayEntries = db.entries.filter(
    e => e.timestamp.startsWith(today)
  );

  const byAccount: Record<'liver' | 'chatre1' | 'chatre2', number> = {
    liver: 0,
    chatre1: 0,
    chatre2: 0,
  };

  const byStatus: Record<string, number> = {
    new: 0,
    replied: 0,
    converted: 0,
    lost: 0,
  };

  for (const entry of todayEntries) {
    if (entry.account !== 'wordpress') {
      byAccount[entry.account as 'liver' | 'chatre1' | 'chatre2']++;
    }
    byStatus[entry.status]++;
  }

  const total = todayEntries.length;
  const goal = db.settings.dailyGoal;

  return {
    total,
    goal,
    progress: Math.min(total / goal * 100, 100),
    byAccount,
    byStatus,
    goalAchieved: total >= goal,
    remaining: Math.max(goal - total, 0),
  };
}

/**
 * 過去N日間の統計を取得
 */
export async function getHistoricalStats(days: number = 7): Promise<{
  dailyStats: DailyStats[];
  totalDMs: number;
  avgDMsPerDay: number;
  goalAchievementRate: number;
  conversionRate: number;
  bestDay: DailyStats | null;
  trend: 'up' | 'down' | 'stable';
}> {
  const db = await loadDB();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const recentStats = db.dailyStats.filter(s => s.date >= cutoffStr);

  const totalDMs = recentStats.reduce((sum, s) => sum + s.totalDMs, 0);
  const avgDMsPerDay = recentStats.length > 0 ? totalDMs / recentStats.length : 0;

  const achievedDays = recentStats.filter(s => s.goalAchieved).length;
  const goalAchievementRate = recentStats.length > 0
    ? (achievedDays / recentStats.length) * 100
    : 0;

  // コンバージョン率
  const convertedEntries = db.entries.filter(
    e => e.status === 'converted' && e.timestamp >= cutoffStr + 'T00:00:00'
  );
  const conversionRate = totalDMs > 0
    ? (convertedEntries.length / totalDMs) * 100
    : 0;

  // ベストな日
  const bestDay = recentStats.length > 0
    ? recentStats.reduce((best, curr) =>
        curr.totalDMs > best.totalDMs ? curr : best
      )
    : null;

  // トレンド計算（直近3日 vs その前3日）
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (recentStats.length >= 6) {
    const sorted = [...recentStats].sort((a, b) => b.date.localeCompare(a.date));
    const recent3 = sorted.slice(0, 3).reduce((s, d) => s + d.totalDMs, 0) / 3;
    const prev3 = sorted.slice(3, 6).reduce((s, d) => s + d.totalDMs, 0) / 3;

    if (recent3 > prev3 * 1.2) trend = 'up';
    else if (recent3 < prev3 * 0.8) trend = 'down';
  }

  return {
    dailyStats: recentStats.sort((a, b) => a.date.localeCompare(b.date)),
    totalDMs,
    avgDMsPerDay: Math.round(avgDMsPerDay * 10) / 10,
    goalAchievementRate: Math.round(goalAchievementRate),
    conversionRate: Math.round(conversionRate),
    bestDay,
    trend,
  };
}

/**
 * 投稿とDMの相関を分析
 * 投稿履歴と連携して、どの投稿パターンがDMを生んでいるか分析
 */
export async function analyzePostPerformance(): Promise<{
  topPerformingPosts: {
    postId: string;
    dmCount: number;
    conversionCount: number;
    text?: string;
    target?: string;
    benefit?: string;
  }[];
  byTarget: Record<string, number>;
  byBenefit: Record<string, number>;
  byAccount: Record<'liver' | 'chatre1' | 'chatre2', { dms: number; conversions: number }>;
  dmGeneratingPatterns: string[];
}> {
  const db = await loadDB();

  // 投稿履歴を読み込んでマッピング
  const postsHistory = loadPostsHistory();
  const postsMap = new Map<string, PostHistoryEntry>();
  for (const post of postsHistory.posts) {
    if (post.tweetId) {
      postsMap.set(post.tweetId, post);
    }
    postsMap.set(post.id, post);
  }

  // 投稿IDごとのDM数
  const postDMs: Record<string, { dms: number; conversions: number; post?: PostHistoryEntry }> = {};

  for (const entry of db.entries) {
    if (entry.linkedPostId) {
      if (!postDMs[entry.linkedPostId]) {
        postDMs[entry.linkedPostId] = {
          dms: 0,
          conversions: 0,
          post: postsMap.get(entry.linkedPostId),
        };
      }
      postDMs[entry.linkedPostId].dms++;
      if (entry.status === 'converted') {
        postDMs[entry.linkedPostId].conversions++;
      }
    }
  }

  const topPerformingPosts = Object.entries(postDMs)
    .map(([postId, data]) => ({
      postId,
      dmCount: data.dms,
      conversionCount: data.conversions,
      text: data.post?.text?.substring(0, 100),
      target: data.post?.target,
      benefit: data.post?.benefit,
    }))
    .sort((a, b) => b.dmCount - a.dmCount)
    .slice(0, 10);

  // ターゲット別・メリット別のDM数
  const byTarget: Record<string, number> = {};
  const byBenefit: Record<string, number> = {};

  for (const [, data] of Object.entries(postDMs)) {
    if (data.post?.target) {
      byTarget[data.post.target] = (byTarget[data.post.target] || 0) + data.dms;
    }
    if (data.post?.benefit) {
      byBenefit[data.post.benefit] = (byBenefit[data.post.benefit] || 0) + data.dms;
    }
  }

  // アカウント別の成績
  const byAccount: Record<'liver' | 'chatre1' | 'chatre2', { dms: number; conversions: number }> = {
    liver: { dms: 0, conversions: 0 },
    chatre1: { dms: 0, conversions: 0 },
    chatre2: { dms: 0, conversions: 0 },
  };

  for (const entry of db.entries) {
    if (entry.account !== 'wordpress') {
      byAccount[entry.account as 'liver' | 'chatre1' | 'chatre2'].dms++;
      if (entry.status === 'converted') {
        byAccount[entry.account as 'liver' | 'chatre1' | 'chatre2'].conversions++;
      }
    }
  }

  // DMを生んだ投稿のパターンを抽出（成功パターンDBに学習）
  const dmGeneratingPatterns: string[] = [];
  for (const post of topPerformingPosts) {
    if (post.dmCount >= 2 && post.text) {
      dmGeneratingPatterns.push(post.text);
      // DMを2件以上生んだ投稿は成功パターンとして学習
      try {
        const fullPost = postsMap.get(post.postId);
        if (fullPost?.text) {
          await learnFromPost(fullPost.text, 9.0, true); // DM獲得投稿は高スコア
        }
      } catch (e) {
        console.error('[DMTracker] Failed to learn from DM-generating post:', e);
      }
    }
  }

  return {
    topPerformingPosts,
    byTarget,
    byBenefit,
    byAccount,
    dmGeneratingPatterns,
  };
}

/**
 * DM目標を設定
 */
export async function setDailyGoal(goal: number): Promise<void> {
  const db = await loadDB();
  db.settings.dailyGoal = goal;
  db.settings.lastUpdated = new Date().toISOString();
  await saveDB(db);
}

/**
 * 最近のDMエントリーを取得
 */
export async function getRecentDMs(limit: number = 20): Promise<DMEntry[]> {
  const db = await loadDB();
  return db.entries
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

/**
 * 目標達成アラートをチェック
 */
export async function checkGoalAlert(): Promise<{
  shouldAlert: boolean;
  type: 'achieved' | 'behind' | 'critical' | null;
  message: string;
}> {
  const stats = await getTodayStats();
  const now = new Date();
  const hour = now.getHours();

  // 目標達成
  if (stats.goalAchieved) {
    return {
      shouldAlert: true,
      type: 'achieved',
      message: `目標達成！今日のDM: ${stats.total}件 (目標: ${stats.goal}件)`,
    };
  }

  // 18時以降で0件
  if (hour >= 18 && stats.total === 0) {
    return {
      shouldAlert: true,
      type: 'critical',
      message: `警告: ${hour}時時点でDM 0件。投稿内容を見直してください。`,
    };
  }

  // 21時以降で目標未達
  if (hour >= 21 && stats.total < stats.goal) {
    return {
      shouldAlert: true,
      type: 'behind',
      message: `注意: 残り${stats.remaining}件。追加施策を検討してください。`,
    };
  }

  return {
    shouldAlert: false,
    type: null,
    message: '',
  };
}

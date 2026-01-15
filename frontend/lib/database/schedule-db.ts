/**
 * スケジュールDB - Supabase版
 * 投稿予定と実績を管理
 */

import { supabase, ScheduleRecord } from './supabase';
import { AccountType } from '../dm-hunter/sns-adapter';
import { generateTodaySchedule, POSTING_SCHEDULE } from '../automation/scheduler';

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

// DB→アプリ形式変換
function toPostRecord(row: ScheduleRecord): PostRecord {
  return {
    id: row.id,
    account: row.account as AccountType,
    scheduledTime: row.scheduled_time,
    slot: row.slot,
    status: row.status,
    stockId: row.stock_id,
    text: row.text,
    target: row.target,
    benefit: row.benefit,
    score: row.score,
    postedAt: row.posted_at,
    tweetId: row.tweet_id,
    impressions: row.impressions,
    engagements: row.engagements,
    error: row.error,
  };
}

// 今日のスケジュールを取得または初期化
export async function getTodaySchedule(): Promise<DailySchedule> {
  const today = new Date().toISOString().split('T')[0];

  // DBから取得
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', today)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('[ScheduleDB] Error fetching schedules:', error);
    throw error;
  }

  // データがなければ初期化
  if (!data || data.length === 0) {
    const schedule = generateTodaySchedule();
    const records: Partial<ScheduleRecord>[] = schedule.map(s => ({
      id: s.id,
      account: s.account,
      scheduled_time: s.scheduledTime,
      slot: s.slot,
      status: 'pending' as const,
      date: today,
    }));

    const { error: insertError } = await supabase
      .from('schedules')
      .insert(records);

    if (insertError) {
      console.error('[ScheduleDB] Error inserting schedules:', insertError);
      throw insertError;
    }

    return {
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
  }

  // 統計計算
  const posts = data.map(toPostRecord);
  const stats = {
    total: posts.length,
    posted: posts.filter(p => p.status === 'posted').length,
    pending: posts.filter(p => p.status === 'pending' || p.status === 'ready').length,
    failed: posts.filter(p => p.status === 'failed').length,
    totalImpressions: posts.reduce((sum, p) => sum + (p.impressions || 0), 0),
  };

  return { date: today, posts, stats };
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
  const { data, error } = await supabase
    .from('schedules')
    .update({
      stock_id: stockId,
      text: stockData.text,
      target: stockData.target,
      benefit: stockData.benefit,
      score: stockData.score,
      status: 'ready',
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) {
    console.error('[ScheduleDB] Error assigning stock:', error);
    return null;
  }

  return toPostRecord(data);
}

// 投稿完了を記録
export async function markPostAsPosted(
  postId: string,
  result: {
    tweetId: string;
    postedAt: string;
  }
): Promise<PostRecord | null> {
  const { data, error } = await supabase
    .from('schedules')
    .update({
      status: 'posted',
      tweet_id: result.tweetId,
      posted_at: result.postedAt,
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) {
    console.error('[ScheduleDB] Error marking as posted:', error);
    return null;
  }

  return toPostRecord(data);
}

// 投稿失敗を記録
export async function markPostAsFailed(
  postId: string,
  errorMsg: string
): Promise<PostRecord | null> {
  const { data, error } = await supabase
    .from('schedules')
    .update({
      status: 'failed',
      error: errorMsg,
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) {
    console.error('[ScheduleDB] Error marking as failed:', error);
    return null;
  }

  return toPostRecord(data);
}

// インプレッションを更新
export async function updateImpressions(
  postId: string,
  impressions: number,
  engagements?: number
): Promise<void> {
  const updateData: Record<string, number> = { impressions };
  if (engagements !== undefined) {
    updateData.engagements = engagements;
  }

  const { error } = await supabase
    .from('schedules')
    .update(updateData)
    .or(`id.eq.${postId},tweet_id.eq.${postId}`);

  if (error) {
    console.error('[ScheduleDB] Error updating impressions:', error);
  }
}

// 次に投稿すべきポストを取得
export async function getNextPendingPosts(): Promise<PostRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', today)
    .in('status', ['pending', 'ready'])
    .lte('scheduled_time', currentTime)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('[ScheduleDB] Error fetching pending posts:', error);
    return [];
  }

  return (data || []).map(toPostRecord);
}

// 今後の投稿予定を取得
export async function getUpcomingPosts(): Promise<PostRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', today)
    .gt('scheduled_time', currentTime)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('[ScheduleDB] Error fetching upcoming posts:', error);
    return [];
  }

  return (data || []).map(toPostRecord);
}

// 週間統計を取得
export async function getWeeklyStats(): Promise<{
  posts: number;
  impressions: number;
  avgImpressions: number;
  dailyBreakdown: { date: string; posts: number; impressions: number }[];
}> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('schedules')
    .select('date, status, impressions')
    .gte('date', weekAgo.toISOString().split('T')[0])
    .lte('date', today.toISOString().split('T')[0]);

  if (error) {
    console.error('[ScheduleDB] Error fetching weekly stats:', error);
    return { posts: 0, impressions: 0, avgImpressions: 0, dailyBreakdown: [] };
  }

  // 日ごとに集計
  const dailyMap: Record<string, { posts: number; impressions: number }> = {};
  let totalPosts = 0;
  let totalImpressions = 0;

  for (const row of data || []) {
    if (row.status === 'posted') {
      totalPosts++;
      totalImpressions += row.impressions || 0;

      if (!dailyMap[row.date]) {
        dailyMap[row.date] = { posts: 0, impressions: 0 };
      }
      dailyMap[row.date].posts++;
      dailyMap[row.date].impressions += row.impressions || 0;
    }
  }

  const dailyBreakdown = Object.entries(dailyMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

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
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('schedules')
    .select('status, impressions')
    .gte('date', monthAgo.toISOString().split('T')[0])
    .lte('date', today.toISOString().split('T')[0])
    .eq('status', 'posted');

  if (error) {
    console.error('[ScheduleDB] Error fetching monthly stats:', error);
    return { posts: 0, impressions: 0, avgImpressions: 0, dms: 0 };
  }

  const totalPosts = data?.length || 0;
  const totalImpressions = data?.reduce((sum, r) => sum + (r.impressions || 0), 0) || 0;

  return {
    posts: totalPosts,
    impressions: totalImpressions,
    avgImpressions: totalPosts > 0 ? Math.round(totalImpressions / totalPosts) : 0,
    dms: 0, // TODO: DM追跡は別テーブル
  };
}

// 全スケジュールを取得（直近7日間）
export async function getRecentSchedules(): Promise<DailySchedule[]> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .gte('date', weekAgo.toISOString().split('T')[0])
    .lte('date', today.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('[ScheduleDB] Error fetching recent schedules:', error);
    return [];
  }

  // 日ごとにグループ化
  const grouped: Record<string, PostRecord[]> = {};
  for (const row of data || []) {
    if (!grouped[row.date]) {
      grouped[row.date] = [];
    }
    grouped[row.date].push(toPostRecord(row));
  }

  return Object.entries(grouped).map(([date, posts]) => ({
    date,
    posts,
    stats: {
      total: posts.length,
      posted: posts.filter(p => p.status === 'posted').length,
      pending: posts.filter(p => p.status === 'pending' || p.status === 'ready').length,
      failed: posts.filter(p => p.status === 'failed').length,
      totalImpressions: posts.reduce((sum, p) => sum + (p.impressions || 0), 0),
    },
  }));
}

/**
 * 完全自動化スケジューラー
 * 目標: 1日45投稿（3アカウント×15回）、平均インプレッション1000、月9件DM
 *
 * スケジュール:
 * - @tt_liver (ライバー事務所) × 15回/日
 * - @mic_chat_ (チャトレ事務所①) × 15回/日
 * - @ms_stripchat (チャトレ事務所②) × 15回/日
 */

import { AccountType, ACCOUNTS } from '../dm-hunter/sns-adapter';

// 全アカウント
const ALL_ACCOUNTS: AccountType[] = ['liver', 'chatre1', 'chatre2'];

// 投稿スケジュール（JST）
// 3アカウント同時投稿
export const POSTING_SCHEDULE = {
  slots: [
    { time: '07:00', label: '早朝', accounts: ALL_ACCOUNTS },
    { time: '08:00', label: '朝活層', accounts: ALL_ACCOUNTS },
    { time: '09:00', label: '通勤時間', accounts: ALL_ACCOUNTS },
    { time: '10:00', label: '午前', accounts: ALL_ACCOUNTS },
    { time: '11:00', label: '昼前', accounts: ALL_ACCOUNTS },
    { time: '12:00', label: '昼休み', accounts: ALL_ACCOUNTS },
    { time: '13:00', label: '午後', accounts: ALL_ACCOUNTS },
    { time: '14:00', label: '午後2', accounts: ALL_ACCOUNTS },
    { time: '15:00', label: 'おやつ時', accounts: ALL_ACCOUNTS },
    { time: '16:00', label: '夕方前', accounts: ALL_ACCOUNTS },
    { time: '17:00', label: '退勤前', accounts: ALL_ACCOUNTS },
    { time: '18:00', label: '退勤時間', accounts: ALL_ACCOUNTS },
    { time: '20:00', label: '夜', accounts: ALL_ACCOUNTS },
    { time: '22:00', label: 'ゴールデンタイム', accounts: ALL_ACCOUNTS },
    { time: '23:00', label: '夜更かし層', accounts: ALL_ACCOUNTS },
  ],

  // 合計: 15スロット × 3アカウント = 45投稿/日
  totalPostsPerDay: 45,
  postsPerAccount: 15,
};

// 目標設定
export const TARGETS = {
  daily: {
    posts: 15,           // 1日の投稿数
    impressions: 15000,  // 1日の総インプレッション目標（15投稿 × 1000）
    dmInquiries: 0.1,    // 1日のDM目標（月3件 ÷ 30日）
  },
  weekly: {
    posts: 105,          // 週の投稿数
    impressions: 105000, // 週の総インプレッション
    dmInquiries: 0.7,    // 週のDM目標
  },
  monthly: {
    posts: 450,          // 月の投稿数
    impressions: 450000, // 月の総インプレッション
    dmInquiries: 3,      // 月のDM目標
  },
};

// ストック設定（1日15投稿に対応）
export const STOCK_CONFIG = {
  minStockPerAccount: 15,  // 1日分のストック
  maxStockPerAccount: 30,  // 2日分のストック
  refillThreshold: 10,     // この数以下になったら補充
  minQualityScore: 7,
};

// 投稿予定の型
export interface ScheduledPost {
  id: string;
  account: AccountType;
  accountName: string;
  scheduledTime: string;
  scheduledAt: Date;
  slot: string;
  status: 'pending' | 'ready' | 'posted' | 'failed';
  stockId?: string;
  text?: string;
  target?: string;
  benefit?: string;
  score?: number;
  postedAt?: string;
  tweetId?: string;
  impressions?: number;
}

// 本日のスケジュールを生成
export function generateTodaySchedule(): ScheduledPost[] {
  const today = new Date();
  const schedule: ScheduledPost[] = [];

  for (const slot of POSTING_SCHEDULE.slots) {
    const [hours, minutes] = slot.time.split(':').map(Number);

    for (const accountId of slot.accounts) {
      const accountInfo = ACCOUNTS.find(a => a.id === accountId);
      const scheduledAt = new Date(today);
      scheduledAt.setHours(hours, minutes, 0, 0);

      // 過去の時間はスキップしない（完了済みとして記録）
      const isPast = scheduledAt < new Date();

      schedule.push({
        id: `${today.toISOString().split('T')[0]}-${slot.time}-${accountId}`,
        account: accountId,
        accountName: accountInfo?.name || accountId,
        scheduledTime: slot.time,
        scheduledAt,
        slot: slot.label,
        status: isPast ? 'pending' : 'pending', // 後で実際のステータスを更新
      });
    }
  }

  // 時間順にソート
  schedule.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return schedule;
}

// 次の投稿予定を取得
export function getNextScheduledPosts(): ScheduledPost[] {
  const schedule = generateTodaySchedule();
  const now = new Date();

  return schedule.filter(post => post.scheduledAt > now);
}

// 特定の時間帯の投稿を取得
export function getPostsForTimeSlot(time: string): ScheduledPost[] {
  const schedule = generateTodaySchedule();
  return schedule.filter(post => post.scheduledTime === time);
}

// UTC cron式を取得（GitHub Actions用）
export function getCronExpressions(): { time: string; cron: string; label: string }[] {
  return POSTING_SCHEDULE.slots.map(slot => {
    const [hours, minutes] = slot.time.split(':').map(Number);
    // JST → UTC 変換（-9時間）
    let utcHours = hours - 9;
    if (utcHours < 0) utcHours += 24;

    return {
      time: slot.time,
      cron: `${minutes} ${utcHours} * * *`,
      label: slot.label,
    };
  });
}

// 進捗計算
export function calculateProgress(posted: number, target: number): {
  percentage: number;
  status: 'on-track' | 'behind' | 'ahead';
  remaining: number;
} {
  const percentage = Math.round((posted / target) * 100);
  const remaining = target - posted;

  let status: 'on-track' | 'behind' | 'ahead' = 'on-track';
  if (percentage >= 100) {
    status = 'ahead';
  } else if (percentage < 50) {
    status = 'behind';
  }

  return { percentage, status, remaining };
}

// 時間帯ごとの最適なターゲット層
export const TIME_SLOT_TARGETS: Record<string, string[]> = {
  '07:00': ['副業探し主婦', '学生'],           // 早朝
  '08:00': ['副業探し主婦', '学生'],           // 朝活層
  '09:00': ['OL', '副業探し主婦'],             // 通勤時間
  '10:00': ['副業探し主婦', 'フリーター'],     // 午前
  '11:00': ['副業探し主婦', 'OL'],             // 昼前
  '12:00': ['OL', 'フリーター'],               // 昼休み
  '13:00': ['副業探し主婦', 'フリーター'],     // 午後
  '14:00': ['副業探し主婦', '学生'],           // 午後2
  '15:00': ['学生', 'フリーター'],             // おやつ時
  '16:00': ['学生', 'OL'],                     // 夕方前
  '17:00': ['OL', 'フリーター'],               // 退勤前
  '18:00': ['副業探し主婦', 'OL'],             // 退勤時間
  '20:00': ['フリーター', '学生'],             // 夜
  '22:00': ['フリーター', '学生', 'ナイトワーク経験者'], // ゴールデンタイム
  '23:00': ['ナイトワーク経験者', 'フリーター'], // 夜更かし層
};

// 本日の残り投稿数を計算
export function getRemainingPostsToday(): number {
  const schedule = generateTodaySchedule();
  const now = new Date();

  return schedule.filter(post => post.scheduledAt > now).length;
}

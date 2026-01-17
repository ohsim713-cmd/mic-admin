/**
 * 完全自動化スケジューラー
 * 目標: 1日15投稿、平均インプレッション1000、月3件DM
 *
 * スケジュール: @tt_liver × 15回/日
 *
 * チャトレアカウントは後で有効化:
 * - @mic_chat_ (チャトレ事務所①)
 * - @ms_stripchat (チャトレ事務所②)
 */

import { AccountType, ACCOUNTS } from '../dm-hunter/sns-adapter';
import { getRandomizedPostTime, shouldTakeBreak, getRandomizedDailyPostCount } from '../langgraph/humanizer';

// アクティブアカウント（@tt_liverのみ稼働中）
// チャトレアカウントを有効化するには: ['liver', 'chatre1', 'chatre2']
const ACTIVE_ACCOUNTS: AccountType[] = ['liver'];

// 投稿スケジュール（JST）- 1.5時間間隔、24時間対応
export const POSTING_SCHEDULE = {
  slots: [
    { time: '00:30', label: '深夜', accounts: ACTIVE_ACCOUNTS },
    { time: '02:00', label: '深夜2', accounts: ACTIVE_ACCOUNTS },
    { time: '03:30', label: '未明', accounts: ACTIVE_ACCOUNTS },
    { time: '05:00', label: '早朝', accounts: ACTIVE_ACCOUNTS },
    { time: '06:30', label: '起床時間', accounts: ACTIVE_ACCOUNTS },
    { time: '08:00', label: '朝活層', accounts: ACTIVE_ACCOUNTS },
    { time: '09:30', label: '通勤時間', accounts: ACTIVE_ACCOUNTS },
    { time: '11:00', label: '昼前', accounts: ACTIVE_ACCOUNTS },
    { time: '12:30', label: '昼休み', accounts: ACTIVE_ACCOUNTS },
    { time: '14:00', label: '午後', accounts: ACTIVE_ACCOUNTS },
    { time: '15:30', label: 'おやつ時', accounts: ACTIVE_ACCOUNTS },
    { time: '17:00', label: '退勤前', accounts: ACTIVE_ACCOUNTS },
    { time: '18:30', label: '帰宅時間', accounts: ACTIVE_ACCOUNTS },
    { time: '20:00', label: '夜', accounts: ACTIVE_ACCOUNTS },
    { time: '21:30', label: 'ゴールデンタイム', accounts: ACTIVE_ACCOUNTS },
    { time: '23:00', label: '夜更かし層', accounts: ACTIVE_ACCOUNTS },
  ],

  // 合計: 16スロット × 1アカウント = 16投稿/日（1.5時間間隔）
  totalPostsPerDay: 16,
  postsPerAccount: 16,
};

// 目標設定
export const TARGETS = {
  daily: {
    posts: 16,           // 1日の投稿数
    impressions: 16000,  // 1日の総インプレッション目標（16投稿 × 1000）
    dmInquiries: 0.1,    // 1日のDM目標（月3件 ÷ 30日）
  },
  weekly: {
    posts: 112,          // 週の投稿数
    impressions: 112000, // 週の総インプレッション
    dmInquiries: 0.7,    // 週のDM目標
  },
  monthly: {
    posts: 480,          // 月の投稿数
    impressions: 480000, // 月の総インプレッション
    dmInquiries: 3,      // 月のDM目標
  },
};

// ストック設定（1日16投稿に対応）
export const STOCK_CONFIG = {
  minStockPerAccount: 16,  // 1日分のストック
  maxStockPerAccount: 32,  // 2日分のストック
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

// 本日のスケジュールを生成（ランダム化対応）
export function generateTodaySchedule(randomize: boolean = false): ScheduledPost[] {
  const today = new Date();
  const schedule: ScheduledPost[] = [];

  // AI臭対策: たまに「休み」を入れる（週1回程度）
  const takingBreak = randomize && shouldTakeBreak();

  for (const slot of POSTING_SCHEDULE.slots) {
    const [hours, minutes] = slot.time.split(':').map(Number);

    // 休みの場合、午後のスロット（13:00-17:00）をスキップ
    if (takingBreak && hours >= 13 && hours <= 17) {
      continue;
    }

    for (const accountId of slot.accounts) {
      const accountInfo = ACCOUNTS.find(a => a.id === accountId);
      const scheduledAt = new Date(today);

      // AI臭対策: 投稿時間をランダム化（±15分）
      if (randomize) {
        const { hour, minute } = getRandomizedPostTime(hours, minutes);
        scheduledAt.setHours(hour, minute, 0, 0);
      } else {
        scheduledAt.setHours(hours, minutes, 0, 0);
      }

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

// 時間帯ごとの最適なターゲット層（1.5時間間隔対応）
export const TIME_SLOT_TARGETS: Record<string, string[]> = {
  '00:30': ['ナイトワーク経験者', 'フリーター'],  // 深夜
  '02:00': ['ナイトワーク経験者', 'フリーター'],  // 深夜2
  '03:30': ['ナイトワーク経験者', 'フリーター'],  // 未明
  '05:00': ['副業探し主婦', '学生'],              // 早朝
  '06:30': ['副業探し主婦', '学生'],              // 起床時間
  '08:00': ['副業探し主婦', '学生'],              // 朝活層
  '09:30': ['OL', '副業探し主婦'],                // 通勤時間
  '11:00': ['副業探し主婦', 'OL'],                // 昼前
  '12:30': ['OL', 'フリーター'],                  // 昼休み
  '14:00': ['副業探し主婦', '学生'],              // 午後
  '15:30': ['学生', 'フリーター'],                // おやつ時
  '17:00': ['OL', 'フリーター'],                  // 退勤前
  '18:30': ['副業探し主婦', 'OL'],                // 帰宅時間
  '20:00': ['フリーター', '学生'],                // 夜
  '21:30': ['フリーター', '学生', 'ナイトワーク経験者'], // ゴールデンタイム
  '23:00': ['ナイトワーク経験者', 'フリーター'],  // 夜更かし層
};

// 本日の残り投稿数を計算
export function getRemainingPostsToday(): number {
  const schedule = generateTodaySchedule();
  const now = new Date();

  return schedule.filter(post => post.scheduledAt > now).length;
}

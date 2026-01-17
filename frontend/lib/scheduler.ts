import cron from 'node-cron';
import { POSTING_SCHEDULE } from './automation/scheduler';

// 投稿済みスロットを記録（日付ごとにリセット）
let lastPostDate = '';
const postedSlots = new Set<string>();

/**
 * 自動投稿を実行
 */
async function executeAutoPost(slotTime: string, slotLabel: string) {
  try {
    console.log(`[Scheduler] 🚀 Executing auto-post for slot ${slotTime} (${slotLabel})...`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/automation/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.AUTO_POST_SECRET,
        dryRun: false,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log(`[Scheduler] ✅ Auto-post success for ${slotTime}:`, result.message);
      postedSlots.add(slotTime);
    } else {
      console.error(`[Scheduler] ❌ Auto-post failed for ${slotTime}:`, result.error || result);
    }

    return result;
  } catch (error) {
    console.error(`[Scheduler] ❌ Error executing auto-post for ${slotTime}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * 毎分実行して、スケジュールされた時間帯に投稿
 */
export function startScheduler() {
  console.log('[Scheduler] 🎯 Starting auto-post scheduler...');
  console.log(`[Scheduler] 📅 ${POSTING_SCHEDULE.slots.length} slots configured for @tt_liver`);

  // 毎分チェック
  cron.schedule('* * * * *', () => {
    const now = new Date();

    // JST時間を計算
    const jstHour = (now.getUTCHours() + 9) % 24;
    const jstMinute = now.getMinutes();
    const currentDate = now.toISOString().split('T')[0];

    // 日付が変わったらリセット
    if (currentDate !== lastPostDate) {
      console.log(`[Scheduler] 📆 New day detected, resetting posted slots`);
      postedSlots.clear();
      lastPostDate = currentDate;
    }

    // 現在のスロットを確認（各スロットの時間 ±5分以内）
    for (const slot of POSTING_SCHEDULE.slots) {
      const [slotHour, slotMinute] = slot.time.split(':').map(Number);

      // 既に投稿済みのスロットはスキップ
      if (postedSlots.has(slot.time)) {
        continue;
      }

      // 時間と分が一致（±5分以内）なら投稿
      const isHourMatch = jstHour === slotHour;
      const isMinuteMatch = jstMinute >= slotMinute && jstMinute <= slotMinute + 5;

      if (isHourMatch && isMinuteMatch) {
        console.log(`[Scheduler] ⏰ Time match! ${jstHour}:${jstMinute.toString().padStart(2, '0')} matches slot ${slot.time} (${slot.label})`);
        executeAutoPost(slot.time, slot.label);
        break; // 1回のチェックで1スロットのみ実行
      }
    }
  });

  console.log('[Scheduler] ✅ Scheduler started. Checking every minute for scheduled posts.');
  console.log('[Scheduler] 📋 Slots:', POSTING_SCHEDULE.slots.map(s => `${s.time} (${s.label})`).join(', '));
}

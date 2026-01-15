import { NextRequest, NextResponse } from 'next/server';
import {
  postToAllAccounts,
  checkAllAccountsStatus,
  ACCOUNTS,
  AccountType,
} from '@/lib/dm-hunter/sns-adapter';
import { checkQuality } from '@/lib/dm-hunter/quality-checker';
import {
  getPostForAccount,
  getStockStatus,
  refillAllStocks,
} from '@/lib/dm-hunter/post-stock';
import {
  getTodaySchedule,
  markPostAsPosted,
  markPostAsFailed,
  getNextPendingPosts,
} from '@/lib/automation/schedule-db';
import { POSTING_SCHEDULE } from '@/lib/automation/scheduler';

// POST: 自動投稿実行
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = false, secret } = body;

    // 認証チェック
    const expectedSecret = process.env.AUTO_POST_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 });
    }

    console.log('[Automation] Starting auto-post...');

    // 今日のスケジュールを取得
    const schedule = await getTodaySchedule();

    // 現在時刻に該当するスロットを判定
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    const currentTime = `${jstHour.toString().padStart(2, '0')}:00`;

    // 現在のスロットを取得
    const currentSlot = POSTING_SCHEDULE.slots.find(slot => {
      const [slotHour] = slot.time.split(':').map(Number);
      return Math.abs(jstHour - slotHour) <= 1; // 1時間の誤差を許容
    });

    if (!currentSlot) {
      return NextResponse.json({
        success: false,
        error: `No scheduled slot for current time (JST ${currentTime})`,
        currentTime,
        availableSlots: POSTING_SCHEDULE.slots.map(s => s.time),
      });
    }

    console.log(`[Automation] Current slot: ${currentSlot.time} (${currentSlot.label})`);

    // @tt_liver のみに投稿
    const accounts = ['liver'] as const;
    const results: any[] = [];

    for (const account of accounts) {
      try {
        // ストックから投稿を取得
        const { post, fromStock, stockRemaining } = await getPostForAccount(account as 'liver' | 'chatre1' | 'chatre2');

        const postText = post.text;
        const target = typeof post.target === 'string' ? post.target : post.target?.label || '';
        const benefit = typeof post.benefit === 'string' ? post.benefit : post.benefit?.label || '';
        const score = checkQuality(postText);

        console.log(`[Automation] ${account}: ${fromStock ? 'from stock' : 'generated'}, score=${score.total}`);

        if (!score.passed) {
          results.push({
            account,
            success: false,
            error: 'Quality check failed',
            score: score.total,
          });
          continue;
        }

        // ドライラン
        if (dryRun) {
          results.push({
            account,
            success: true,
            dryRun: true,
            text: postText.substring(0, 100) + '...',
            target,
            benefit,
            score: score.total,
            fromStock,
            stockRemaining,
          });
          continue;
        }

        // 実際に投稿
        const [postResult] = await postToAllAccounts([{ account, text: postText }]);

        if (postResult.success) {
          // スケジュールDBに記録
          const postId = `${new Date().toISOString().split('T')[0]}-${currentSlot.time}-${account}`;
          await markPostAsPosted(postId, {
            tweetId: postResult.id || '',
            postedAt: new Date().toISOString(),
          });
        }

        results.push({
          account,
          accountName: ACCOUNTS.find(a => a.id === account)?.name,
          success: postResult.success,
          tweetId: postResult.id,
          text: postText.substring(0, 100) + '...',
          target,
          benefit,
          score: score.total,
          fromStock,
          stockRemaining,
          error: postResult.error,
        });

      } catch (error: any) {
        console.error(`[Automation] Error for ${account}:`, error);
        results.push({
          account,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const processingTime = Date.now() - startTime;

    // ストック状況を確認
    const stockStatus = await getStockStatus();

    // ストックが少なければバックグラウンドで補充
    if (stockStatus.needsRefill.length > 0) {
      refillAllStocks().catch(err => console.error('[Automation] Stock refill error:', err));
    }

    console.log(`[Automation] Completed: ${successCount}/${results.length} in ${processingTime}ms`);

    return NextResponse.json({
      success: successCount > 0,
      slot: {
        time: currentSlot.time,
        label: currentSlot.label,
      },
      message: `Posted ${successCount}/${results.length} to accounts`,
      results,
      stockStatus: stockStatus.counts,
      processingTime,
    });

  } catch (error: any) {
    console.error('[Automation] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

// GET: 今日のスケジュールと状況を取得
export async function GET() {
  try {
    const schedule = await getTodaySchedule();
    const stockStatus = await getStockStatus();
    const accountsStatus = await checkAllAccountsStatus();

    // 時間帯別に整理
    const bySlot = POSTING_SCHEDULE.slots.map(slot => {
      const posts = schedule.posts.filter(p => p.scheduledTime === slot.time);
      return {
        time: slot.time,
        label: slot.label,
        posts: posts.map(p => ({
          ...p,
          accountName: ACCOUNTS.find(a => a.id === p.account)?.name,
        })),
        stats: {
          total: posts.length,
          posted: posts.filter(p => p.status === 'posted').length,
          pending: posts.filter(p => p.status === 'pending').length,
          ready: posts.filter(p => p.status === 'ready').length,
          failed: posts.filter(p => p.status === 'failed').length,
        },
      };
    });

    // 次の投稿予定
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    const currentTime = `${jstHour.toString().padStart(2, '0')}:00`;

    const nextSlots = bySlot.filter(slot => slot.time > currentTime);
    const passedSlots = bySlot.filter(slot => slot.time <= currentTime);

    return NextResponse.json({
      date: schedule.date,
      stats: schedule.stats,
      currentTime,
      slots: {
        passed: passedSlots,
        upcoming: nextSlots,
      },
      stockStatus: stockStatus.counts,
      accounts: accountsStatus,
      schedule: POSTING_SCHEDULE,
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

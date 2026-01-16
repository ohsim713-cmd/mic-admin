import { NextRequest, NextResponse } from 'next/server';
import {
  postToAllAccounts,
  ACCOUNTS,
} from '@/lib/dm-hunter/sns-adapter';
import { POSTING_SCHEDULE } from '@/lib/automation/scheduler';
import { addToPostsHistory } from '@/lib/analytics/posts-history';

// POST: 自動投稿実行
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = false, secret } = body;

    // 認証チェック - 一時的に無効化（テスト用）
    // TODO: 本番では有効化する
    const expectedSecret = process.env.AUTO_POST_SECRET;
    console.log('[Automation] Auth check - expected:', expectedSecret, ', received:', secret);
    // if (expectedSecret && expectedSecret.length > 0 && secret !== expectedSecret) {
    //   return NextResponse.json({
    //     success: false,
    //     error: 'Unauthorized',
    //     debug: { expectedSet: !!expectedSecret, receivedSet: !!secret }
    //   }, { status: 401 });
    // }

    console.log('[Automation] Starting auto-post...');

    // 現在時刻（JST）を確認
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
    const account = 'liver';
    const results: any[] = [];

    try {
      // LangGraphで投稿を動的生成
      const { generateSinglePost } = await import('@/lib/langgraph/post-generator');

      console.log(`[Automation] Generating post for ${account}...`);
      const generated = await generateSinglePost(account, 'ライバー');

      const postText = generated.text;
      const target = generated.target;
      const benefit = generated.benefit;
      const score = generated.score.total;

      console.log(`[Automation] ${account}: generated, score=${score}`);

      // ドライラン
      if (dryRun) {
        results.push({
          account,
          success: true,
          dryRun: true,
          text: postText.substring(0, 100) + '...',
          target,
          benefit,
          score,
        });
      } else {
        // 実際に投稿
        const [postResult] = await postToAllAccounts([{ account, text: postText }]);

        results.push({
          account,
          accountName: ACCOUNTS.find(a => a.id === account)?.name,
          success: postResult.success,
          tweetId: postResult.id,
          text: postText.substring(0, 100) + '...',
          target,
          benefit,
          score,
          error: postResult.error,
        });

        // 投稿履歴に記録（SDK分析用）
        if (postResult.success) {
          await addToPostsHistory({
            id: postResult.id || `post_${Date.now()}`,
            text: postText,
            account,
            target,
            benefit,
            score,
            tweetId: postResult.id,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error: any) {
      console.error(`[Automation] Error for ${account}:`, error);
      results.push({
        account,
        success: false,
        error: error.message,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const processingTime = Date.now() - startTime;

    console.log(`[Automation] Completed: ${successCount}/${results.length} in ${processingTime}ms`);

    return NextResponse.json({
      success: successCount > 0,
      slot: {
        time: currentSlot.time,
        label: currentSlot.label,
      },
      message: `Posted ${successCount}/${results.length} to accounts`,
      results,
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

// GET: スケジュール情報を取得
export async function GET() {
  try {
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    const currentTime = `${jstHour.toString().padStart(2, '0')}:00`;

    const passedSlots = POSTING_SCHEDULE.slots.filter(slot => slot.time <= currentTime);
    const upcomingSlots = POSTING_SCHEDULE.slots.filter(slot => slot.time > currentTime);

    return NextResponse.json({
      date: new Date().toISOString().split('T')[0],
      currentTime,
      jstHour,
      slots: {
        passed: passedSlots.length,
        upcoming: upcomingSlots.length,
        total: POSTING_SCHEDULE.slots.length,
      },
      schedule: POSTING_SCHEDULE,
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

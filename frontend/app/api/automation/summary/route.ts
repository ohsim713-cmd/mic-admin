import { NextRequest, NextResponse } from 'next/server';
import {
  getTodaySchedule,
  getWeeklyStats,
  getMonthlyStats,
} from '@/lib/automation/schedule-db';
import { getStockStatus } from '@/lib/dm-hunter/post-stock';
import { TARGETS, POSTING_SCHEDULE } from '@/lib/automation/scheduler';
import { ACCOUNTS } from '@/lib/dm-hunter/sns-adapter';

// POST: 日次サマリー生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { secret } = body;

    // 認証チェック
    const expectedSecret = process.env.AUTO_POST_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 });
    }

    const today = await getTodaySchedule();
    const weekly = await getWeeklyStats();
    const monthly = await getMonthlyStats();
    const stock = await getStockStatus();

    // 今日の進捗
    const todayProgress = {
      posts: {
        done: today.stats.posted,
        target: TARGETS.daily.posts,
        percentage: Math.round((today.stats.posted / TARGETS.daily.posts) * 100),
      },
      impressions: {
        total: today.stats.totalImpressions,
        target: TARGETS.daily.impressions,
        avg: today.stats.posted > 0 ? Math.round(today.stats.totalImpressions / today.stats.posted) : 0,
        avgTarget: 1000,
      },
    };

    // 月間進捗
    const monthlyProgress = {
      posts: {
        done: monthly.posts,
        target: TARGETS.monthly.posts,
        percentage: Math.round((monthly.posts / TARGETS.monthly.posts) * 100),
      },
      impressions: {
        total: monthly.impressions,
        avg: monthly.avgImpressions,
        target: 1000,
      },
      dms: {
        count: monthly.dms,
        target: TARGETS.monthly.dmInquiries,
        percentage: Math.round((monthly.dms / TARGETS.monthly.dmInquiries) * 100),
      },
    };

    // サマリーテキスト生成
    const summaryText = generateSummaryText(todayProgress, monthlyProgress, stock.counts);

    console.log('[Summary] Daily summary generated');
    console.log(summaryText);

    return NextResponse.json({
      success: true,
      date: today.date,
      today: todayProgress,
      weekly: {
        posts: weekly.posts,
        impressions: weekly.impressions,
        avgImpressions: weekly.avgImpressions,
      },
      monthly: monthlyProgress,
      stock: stock.counts,
      summary: summaryText,
    });

  } catch (error: any) {
    console.error('[Summary] Error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// GET: 現在の状況サマリー
export async function GET() {
  try {
    const today = await getTodaySchedule();
    const weekly = await getWeeklyStats();
    const monthly = await getMonthlyStats();
    const stock = await getStockStatus();

    // 時間帯別の進捗
    const slotProgress = POSTING_SCHEDULE.slots.map(slot => {
      const posts = today.posts.filter(p => p.scheduledTime === slot.time);
      return {
        time: slot.time,
        label: slot.label,
        total: posts.length,
        posted: posts.filter(p => p.status === 'posted').length,
        pending: posts.filter(p => p.status === 'pending' || p.status === 'ready').length,
        failed: posts.filter(p => p.status === 'failed').length,
      };
    });

    // 目標達成率
    const achievements = {
      daily: {
        posts: Math.round((today.stats.posted / TARGETS.daily.posts) * 100),
        impressions: today.stats.posted > 0
          ? Math.round((today.stats.totalImpressions / today.stats.posted / 1000) * 100)
          : 0,
      },
      monthly: {
        posts: Math.round((monthly.posts / TARGETS.monthly.posts) * 100),
        dms: Math.round((monthly.dms / TARGETS.monthly.dmInquiries) * 100),
      },
    };

    return NextResponse.json({
      date: today.date,
      schedule: {
        total: today.stats.total,
        posted: today.stats.posted,
        pending: today.stats.pending,
        failed: today.stats.failed,
        slots: slotProgress,
      },
      targets: TARGETS,
      achievements,
      stock: {
        counts: stock.counts,
        total: Object.values(stock.counts).reduce((a, b) => a + b, 0),
        needsRefill: stock.needsRefill,
      },
      weekly: {
        posts: weekly.posts,
        impressions: weekly.impressions,
        avgImpressions: weekly.avgImpressions,
        breakdown: weekly.dailyBreakdown,
      },
      monthly: {
        posts: monthly.posts,
        impressions: monthly.impressions,
        avgImpressions: monthly.avgImpressions,
        dms: monthly.dms,
      },
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

function generateSummaryText(
  today: any,
  monthly: any,
  stock: Record<string, number>
): string {
  const lines: string[] = [];

  lines.push('📊 日次レポート');
  lines.push('');
  lines.push('【今日の実績】');
  lines.push(`投稿: ${today.posts.done}/${today.posts.target} (${today.posts.percentage}%)`);
  lines.push(`インプレッション: ${today.impressions.total.toLocaleString()}`);
  lines.push(`平均: ${today.impressions.avg}/投稿 (目標: 1,000)`);
  lines.push('');
  lines.push('【月間進捗】');
  lines.push(`投稿: ${monthly.posts.done}/${monthly.posts.target} (${monthly.posts.percentage}%)`);
  lines.push(`DM問い合わせ: ${monthly.dms.count}/${monthly.dms.target}件`);
  lines.push('');
  lines.push('【ストック状況】');

  const stockTotal = Object.values(stock).reduce((a, b) => a + b, 0);
  lines.push(`合計: ${stockTotal}件`);

  for (const [account, count] of Object.entries(stock)) {
    const name = ACCOUNTS.find(a => a.id === account)?.name || account;
    const status = count >= 5 ? '✅' : count >= 3 ? '⚠️' : '❌';
    lines.push(`  ${status} ${name}: ${count}件`);
  }

  return lines.join('\n');
}

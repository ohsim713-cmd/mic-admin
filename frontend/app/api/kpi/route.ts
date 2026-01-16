/**
 * KPI API
 * GET /api/kpi - KPIダッシュボード用データ取得
 * POST /api/kpi/inquiry - DM問い合わせ記録
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const KPI_FILE = path.join(process.cwd(), 'data', 'kpi_stats.json');

interface KPIData {
  inquiries: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byAccount: Record<string, number>;
    history: Array<{
      date: string;
      account: string;
      timestamp: string;
      source?: string;
    }>;
  };
  posts: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byAccount: Record<string, number>;
  };
  impressions: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byAccount: Record<string, number>;
  };
  lastUpdated: string;
}

function getDefaultKPI(): KPIData {
  return {
    inquiries: {
      total: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      byAccount: {},
      history: [],
    },
    posts: {
      total: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      byAccount: {},
    },
    impressions: {
      total: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      byAccount: {},
    },
    lastUpdated: new Date().toISOString(),
  };
}

function loadKPI(): KPIData {
  try {
    if (!fs.existsSync(KPI_FILE)) {
      return getDefaultKPI();
    }
    const data = JSON.parse(fs.readFileSync(KPI_FILE, 'utf-8'));
    return data;
  } catch {
    return getDefaultKPI();
  }
}

function saveKPI(data: KPIData): void {
  try {
    const dir = path.dirname(KPI_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(KPI_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[KPI] Save error:', error);
  }
}

function recalculateKPI(kpi: KPIData): KPIData {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 問い合わせを再計算
  let todayInquiries = 0;
  let weekInquiries = 0;
  let monthInquiries = 0;
  const byAccount: Record<string, number> = {};

  for (const inquiry of kpi.inquiries.history) {
    const date = new Date(inquiry.timestamp);
    if (inquiry.timestamp.startsWith(today)) {
      todayInquiries++;
    }
    if (date >= weekAgo) {
      weekInquiries++;
    }
    if (date >= monthAgo) {
      monthInquiries++;
    }
    byAccount[inquiry.account] = (byAccount[inquiry.account] || 0) + 1;
  }

  kpi.inquiries.today = todayInquiries;
  kpi.inquiries.thisWeek = weekInquiries;
  kpi.inquiries.thisMonth = monthInquiries;
  kpi.inquiries.byAccount = byAccount;
  kpi.inquiries.total = kpi.inquiries.history.length;

  return kpi;
}

// GET: KPI統計取得
export async function GET() {
  try {
    const kpi = loadKPI();
    const recalculated = recalculateKPI(kpi);

    // 投稿データを別ソースから取得
    const postsHistory = await import('@/lib/analytics/posts-history').then(m => m.loadPostsHistory().posts).catch(() => []);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let todayPosts = 0;
    let weekPosts = 0;
    let monthPosts = 0;
    let totalImpressions = 0;
    const postsByAccount: Record<string, number> = {};
    const impressionsByAccount: Record<string, number> = {};

    for (const post of postsHistory) {
      const date = new Date(post.timestamp);
      if (post.timestamp.startsWith(today)) {
        todayPosts++;
      }
      if (date >= weekAgo) {
        weekPosts++;
      }
      if (date >= monthAgo) {
        monthPosts++;
      }
      postsByAccount[post.account] = (postsByAccount[post.account] || 0) + 1;

      if (post.impressions) {
        totalImpressions += post.impressions;
        impressionsByAccount[post.account] = (impressionsByAccount[post.account] || 0) + post.impressions;
      }
    }

    recalculated.posts = {
      total: postsHistory.length,
      today: todayPosts,
      thisWeek: weekPosts,
      thisMonth: monthPosts,
      byAccount: postsByAccount,
    };

    recalculated.impressions = {
      total: totalImpressions,
      today: 0, // 実際のデータがあれば更新
      thisWeek: 0,
      thisMonth: 0,
      byAccount: impressionsByAccount,
    };

    recalculated.lastUpdated = new Date().toISOString();

    // 目標との比較
    const targets = {
      daily: { posts: 15, inquiries: 0.1, impressions: 15000 },
      weekly: { posts: 105, inquiries: 0.7, impressions: 105000 },
      monthly: { posts: 450, inquiries: 3, impressions: 450000 },
    };

    return NextResponse.json({
      kpi: recalculated,
      targets,
      progress: {
        daily: {
          posts: Math.round((todayPosts / targets.daily.posts) * 100),
          inquiries: Math.round((recalculated.inquiries.today / targets.daily.inquiries) * 100),
          impressions: Math.round((recalculated.impressions.today / targets.daily.impressions) * 100),
        },
        monthly: {
          posts: Math.round((monthPosts / targets.monthly.posts) * 100),
          inquiries: Math.round((recalculated.inquiries.thisMonth / targets.monthly.inquiries) * 100),
          impressions: Math.round((recalculated.impressions.total / targets.monthly.impressions) * 100),
        },
      },
    });
  } catch (error: any) {
    console.error('[KPI] Error:', error);
    return NextResponse.json({
      kpi: getDefaultKPI(),
      targets: {
        daily: { posts: 15, inquiries: 0.1, impressions: 15000 },
        weekly: { posts: 105, inquiries: 0.7, impressions: 105000 },
        monthly: { posts: 450, inquiries: 3, impressions: 450000 },
      },
      progress: { daily: { posts: 0, inquiries: 0, impressions: 0 }, monthly: { posts: 0, inquiries: 0, impressions: 0 } },
      error: error.message,
    });
  }
}

// POST: DM問い合わせを記録
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, source } = body;

    if (!account) {
      return NextResponse.json({ error: 'Account is required' }, { status: 400 });
    }

    const kpi = loadKPI();

    kpi.inquiries.history.push({
      date: new Date().toISOString().split('T')[0],
      account,
      timestamp: new Date().toISOString(),
      source,
    });

    // 最大1000件まで保持
    if (kpi.inquiries.history.length > 1000) {
      kpi.inquiries.history = kpi.inquiries.history.slice(-1000);
    }

    const recalculated = recalculateKPI(kpi);
    recalculated.lastUpdated = new Date().toISOString();
    saveKPI(recalculated);

    return NextResponse.json({
      success: true,
      inquiries: recalculated.inquiries,
    });
  } catch (error: any) {
    console.error('[KPI] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * アカウント別詳細分析API
 * 投稿パフォーマンス、スコア分布、トレンドを返す
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// アカウント設定
const ACCOUNTS = {
  liver: { name: 'ライバー事務所', type: 'ライバー', twitter: '@tt_liver' },
  chatre1: { name: 'チャトレ事務所①', type: 'チャトレ', twitter: '@mic_chat_' },
  chatre2: { name: 'チャトレ事務所②', type: 'チャトレ', twitter: '@ms_stripchat' },
};

interface Post {
  id: string;
  text: string;
  account: string;
  accountType: string;
  target?: string;
  benefit?: string;
  score?: {
    empathy: number;
    benefit: number;
    cta: number;
    credibility: number;
    urgency: number;
    originality?: number;
    engagement?: number;
    scrollStop?: number;
    total: number;
  };
  status: string;
  createdAt: string;
  revisionCount?: number;
}

interface Stock {
  id: string;
  account: string;
  text: string;
  target: string;
  benefit: string;
  pattern: string;
  score: number;
  createdAt: string;
  usedAt?: string;
}

async function loadPosts(): Promise<Post[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'generated_posts.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.posts || [];
  } catch {
    return [];
  }
}

async function loadStock(): Promise<Stock[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'post_stock.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.stocks || [];
  } catch {
    return [];
  }
}

async function loadSuccessPatterns() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'success_patterns.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.patterns || [];
  } catch {
    return [];
  }
}

function analyzeScoreDistribution(posts: Post[]) {
  const postsWithScore = posts.filter(p => p.score && p.score.total > 0);

  if (postsWithScore.length === 0) {
    return {
      avg: 0,
      min: 0,
      max: 0,
      distribution: { excellent: 0, good: 0, average: 0, poor: 0 },
      byMetric: {},
    };
  }

  const scores = postsWithScore.map(p => p.score!.total);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  // スコア分布
  const distribution = {
    excellent: postsWithScore.filter(p => p.score!.total >= 12).length,
    good: postsWithScore.filter(p => p.score!.total >= 10 && p.score!.total < 12).length,
    average: postsWithScore.filter(p => p.score!.total >= 8 && p.score!.total < 10).length,
    poor: postsWithScore.filter(p => p.score!.total < 8).length,
  };

  // 各評価軸の平均
  const byMetric: Record<string, number> = {};
  const metrics = ['empathy', 'benefit', 'cta', 'credibility', 'urgency', 'originality', 'engagement', 'scrollStop'];

  for (const metric of metrics) {
    const values = postsWithScore
      .filter(p => p.score && (p.score as Record<string, number>)[metric] !== undefined)
      .map(p => (p.score as Record<string, number>)[metric]);

    if (values.length > 0) {
      byMetric[metric] = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
    }
  }

  return {
    avg: Number(avg.toFixed(2)),
    min: Math.min(...scores),
    max: Math.max(...scores),
    distribution,
    byMetric,
  };
}

function analyzeTargetPerformance(posts: Post[]) {
  const byTarget: Record<string, { count: number; avgScore: number; scores: number[] }> = {};

  for (const post of posts) {
    if (!post.target || !post.score?.total) continue;

    if (!byTarget[post.target]) {
      byTarget[post.target] = { count: 0, avgScore: 0, scores: [] };
    }

    byTarget[post.target].count++;
    byTarget[post.target].scores.push(post.score.total);
  }

  // 平均スコアを計算
  for (const target of Object.keys(byTarget)) {
    const data = byTarget[target];
    data.avgScore = Number((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2));
  }

  return Object.entries(byTarget)
    .map(([target, data]) => ({
      target,
      count: data.count,
      avgScore: data.avgScore,
    }))
    .sort((a, b) => b.count - a.count);
}

function analyzeBenefitPerformance(posts: Post[]) {
  const byBenefit: Record<string, { count: number; avgScore: number; scores: number[] }> = {};

  for (const post of posts) {
    if (!post.benefit || !post.score?.total) continue;

    if (!byBenefit[post.benefit]) {
      byBenefit[post.benefit] = { count: 0, avgScore: 0, scores: [] };
    }

    byBenefit[post.benefit].count++;
    byBenefit[post.benefit].scores.push(post.score.total);
  }

  for (const benefit of Object.keys(byBenefit)) {
    const data = byBenefit[benefit];
    data.avgScore = Number((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2));
  }

  return Object.entries(byBenefit)
    .map(([benefit, data]) => ({
      benefit,
      count: data.count,
      avgScore: data.avgScore,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function analyzeWeaknesses(posts: Post[]) {
  const weakPoints: Record<string, number> = {};

  for (const post of posts) {
    if (!post.score) continue;

    // 各指標で低スコアをカウント
    if (post.score.empathy < 2) weakPoints['共感・本音感'] = (weakPoints['共感・本音感'] || 0) + 1;
    if (post.score.benefit < 1) weakPoints['メリット提示'] = (weakPoints['メリット提示'] || 0) + 1;
    if (post.score.cta < 1) weakPoints['CTA'] = (weakPoints['CTA'] || 0) + 1;
    if (post.score.credibility < 1) weakPoints['信頼性'] = (weakPoints['信頼性'] || 0) + 1;
    if (post.score.urgency < 1) weakPoints['緊急性'] = (weakPoints['緊急性'] || 0) + 1;

    // 新規評価項目
    if (post.score.originality !== undefined && post.score.originality < 1) {
      weakPoints['独自性'] = (weakPoints['独自性'] || 0) + 1;
    }
    if (post.score.engagement !== undefined && post.score.engagement < 1) {
      weakPoints['エンゲージメント'] = (weakPoints['エンゲージメント'] || 0) + 1;
    }
    if (post.score.scrollStop !== undefined && post.score.scrollStop < 1) {
      weakPoints['スクロール停止力'] = (weakPoints['スクロール停止力'] || 0) + 1;
    }
  }

  return Object.entries(weakPoints)
    .map(([point, count]) => ({ point, count }))
    .sort((a, b) => b.count - a.count);
}

function analyzeTimeTrend(posts: Post[]) {
  // 日別の投稿数とスコア推移
  const byDate: Record<string, { count: number; totalScore: number; scores: number[] }> = {};

  for (const post of posts) {
    const date = post.createdAt.split('T')[0];

    if (!byDate[date]) {
      byDate[date] = { count: 0, totalScore: 0, scores: [] };
    }

    byDate[date].count++;
    if (post.score?.total) {
      byDate[date].scores.push(post.score.total);
      byDate[date].totalScore += post.score.total;
    }
  }

  return Object.entries(byDate)
    .map(([date, data]) => ({
      date,
      count: data.count,
      avgScore: data.scores.length > 0
        ? Number((data.totalScore / data.scores.length).toFixed(2))
        : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14); // 直近14日
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountFilter = searchParams.get('account'); // liver, chatre1, chatre2, all

  const [posts, stocks, successPatterns] = await Promise.all([
    loadPosts(),
    loadStock(),
    loadSuccessPatterns(),
  ]);

  // アカウント別に集計
  const accountStats: Record<string, {
    info: { name: string; type: string; twitter: string };
    posts: {
      total: number;
      pending: number;
      approved: number;
      posted: number;
    };
    stock: {
      total: number;
      unused: number;
      used: number;
    };
    scoreAnalysis: ReturnType<typeof analyzeScoreDistribution>;
    targetPerformance: ReturnType<typeof analyzeTargetPerformance>;
    benefitPerformance: ReturnType<typeof analyzeBenefitPerformance>;
    weaknesses: ReturnType<typeof analyzeWeaknesses>;
    timeTrend: ReturnType<typeof analyzeTimeTrend>;
    topPosts: Post[];
    recentPosts: Post[];
  }> = {};

  const accountKeys = accountFilter && accountFilter !== 'all'
    ? [accountFilter]
    : Object.keys(ACCOUNTS);

  for (const accountKey of accountKeys) {
    const accountInfo = ACCOUNTS[accountKey as keyof typeof ACCOUNTS];
    if (!accountInfo) continue;

    const accountPosts = posts.filter(p => p.account === accountKey);
    const accountStock = stocks.filter(s => s.account === accountKey);

    accountStats[accountKey] = {
      info: accountInfo,
      posts: {
        total: accountPosts.length,
        pending: accountPosts.filter(p => p.status === 'pending').length,
        approved: accountPosts.filter(p => p.status === 'approved').length,
        posted: accountPosts.filter(p => p.status === 'posted').length,
      },
      stock: {
        total: accountStock.length,
        unused: accountStock.filter(s => !s.usedAt).length,
        used: accountStock.filter(s => s.usedAt).length,
      },
      scoreAnalysis: analyzeScoreDistribution(accountPosts),
      targetPerformance: analyzeTargetPerformance(accountPosts),
      benefitPerformance: analyzeBenefitPerformance(accountPosts),
      weaknesses: analyzeWeaknesses(accountPosts),
      timeTrend: analyzeTimeTrend(accountPosts),
      topPosts: accountPosts
        .filter(p => p.score?.total)
        .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0))
        .slice(0, 5),
      recentPosts: accountPosts
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    };
  }

  // 全体サマリー
  const summary = {
    totalPosts: posts.length,
    totalStock: stocks.length,
    totalPatterns: successPatterns.length,
    accountBreakdown: Object.entries(ACCOUNTS).map(([key, info]) => ({
      key,
      name: info.name,
      posts: posts.filter(p => p.account === key).length,
      stock: stocks.filter(s => s.account === key).length,
    })),
  };

  return NextResponse.json({
    summary,
    accounts: accountStats,
    generatedAt: new Date().toISOString(),
  });
}

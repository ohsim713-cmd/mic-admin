/**
 * Agent SDK向けの分析サマリー生成
 * SDKがファイルを1つ読むだけで全体像を把握できるようにする
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SUMMARY_FILE = path.join(DATA_DIR, 'sdk_analysis_summary.json');

export interface PostAnalytics {
  id: string;
  account: string;
  text: string;
  target: string;
  benefit: string;
  score: number;
  status: 'pending' | 'posted' | 'failed';
  impressions?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  engagementRate?: number;
  createdAt: string;
  postedAt?: string;
}

export interface SDKSummary {
  generatedAt: string;
  overview: {
    totalPosts: number;
    pendingPosts: number;
    postedPosts: number;
    avgScore: number;
    minScore: number;
    maxScore: number;
    scoreDistribution: Record<string, number>;
  };
  performance: {
    totalImpressions: number;
    totalEngagement: number;
    avgEngagementRate: number;
    bestPerformingPost: PostAnalytics | null;
    worstPerformingPost: PostAnalytics | null;
  };
  patterns: {
    topHooks: Array<{ pattern: string; score: number; count: number }>;
    topCTAs: Array<{ pattern: string; score: number; count: number }>;
    targetDistribution: Record<string, { count: number; avgScore: number }>;
    benefitDistribution: Record<string, { count: number; avgScore: number }>;
  };
  recentPosts: PostAnalytics[];
  lowScorePosts: PostAnalytics[];
  highScorePosts: PostAnalytics[];
  recommendations: string[];
}

/**
 * 投稿ストックからデータを読み込み
 */
function loadPostStock(): PostAnalytics[] {
  const stockPath = path.join(DATA_DIR, 'post_stock.json');
  try {
    if (fs.existsSync(stockPath)) {
      const data = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
      return (data.stocks || []).map((p: any) => ({
        id: p.id,
        account: p.account,
        text: p.text,
        target: p.target || '不明',
        benefit: p.benefit || '不明',
        score: p.score || 0,
        status: p.usedAt ? 'posted' : 'pending',
        impressions: p.impressions,
        likes: p.likes,
        retweets: p.retweets,
        replies: p.replies,
        engagementRate: p.impressions ? ((p.likes || 0) + (p.retweets || 0) + (p.replies || 0)) / p.impressions * 100 : undefined,
        createdAt: p.createdAt,
        postedAt: p.usedAt,
      }));
    }
  } catch (e) {
    console.error('Failed to load post stock:', e);
  }
  return [];
}

/**
 * 成功パターンを読み込み
 */
function loadSuccessPatterns(): Array<{ pattern: string; category: string; score: number; usageCount: number }> {
  const patternsPath = path.join(DATA_DIR, 'success_patterns.json');
  try {
    if (fs.existsSync(patternsPath)) {
      const data = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
      return data.patterns || [];
    }
  } catch (e) {
    console.error('Failed to load success patterns:', e);
  }
  return [];
}

/**
 * SDKサマリーを生成
 */
export function generateSDKSummary(): SDKSummary {
  const posts = loadPostStock();
  const patterns = loadSuccessPatterns();

  // 基本統計
  const scores = posts.map(p => p.score).filter(s => s > 0);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // スコア分布
  const scoreDistribution: Record<string, number> = {
    '0-5': 0, '6-8': 0, '9-10': 0, '11-12': 0, '13-15': 0
  };
  scores.forEach(s => {
    if (s <= 5) scoreDistribution['0-5']++;
    else if (s <= 8) scoreDistribution['6-8']++;
    else if (s <= 10) scoreDistribution['9-10']++;
    else if (s <= 12) scoreDistribution['11-12']++;
    else scoreDistribution['13-15']++;
  });

  // パフォーマンス
  const postedPosts = posts.filter(p => p.status === 'posted');
  const totalImpressions = postedPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
  const totalEngagement = postedPosts.reduce((sum, p) => sum + (p.likes || 0) + (p.retweets || 0) + (p.replies || 0), 0);

  // ベスト/ワースト
  const sortedByEngagement = [...postedPosts].filter(p => p.engagementRate).sort((a, b) => (b.engagementRate || 0) - (a.engagementRate || 0));

  // ターゲット・ベネフィット分布
  const targetDist: Record<string, { count: number; totalScore: number }> = {};
  const benefitDist: Record<string, { count: number; totalScore: number }> = {};

  posts.forEach(p => {
    if (!targetDist[p.target]) targetDist[p.target] = { count: 0, totalScore: 0 };
    targetDist[p.target].count++;
    targetDist[p.target].totalScore += p.score;

    if (!benefitDist[p.benefit]) benefitDist[p.benefit] = { count: 0, totalScore: 0 };
    benefitDist[p.benefit].count++;
    benefitDist[p.benefit].totalScore += p.score;
  });

  // フックとCTAパターン
  const hooks = patterns.filter(p => p.category === 'hook').sort((a, b) => b.score - a.score).slice(0, 5);
  const ctas = patterns.filter(p => p.category === 'cta').sort((a, b) => b.score - a.score).slice(0, 5);

  // レコメンデーション生成
  const recommendations: string[] = [];

  if (avgScore < 8) {
    recommendations.push('平均スコアが8未満です。ナレッジベースの更新と成功パターンの追加を推奨');
  }
  if (scoreDistribution['0-5'] > posts.length * 0.2) {
    recommendations.push('低スコア投稿（5以下）が20%以上あります。品質向上が必要');
  }
  if (posts.filter(p => p.status === 'pending').length < 5) {
    recommendations.push('投稿ストックが少なくなっています。新規生成を推奨');
  }

  const lowEngagementTargets = Object.entries(targetDist)
    .filter(([_, v]) => v.count >= 3 && v.totalScore / v.count < 7)
    .map(([k]) => k);
  if (lowEngagementTargets.length > 0) {
    recommendations.push(`以下のターゲット向け投稿のスコアが低い: ${lowEngagementTargets.join(', ')}`);
  }

  const summary: SDKSummary = {
    generatedAt: new Date().toISOString(),
    overview: {
      totalPosts: posts.length,
      pendingPosts: posts.filter(p => p.status === 'pending').length,
      postedPosts: postedPosts.length,
      avgScore: Math.round(avgScore * 10) / 10,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      scoreDistribution,
    },
    performance: {
      totalImpressions,
      totalEngagement,
      avgEngagementRate: totalImpressions > 0 ? Math.round(totalEngagement / totalImpressions * 10000) / 100 : 0,
      bestPerformingPost: sortedByEngagement[0] || null,
      worstPerformingPost: sortedByEngagement[sortedByEngagement.length - 1] || null,
    },
    patterns: {
      topHooks: hooks.map(h => ({ pattern: h.pattern, score: h.score, count: h.usageCount })),
      topCTAs: ctas.map(c => ({ pattern: c.pattern, score: c.score, count: c.usageCount })),
      targetDistribution: Object.fromEntries(
        Object.entries(targetDist).map(([k, v]) => [k, { count: v.count, avgScore: Math.round(v.totalScore / v.count * 10) / 10 }])
      ),
      benefitDistribution: Object.fromEntries(
        Object.entries(benefitDist).map(([k, v]) => [k, { count: v.count, avgScore: Math.round(v.totalScore / v.count * 10) / 10 }])
      ),
    },
    recentPosts: posts.slice(-10).reverse(),
    lowScorePosts: posts.filter(p => p.score <= 7).slice(0, 10),
    highScorePosts: posts.filter(p => p.score >= 12).slice(0, 10),
    recommendations,
  };

  return summary;
}

/**
 * サマリーをファイルに保存
 */
export function saveSDKSummary(): string {
  const summary = generateSDKSummary();
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), 'utf-8');
  return SUMMARY_FILE;
}

/**
 * 既存のサマリーを読み込み
 */
export function loadSDKSummary(): SDKSummary | null {
  try {
    if (fs.existsSync(SUMMARY_FILE)) {
      return JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load SDK summary:', e);
  }
  return null;
}

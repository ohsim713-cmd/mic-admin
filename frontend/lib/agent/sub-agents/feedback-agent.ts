/**
 * Feedback Agent - 実績ベースの学習エージェント
 *
 * 投稿後のエンゲージメント（いいね・RT・リプ・DM）を
 * 取得して成功パターンを学習
 */

// EventBusは動的インポート（サーバーサイドのみ）
type EventBusType = Awaited<ReturnType<typeof import('../event-bus').getEventBus>>;
let eventBus: EventBusType | null = null;
async function getEventBusAsync(): Promise<EventBusType | null> {
  if (eventBus) return eventBus;
  if (typeof window === 'undefined') {
    try {
      const mod = await import('../event-bus');
      eventBus = mod.getEventBus();
    } catch {
      // サーバーサイドでない場合は無視
    }
  }
  return eventBus;
}

// Types
interface PostPerformance {
  postId: string;
  tweetId?: string;
  text: string;
  target: string;
  benefit: string;
  predictedScore: number;
  postedAt: string;

  // 実績メトリクス
  impressions?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  clicks?: number;
  profileVisits?: number;

  // 計算済みスコア
  actualScore?: number;
  scoreGap?: number; // 予測との差

  fetchedAt?: string;
}

interface PerformanceAnalysis {
  topPerformers: PostPerformance[];
  underPerformers: PostPerformance[];
  patterns: {
    winningHooks: string[];
    winningBenefits: string[];
    winningTargets: string[];
    losingPatterns: string[];
  };
  insights: string[];
}

// In-memory storage (本番ではDB推奨)
const performanceHistory: PostPerformance[] = [];
const MAX_HISTORY = 500;

/**
 * 投稿パフォーマンスを記録
 */
export function recordPost(post: Omit<PostPerformance, 'postId'>): string {
  const postId = `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const record: PostPerformance = {
    postId,
    ...post,
  };

  performanceHistory.push(record);
  if (performanceHistory.length > MAX_HISTORY) {
    performanceHistory.shift();
  }

  console.log(`[Feedback] 📝 Recorded post: ${postId}`);
  return postId;
}

/**
 * エンゲージメントメトリクスを更新
 * (Twitter API v2から取得した結果を反映)
 */
export function updateMetrics(
  postId: string,
  metrics: {
    impressions?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
    clicks?: number;
    profileVisits?: number;
  }
): void {
  const post = performanceHistory.find(p => p.postId === postId);
  if (!post) {
    console.warn(`[Feedback] Post not found: ${postId}`);
    return;
  }

  // メトリクス更新
  Object.assign(post, metrics);
  post.fetchedAt = new Date().toISOString();

  // 実績スコア計算
  post.actualScore = calculateActualScore(metrics);
  post.scoreGap = post.actualScore - post.predictedScore;

  console.log(`[Feedback] 📊 Updated metrics for ${postId}: actual=${post.actualScore}, gap=${post.scoreGap}`);

  // 大きなギャップがあればイベント発行（サーバーサイドのみ）
  const scoreGap = post.scoreGap;
  if (scoreGap !== undefined && Math.abs(scoreGap) > 3) {
    getEventBusAsync().then(bus => {
      if (bus) {
        bus.emit({
          type: 'analytics:alert',
          source: 'feedback-agent',
          data: {
            postId,
            predictedScore: post.predictedScore,
            actualScore: post.actualScore,
            gap: scoreGap,
            alert: scoreGap > 0 ? '予想以上に好成績' : '予想より低成績',
          },
          priority: scoreGap > 0 ? 'low' : 'high',
        });
      }
    });
  }
}

/**
 * 実績スコア計算（15点満点に正規化）
 */
function calculateActualScore(metrics: {
  impressions?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
}): number {
  const { impressions = 0, likes = 0, retweets = 0, replies = 0 } = metrics;

  if (impressions === 0) return 0;

  // エンゲージメント率
  const engagementRate = (likes + retweets * 2 + replies * 3) / impressions;

  // 15点満点に変換
  // 目安: 1%エンゲージメント = 7点, 2% = 10点, 3% = 13点, 5%以上 = 15点
  let score = 0;
  if (engagementRate >= 0.05) score = 15;
  else if (engagementRate >= 0.03) score = 13;
  else if (engagementRate >= 0.02) score = 10;
  else if (engagementRate >= 0.01) score = 7;
  else if (engagementRate >= 0.005) score = 5;
  else score = 3;

  // インプレッション数ボーナス
  if (impressions >= 10000) score = Math.min(15, score + 2);
  else if (impressions >= 5000) score = Math.min(15, score + 1);

  return score;
}

/**
 * tweetIdから投稿を検索して更新
 */
export function updateByTweetId(
  tweetId: string,
  metrics: Parameters<typeof updateMetrics>[1]
): void {
  const post = performanceHistory.find(p => p.tweetId === tweetId);
  if (post) {
    updateMetrics(post.postId, metrics);
  } else {
    console.warn(`[Feedback] Tweet not found: ${tweetId}`);
  }
}

/**
 * パフォーマンス分析
 */
export function analyzePerformance(): PerformanceAnalysis {
  const postsWithScore = performanceHistory.filter(p => p.actualScore !== undefined);

  if (postsWithScore.length === 0) {
    return {
      topPerformers: [],
      underPerformers: [],
      patterns: {
        winningHooks: [],
        winningBenefits: [],
        winningTargets: [],
        losingPatterns: [],
      },
      insights: ['データ不足: 投稿のエンゲージメントを取得してください'],
    };
  }

  // スコア順にソート
  const sorted = [...postsWithScore].sort((a, b) => (b.actualScore || 0) - (a.actualScore || 0));

  const topPerformers = sorted.slice(0, 10);
  const underPerformers = sorted.slice(-10).reverse();

  // パターン分析
  const winningHooks: string[] = [];
  const winningBenefits: string[] = [];
  const winningTargets: string[] = [];
  const losingPatterns: string[] = [];

  // 成功パターン抽出
  for (const post of topPerformers) {
    // 冒頭フック
    const hook = post.text.slice(0, 30).split(/[。！？\n]/)[0];
    if (hook) winningHooks.push(hook);

    // メリット
    if (post.benefit) winningBenefits.push(post.benefit);

    // ターゲット
    if (post.target) winningTargets.push(post.target);
  }

  // 失敗パターン抽出
  for (const post of underPerformers) {
    const hook = post.text.slice(0, 30).split(/[。！？\n]/)[0];
    if (hook) losingPatterns.push(hook);
  }

  // インサイト生成
  const insights: string[] = [];

  // 予測と実績の乖離分析
  const avgGap = postsWithScore.reduce((sum, p) => sum + (p.scoreGap || 0), 0) / postsWithScore.length;
  if (avgGap > 1) {
    insights.push(`予測スコアは実績より${avgGap.toFixed(1)}点低め（実際はもっと良い）`);
  } else if (avgGap < -1) {
    insights.push(`予測スコアは実績より${Math.abs(avgGap).toFixed(1)}点高め（予測が楽観的）`);
  }

  // ベストターゲット
  const targetCounts: Record<string, { count: number; totalScore: number }> = {};
  for (const post of postsWithScore) {
    if (post.target) {
      if (!targetCounts[post.target]) {
        targetCounts[post.target] = { count: 0, totalScore: 0 };
      }
      targetCounts[post.target].count++;
      targetCounts[post.target].totalScore += post.actualScore || 0;
    }
  }

  const targetPerformance = Object.entries(targetCounts)
    .map(([target, data]) => ({
      target,
      avgScore: data.totalScore / data.count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  if (targetPerformance.length > 0) {
    insights.push(`最も反応が良いターゲット: ${targetPerformance[0].target} (平均${targetPerformance[0].avgScore.toFixed(1)}点)`);
  }

  return {
    topPerformers,
    underPerformers,
    patterns: {
      winningHooks: [...new Set(winningHooks)],
      winningBenefits: [...new Set(winningBenefits)],
      winningTargets: [...new Set(winningTargets)],
      losingPatterns: [...new Set(losingPatterns)],
    },
    insights,
  };
}

/**
 * 学習結果をプロンプト用のコンテキストに変換
 */
export function getLearnedContext(): {
  recommendedHooks: string[];
  recommendedTargets: string[];
  recommendedBenefits: string[];
  avoidPatterns: string[];
  tips: string[];
} {
  const analysis = analyzePerformance();

  return {
    recommendedHooks: analysis.patterns.winningHooks.slice(0, 5),
    recommendedTargets: analysis.patterns.winningTargets.slice(0, 3),
    recommendedBenefits: analysis.patterns.winningBenefits.slice(0, 5),
    avoidPatterns: analysis.patterns.losingPatterns.slice(0, 5),
    tips: analysis.insights,
  };
}

/**
 * 投稿履歴を取得
 */
export function getHistory(limit: number = 50): PostPerformance[] {
  return performanceHistory.slice(-limit);
}

/**
 * 統計サマリー
 */
export function getStats(): {
  totalPosts: number;
  postsWithMetrics: number;
  avgPredictedScore: number;
  avgActualScore: number;
  avgScoreGap: number;
  topTarget: string | null;
  topBenefit: string | null;
} {
  const postsWithMetrics = performanceHistory.filter(p => p.actualScore !== undefined);

  const avgPredicted = performanceHistory.length > 0
    ? performanceHistory.reduce((sum, p) => sum + p.predictedScore, 0) / performanceHistory.length
    : 0;

  const avgActual = postsWithMetrics.length > 0
    ? postsWithMetrics.reduce((sum, p) => sum + (p.actualScore || 0), 0) / postsWithMetrics.length
    : 0;

  const avgGap = postsWithMetrics.length > 0
    ? postsWithMetrics.reduce((sum, p) => sum + (p.scoreGap || 0), 0) / postsWithMetrics.length
    : 0;

  // トップターゲット/メリット
  const analysis = analyzePerformance();

  return {
    totalPosts: performanceHistory.length,
    postsWithMetrics: postsWithMetrics.length,
    avgPredictedScore: Math.round(avgPredicted * 10) / 10,
    avgActualScore: Math.round(avgActual * 10) / 10,
    avgScoreGap: Math.round(avgGap * 10) / 10,
    topTarget: analysis.patterns.winningTargets[0] || null,
    topBenefit: analysis.patterns.winningBenefits[0] || null,
  };
}

export default {
  recordPost,
  updateMetrics,
  updateByTweetId,
  analyzePerformance,
  getLearnedContext,
  getHistory,
  getStats,
};

// Stripchat パフォーマンス分析

export interface StreamSession {
  id: string;
  userId: string;
  startTime: string;
  endTime: string;
  duration: number; // 分

  // パフォーマンス指標
  metrics: {
    peakViewers: number;
    avgViewers: number;
    totalViewers: number;

    // 収益
    publicTips: number;     // トークン
    privateTips: number;
    c2cTips: number;
    totalTokens: number;

    // エンゲージメント
    chatMessages: number;
    newFollowers: number;
    privateRequests: number;
    privateMinutes: number;
  };

  // 配信設定
  settings: {
    title: string;
    tags: string[];
    tipGoal?: number;
    tipGoalReached: boolean;
  };
}

export interface DailyStats {
  date: string;
  userId: string;

  totalHours: number;
  sessions: number;

  totalTokens: number;
  avgTokensPerHour: number;

  totalViewers: number;
  avgViewers: number;
  peakViewers: number;

  newFollowers: number;

  privateMinutes: number;
  privateEarnings: number;
}

export interface MonthlyReport {
  month: string; // YYYY-MM
  userId: string;

  totalHours: number;
  totalSessions: number;

  totalTokens: number;
  estimatedEarnings: number; // USD
  tokenRate: number; // トークンあたりの価値

  avgDailyHours: number;
  avgDailyEarnings: number;

  topDays: { date: string; tokens: number }[];

  growth: {
    followersGained: number;
    viewerGrowth: number; // %
    earningsGrowth: number; // %
  };

  insights: string[];
  recommendations: string[];
}

// パフォーマンス計算
export function calculatePerformanceScore(session: StreamSession): number {
  const weights = {
    avgViewers: 0.2,
    tipsPerViewer: 0.3,
    privateConversion: 0.25,
    engagement: 0.25,
  };

  const avgViewerScore = Math.min(session.metrics.avgViewers / 50, 1);
  const tipsPerViewer = session.metrics.totalViewers > 0
    ? session.metrics.totalTokens / session.metrics.totalViewers
    : 0;
  const tipsScore = Math.min(tipsPerViewer / 10, 1);

  const privateConversion = session.metrics.totalViewers > 0
    ? session.metrics.privateRequests / session.metrics.totalViewers
    : 0;
  const privateScore = Math.min(privateConversion / 0.1, 1);

  const chatPerViewer = session.metrics.totalViewers > 0
    ? session.metrics.chatMessages / session.metrics.totalViewers
    : 0;
  const engagementScore = Math.min(chatPerViewer / 5, 1);

  return (
    avgViewerScore * weights.avgViewers +
    tipsScore * weights.tipsPerViewer +
    privateScore * weights.privateConversion +
    engagementScore * weights.engagement
  ) * 100;
}

// 時間帯分析
export function analyzeBestTimes(sessions: StreamSession[]): {
  bestHours: { hour: number; avgTokens: number }[];
  bestDays: { day: string; avgTokens: number }[];
} {
  const hourlyStats: Record<number, { total: number; count: number }> = {};
  const dailyStats: Record<string, { total: number; count: number }> = {};

  const days = ['日', '月', '火', '水', '木', '金', '土'];

  sessions.forEach(session => {
    const date = new Date(session.startTime);
    const hour = date.getHours();
    const day = days[date.getDay()];

    if (!hourlyStats[hour]) hourlyStats[hour] = { total: 0, count: 0 };
    hourlyStats[hour].total += session.metrics.totalTokens;
    hourlyStats[hour].count++;

    if (!dailyStats[day]) dailyStats[day] = { total: 0, count: 0 };
    dailyStats[day].total += session.metrics.totalTokens;
    dailyStats[day].count++;
  });

  const bestHours = Object.entries(hourlyStats)
    .map(([hour, stats]) => ({
      hour: parseInt(hour),
      avgTokens: stats.count > 0 ? stats.total / stats.count : 0,
    }))
    .sort((a, b) => b.avgTokens - a.avgTokens)
    .slice(0, 5);

  const bestDays = Object.entries(dailyStats)
    .map(([day, stats]) => ({
      day,
      avgTokens: stats.count > 0 ? stats.total / stats.count : 0,
    }))
    .sort((a, b) => b.avgTokens - a.avgTokens);

  return { bestHours, bestDays };
}

// 成長率計算
export function calculateGrowthRate(
  current: number,
  previous: number
): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// AI改善提案生成
export function generateRecommendations(
  sessions: StreamSession[],
  monthlyReport: MonthlyReport
): string[] {
  const recommendations: string[] = [];

  // 配信時間分析
  if (monthlyReport.avgDailyHours < 3) {
    recommendations.push('配信時間を増やすことで収益アップが見込めます。目標: 1日4時間以上');
  }

  // 視聴者エンゲージメント
  const avgEngagement = sessions.reduce((sum, s) =>
    sum + (s.metrics.chatMessages / Math.max(s.metrics.totalViewers, 1)), 0) / sessions.length;

  if (avgEngagement < 3) {
    recommendations.push('視聴者との会話を増やしましょう。入室挨拶、質問を積極的に');
  }

  // プライベート率
  const totalTokens = sessions.reduce((sum, s) => sum + s.metrics.totalTokens, 0);
  const privateTokens = sessions.reduce((sum, s) => sum + s.metrics.privateTips, 0);
  const privateRate = totalTokens > 0 ? (privateTokens / totalTokens) * 100 : 0;

  if (privateRate < 30) {
    recommendations.push('プライベートショーへの誘導を増やしましょう。パブリックでの雰囲気づくりが重要');
  }

  // 時間帯最適化
  const { bestHours } = analyzeBestTimes(sessions);
  if (bestHours.length > 0) {
    const topHour = bestHours[0].hour;
    recommendations.push(`最も収益が高い時間帯は ${topHour}:00台です。この時間の配信を増やしましょう`);
  }

  return recommendations;
}

// トークン→円換算（概算）
export function tokensToJPY(tokens: number, rate: number = 0.05): number {
  // 1トークン ≈ $0.05 として計算
  const usd = tokens * rate;
  const jpy = usd * 150; // レートは変動
  return Math.round(jpy);
}

/**
 * DM Hunter - パフォーマンス分析エンジン
 * 投稿とDMの相関を分析し、改善提案を自動生成
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AccountType } from './sns-adapter';
import { GoogleGenAI } from "@google/genai";

const LOGS_PATH = path.join(process.cwd(), 'data', 'dm_hunter_logs.json');
const DM_PATH = path.join(process.cwd(), 'data', 'dm_tracking.json');
const ANALYSIS_PATH = path.join(process.cwd(), 'data', 'performance_analysis.json');

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey });

interface PostLog {
  id: string;
  timestamp: string;
  text: string;
  target: string;
  benefit: string;
  account?: string;
  score: number;
}

interface PerformanceMetrics {
  postId: string;
  account: AccountType;
  timestamp: string;
  target: string;
  benefit: string;
  score: number;
  dmCount: number;
  conversionCount: number;
  performanceScore: number; // 総合スコア
}

interface AnalysisResult {
  lastAnalyzed: string;
  topPerformers: PerformanceMetrics[];
  worstPerformers: PerformanceMetrics[];
  insights: {
    bestTargets: { target: string; avgDMs: number; count: number }[];
    bestBenefits: { benefit: string; avgDMs: number; count: number }[];
    bestTimes: { hour: number; avgDMs: number; count: number }[];
    accountPerformance: Record<'liver' | 'chatre1' | 'chatre2', {
      totalPosts: number;
      totalDMs: number;
      avgDMsPerPost: number;
      conversionRate: number;
    }>;
  };
  recommendations: string[];
}

/**
 * 投稿ログを読み込む
 */
async function loadPostLogs(): Promise<PostLog[]> {
  try {
    const data = await fs.readFile(LOGS_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.logs || [];
  } catch {
    return [];
  }
}

/**
 * DM追跡データを読み込む
 */
async function loadDMData(): Promise<any> {
  try {
    const data = await fs.readFile(DM_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { entries: [] };
  }
}

/**
 * 分析結果を保存
 */
async function saveAnalysis(analysis: AnalysisResult): Promise<void> {
  const dir = path.dirname(ANALYSIS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(ANALYSIS_PATH, JSON.stringify(analysis, null, 2));
}

/**
 * パフォーマンス分析を実行
 */
export async function analyzePerformance(days: number = 7): Promise<AnalysisResult> {
  const postLogs = await loadPostLogs();
  const dmData = await loadDMData();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString();

  // 期間内の投稿をフィルタ
  const recentPosts = postLogs.filter(p => p.timestamp >= cutoffStr);

  // 投稿ごとのDM数を計算
  const postMetrics: PerformanceMetrics[] = recentPosts.map(post => {
    const linkedDMs = dmData.entries?.filter(
      (dm: any) => dm.linkedPostId === post.id
    ) || [];

    const dmCount = linkedDMs.length;
    const conversionCount = linkedDMs.filter(
      (dm: any) => dm.status === 'converted'
    ).length;

    // パフォーマンススコア = (DM数 * 10) + (コンバージョン * 50) + (品質スコア)
    const performanceScore = (dmCount * 10) + (conversionCount * 50) + post.score;

    return {
      postId: post.id,
      account: (post.account || 'chatre1') as AccountType,
      timestamp: post.timestamp,
      target: post.target,
      benefit: post.benefit,
      score: post.score,
      dmCount,
      conversionCount,
      performanceScore,
    };
  });

  // トップパフォーマー
  const topPerformers = [...postMetrics]
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 10);

  // ワーストパフォーマー
  const worstPerformers = [...postMetrics]
    .sort((a, b) => a.performanceScore - b.performanceScore)
    .slice(0, 5);

  // ターゲット別の分析
  const targetStats = new Map<string, { dms: number; count: number }>();
  for (const metric of postMetrics) {
    const existing = targetStats.get(metric.target) || { dms: 0, count: 0 };
    targetStats.set(metric.target, {
      dms: existing.dms + metric.dmCount,
      count: existing.count + 1,
    });
  }
  const bestTargets = Array.from(targetStats.entries())
    .map(([target, stats]) => ({
      target,
      avgDMs: stats.count > 0 ? stats.dms / stats.count : 0,
      count: stats.count,
    }))
    .sort((a, b) => b.avgDMs - a.avgDMs);

  // ベネフィット別の分析
  const benefitStats = new Map<string, { dms: number; count: number }>();
  for (const metric of postMetrics) {
    const existing = benefitStats.get(metric.benefit) || { dms: 0, count: 0 };
    benefitStats.set(metric.benefit, {
      dms: existing.dms + metric.dmCount,
      count: existing.count + 1,
    });
  }
  const bestBenefits = Array.from(benefitStats.entries())
    .map(([benefit, stats]) => ({
      benefit,
      avgDMs: stats.count > 0 ? stats.dms / stats.count : 0,
      count: stats.count,
    }))
    .sort((a, b) => b.avgDMs - a.avgDMs);

  // 時間帯別の分析
  const timeStats = new Map<number, { dms: number; count: number }>();
  for (const metric of postMetrics) {
    const hour = new Date(metric.timestamp).getHours();
    const existing = timeStats.get(hour) || { dms: 0, count: 0 };
    timeStats.set(hour, {
      dms: existing.dms + metric.dmCount,
      count: existing.count + 1,
    });
  }
  const bestTimes = Array.from(timeStats.entries())
    .map(([hour, stats]) => ({
      hour,
      avgDMs: stats.count > 0 ? stats.dms / stats.count : 0,
      count: stats.count,
    }))
    .sort((a, b) => b.avgDMs - a.avgDMs);

  // アカウント別の分析 (Twitterアカウントのみ)
  const accountPerformance: Record<'liver' | 'chatre1' | 'chatre2', any> = {
    liver: { totalPosts: 0, totalDMs: 0, avgDMsPerPost: 0, conversionRate: 0 },
    chatre1: { totalPosts: 0, totalDMs: 0, avgDMsPerPost: 0, conversionRate: 0 },
    chatre2: { totalPosts: 0, totalDMs: 0, avgDMsPerPost: 0, conversionRate: 0 },
  };

  for (const metric of postMetrics) {
    const acc = metric.account;
    if (acc !== 'wordpress') {
      accountPerformance[acc as 'liver' | 'chatre1' | 'chatre2'].totalPosts++;
      accountPerformance[acc as 'liver' | 'chatre1' | 'chatre2'].totalDMs += metric.dmCount;
    }
  }

  for (const acc of ['liver', 'chatre1', 'chatre2'] as const) {
    const data = accountPerformance[acc];
    data.avgDMsPerPost = data.totalPosts > 0 ? data.totalDMs / data.totalPosts : 0;
    data.avgDMsPerPost = Math.round(data.avgDMsPerPost * 100) / 100;
  }

  // 改善提案を生成
  const recommendations = await generateRecommendations({
    topPerformers,
    bestTargets,
    bestBenefits,
    bestTimes,
    accountPerformance,
  });

  const analysis: AnalysisResult = {
    lastAnalyzed: new Date().toISOString(),
    topPerformers,
    worstPerformers,
    insights: {
      bestTargets,
      bestBenefits,
      bestTimes,
      accountPerformance,
    },
    recommendations,
  };

  await saveAnalysis(analysis);
  return analysis;
}

/**
 * AIで改善提案を生成
 */
async function generateRecommendations(data: {
  topPerformers: PerformanceMetrics[];
  bestTargets: any[];
  bestBenefits: any[];
  bestTimes: any[];
  accountPerformance: any;
}): Promise<string[]> {
  try {
    const prompt = `以下の投稿パフォーマンスデータを分析し、DM問い合わせを増やすための具体的な改善提案を3-5つ生成してください。

## パフォーマンスデータ

### 最も効果的だったターゲット
${data.bestTargets.slice(0, 3).map(t => `- ${t.target}: 平均${t.avgDMs.toFixed(2)}DM/投稿 (${t.count}投稿)`).join('\n')}

### 最も効果的だったベネフィット
${data.bestBenefits.slice(0, 3).map(b => `- ${b.benefit}: 平均${b.avgDMs.toFixed(2)}DM/投稿 (${b.count}投稿)`).join('\n')}

### 最も効果的だった時間帯
${data.bestTimes.slice(0, 3).map(t => `- ${t.hour}時: 平均${t.avgDMs.toFixed(2)}DM/投稿`).join('\n')}

### アカウント別パフォーマンス
- ライバー: ${data.accountPerformance.liver.avgDMsPerPost}DM/投稿
- チャトレ①: ${data.accountPerformance.chatre1.avgDMsPerPost}DM/投稿
- チャトレ②: ${data.accountPerformance.chatre2.avgDMsPerPost}DM/投稿

## 出力形式
- 箇条書きで3-5つの具体的な改善提案
- 各提案は1-2文で簡潔に
- データに基づいた実行可能なアドバイス

改善提案:`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = result.text || "";
    const lines = text.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.replace(/^[-•]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 5);

    return lines.length > 0 ? lines : [
      '効果的なターゲットへの投稿頻度を増やす',
      '反応の良い時間帯に投稿を集中させる',
      '成功した投稿のパターンを分析して再現する',
    ];
  } catch (error) {
    console.error('[PerformanceAnalyzer] Recommendation generation error:', error);
    return [
      '効果的なターゲットへの投稿頻度を増やす',
      '反応の良い時間帯に投稿を集中させる',
      '成功した投稿のパターンを分析して再現する',
    ];
  }
}

/**
 * A/Bテスト結果を分析
 */
export async function analyzeABTest(params: {
  variantA: { target: string; benefit: string; posts: number; dms: number };
  variantB: { target: string; benefit: string; posts: number; dms: number };
}): Promise<{
  winner: 'A' | 'B' | 'tie';
  confidence: number;
  recommendation: string;
}> {
  const { variantA, variantB } = params;

  const rateA = variantA.posts > 0 ? variantA.dms / variantA.posts : 0;
  const rateB = variantB.posts > 0 ? variantB.dms / variantB.posts : 0;

  const diff = Math.abs(rateA - rateB);
  const avgRate = (rateA + rateB) / 2;

  // 簡易的な信頼度計算（サンプルサイズと差分から）
  const minPosts = Math.min(variantA.posts, variantB.posts);
  const confidence = Math.min(
    (minPosts / 10) * 0.5 + (diff / (avgRate || 0.01)) * 0.5,
    1
  ) * 100;

  let winner: 'A' | 'B' | 'tie' = 'tie';
  if (diff > 0.1 && confidence > 60) {
    winner = rateA > rateB ? 'A' : 'B';
  }

  const winnerData = winner === 'A' ? variantA : variantB;
  const recommendation = winner !== 'tie'
    ? `${winnerData.target} × ${winnerData.benefit} の組み合わせが効果的です。`
    : 'まだ十分なデータがありません。テストを継続してください。';

  return {
    winner,
    confidence: Math.round(confidence),
    recommendation,
  };
}

/**
 * 週次レポートを生成
 */
export async function generateWeeklyReport(): Promise<{
  summary: string;
  metrics: {
    totalPosts: number;
    totalDMs: number;
    conversionRate: number;
    goalAchievementDays: number;
  };
  highlights: string[];
  improvements: string[];
}> {
  const analysis = await analyzePerformance(7);

  const totalPosts = analysis.topPerformers.length + analysis.worstPerformers.length;
  const totalDMs = analysis.topPerformers.reduce((sum, p) => sum + p.dmCount, 0) +
                   analysis.worstPerformers.reduce((sum, p) => sum + p.dmCount, 0);
  const totalConversions = analysis.topPerformers.reduce((sum, p) => sum + p.conversionCount, 0);
  const conversionRate = totalDMs > 0 ? (totalConversions / totalDMs) * 100 : 0;

  // サマリーをAIで生成
  let summary = '';
  try {
    const prompt = `以下のデータを元に、週次レポートのサマリーを2-3文で生成してください。

- 総投稿数: ${totalPosts}
- 総DM数: ${totalDMs}
- コンバージョン率: ${conversionRate.toFixed(1)}%
- 最も効果的だったターゲット: ${analysis.insights.bestTargets[0]?.target || 'N/A'}
- トレンド: ${analysis.recommendations[0] || 'データ収集中'}

サマリー:`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    summary = result.text?.trim() || '';
  } catch {
    summary = `今週は${totalPosts}件の投稿を行い、${totalDMs}件のDMを獲得しました。`;
  }

  return {
    summary,
    metrics: {
      totalPosts,
      totalDMs,
      conversionRate: Math.round(conversionRate * 10) / 10,
      goalAchievementDays: 0, // DM追跡データから計算
    },
    highlights: analysis.recommendations.slice(0, 2),
    improvements: analysis.recommendations.slice(2),
  };
}

/**
 * 最新の分析結果を取得
 */
export async function getLatestAnalysis(): Promise<AnalysisResult | null> {
  try {
    const data = await fs.readFile(ANALYSIS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

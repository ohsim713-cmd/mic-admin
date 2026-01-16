/**
 * PDCA分析システム
 * Check: 投稿後の実績を分析
 * Act: 分析結果をナレッジに反映
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

export interface PostPerformance {
  id: string;
  text: string;
  target: string;
  benefit: string;
  score: number;  // 生成時のAIスコア
  tweetId?: string;
  postedAt?: string;
  // 実績データ
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  engagementRate: number;  // (likes + retweets + replies) / impressions * 100
}

export interface PDCACheckResult {
  analyzedAt: string;
  totalAnalyzed: number;

  // スコアと実績の相関
  scoreCorrelation: {
    highScoreAvgEngagement: number;  // スコア12+の平均エンゲージメント
    lowScoreAvgEngagement: number;   // スコア8-の平均エンゲージメント
    correlationStrength: 'strong' | 'moderate' | 'weak' | 'none';
  };

  // 効果的なパターン
  effectivePatterns: {
    targets: Array<{ target: string; avgEngagement: number; count: number }>;
    benefits: Array<{ benefit: string; avgEngagement: number; count: number }>;
    hooks: Array<{ hook: string; avgEngagement: number; count: number }>;
  };

  // 改善が必要なパターン
  underperforming: {
    targets: string[];
    benefits: string[];
    commonIssues: string[];
  };

  // 推奨アクション
  recommendations: string[];
}

/**
 * 投稿履歴からパフォーマンスデータを読み込み
 */
function loadPostPerformance(): PostPerformance[] {
  const historyPath = path.join(KNOWLEDGE_DIR, 'posts_history.json');
  const stockPath = path.join(DATA_DIR, 'post_stock.json');

  const performances: PostPerformance[] = [];

  // posts_history.jsonから実績データを取得
  try {
    if (fs.existsSync(historyPath)) {
      const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      const posts = historyData.posts || [];

      for (const post of posts) {
        if (post.impressions && post.impressions > 0) {
          performances.push({
            id: post.id,
            text: post.text,
            target: post.target || '不明',
            benefit: post.benefit || '不明',
            score: post.score || 0,
            tweetId: post.tweetId,
            postedAt: post.timestamp,
            impressions: post.impressions,
            likes: post.likes || 0,
            retweets: post.retweets || 0,
            replies: post.replies || 0,
            engagementRate: post.impressions > 0
              ? ((post.likes || 0) + (post.retweets || 0) + (post.replies || 0)) / post.impressions * 100
              : 0,
          });
        }
      }
    }
  } catch (e) {
    console.error('Failed to load posts history:', e);
  }

  // post_stock.jsonから追加データを取得
  try {
    if (fs.existsSync(stockPath)) {
      const stockData = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
      const stocks = stockData.stocks || [];

      for (const stock of stocks) {
        // usedAtがあり、impressionsがある場合（投稿済みで実績あり）
        if (stock.usedAt && stock.impressions && stock.impressions > 0) {
          // 既に追加済みでなければ追加
          if (!performances.find(p => p.id === stock.id)) {
            performances.push({
              id: stock.id,
              text: stock.text,
              target: stock.target || '不明',
              benefit: stock.benefit || '不明',
              score: typeof stock.score === 'object' ? stock.score.total : (stock.score || 0),
              postedAt: stock.usedAt,
              impressions: stock.impressions,
              likes: stock.likes || 0,
              retweets: stock.retweets || 0,
              replies: stock.replies || 0,
              engagementRate: stock.impressions > 0
                ? ((stock.likes || 0) + (stock.retweets || 0) + (stock.replies || 0)) / stock.impressions * 100
                : 0,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load post stock:', e);
  }

  return performances;
}

/**
 * 冒頭のフックパターンを抽出
 */
function extractHook(text: string): string {
  const firstLine = text.split('\n')[0].trim();
  // 最初の20文字または最初の文を返す
  if (firstLine.length <= 30) return firstLine;
  return firstLine.slice(0, 30) + '...';
}

/**
 * Check: 投稿実績を分析
 */
export function runPDCACheck(): PDCACheckResult {
  const performances = loadPostPerformance();

  if (performances.length === 0) {
    return {
      analyzedAt: new Date().toISOString(),
      totalAnalyzed: 0,
      scoreCorrelation: {
        highScoreAvgEngagement: 0,
        lowScoreAvgEngagement: 0,
        correlationStrength: 'none',
      },
      effectivePatterns: { targets: [], benefits: [], hooks: [] },
      underperforming: { targets: [], benefits: [], commonIssues: ['データ不足'] },
      recommendations: ['投稿実績データがありません。投稿後にインプレッション取得を実行してください。'],
    };
  }

  // スコアと実績の相関分析
  const highScorePosts = performances.filter(p => p.score >= 12);
  const lowScorePosts = performances.filter(p => p.score <= 8);

  const highScoreAvgEngagement = highScorePosts.length > 0
    ? highScorePosts.reduce((sum, p) => sum + p.engagementRate, 0) / highScorePosts.length
    : 0;
  const lowScoreAvgEngagement = lowScorePosts.length > 0
    ? lowScorePosts.reduce((sum, p) => sum + p.engagementRate, 0) / lowScorePosts.length
    : 0;

  let correlationStrength: 'strong' | 'moderate' | 'weak' | 'none' = 'none';
  if (highScoreAvgEngagement > 0 && lowScoreAvgEngagement > 0) {
    const ratio = highScoreAvgEngagement / lowScoreAvgEngagement;
    if (ratio > 2) correlationStrength = 'strong';
    else if (ratio > 1.5) correlationStrength = 'moderate';
    else if (ratio > 1.1) correlationStrength = 'weak';
  }

  // ターゲット別分析
  const targetStats: Record<string, { sum: number; count: number }> = {};
  const benefitStats: Record<string, { sum: number; count: number }> = {};
  const hookStats: Record<string, { sum: number; count: number }> = {};

  for (const p of performances) {
    // ターゲット
    if (!targetStats[p.target]) targetStats[p.target] = { sum: 0, count: 0 };
    targetStats[p.target].sum += p.engagementRate;
    targetStats[p.target].count++;

    // ベネフィット
    if (!benefitStats[p.benefit]) benefitStats[p.benefit] = { sum: 0, count: 0 };
    benefitStats[p.benefit].sum += p.engagementRate;
    benefitStats[p.benefit].count++;

    // フック
    const hook = extractHook(p.text);
    if (!hookStats[hook]) hookStats[hook] = { sum: 0, count: 0 };
    hookStats[hook].sum += p.engagementRate;
    hookStats[hook].count++;
  }

  // 効果的なパターン（上位5件）
  const effectiveTargets = Object.entries(targetStats)
    .map(([target, s]) => ({ target, avgEngagement: s.sum / s.count, count: s.count }))
    .filter(t => t.count >= 2)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 5);

  const effectiveBenefits = Object.entries(benefitStats)
    .map(([benefit, s]) => ({ benefit, avgEngagement: s.sum / s.count, count: s.count }))
    .filter(b => b.count >= 2)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 5);

  const effectiveHooks = Object.entries(hookStats)
    .map(([hook, s]) => ({ hook, avgEngagement: s.sum / s.count, count: s.count }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 5);

  // 改善が必要なパターン（平均以下）
  const avgEngagement = performances.reduce((sum, p) => sum + p.engagementRate, 0) / performances.length;

  const underperformingTargets = Object.entries(targetStats)
    .filter(([_, s]) => s.count >= 2 && s.sum / s.count < avgEngagement * 0.7)
    .map(([t]) => t);

  const underperformingBenefits = Object.entries(benefitStats)
    .filter(([_, s]) => s.count >= 2 && s.sum / s.count < avgEngagement * 0.7)
    .map(([b]) => b);

  // 推奨アクション生成
  const recommendations: string[] = [];

  if (correlationStrength === 'weak' || correlationStrength === 'none') {
    recommendations.push('AIスコアと実績の相関が弱いです。評価基準の見直しを推奨します');
  }

  if (effectiveTargets.length > 0) {
    recommendations.push(`効果的なターゲット「${effectiveTargets[0].target}」への投稿を増やしましょう`);
  }

  if (underperformingTargets.length > 0) {
    recommendations.push(`「${underperformingTargets.join('、')}」向け投稿のコピーを改善してください`);
  }

  if (effectiveHooks.length > 0 && effectiveHooks[0].avgEngagement > avgEngagement * 1.5) {
    recommendations.push(`フック「${effectiveHooks[0].hook}」が効果的。類似パターンを増やしましょう`);
  }

  return {
    analyzedAt: new Date().toISOString(),
    totalAnalyzed: performances.length,
    scoreCorrelation: {
      highScoreAvgEngagement: Math.round(highScoreAvgEngagement * 100) / 100,
      lowScoreAvgEngagement: Math.round(lowScoreAvgEngagement * 100) / 100,
      correlationStrength,
    },
    effectivePatterns: {
      targets: effectiveTargets.map(t => ({ ...t, avgEngagement: Math.round(t.avgEngagement * 100) / 100 })),
      benefits: effectiveBenefits.map(b => ({ ...b, avgEngagement: Math.round(b.avgEngagement * 100) / 100 })),
      hooks: effectiveHooks.map(h => ({ ...h, avgEngagement: Math.round(h.avgEngagement * 100) / 100 })),
    },
    underperforming: {
      targets: underperformingTargets,
      benefits: underperformingBenefits,
      commonIssues: [],
    },
    recommendations,
  };
}

/**
 * Act: 分析結果をナレッジに反映
 */
export function runPDCAAct(checkResult: PDCACheckResult): { updated: string[]; actions: string[] } {
  const updated: string[] = [];
  const actions: string[] = [];

  // 1. 効果的なフックをナレッジに追加
  if (checkResult.effectivePatterns.hooks.length > 0) {
    const viralTemplatesPath = path.join(KNOWLEDGE_DIR, 'liver_viral_templates.json');
    try {
      let templates: any = { templates: [] };
      if (fs.existsSync(viralTemplatesPath)) {
        templates = JSON.parse(fs.readFileSync(viralTemplatesPath, 'utf-8'));
      }

      const existingHooks = new Set(templates.templates?.map((t: any) => t.hook) || []);
      let addedCount = 0;

      for (const hook of checkResult.effectivePatterns.hooks) {
        if (hook.avgEngagement > 2 && !existingHooks.has(hook.hook)) {
          templates.templates = templates.templates || [];
          templates.templates.push({
            hook: hook.hook,
            source: 'pdca_analysis',
            avgEngagement: hook.avgEngagement,
            addedAt: new Date().toISOString(),
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        fs.writeFileSync(viralTemplatesPath, JSON.stringify(templates, null, 2));
        updated.push('liver_viral_templates.json');
        actions.push(`${addedCount}件の効果的なフックをナレッジに追加`);
      }
    } catch (e) {
      console.error('Failed to update viral templates:', e);
    }
  }

  // 2. 成功パターンDBを更新
  if (checkResult.effectivePatterns.targets.length > 0 || checkResult.effectivePatterns.benefits.length > 0) {
    const patternsPath = path.join(DATA_DIR, 'success_patterns.json');
    try {
      let patterns: any = { patterns: [], pdcaInsights: [] };
      if (fs.existsSync(patternsPath)) {
        patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
      }

      // PDCAインサイトを追加
      patterns.pdcaInsights = patterns.pdcaInsights || [];
      patterns.pdcaInsights.push({
        analyzedAt: checkResult.analyzedAt,
        effectiveTargets: checkResult.effectivePatterns.targets.slice(0, 3),
        effectiveBenefits: checkResult.effectivePatterns.benefits.slice(0, 3),
        correlationStrength: checkResult.scoreCorrelation.correlationStrength,
      });

      // 古いインサイトを削除（最新10件のみ保持）
      if (patterns.pdcaInsights.length > 10) {
        patterns.pdcaInsights = patterns.pdcaInsights.slice(-10);
      }

      fs.writeFileSync(patternsPath, JSON.stringify(patterns, null, 2));
      updated.push('success_patterns.json');
      actions.push('PDCA分析インサイトを記録');
    } catch (e) {
      console.error('Failed to update success patterns:', e);
    }
  }

  // 3. SDKサマリーを更新（PDCA結果を含める）
  const summaryPath = path.join(DATA_DIR, 'sdk_analysis_summary.json');
  try {
    let summary: any = {};
    if (fs.existsSync(summaryPath)) {
      summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    }

    summary.pdcaResult = checkResult;
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    updated.push('sdk_analysis_summary.json');
    actions.push('SDKサマリーにPDCA結果を統合');
  } catch (e) {
    console.error('Failed to update SDK summary:', e);
  }

  return { updated, actions };
}

/**
 * PDCA完全サイクルを実行
 */
export function runFullPDCACycle(): {
  check: PDCACheckResult;
  act: { updated: string[]; actions: string[] };
} {
  const check = runPDCACheck();
  const act = runPDCAAct(check);

  return { check, act };
}

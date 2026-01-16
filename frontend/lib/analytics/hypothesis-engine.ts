/**
 * 仮説生成・検証エンジン
 *
 * 1. データから仮説を自動生成
 * 2. A/Bテストを設計
 * 3. 統計的有意性を検証
 * 4. 学習結果をナレッジに反映
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const HYPOTHESES_FILE = path.join(DATA_DIR, 'hypotheses.json');

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// ========================================
// 型定義
// ========================================

export interface Hypothesis {
  id: string;
  createdAt: string;

  // 仮説の内容
  statement: string;           // 「〇〇すると△△になる」形式
  variable: string;            // 検証する変数（フック、ターゲット、時間帯など）
  expectedOutcome: string;     // 期待する結果
  rationale: string;           // 仮説の根拠

  // 検証設計
  testDesign: {
    controlGroup: string;      // 対照群の条件
    treatmentGroup: string;    // 実験群の条件
    metric: string;            // 測定指標（エンゲージメント率など）
    minSampleSize: number;     // 最小サンプルサイズ
    duration: string;          // 検証期間
  };

  // 検証状態
  status: 'pending' | 'testing' | 'validated' | 'rejected' | 'inconclusive';

  // 検証結果
  results?: {
    controlMetric: number;
    treatmentMetric: number;
    sampleSize: { control: number; treatment: number };
    pValue: number;
    confidenceInterval: [number, number];
    effectSize: number;        // Cohen's d
    conclusion: string;
  };

  // 適用状況
  appliedToKnowledge: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface HypothesisGenerationContext {
  recentPerformance: Array<{
    text: string;
    target: string;
    benefit: string;
    hook: string;
    engagementRate: number;
    impressions: number;
    postedAt: string;
    dayOfWeek: string;
    hour: number;
  }>;
  currentPatterns: {
    topTargets: string[];
    topBenefits: string[];
    topHooks: string[];
    underperformingPatterns: string[];
  };
  historicalInsights: string[];
}

// ========================================
// 仮説の読み書き
// ========================================

export function loadHypotheses(): Hypothesis[] {
  try {
    if (fs.existsSync(HYPOTHESES_FILE)) {
      const data = JSON.parse(fs.readFileSync(HYPOTHESES_FILE, 'utf-8'));
      return data.hypotheses || [];
    }
  } catch (e) {
    console.error('Failed to load hypotheses:', e);
  }
  return [];
}

export function saveHypotheses(hypotheses: Hypothesis[]): void {
  const dir = path.dirname(HYPOTHESES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(HYPOTHESES_FILE, JSON.stringify({
    hypotheses,
    updatedAt: new Date().toISOString()
  }, null, 2));
}

// ========================================
// コンテキスト収集
// ========================================

function collectContext(): HypothesisGenerationContext {
  const performances: HypothesisGenerationContext['recentPerformance'] = [];

  // posts_history.json から読み込み
  try {
    const historyPath = path.join(KNOWLEDGE_DIR, 'posts_history.json');
    if (fs.existsSync(historyPath)) {
      const data = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      for (const post of (data.posts || []).slice(-50)) {
        if (post.impressions > 0) {
          const postedDate = new Date(post.timestamp);
          performances.push({
            text: post.text,
            target: post.target || '不明',
            benefit: post.benefit || '不明',
            hook: post.text.split('\n')[0].slice(0, 30),
            engagementRate: ((post.likes || 0) + (post.retweets || 0) + (post.replies || 0)) / post.impressions * 100,
            impressions: post.impressions,
            postedAt: post.timestamp,
            dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][postedDate.getDay()],
            hour: postedDate.getHours(),
          });
        }
      }
    }
  } catch (e) {
    console.error('Failed to collect context:', e);
  }

  // パターン分析
  const targetStats: Record<string, number[]> = {};
  const benefitStats: Record<string, number[]> = {};
  const hookStats: Record<string, number[]> = {};

  for (const p of performances) {
    if (!targetStats[p.target]) targetStats[p.target] = [];
    targetStats[p.target].push(p.engagementRate);

    if (!benefitStats[p.benefit]) benefitStats[p.benefit] = [];
    benefitStats[p.benefit].push(p.engagementRate);

    if (!hookStats[p.hook]) hookStats[p.hook] = [];
    hookStats[p.hook].push(p.engagementRate);
  }

  const avgAll = performances.length > 0
    ? performances.reduce((s, p) => s + p.engagementRate, 0) / performances.length
    : 0;

  const topTargets = Object.entries(targetStats)
    .map(([k, v]) => ({ name: k, avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }))
    .filter(x => x.count >= 2)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map(x => x.name);

  const topBenefits = Object.entries(benefitStats)
    .map(([k, v]) => ({ name: k, avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }))
    .filter(x => x.count >= 2)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map(x => x.name);

  const topHooks = Object.entries(hookStats)
    .map(([k, v]) => ({ name: k, avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map(x => x.name);

  const underperforming = [
    ...Object.entries(targetStats)
      .filter(([_, v]) => v.length >= 2 && v.reduce((a, b) => a + b, 0) / v.length < avgAll * 0.7)
      .map(([k]) => `ターゲット:${k}`),
    ...Object.entries(benefitStats)
      .filter(([_, v]) => v.length >= 2 && v.reduce((a, b) => a + b, 0) / v.length < avgAll * 0.7)
      .map(([k]) => `ベネフィット:${k}`),
  ];

  return {
    recentPerformance: performances,
    currentPatterns: {
      topTargets,
      topBenefits,
      topHooks,
      underperformingPatterns: underperforming,
    },
    historicalInsights: [],
  };
}

// ========================================
// AI仮説生成
// ========================================

export async function generateHypotheses(count: number = 3): Promise<Hypothesis[]> {
  const context = collectContext();

  if (context.recentPerformance.length < 5) {
    return [{
      id: `hyp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      statement: 'データ不足のため仮説生成を保留',
      variable: 'none',
      expectedOutcome: '最低5件の投稿実績が必要',
      rationale: 'サンプルサイズが不十分',
      testDesign: {
        controlGroup: '',
        treatmentGroup: '',
        metric: 'engagement_rate',
        minSampleSize: 10,
        duration: '1週間',
      },
      status: 'pending',
      appliedToKnowledge: false,
      priority: 'low',
    }];
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const prompt = `あなたはSNSマーケティングのデータサイエンティストです。
以下の投稿パフォーマンスデータを分析し、検証可能な仮説を${count}個生成してください。

## 直近の投稿パフォーマンス（最新20件）
${JSON.stringify(context.recentPerformance.slice(-20), null, 2)}

## 現在判明しているパターン
- 効果的なターゲット: ${context.currentPatterns.topTargets.join(', ') || 'なし'}
- 効果的なベネフィット: ${context.currentPatterns.topBenefits.join(', ') || 'なし'}
- 効果的なフック: ${context.currentPatterns.topHooks.join(', ') || 'なし'}
- 改善が必要: ${context.currentPatterns.underperformingPatterns.join(', ') || 'なし'}

## 仮説生成のルール
1. 具体的で検証可能な仮説を立てる（「〇〇すると△△が□%向上する」形式）
2. 以下の変数から選んで検証設計する:
   - フック（冒頭の書き出し）
   - ターゲット層
   - ベネフィット訴求
   - 投稿時間帯
   - 文体・トーン
   - 絵文字の使用
   - 具体的数字の有無
3. 各仮説に対してA/Bテスト設計を含める
4. 優先度を high/medium/low で設定

以下のJSON形式で出力してください:
{
  "hypotheses": [
    {
      "statement": "仮説の文章",
      "variable": "検証する変数",
      "expectedOutcome": "期待する結果（数値目標を含む）",
      "rationale": "この仮説を立てた根拠（データに基づく）",
      "testDesign": {
        "controlGroup": "対照群の条件",
        "treatmentGroup": "実験群の条件",
        "metric": "engagement_rate または impressions",
        "minSampleSize": 10,
        "duration": "1週間"
      },
      "priority": "high/medium/low"
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // JSON抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON not found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const newHypotheses: Hypothesis[] = parsed.hypotheses.map((h: any, i: number) => ({
      id: `hyp_${Date.now()}_${i}`,
      createdAt: new Date().toISOString(),
      statement: h.statement,
      variable: h.variable,
      expectedOutcome: h.expectedOutcome,
      rationale: h.rationale,
      testDesign: {
        controlGroup: h.testDesign.controlGroup,
        treatmentGroup: h.testDesign.treatmentGroup,
        metric: h.testDesign.metric || 'engagement_rate',
        minSampleSize: h.testDesign.minSampleSize || 10,
        duration: h.testDesign.duration || '1週間',
      },
      status: 'pending' as const,
      appliedToKnowledge: false,
      priority: h.priority || 'medium',
    }));

    // 既存の仮説に追加
    const existing = loadHypotheses();
    const all = [...existing, ...newHypotheses];
    saveHypotheses(all);

    return newHypotheses;
  } catch (e) {
    console.error('Failed to generate hypotheses:', e);
    return [];
  }
}

// ========================================
// 統計的検証
// ========================================

/**
 * t検定によるp値計算（簡易版）
 */
function calculateTTest(group1: number[], group2: number[]): {
  pValue: number;
  tStatistic: number;
  effectSize: number;
} {
  const n1 = group1.length;
  const n2 = group2.length;

  if (n1 < 2 || n2 < 2) {
    return { pValue: 1, tStatistic: 0, effectSize: 0 };
  }

  const mean1 = group1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = group2.reduce((a, b) => a + b, 0) / n2;

  const var1 = group1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
  const var2 = group2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);

  const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);

  if (pooledSE === 0) {
    return { pValue: 1, tStatistic: 0, effectSize: 0 };
  }

  const tStatistic = (mean1 - mean2) / pooledSE;
  const df = n1 + n2 - 2;

  // 簡易p値計算（正規分布近似）
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

  // Cohen's d（効果量）
  const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
  const effectSize = pooledStd > 0 ? (mean1 - mean2) / pooledStd : 0;

  return { pValue, tStatistic, effectSize };
}

/**
 * 正規分布の累積分布関数（近似）
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * 仮説を検証
 */
export async function validateHypothesis(hypothesisId: string): Promise<Hypothesis | null> {
  const hypotheses = loadHypotheses();
  const hypothesis = hypotheses.find(h => h.id === hypothesisId);

  if (!hypothesis) {
    return null;
  }

  const context = collectContext();
  const performances = context.recentPerformance;

  // 仮説の変数に基づいてグループ分け
  let controlGroup: number[] = [];
  let treatmentGroup: number[] = [];

  // 変数に応じたフィルタリング
  const variable = hypothesis.variable.toLowerCase();

  if (variable.includes('フック') || variable.includes('hook')) {
    // フックパターンでの分類
    const treatmentPattern = hypothesis.testDesign.treatmentGroup.toLowerCase();
    for (const p of performances) {
      if (p.hook.toLowerCase().includes(treatmentPattern) ||
          treatmentPattern.includes(p.hook.toLowerCase().slice(0, 10))) {
        treatmentGroup.push(p.engagementRate);
      } else {
        controlGroup.push(p.engagementRate);
      }
    }
  } else if (variable.includes('ターゲット') || variable.includes('target')) {
    const treatmentTarget = hypothesis.testDesign.treatmentGroup;
    for (const p of performances) {
      if (p.target === treatmentTarget) {
        treatmentGroup.push(p.engagementRate);
      } else {
        controlGroup.push(p.engagementRate);
      }
    }
  } else if (variable.includes('ベネフィット') || variable.includes('benefit')) {
    const treatmentBenefit = hypothesis.testDesign.treatmentGroup;
    for (const p of performances) {
      if (p.benefit === treatmentBenefit) {
        treatmentGroup.push(p.engagementRate);
      } else {
        controlGroup.push(p.engagementRate);
      }
    }
  } else if (variable.includes('時間') || variable.includes('hour')) {
    // 時間帯での分類
    for (const p of performances) {
      if (p.hour >= 19 && p.hour <= 23) { // ゴールデンタイム
        treatmentGroup.push(p.engagementRate);
      } else {
        controlGroup.push(p.engagementRate);
      }
    }
  } else {
    // デフォルト: 上位半分 vs 下位半分
    const sorted = [...performances].sort((a, b) => b.engagementRate - a.engagementRate);
    const mid = Math.floor(sorted.length / 2);
    treatmentGroup = sorted.slice(0, mid).map(p => p.engagementRate);
    controlGroup = sorted.slice(mid).map(p => p.engagementRate);
  }

  // サンプルサイズチェック
  if (controlGroup.length < 3 || treatmentGroup.length < 3) {
    hypothesis.status = 'inconclusive';
    hypothesis.results = {
      controlMetric: controlGroup.length > 0 ? controlGroup.reduce((a, b) => a + b, 0) / controlGroup.length : 0,
      treatmentMetric: treatmentGroup.length > 0 ? treatmentGroup.reduce((a, b) => a + b, 0) / treatmentGroup.length : 0,
      sampleSize: { control: controlGroup.length, treatment: treatmentGroup.length },
      pValue: 1,
      confidenceInterval: [0, 0],
      effectSize: 0,
      conclusion: `サンプルサイズ不足（対照群: ${controlGroup.length}, 実験群: ${treatmentGroup.length}）`,
    };
    saveHypotheses(hypotheses);
    return hypothesis;
  }

  // 統計検定
  const { pValue, effectSize } = calculateTTest(treatmentGroup, controlGroup);

  const controlMean = controlGroup.reduce((a, b) => a + b, 0) / controlGroup.length;
  const treatmentMean = treatmentGroup.reduce((a, b) => a + b, 0) / treatmentGroup.length;

  // 信頼区間（簡易計算）
  const diff = treatmentMean - controlMean;
  const se = Math.sqrt(
    (treatmentGroup.reduce((s, x) => s + Math.pow(x - treatmentMean, 2), 0) / (treatmentGroup.length - 1)) / treatmentGroup.length +
    (controlGroup.reduce((s, x) => s + Math.pow(x - controlMean, 2), 0) / (controlGroup.length - 1)) / controlGroup.length
  );
  const ci: [number, number] = [diff - 1.96 * se, diff + 1.96 * se];

  // 結論判定
  let status: Hypothesis['status'];
  let conclusion: string;

  if (pValue < 0.05 && treatmentMean > controlMean) {
    status = 'validated';
    conclusion = `仮説が支持されました（p=${pValue.toFixed(3)}, 効果量d=${effectSize.toFixed(2)}）。実験群は対照群より${((treatmentMean / controlMean - 1) * 100).toFixed(1)}%高いエンゲージメント率を示しました。`;
  } else if (pValue < 0.05 && treatmentMean < controlMean) {
    status = 'rejected';
    conclusion = `仮説は棄却されました（p=${pValue.toFixed(3)}）。予想に反して、実験群は対照群より低いパフォーマンスでした。`;
  } else {
    status = 'inconclusive';
    conclusion = `統計的に有意な差は検出されませんでした（p=${pValue.toFixed(3)}）。サンプルサイズを増やして再検証を推奨します。`;
  }

  hypothesis.status = status;
  hypothesis.results = {
    controlMetric: Math.round(controlMean * 100) / 100,
    treatmentMetric: Math.round(treatmentMean * 100) / 100,
    sampleSize: { control: controlGroup.length, treatment: treatmentGroup.length },
    pValue: Math.round(pValue * 1000) / 1000,
    confidenceInterval: [Math.round(ci[0] * 100) / 100, Math.round(ci[1] * 100) / 100],
    effectSize: Math.round(effectSize * 100) / 100,
    conclusion,
  };

  saveHypotheses(hypotheses);
  return hypothesis;
}

// ========================================
// 検証結果をナレッジに反映
// ========================================

export async function applyValidatedHypothesis(hypothesisId: string): Promise<{
  success: boolean;
  actions: string[];
}> {
  const hypotheses = loadHypotheses();
  const hypothesis = hypotheses.find(h => h.id === hypothesisId);

  if (!hypothesis || hypothesis.status !== 'validated') {
    return { success: false, actions: ['仮説が見つからないか、まだ検証されていません'] };
  }

  const actions: string[] = [];

  // 1. 成功パターンDBに追加
  const patternsPath = path.join(DATA_DIR, 'success_patterns.json');
  try {
    let patterns: any = { patterns: [], validatedHypotheses: [] };
    if (fs.existsSync(patternsPath)) {
      patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
    }

    patterns.validatedHypotheses = patterns.validatedHypotheses || [];
    patterns.validatedHypotheses.push({
      statement: hypothesis.statement,
      variable: hypothesis.variable,
      effectSize: hypothesis.results?.effectSize,
      validatedAt: new Date().toISOString(),
    });

    fs.writeFileSync(patternsPath, JSON.stringify(patterns, null, 2));
    actions.push('成功パターンDBに検証済み仮説を追加');
  } catch (e) {
    console.error('Failed to update patterns:', e);
  }

  // 2. 生成プロンプトの改善指示に追加
  const promptGuidePath = path.join(KNOWLEDGE_DIR, 'prompt_improvements.json');
  try {
    let guide: any = { improvements: [] };
    if (fs.existsSync(promptGuidePath)) {
      guide = JSON.parse(fs.readFileSync(promptGuidePath, 'utf-8'));
    }

    guide.improvements = guide.improvements || [];
    guide.improvements.push({
      source: 'hypothesis_validation',
      rule: hypothesis.statement,
      evidence: `p値=${hypothesis.results?.pValue}, 効果量=${hypothesis.results?.effectSize}`,
      addedAt: new Date().toISOString(),
    });

    // 古い改善指示を削除（最新20件のみ保持）
    if (guide.improvements.length > 20) {
      guide.improvements = guide.improvements.slice(-20);
    }

    fs.writeFileSync(promptGuidePath, JSON.stringify(guide, null, 2));
    actions.push('プロンプト改善ガイドに追加');
  } catch (e) {
    console.error('Failed to update prompt guide:', e);
  }

  // 3. 仮説を適用済みにマーク
  hypothesis.appliedToKnowledge = true;
  saveHypotheses(hypotheses);
  actions.push('仮説を適用済みにマーク');

  return { success: true, actions };
}

// ========================================
// 全仮説の一括検証
// ========================================

export async function validateAllPendingHypotheses(): Promise<{
  validated: number;
  rejected: number;
  inconclusive: number;
  results: Hypothesis[];
}> {
  const hypotheses = loadHypotheses();
  const pending = hypotheses.filter(h => h.status === 'pending' || h.status === 'testing');

  let validated = 0;
  let rejected = 0;
  let inconclusive = 0;
  const results: Hypothesis[] = [];

  for (const h of pending) {
    const result = await validateHypothesis(h.id);
    if (result) {
      results.push(result);
      if (result.status === 'validated') validated++;
      else if (result.status === 'rejected') rejected++;
      else inconclusive++;
    }
  }

  return { validated, rejected, inconclusive, results };
}

// ========================================
// サマリーレポート生成
// ========================================

export function getHypothesisSummary(): {
  total: number;
  byStatus: Record<string, number>;
  topValidated: Hypothesis[];
  pendingHighPriority: Hypothesis[];
  recentActivity: string[];
} {
  const hypotheses = loadHypotheses();

  const byStatus: Record<string, number> = {
    pending: 0,
    testing: 0,
    validated: 0,
    rejected: 0,
    inconclusive: 0,
  };

  for (const h of hypotheses) {
    byStatus[h.status] = (byStatus[h.status] || 0) + 1;
  }

  const topValidated = hypotheses
    .filter(h => h.status === 'validated' && h.results)
    .sort((a, b) => (b.results?.effectSize || 0) - (a.results?.effectSize || 0))
    .slice(0, 5);

  const pendingHighPriority = hypotheses
    .filter(h => h.status === 'pending' && h.priority === 'high')
    .slice(0, 3);

  const recentActivity = hypotheses
    .slice(-5)
    .map(h => `[${h.status}] ${h.statement.slice(0, 50)}...`);

  return {
    total: hypotheses.length,
    byStatus,
    topValidated,
    pendingHighPriority,
    recentActivity,
  };
}

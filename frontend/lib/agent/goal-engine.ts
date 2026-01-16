/**
 * 目標管理 & 逆算エンジン
 *
 * 「今月30件DM」と言えば:
 * 1. 残り日数から1日あたりの必要数を計算
 * 2. 現在のペースと比較
 * 3. 足りなければ戦略を自動調整
 */

import fs from 'fs';
import path from 'path';
import { chat } from './sns-agent';

const DATA_DIR = path.join(process.cwd(), 'data');
const GOALS_PATH = path.join(DATA_DIR, 'goals.json');

// ========================================
// 型定義
// ========================================

export interface Goal {
  id: string;
  type: 'dm' | 'impression' | 'engagement' | 'follower' | 'post';
  target: number;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  current: number;
  status: 'on_track' | 'behind' | 'ahead' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgress {
  goal: Goal;
  daysRemaining: number;
  dailyTarget: number;
  currentPace: number;
  gapPercent: number;
  projectedFinal: number;
  recommendation: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface GoalState {
  goals: Goal[];
  lastCalculation: string;
  alerts: string[];
}

export interface StrategyAdjustment {
  reason: string;
  actions: string[];
  priority: 'low' | 'medium' | 'high';
  autoExecute: boolean;
}

// ========================================
// 状態管理
// ========================================

function loadGoals(): GoalState {
  try {
    if (fs.existsSync(GOALS_PATH)) {
      return JSON.parse(fs.readFileSync(GOALS_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[Goal Engine] Failed to load goals:', e);
  }

  return {
    goals: [],
    lastCalculation: '',
    alerts: [],
  };
}

function saveGoals(state: GoalState): void {
  try {
    fs.writeFileSync(GOALS_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[Goal Engine] Failed to save goals:', e);
  }
}

// ========================================
// 目標設定
// ========================================

export function setGoal(
  type: Goal['type'],
  target: number,
  period: Goal['period'] = 'monthly'
): Goal {
  const now = new Date();
  const state = loadGoals();

  // 期間の終了日を計算
  let endDate: Date;
  switch (period) {
    case 'daily':
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + (7 - endDate.getDay()));
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
    default:
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
  }

  // 既存の同タイプ・同期間の目標を更新または新規作成
  const existingIndex = state.goals.findIndex(
    g => g.type === type && g.period === period && g.status !== 'completed' && g.status !== 'failed'
  );

  const goal: Goal = {
    id: existingIndex >= 0 ? state.goals[existingIndex].id : `goal-${Date.now()}`,
    type,
    target,
    period,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    current: existingIndex >= 0 ? state.goals[existingIndex].current : 0,
    status: 'on_track',
    createdAt: existingIndex >= 0 ? state.goals[existingIndex].createdAt : now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (existingIndex >= 0) {
    state.goals[existingIndex] = goal;
  } else {
    state.goals.push(goal);
  }

  saveGoals(state);
  return goal;
}

// ========================================
// 進捗更新
// ========================================

export function updateProgress(type: Goal['type'], value: number): Goal | null {
  const state = loadGoals();
  const goalIndex = state.goals.findIndex(
    g => g.type === type && g.status !== 'completed' && g.status !== 'failed'
  );

  if (goalIndex < 0) return null;

  const goal = state.goals[goalIndex];
  goal.current = value;
  goal.updatedAt = new Date().toISOString();

  // ステータス更新
  if (goal.current >= goal.target) {
    goal.status = 'completed';
  } else {
    const progress = calculateProgress(goal);
    if (progress.gapPercent <= -30) {
      goal.status = 'behind';
    } else if (progress.gapPercent >= 20) {
      goal.status = 'ahead';
    } else {
      goal.status = 'on_track';
    }
  }

  state.goals[goalIndex] = goal;
  saveGoals(state);
  return goal;
}

export function incrementProgress(type: Goal['type'], increment: number = 1): Goal | null {
  const state = loadGoals();
  const goal = state.goals.find(
    g => g.type === type && g.status !== 'completed' && g.status !== 'failed'
  );

  if (!goal) return null;
  return updateProgress(type, goal.current + increment);
}

// ========================================
// 逆算エンジン
// ========================================

export function calculateProgress(goal: Goal): GoalProgress {
  const now = new Date();
  const endDate = new Date(goal.endDate);
  const startDate = new Date(goal.startDate);

  // 残り日数（最低1日）
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(1, Math.ceil((endDate.getTime() - now.getTime()) / msPerDay));
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
  const daysPassed = totalDays - daysRemaining;

  // 残り必要数
  const remaining = goal.target - goal.current;

  // 1日あたり必要数
  const dailyTarget = Math.ceil(remaining / daysRemaining);

  // 現在のペース（1日あたり）
  const currentPace = daysPassed > 0 ? goal.current / daysPassed : 0;

  // 予測最終値
  const projectedFinal = Math.round(currentPace * totalDays);

  // ギャップ（%）
  const idealProgress = (daysPassed / totalDays) * goal.target;
  const gapPercent = idealProgress > 0
    ? Math.round(((goal.current - idealProgress) / idealProgress) * 100)
    : 0;

  // 緊急度
  let urgency: GoalProgress['urgency'] = 'low';
  if (gapPercent <= -50 || (daysRemaining <= 3 && remaining > dailyTarget * 2)) {
    urgency = 'critical';
  } else if (gapPercent <= -30 || (daysRemaining <= 7 && remaining > dailyTarget * 1.5)) {
    urgency = 'high';
  } else if (gapPercent <= -15) {
    urgency = 'medium';
  }

  // レコメンデーション
  let recommendation = '';
  if (goal.current >= goal.target) {
    recommendation = '目標達成おめでとうございます！次の目標を設定しましょう。';
  } else if (urgency === 'critical') {
    recommendation = `危険！残り${daysRemaining}日で${remaining}件必要。投稿頻度を2倍に増やし、高パフォーマンスパターンに集中してください。`;
  } else if (urgency === 'high') {
    recommendation = `遅れています。1日${dailyTarget}件ペースが必要。戦略の見直しを推奨します。`;
  } else if (urgency === 'medium') {
    recommendation = `やや遅れ気味。現在のペース${currentPace.toFixed(1)}件/日 → 必要ペース${dailyTarget}件/日`;
  } else if (gapPercent >= 20) {
    recommendation = `順調！このペースなら${projectedFinal}件達成見込み。`;
  } else {
    recommendation = `予定通り進行中。残り${daysRemaining}日で${remaining}件。`;
  }

  return {
    goal,
    daysRemaining,
    dailyTarget,
    currentPace,
    gapPercent,
    projectedFinal,
    recommendation,
    urgency,
  };
}

// ========================================
// 戦略自動調整
// ========================================

export async function getStrategyAdjustments(): Promise<StrategyAdjustment[]> {
  const state = loadGoals();
  const adjustments: StrategyAdjustment[] = [];

  for (const goal of state.goals) {
    if (goal.status === 'completed' || goal.status === 'failed') continue;

    const progress = calculateProgress(goal);

    if (progress.urgency === 'critical') {
      adjustments.push({
        reason: `${getGoalTypeLabel(goal.type)}目標が危機的状況（残り${progress.daysRemaining}日で${goal.target - goal.current}件必要）`,
        actions: [
          '投稿頻度を1.5倍に増加',
          '高スコアパターンのみ使用',
          'Web検索で最新トレンドを取得',
          '緊急で5件追加生成',
        ],
        priority: 'high',
        autoExecute: true,
      });
    } else if (progress.urgency === 'high') {
      adjustments.push({
        reason: `${getGoalTypeLabel(goal.type)}目標に遅れ（ペース${progress.currentPace.toFixed(1)} → 必要${progress.dailyTarget}）`,
        actions: [
          'パフォーマンス分析を実行',
          '低スコア投稿のパターンを避ける',
          'ターゲット層を見直し',
        ],
        priority: 'medium',
        autoExecute: false,
      });
    }
  }

  return adjustments;
}

function getGoalTypeLabel(type: Goal['type']): string {
  const labels: Record<Goal['type'], string> = {
    dm: 'DM問い合わせ',
    impression: 'インプレッション',
    engagement: 'エンゲージメント',
    follower: 'フォロワー',
    post: '投稿数',
  };
  return labels[type] || type;
}

// ========================================
// AI連携：目標に基づく戦略生成
// ========================================

export async function generateGoalDrivenStrategy(): Promise<string> {
  const state = loadGoals();
  const activeGoals = state.goals.filter(
    g => g.status !== 'completed' && g.status !== 'failed'
  );

  if (activeGoals.length === 0) {
    return '現在アクティブな目標がありません。目標を設定してください。';
  }

  // 各目標の進捗を計算
  const progressList = activeGoals.map(g => calculateProgress(g));

  // 最も遅れている目標を特定
  const mostBehind = progressList.reduce((a, b) =>
    a.gapPercent < b.gapPercent ? a : b
  );

  // AIに戦略を生成させる
  const prompt = `
現在の目標状況:
${progressList.map(p => `
- ${getGoalTypeLabel(p.goal.type)}: ${p.goal.current}/${p.goal.target} (${p.gapPercent > 0 ? '+' : ''}${p.gapPercent}%)
  残り${p.daysRemaining}日、1日${p.dailyTarget}件必要
  緊急度: ${p.urgency}
`).join('')}

最も遅れている目標: ${getGoalTypeLabel(mostBehind.goal.type)}

この状況を踏まえて、目標達成のための具体的な戦略を提案してください:
1. 今日やるべきアクション（3つ）
2. 投稿の改善ポイント
3. ターゲット層の調整案

Web検索ツールを使って最新のSNSマーケティングトレンドも確認してください。
`;

  try {
    const result = await chat(prompt, []);
    return result.response;
  } catch (e: any) {
    return `戦略生成エラー: ${e.message}`;
  }
}

// ========================================
// 全目標の進捗サマリー
// ========================================

export function getGoalsSummary(): {
  goals: GoalProgress[];
  overallHealth: 'healthy' | 'warning' | 'critical';
  alerts: string[];
} {
  const state = loadGoals();
  const activeGoals = state.goals.filter(
    g => g.status !== 'completed' && g.status !== 'failed'
  );

  const progressList = activeGoals.map(g => calculateProgress(g));

  // 全体の健康状態
  let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  const criticalCount = progressList.filter(p => p.urgency === 'critical').length;
  const highCount = progressList.filter(p => p.urgency === 'high').length;

  if (criticalCount > 0) {
    overallHealth = 'critical';
  } else if (highCount > 0) {
    overallHealth = 'warning';
  }

  // アラート生成
  const alerts: string[] = [];
  for (const p of progressList) {
    if (p.urgency === 'critical') {
      alerts.push(`🚨 ${getGoalTypeLabel(p.goal.type)}が危機的！残り${p.daysRemaining}日で${p.goal.target - p.goal.current}件必要`);
    } else if (p.urgency === 'high') {
      alerts.push(`⚠️ ${getGoalTypeLabel(p.goal.type)}が遅れています（${p.gapPercent}%）`);
    }
  }

  // 状態を更新
  state.lastCalculation = new Date().toISOString();
  state.alerts = alerts;
  saveGoals(state);

  return {
    goals: progressList,
    overallHealth,
    alerts,
  };
}

// ========================================
// 目標取得
// ========================================

export function getGoals(): Goal[] {
  const state = loadGoals();
  return state.goals;
}

export function getActiveGoals(): Goal[] {
  const state = loadGoals();
  return state.goals.filter(
    g => g.status !== 'completed' && g.status !== 'failed'
  );
}

// ========================================
// 自然言語から目標を解析
// ========================================

export function parseGoalFromText(text: string): {
  type: Goal['type'];
  target: number;
  period: Goal['period'];
} | null {
  const lowerText = text.toLowerCase();

  // 数値を抽出
  const numberMatch = text.match(/(\d+)/);
  if (!numberMatch) return null;
  const target = parseInt(numberMatch[1], 10);

  // 期間を判定
  let period: Goal['period'] = 'monthly';
  if (lowerText.includes('今日') || lowerText.includes('本日')) {
    period = 'daily';
  } else if (lowerText.includes('今週') || lowerText.includes('週')) {
    period = 'weekly';
  } else if (lowerText.includes('今月') || lowerText.includes('月')) {
    period = 'monthly';
  }

  // タイプを判定
  let type: Goal['type'] = 'dm';
  if (lowerText.includes('dm') || lowerText.includes('問い合わせ') || lowerText.includes('問合せ')) {
    type = 'dm';
  } else if (lowerText.includes('インプレ') || lowerText.includes('表示')) {
    type = 'impression';
  } else if (lowerText.includes('エンゲージ') || lowerText.includes('反応')) {
    type = 'engagement';
  } else if (lowerText.includes('フォロワー')) {
    type = 'follower';
  } else if (lowerText.includes('投稿')) {
    type = 'post';
  }

  return { type, target, period };
}

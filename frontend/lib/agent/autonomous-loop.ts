/**
 * 自律型エージェント実行ループ
 *
 * 自分で状況を判断し、必要なアクションを実行する
 * - 定期的にパフォーマンスをチェック
 * - 問題があれば自動で対処
 * - 学習して改善し続ける
 */

import { chat, AgentMessage } from './sns-agent';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOG_PATH = path.join(DATA_DIR, 'autonomous_log.json');

// ========================================
// 型定義
// ========================================

export interface AutonomousAction {
  id: string;
  type: 'analysis' | 'generation' | 'optimization' | 'learning' | 'alert';
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  timestamp: string;
  duration?: number;
}

export interface AutonomousState {
  isRunning: boolean;
  lastCheck: string;
  lastAction: string;
  actionsToday: number;
  health: 'healthy' | 'warning' | 'critical';
  insights: string[];
  pendingActions: AutonomousAction[];
  completedActions: AutonomousAction[];
}

export interface DecisionContext {
  currentHour: number;
  stockLevel: number;
  todayPosts: number;
  avgScore: number;
  recentPerformance: 'good' | 'average' | 'poor';
  lastAnalysisHoursAgo: number;
}

// ========================================
// 状態管理
// ========================================

function loadState(): AutonomousState {
  try {
    if (fs.existsSync(LOG_PATH)) {
      return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[Autonomous] Failed to load state:', e);
  }

  return {
    isRunning: false,
    lastCheck: '',
    lastAction: '',
    actionsToday: 0,
    health: 'healthy',
    insights: [],
    pendingActions: [],
    completedActions: [],
  };
}

function saveState(state: AutonomousState): void {
  try {
    // 完了アクションは最新50件のみ保持
    state.completedActions = state.completedActions.slice(-50);
    fs.writeFileSync(LOG_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[Autonomous] Failed to save state:', e);
  }
}

// ========================================
// 状況判断
// ========================================

async function gatherContext(): Promise<DecisionContext> {
  const now = new Date();
  const currentHour = now.getHours();

  // ストックレベルを確認
  let stockLevel = 0;
  try {
    const stockPath = path.join(DATA_DIR, 'post_stock.json');
    if (fs.existsSync(stockPath)) {
      const data = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
      const unused = (data.stocks || []).filter((s: any) => !s.usedAt);
      stockLevel = unused.length;
    }
  } catch (e) {}

  // 今日の投稿数を確認
  let todayPosts = 0;
  let avgScore = 0;
  try {
    const stockPath = path.join(DATA_DIR, 'post_stock.json');
    if (fs.existsSync(stockPath)) {
      const data = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
      const today = now.toISOString().split('T')[0];
      const todayStocks = (data.stocks || []).filter((s: any) =>
        s.usedAt && s.usedAt.startsWith(today)
      );
      todayPosts = todayStocks.length;

      const scores = todayStocks.map((s: any) =>
        typeof s.score === 'number' ? s.score : s.score?.total || 0
      );
      avgScore = scores.length > 0
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        : 0;
    }
  } catch (e) {}

  // パフォーマンス判定
  let recentPerformance: 'good' | 'average' | 'poor' = 'average';
  if (avgScore >= 8) recentPerformance = 'good';
  else if (avgScore < 6) recentPerformance = 'poor';

  // 最後の分析からの時間
  const state = loadState();
  let lastAnalysisHoursAgo = 24;
  if (state.lastCheck) {
    const lastCheck = new Date(state.lastCheck);
    lastAnalysisHoursAgo = (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60);
  }

  return {
    currentHour,
    stockLevel,
    todayPosts,
    avgScore,
    recentPerformance,
    lastAnalysisHoursAgo,
  };
}

// ========================================
// 意思決定エンジン
// ========================================

async function decideNextActions(context: DecisionContext): Promise<AutonomousAction[]> {
  const actions: AutonomousAction[] = [];
  const now = new Date().toISOString();

  // 1. ストック不足チェック
  if (context.stockLevel < 10) {
    actions.push({
      id: `gen-${Date.now()}`,
      type: 'generation',
      description: `ストックが${context.stockLevel}件しかありません。新しい投稿を5件生成します。`,
      priority: context.stockLevel < 5 ? 'high' : 'medium',
      status: 'pending',
      timestamp: now,
    });
  }

  // 2. 定期分析（4時間ごと）
  if (context.lastAnalysisHoursAgo >= 4) {
    actions.push({
      id: `analysis-${Date.now()}`,
      type: 'analysis',
      description: '定期パフォーマンス分析を実行します。',
      priority: 'medium',
      status: 'pending',
      timestamp: now,
    });
  }

  // 3. パフォーマンス改善
  if (context.recentPerformance === 'poor' && context.todayPosts >= 3) {
    actions.push({
      id: `opt-${Date.now()}`,
      type: 'optimization',
      description: `平均スコアが${context.avgScore.toFixed(1)}と低いため、投稿戦略を見直します。`,
      priority: 'high',
      status: 'pending',
      timestamp: now,
    });
  }

  // 4. 学習（夜間に1回）
  if (context.currentHour === 3) {
    actions.push({
      id: `learn-${Date.now()}`,
      type: 'learning',
      description: '過去24時間のデータから学習し、ナレッジを更新します。',
      priority: 'low',
      status: 'pending',
      timestamp: now,
    });
  }

  // 5. 朝の準備（6時）
  if (context.currentHour === 6) {
    actions.push({
      id: `morning-${Date.now()}`,
      type: 'analysis',
      description: '今日の投稿戦略を策定し、ストックを確認します。',
      priority: 'medium',
      status: 'pending',
      timestamp: now,
    });
  }

  return actions;
}

// ========================================
// アクション実行
// ========================================

async function executeAction(
  action: AutonomousAction,
  history: AgentMessage[]
): Promise<{ result: string; history: AgentMessage[] }> {
  const startTime = Date.now();

  let prompt = '';

  switch (action.type) {
    case 'generation':
      prompt = `ストックが少なくなっています。高品質な投稿を5件生成してください。
ターゲット層と訴求ポイントを変えて多様性を持たせてください。
generate_postツールを使って生成してください。`;
      break;

    case 'analysis':
      prompt = `現在のパフォーマンスを分析してください。
- get_statsで統計を確認
- analyze_performanceで詳細分析
- 問題があれば具体的な改善案を提示
- 成功パターンがあれば記録`;
      break;

    case 'optimization':
      prompt = `最近の投稿スコアが低いです。原因を分析し、改善してください。
- 最近の投稿を確認（get_posts）
- 成功パターンと比較（get_knowledge）
- Web検索で最新トレンドを確認（web_search）
- 具体的な改善案をナレッジに追加`;
      break;

    case 'learning':
      prompt = `過去24時間のデータを分析し、学習してください。
- 高スコアの投稿パターンを特定
- 新しい成功パターンをナレッジに追加（update_knowledge）
- 今後の投稿に活かせる洞察をまとめてください`;
      break;

    case 'alert':
      prompt = `${action.description}
この問題を解決するための対策を考え、実行してください。`;
      break;

    default:
      prompt = action.description;
  }

  try {
    const result = await chat(prompt, history);

    return {
      result: result.response,
      history: result.history,
    };
  } catch (e: any) {
    return {
      result: `エラー: ${e.message}`,
      history,
    };
  }
}

// ========================================
// メインループ
// ========================================

export async function runAutonomousCheck(): Promise<{
  actions: AutonomousAction[];
  insights: string[];
  state: AutonomousState;
}> {
  console.log('[Autonomous] Starting check...');

  const state = loadState();
  state.isRunning = true;
  state.lastCheck = new Date().toISOString();
  saveState(state);

  try {
    // 状況を把握
    const context = await gatherContext();
    console.log('[Autonomous] Context:', context);

    // 次のアクションを決定
    const pendingActions = await decideNextActions(context);
    console.log('[Autonomous] Pending actions:', pendingActions.length);

    // 健康状態を更新
    if (context.stockLevel < 5 || context.recentPerformance === 'poor') {
      state.health = 'warning';
    } else if (context.stockLevel < 3) {
      state.health = 'critical';
    } else {
      state.health = 'healthy';
    }

    // 高優先度のアクションを即座に実行
    let history: AgentMessage[] = [];
    const executedActions: AutonomousAction[] = [];

    for (const action of pendingActions) {
      if (action.priority === 'high') {
        console.log('[Autonomous] Executing high-priority action:', action.description);
        action.status = 'running';

        const startTime = Date.now();
        const { result, history: newHistory } = await executeAction(action, history);
        history = newHistory;

        action.status = 'completed';
        action.result = result;
        action.duration = Date.now() - startTime;

        executedActions.push(action);
        state.completedActions.push(action);
        state.actionsToday++;
      } else {
        state.pendingActions.push(action);
      }
    }

    // インサイトを生成
    const insights: string[] = [];
    if (context.stockLevel < 10) {
      insights.push(`⚠️ ストック残り${context.stockLevel}件`);
    }
    if (context.todayPosts > 0) {
      insights.push(`📊 今日の投稿: ${context.todayPosts}件 (平均スコア: ${context.avgScore.toFixed(1)})`);
    }
    if (executedActions.length > 0) {
      insights.push(`✅ ${executedActions.length}件のアクションを実行`);
    }

    state.insights = insights;
    state.isRunning = false;
    state.lastAction = executedActions.length > 0
      ? executedActions[executedActions.length - 1].description
      : '';

    saveState(state);

    return {
      actions: [...executedActions, ...pendingActions.filter(a => a.priority !== 'high')],
      insights,
      state,
    };
  } catch (e: any) {
    console.error('[Autonomous] Error:', e);
    state.isRunning = false;
    state.health = 'critical';
    state.insights = [`❌ エラー: ${e.message}`];
    saveState(state);

    return {
      actions: [],
      insights: [`❌ エラー: ${e.message}`],
      state,
    };
  }
}

// ========================================
// 手動トリガー用
// ========================================

export async function executeManualAction(
  actionType: 'analysis' | 'generation' | 'optimization' | 'learning',
  customPrompt?: string
): Promise<{
  action: AutonomousAction;
  result: string;
}> {
  const action: AutonomousAction = {
    id: `manual-${Date.now()}`,
    type: actionType,
    description: customPrompt || `手動で${actionType}を実行`,
    priority: 'high',
    status: 'running',
    timestamp: new Date().toISOString(),
  };

  const { result } = await executeAction(action, []);

  action.status = 'completed';
  action.result = result;

  // 状態を更新
  const state = loadState();
  state.completedActions.push(action);
  state.lastAction = action.description;
  state.actionsToday++;
  saveState(state);

  return { action, result };
}

// ========================================
// 状態取得
// ========================================

export function getAutonomousState(): AutonomousState {
  return loadState();
}

// ========================================
// 完全自律モード
// ========================================

export async function runFullAutonomousLoop(iterations: number = 1): Promise<{
  totalActions: number;
  results: string[];
}> {
  const results: string[] = [];
  let totalActions = 0;

  for (let i = 0; i < iterations; i++) {
    console.log(`[Autonomous] Loop iteration ${i + 1}/${iterations}`);

    const { actions, insights } = await runAutonomousCheck();
    totalActions += actions.filter(a => a.status === 'completed').length;

    results.push(...insights);

    // 1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { totalActions, results };
}

/**
 * 自律型エージェント判断ルール
 *
 * 明確な「if-then」ルールでAIが自律的に行動する
 * ソネット4.5提案: 完全自律型システム
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// ========================================
// 判断ルール定義
// ========================================

export interface DecisionRule {
  id: string;
  name: string;
  condition: () => Promise<boolean>;
  action: () => Promise<{ success: boolean; message: string }>;
  priority: number; // 1-10（高いほど優先）
  cooldownMinutes: number; // 再実行までの待機時間
  lastExecuted?: string;
}

// ルール実行履歴
interface RuleHistory {
  [ruleId: string]: {
    lastExecuted: string;
    lastResult: boolean;
    executionCount: number;
  };
}

const HISTORY_PATH = path.join(DATA_DIR, 'rule_history.json');

function loadHistory(): RuleHistory {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveHistory(history: RuleHistory): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('[DecisionRules] Failed to save history:', e);
  }
}

// ========================================
// ヘルパー関数
// ========================================

function getStockCount(): number {
  try {
    const stockPath = path.join(DATA_DIR, 'post_stock.json');
    if (fs.existsSync(stockPath)) {
      const data = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
      return (data.posts || []).filter((p: any) => !p.usedAt).length;
    }
  } catch {}
  return 0;
}

function getTodayPostCount(): number {
  try {
    const historyPath = path.join(DATA_DIR, 'posts_history.json');
    if (fs.existsSync(historyPath)) {
      const data = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      const today = new Date().toISOString().split('T')[0];
      return (data.posts || []).filter((p: any) => p.timestamp?.startsWith(today)).length;
    }
  } catch {}
  return 0;
}

function getNextScheduledTime(): Date | null {
  const now = new Date();
  const schedules = [
    '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00',
    '17:00', '18:00', '19:00', '20:00', '21:00',
    '22:00', '23:00'
  ];

  for (const time of schedules) {
    const [h, m] = time.split(':').map(Number);
    const scheduled = new Date(now);
    scheduled.setHours(h, m, 0, 0);
    if (scheduled > now) {
      return scheduled;
    }
  }
  return null;
}

function minutesUntilNextPost(): number {
  const next = getNextScheduledTime();
  if (!next) return Infinity;
  return (next.getTime() - Date.now()) / (1000 * 60);
}

async function callAPI(endpoint: string, method: string = 'POST', body?: any): Promise<any> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ========================================
// 具体的な判断ルール
// ========================================

export const DECISION_RULES: DecisionRule[] = [
  // ルール1: ストック枯渇防止
  {
    id: 'stock-critical',
    name: 'ストック緊急補充',
    priority: 10,
    cooldownMinutes: 30,
    condition: async () => {
      const stock = getStockCount();
      console.log(`[Rule:stock-critical] Stock count: ${stock}`);
      return stock <= 3;
    },
    action: async () => {
      console.log('[Rule:stock-critical] Triggering emergency refill...');
      const result = await callAPI('/api/cron/refill-stock');
      return {
        success: result.success !== false,
        message: `緊急ストック補充: ${result.generated || 0}件生成`,
      };
    },
  },

  // ルール2: ストック事前補充
  {
    id: 'stock-low',
    name: 'ストック事前補充',
    priority: 7,
    cooldownMinutes: 60,
    condition: async () => {
      const stock = getStockCount();
      return stock <= 5 && stock > 3;
    },
    action: async () => {
      console.log('[Rule:stock-low] Triggering preemptive refill...');
      const result = await callAPI('/api/cron/refill-stock');
      return {
        success: result.success !== false,
        message: `事前ストック補充: ${result.generated || 0}件生成`,
      };
    },
  },

  // ルール3: 投稿時間5分前に準備確認
  {
    id: 'pre-post-check',
    name: '投稿前準備確認',
    priority: 9,
    cooldownMinutes: 10,
    condition: async () => {
      const minutes = minutesUntilNextPost();
      console.log(`[Rule:pre-post-check] Minutes until next post: ${minutes}`);
      return minutes <= 5 && minutes > 0;
    },
    action: async () => {
      const stock = getStockCount();
      if (stock === 0) {
        // 緊急生成
        console.log('[Rule:pre-post-check] No stock! Emergency generation...');
        await callAPI('/api/cron/refill-stock');
      }

      // ヘルスチェック
      const health = await callAPI('/api/health', 'GET');
      if (health.status === 'unhealthy') {
        return {
          success: false,
          message: 'システム異常検知: 投稿を一時停止',
        };
      }

      return {
        success: true,
        message: `投稿準備完了: ストック${getStockCount()}件`,
      };
    },
  },

  // ルール4: 定期学習
  {
    id: 'periodic-learning',
    name: '定期パターン学習',
    priority: 5,
    cooldownMinutes: 360, // 6時間
    condition: async () => {
      const hour = new Date().getHours();
      // 深夜3時 or 15時に実行
      return hour === 3 || hour === 15;
    },
    action: async () => {
      console.log('[Rule:periodic-learning] Running learning cycle...');
      const result = await callAPI('/api/cron/auto-learn');
      return {
        success: result.success !== false,
        message: `学習完了: ${result.patternsLearned || 0}件のパターン更新`,
      };
    },
  },

  // ルール5: 投稿目標未達アラート
  {
    id: 'daily-target-check',
    name: '日次目標チェック',
    priority: 6,
    cooldownMinutes: 120,
    condition: async () => {
      const hour = new Date().getHours();
      const todayPosts = getTodayPostCount();

      // 時間帯別の期待投稿数
      const expectedByHour: Record<number, number> = {
        10: 3, 12: 5, 15: 8, 18: 11, 21: 13, 23: 15
      };

      const expected = expectedByHour[hour] || 0;
      console.log(`[Rule:daily-target-check] Hour ${hour}: ${todayPosts}/${expected} posts`);

      // 期待の70%未満なら発動
      return expected > 0 && todayPosts < expected * 0.7;
    },
    action: async () => {
      const todayPosts = getTodayPostCount();
      const remaining = 15 - todayPosts;

      if (remaining > 5) {
        // 多く遅れている場合は追加投稿をスケジュール
        console.log('[Rule:daily-target-check] Behind schedule, triggering extra posts...');
        // Discord通知
        await callAPI('/api/automation/summary');
      }

      return {
        success: true,
        message: `目標チェック: ${todayPosts}/15投稿完了、残り${remaining}件`,
      };
    },
  },

  // ルール6: インプレッション取得
  {
    id: 'fetch-impressions',
    name: 'インプレッション収集',
    priority: 4,
    cooldownMinutes: 60,
    condition: async () => {
      const hour = new Date().getHours();
      // 8時-22時の間、毎時実行
      return hour >= 8 && hour <= 22;
    },
    action: async () => {
      const result = await callAPI('/api/cron/fetch-impressions');
      return {
        success: result.success !== false,
        message: `インプレッション取得: ${result.updated || 0}件更新`,
      };
    },
  },

  // ルール7: 週次PDCA
  {
    id: 'weekly-pdca',
    name: '週次PDCA分析',
    priority: 5,
    cooldownMinutes: 10080, // 7日
    condition: async () => {
      const now = new Date();
      // 日曜日の朝6時
      return now.getDay() === 0 && now.getHours() === 6;
    },
    action: async () => {
      const result = await callAPI('/api/cron/weekly-pdca');
      return {
        success: result.success !== false,
        message: `週次PDCA完了: ${result.improvements || 0}件の改善提案`,
      };
    },
  },
];

// ========================================
// ルール実行エンジン
// ========================================

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  executed: boolean;
  result?: { success: boolean; message: string };
  skippedReason?: string;
}

export async function evaluateAndExecuteRules(): Promise<{
  results: RuleExecutionResult[];
  executedCount: number;
  triggeredCount: number;
}> {
  console.log('[DecisionRules] Evaluating rules...');

  const history = loadHistory();
  const results: RuleExecutionResult[] = [];
  let executedCount = 0;
  let triggeredCount = 0;

  // 優先度順にソート
  const sortedRules = [...DECISION_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    const result: RuleExecutionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      triggered: false,
      executed: false,
    };

    // クールダウンチェック
    const ruleHistory = history[rule.id];
    if (ruleHistory?.lastExecuted) {
      const lastExec = new Date(ruleHistory.lastExecuted);
      const cooldownEnd = new Date(lastExec.getTime() + rule.cooldownMinutes * 60 * 1000);
      if (new Date() < cooldownEnd) {
        result.skippedReason = `Cooldown (${Math.round((cooldownEnd.getTime() - Date.now()) / 60000)}分後)`;
        results.push(result);
        continue;
      }
    }

    // 条件チェック
    try {
      const shouldTrigger = await rule.condition();
      result.triggered = shouldTrigger;

      if (shouldTrigger) {
        triggeredCount++;
        console.log(`[DecisionRules] Rule "${rule.name}" triggered!`);

        // アクション実行
        const actionResult = await rule.action();
        result.executed = true;
        result.result = actionResult;
        executedCount++;

        // 履歴更新
        history[rule.id] = {
          lastExecuted: new Date().toISOString(),
          lastResult: actionResult.success,
          executionCount: (ruleHistory?.executionCount || 0) + 1,
        };

        console.log(`[DecisionRules] Rule "${rule.name}" result:`, actionResult);
      }
    } catch (e: any) {
      result.skippedReason = `Error: ${e.message}`;
      console.error(`[DecisionRules] Rule "${rule.name}" error:`, e);
    }

    results.push(result);
  }

  saveHistory(history);

  console.log(`[DecisionRules] Evaluation complete: ${triggeredCount} triggered, ${executedCount} executed`);

  return { results, executedCount, triggeredCount };
}

// ========================================
// 状態取得
// ========================================

export function getRuleStatus(): {
  rules: Array<{
    id: string;
    name: string;
    priority: number;
    lastExecuted: string | null;
    executionCount: number;
    cooldownRemaining: number;
  }>;
} {
  const history = loadHistory();
  const now = Date.now();

  const rules = DECISION_RULES.map(rule => {
    const ruleHistory = history[rule.id];
    let cooldownRemaining = 0;

    if (ruleHistory?.lastExecuted) {
      const lastExec = new Date(ruleHistory.lastExecuted).getTime();
      const cooldownEnd = lastExec + rule.cooldownMinutes * 60 * 1000;
      cooldownRemaining = Math.max(0, Math.round((cooldownEnd - now) / 60000));
    }

    return {
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      lastExecuted: ruleHistory?.lastExecuted || null,
      executionCount: ruleHistory?.executionCount || 0,
      cooldownRemaining,
    };
  });

  return { rules };
}

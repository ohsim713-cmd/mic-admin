/**
 * ReAct Loop Engine - 自律型思考ループ
 *
 * 「神経」の役割: 指示がなくても自分で考えて動き続ける
 *
 * ReAct = Reasoning + Acting
 * 1. Observe（観察）: 現在の状況を把握
 * 2. Think（思考）: 何をすべきか判断
 * 3. Act（行動）: 実際にツールを実行
 * 4. Reflect（振り返り）: 結果を検証して次に活かす
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSessionManager } from './session-manager';
import { getExecutionVerifier, VerificationResult } from './execution-verifier';
import { getEventBus, AgentEvent, emitStockLow, emitSystemError } from './event-bus';
import { startTrace, traceAction, traceResult, endTrace } from './trigger-tracer';

// Gemini AI ヘルパー
let _genai: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    _genai = new GoogleGenerativeAI(apiKey);
  }
  return _genai;
}

// ========================================
// Types
// ========================================

export type AgentState = 'idle' | 'observing' | 'thinking' | 'acting' | 'reflecting' | 'sleeping';

export interface Observation {
  timestamp: Date;
  type: 'schedule' | 'notification' | 'performance' | 'error' | 'opportunity';
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  data?: Record<string, unknown>;
}

export interface Thought {
  observation: Observation;
  reasoning: string;
  decidedAction: string | null;
  confidence: number; // 0-1
}

export interface Action {
  id: string;
  type: string;
  params: Record<string, unknown>;
  startedAt: Date;
  result?: unknown;
  verification?: VerificationResult;
  error?: string;
}

export interface ReActCycle {
  cycleId: string;
  startedAt: Date;
  observations: Observation[];
  thoughts: Thought[];
  actions: Action[];
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
}

export interface ReActConfig {
  // ループ設定
  cycleIntervalMs: number;        // 1サイクルの間隔（デフォルト: 5分）
  maxActionsPerCycle: number;     // 1サイクルの最大アクション数
  sleepStartHour: number;         // スリープ開始時刻（24h）
  sleepEndHour: number;           // スリープ終了時刻（24h）

  // 判断基準
  minConfidenceToAct: number;     // 行動する最低信頼度
  maxConsecutiveErrors: number;   // 連続エラーでスリープ

  // 観察対象
  enabledObservers: string[];     // 有効な観察者
}

const DEFAULT_CONFIG: ReActConfig = {
  cycleIntervalMs: 5 * 60 * 1000, // 5分
  maxActionsPerCycle: 3,
  sleepStartHour: 1,              // 深夜1時〜5時はスリープ
  sleepEndHour: 5,
  minConfidenceToAct: 0.6,
  maxConsecutiveErrors: 5,
  enabledObservers: ['schedule', 'notification', 'performance'],
};

// ========================================
// ReAct Loop Engine
// ========================================

export class ReActLoop {
  private state: AgentState = 'idle';
  private config: ReActConfig;
  private currentCycle: ReActCycle | null = null;
  private cycleHistory: ReActCycle[] = [];
  private consecutiveErrors = 0;
  private loopInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<ReActConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupEventListeners();
  }

  /**
   * イベントバスからの通知を受信
   */
  private setupEventListeners(): void {
    const bus = getEventBus();

    // ストック低下イベントを受信したら即座に補充
    bus.subscribe('stock:low', async (event) => {
      console.log('[ReAct] 📢 Received stock:low event, triggering replenishment');
      if (this.isRunning && this.state === 'idle') {
        await this.executeReplenishStock();
      }
    });

    // エラーイベントを受信
    bus.subscribe('system:error', (event) => {
      console.error('[ReAct] 🚨 System error:', event.data);
    });
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * ループを開始（従業員が出勤）
   */
  start(): void {
    if (this.isRunning) {
      console.log('[ReAct] Already running');
      return;
    }

    console.log('[ReAct] 🚀 Starting autonomous loop...');
    this.isRunning = true;
    this.state = 'idle';

    // サイクル開始イベントを発行
    getEventBus().emit({
      type: 'cycle:start',
      source: 'react-loop',
      data: { config: this.config },
      priority: 'normal',
    });

    // 即座に1サイクル実行
    this.runCycle();

    // 定期実行を開始
    this.loopInterval = setInterval(() => {
      this.runCycle();
    }, this.config.cycleIntervalMs);
  }

  /**
   * ループを停止（従業員が退勤）
   */
  stop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.isRunning = false;
    this.state = 'idle';
    console.log('[ReAct] 🛑 Stopped autonomous loop');
  }

  /**
   * 現在の状態を取得
   */
  getStatus(): {
    state: AgentState;
    isRunning: boolean;
    currentCycle: ReActCycle | null;
    recentCycles: ReActCycle[];
    consecutiveErrors: number;
  } {
    return {
      state: this.state,
      isRunning: this.isRunning,
      currentCycle: this.currentCycle,
      recentCycles: this.cycleHistory.slice(-10),
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  // ========================================
  // Core Loop
  // ========================================

  private async runCycle(): Promise<void> {
    // スリープ時間帯チェック
    if (this.shouldSleep()) {
      this.state = 'sleeping';
      console.log('[ReAct] 😴 Sleeping (night mode)...');
      return;
    }

    // エラー過多チェック
    if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      this.state = 'sleeping';
      console.log('[ReAct] 😵 Too many errors, sleeping...');
      return;
    }

    const cycleId = `cycle_${Date.now()}`;

    // トレーサー: チェーン開始
    const traceChainId = startTrace('ReAct Cycle', 'ReActLoop', { cycleId });

    this.currentCycle = {
      cycleId,
      startedAt: new Date(),
      observations: [],
      thoughts: [],
      actions: [],
      status: 'running',
    };

    try {
      // Phase 1: Observe（観察）
      this.state = 'observing';
      const observeEventId = traceAction(traceChainId, 'Observe', 'ReActLoop');
      const observations = await this.observe();
      this.currentCycle.observations = observations;
      traceResult(traceChainId, observeEventId, 'success', { count: observations.length });

      if (observations.length === 0) {
        console.log('[ReAct] 👀 Nothing notable observed');
        this.completeCycle('completed');
        endTrace(traceChainId, 'No observations');
        return;
      }

      // Phase 2: Think（思考）
      this.state = 'thinking';
      const thinkEventId = traceAction(traceChainId, 'Think', 'ReActLoop');
      const thoughts = await this.think(observations);
      this.currentCycle.thoughts = thoughts;
      traceResult(traceChainId, thinkEventId, 'success', { count: thoughts.length });

      // 実行すべきアクションを抽出
      const actionsToTake = thoughts
        .filter(t => t.decidedAction && t.confidence >= this.config.minConfidenceToAct)
        .slice(0, this.config.maxActionsPerCycle);

      if (actionsToTake.length === 0) {
        console.log('[ReAct] 🤔 No action needed');
        this.completeCycle('completed');
        endTrace(traceChainId, 'No action needed');
        return;
      }

      // Phase 3: Act（行動）
      this.state = 'acting';
      for (const thought of actionsToTake) {
        const actEventId = traceAction(traceChainId, `Act: ${thought.decidedAction}`, 'ReActLoop');
        const action = await this.act(thought);
        this.currentCycle.actions.push(action);
        traceResult(traceChainId, actEventId, action.error ? 'failed' : 'success', action.result);

        // Phase 4: Reflect（振り返り）
        this.state = 'reflecting';
        const reflectEventId = traceAction(traceChainId, 'Reflect', 'ReActLoop');
        await this.reflect(action);
        traceResult(traceChainId, reflectEventId, 'success');
      }

      this.consecutiveErrors = 0;
      this.completeCycle('completed');
      endTrace(traceChainId, `Completed ${actionsToTake.length} actions`);

    } catch (error) {
      console.error('[ReAct] Cycle error:', error);
      this.consecutiveErrors++;
      this.completeCycle('failed');
      endTrace(traceChainId, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========================================
  // Phase 1: Observe（観察）
  // ========================================

  private async observe(): Promise<Observation[]> {
    const observations: Observation[] = [];
    const now = new Date();

    // 1. スケジュールチェック
    if (this.config.enabledObservers.includes('schedule')) {
      const scheduleObs = await this.observeSchedule(now);
      observations.push(...scheduleObs);
    }

    // 2. 通知/DM チェック
    if (this.config.enabledObservers.includes('notification')) {
      const notifObs = await this.observeNotifications();
      observations.push(...notifObs);
    }

    // 3. パフォーマンスチェック
    if (this.config.enabledObservers.includes('performance')) {
      const perfObs = await this.observePerformance();
      observations.push(...perfObs);
    }

    // 緊急度でソート
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    observations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return observations;
  }

  private async observeSchedule(now: Date): Promise<Observation[]> {
    const observations: Observation[] = [];
    const hour = now.getHours();
    const minute = now.getMinutes();

    // 投稿スケジュールをチェック
    const postingSlots = [7, 8, 12, 13, 17, 18, 19, 20, 21, 22, 23];

    if (postingSlots.includes(hour) && minute < 10) {
      observations.push({
        timestamp: now,
        type: 'schedule',
        description: `投稿時間帯です（${hour}時台）`,
        urgency: 'high',
        data: { hour, slot: 'posting' },
      });
    }

    // ストック残量チェック（毎時0分台）
    if (minute < 5) {
      try {
        const stockRes = await fetch('http://localhost:3000/api/dm-hunter/stock');
        const stock = await stockRes.json();

        if (stock.count < 5) {
          observations.push({
            timestamp: now,
            type: 'schedule',
            description: `投稿ストックが残り${stock.count}件です。補充が必要です。`,
            urgency: stock.count < 2 ? 'critical' : 'high',
            data: { stockCount: stock.count },
          });
        }
      } catch {
        // ignore
      }
    }

    return observations;
  }

  private async observeNotifications(): Promise<Observation[]> {
    // TODO: SNS通知のチェック（DM、コメント等）
    // 現状はプレースホルダー
    return [];
  }

  private async observePerformance(): Promise<Observation[]> {
    const observations: Observation[] = [];

    try {
      const statsRes = await fetch('http://localhost:3000/api/db/stats');
      const stats = await statsRes.json();

      // 今日の投稿数が目標に達していない
      const todayPosts = stats.todayPosts || 0;
      const targetPosts = 15;

      if (todayPosts < targetPosts) {
        const remaining = targetPosts - todayPosts;
        const hour = new Date().getHours();

        // 夜になっても投稿が少ない場合は緊急度UP
        const urgency = hour >= 20 && remaining > 5 ? 'high' : 'medium';

        observations.push({
          timestamp: new Date(),
          type: 'performance',
          description: `今日の投稿: ${todayPosts}/${targetPosts}件（残り${remaining}件）`,
          urgency,
          data: { todayPosts, targetPosts, remaining },
        });
      }
    } catch {
      // ignore
    }

    return observations;
  }

  // ========================================
  // Phase 2: Think（思考）
  // ========================================

  private async think(observations: Observation[]): Promise<Thought[]> {
    const thoughts: Thought[] = [];
    const genai = getGenAI();
    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    for (const obs of observations) {
      try {
        const prompt = `あなたは自律型SNSマーケティングエージェントです。
以下の観察結果から、取るべきアクションを判断してください。

【観察】
- タイプ: ${obs.type}
- 内容: ${obs.description}
- 緊急度: ${obs.urgency}
- データ: ${JSON.stringify(obs.data || {})}

【利用可能なアクション】
1. generate_post - 新しい投稿を生成
2. post_to_sns - SNSに投稿
3. check_dm - DMを確認
4. replenish_stock - ストックを補充
5. analyze_performance - パフォーマンス分析
6. wait - 何もしない

【回答形式】JSON
{
  "reasoning": "判断の理由（日本語で簡潔に）",
  "action": "アクション名（上記から1つ、または null）",
  "confidence": 0.0-1.0の信頼度
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // JSONを抽出
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          thoughts.push({
            observation: obs,
            reasoning: parsed.reasoning || '',
            decidedAction: parsed.action || null,
            confidence: parsed.confidence || 0,
          });
        }
      } catch (error) {
        console.error('[ReAct] Think error for observation:', obs.type, error);
        thoughts.push({
          observation: obs,
          reasoning: 'エラーにより判断できませんでした',
          decidedAction: null,
          confidence: 0,
        });
      }
    }

    return thoughts;
  }

  // ========================================
  // Phase 3: Act（行動）
  // ========================================

  private async act(thought: Thought): Promise<Action> {
    const actionId = `action_${Date.now()}`;
    const action: Action = {
      id: actionId,
      type: thought.decidedAction || 'unknown',
      params: thought.observation.data || {},
      startedAt: new Date(),
    };

    console.log(`[ReAct] 🎯 Executing: ${action.type}`);

    try {
      switch (action.type) {
        case 'generate_post':
          action.result = await this.executeGeneratePost();
          break;

        case 'post_to_sns':
          action.result = await this.executePostToSNS();
          break;

        case 'replenish_stock':
          action.result = await this.executeReplenishStock();
          break;

        case 'analyze_performance':
          action.result = await this.executeAnalyzePerformance();
          break;

        case 'check_dm':
          action.result = await this.executeCheckDM();
          break;

        case 'wait':
        default:
          action.result = { status: 'skipped' };
          break;
      }

      // 実行結果を検証
      const verifier = getExecutionVerifier();
      action.verification = await verifier.verify(action.type, action.result);

    } catch (error) {
      action.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ReAct] Action failed: ${action.type}`, error);
    }

    return action;
  }

  private async executeGeneratePost(): Promise<unknown> {
    const res = await fetch('http://localhost:3000/api/generate/persistent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: 'liver',
        accountType: 'ライバー',
        mode: 'normal',
      }),
    });
    return res.json();
  }

  private async executePostToSNS(): Promise<unknown> {
    // スケジューラー経由で投稿
    const res = await fetch('http://localhost:3000/api/automation/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'post_next' }),
    });
    return res.json();
  }

  private async executeReplenishStock(): Promise<unknown> {
    // 5件のストックを生成
    const results = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch('http://localhost:3000/api/generate/persistent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: 'liver',
          accountType: 'ライバー',
          mode: 'normal',
        }),
      });
      const data = await res.json();

      if (data.success) {
        // ストックに追加
        await fetch('http://localhost:3000/api/dm-hunter/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            post: data.post,
          }),
        });
        results.push(data.post);
      }
    }
    return { generated: results.length, posts: results };
  }

  private async executeAnalyzePerformance(): Promise<unknown> {
    const res = await fetch('http://localhost:3000/api/db/stats');
    return res.json();
  }

  private async executeCheckDM(): Promise<unknown> {
    // TODO: DM確認の実装
    return { status: 'not_implemented' };
  }

  // ========================================
  // Phase 4: Reflect（振り返り）
  // ========================================

  private async reflect(action: Action): Promise<void> {
    const verification = action.verification;

    if (!verification) {
      console.log(`[ReAct] 📝 Action ${action.type}: No verification available`);
      return;
    }

    if (verification.success) {
      console.log(`[ReAct] ✅ Action ${action.type}: Success - ${verification.message}`);
    } else {
      console.log(`[ReAct] ❌ Action ${action.type}: Failed - ${verification.message}`);

      // 失敗理由を記録して学習に活かす
      // TODO: 失敗パターンをDBに保存
    }
  }

  // ========================================
  // Helpers
  // ========================================

  private shouldSleep(): boolean {
    const hour = new Date().getHours();
    return hour >= this.config.sleepStartHour && hour < this.config.sleepEndHour;
  }

  private completeCycle(status: 'completed' | 'failed'): void {
    if (this.currentCycle) {
      this.currentCycle.status = status;
      this.currentCycle.completedAt = new Date();
      this.cycleHistory.push(this.currentCycle);

      // 履歴は最新100件まで
      if (this.cycleHistory.length > 100) {
        this.cycleHistory = this.cycleHistory.slice(-100);
      }
    }
    this.state = 'idle';
  }
}

// ========================================
// Singleton
// ========================================

let reactLoopInstance: ReActLoop | null = null;

export function getReActLoop(config?: Partial<ReActConfig>): ReActLoop {
  if (!reactLoopInstance) {
    reactLoopInstance = new ReActLoop(config);
  }
  return reactLoopInstance;
}

export function resetReActLoop(): void {
  if (reactLoopInstance) {
    reactLoopInstance.stop();
    reactLoopInstance = null;
  }
}

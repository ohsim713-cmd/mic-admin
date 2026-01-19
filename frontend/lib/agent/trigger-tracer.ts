/**
 * Trigger Tracer - イベント因果関係トレーサー
 *
 * 「何が何を起動したか」を追跡・可視化
 */

// ============================================
// Types
// ============================================

export interface TriggerEvent {
  id: string;
  type: 'trigger' | 'action' | 'result';
  name: string;
  agent: string;
  data?: unknown;
  timestamp: string;
  parentId?: string;  // 親イベントID（因果関係）
  duration?: number;  // 実行時間(ms)
  status?: 'pending' | 'running' | 'success' | 'failed';
}

export interface TriggerChain {
  id: string;
  startTime: string;
  endTime?: string;
  events: TriggerEvent[];
  status: 'running' | 'completed' | 'failed';
  summary?: string;
}

// ============================================
// In-Memory Storage
// ============================================

const chains: TriggerChain[] = [];
const MAX_CHAINS = 100;

const activeChains: Map<string, TriggerChain> = new Map();

// ============================================
// Trigger Tracer
// ============================================

class TriggerTracer {
  private static instance: TriggerTracer;

  private constructor() {}

  static getInstance(): TriggerTracer {
    if (!TriggerTracer.instance) {
      TriggerTracer.instance = new TriggerTracer();
    }
    return TriggerTracer.instance;
  }

  /**
   * 新しいトリガーチェーンを開始
   */
  startChain(triggerName: string, agent: string, data?: unknown): string {
    const chainId = `chain-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const eventId = `evt-${Date.now()}`;

    const chain: TriggerChain = {
      id: chainId,
      startTime: new Date().toISOString(),
      events: [{
        id: eventId,
        type: 'trigger',
        name: triggerName,
        agent,
        data,
        timestamp: new Date().toISOString(),
        status: 'success',
      }],
      status: 'running',
    };

    activeChains.set(chainId, chain);
    console.log(`[Tracer] 🔗 Chain started: ${chainId} - ${triggerName}`);

    return chainId;
  }

  /**
   * アクションを記録
   */
  addAction(
    chainId: string,
    actionName: string,
    agent: string,
    parentEventId?: string,
    data?: unknown
  ): string {
    const chain = activeChains.get(chainId);
    if (!chain) {
      console.warn(`[Tracer] Chain not found: ${chainId}`);
      return '';
    }

    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const event: TriggerEvent = {
      id: eventId,
      type: 'action',
      name: actionName,
      agent,
      data,
      timestamp: new Date().toISOString(),
      parentId: parentEventId,
      status: 'running',
    };

    chain.events.push(event);
    console.log(`[Tracer] ⚡ Action: ${actionName} by ${agent}`);

    return eventId;
  }

  /**
   * 結果を記録
   */
  addResult(
    chainId: string,
    eventId: string,
    status: 'success' | 'failed',
    result?: unknown
  ): void {
    const chain = activeChains.get(chainId);
    if (!chain) return;

    const event = chain.events.find(e => e.id === eventId);
    if (event) {
      event.status = status;
      event.duration = Date.now() - new Date(event.timestamp).getTime();

      // 結果イベントを追加
      chain.events.push({
        id: `res-${Date.now()}`,
        type: 'result',
        name: `${event.name} ${status}`,
        agent: event.agent,
        data: result,
        timestamp: new Date().toISOString(),
        parentId: eventId,
        status,
      });
    }

    console.log(`[Tracer] ${status === 'success' ? '✅' : '❌'} Result: ${eventId}`);
  }

  /**
   * チェーンを完了
   */
  endChain(chainId: string, summary?: string): void {
    const chain = activeChains.get(chainId);
    if (!chain) return;

    chain.endTime = new Date().toISOString();
    chain.status = chain.events.some(e => e.status === 'failed') ? 'failed' : 'completed';
    chain.summary = summary || this.generateSummary(chain);

    // アーカイブに移動
    chains.push(chain);
    if (chains.length > MAX_CHAINS) chains.shift();
    activeChains.delete(chainId);

    console.log(`[Tracer] 🏁 Chain ended: ${chainId} - ${chain.status}`);
  }

  /**
   * サマリー自動生成
   */
  private generateSummary(chain: TriggerChain): string {
    const trigger = chain.events.find(e => e.type === 'trigger');
    const actions = chain.events.filter(e => e.type === 'action');
    const successes = chain.events.filter(e => e.status === 'success').length;
    const failures = chain.events.filter(e => e.status === 'failed').length;

    return `${trigger?.name || 'Unknown'} → ${actions.length}アクション (✅${successes} ❌${failures})`;
  }

  /**
   * アクティブなチェーンを取得
   */
  getActiveChains(): TriggerChain[] {
    return Array.from(activeChains.values());
  }

  /**
   * 完了したチェーンを取得
   */
  getCompletedChains(limit: number = 50): TriggerChain[] {
    return chains.slice(-limit);
  }

  /**
   * 全チェーンを取得
   */
  getAllChains(limit: number = 50): TriggerChain[] {
    const active = this.getActiveChains();
    const completed = this.getCompletedChains(limit - active.length);
    return [...active, ...completed].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  /**
   * 特定チェーンの詳細を取得
   */
  getChain(chainId: string): TriggerChain | undefined {
    return activeChains.get(chainId) || chains.find(c => c.id === chainId);
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    totalChains: number;
    activeChains: number;
    successRate: number;
    avgDuration: number;
    topTriggers: { name: string; count: number }[];
    topAgents: { name: string; count: number }[];
  } {
    const allChains = [...chains, ...Array.from(activeChains.values())];
    const completedChains = chains.filter(c => c.status === 'completed');

    // 成功率
    const successRate = chains.length > 0
      ? completedChains.length / chains.length
      : 0;

    // 平均実行時間
    const durations = chains
      .filter(c => c.endTime)
      .map(c => new Date(c.endTime!).getTime() - new Date(c.startTime).getTime());
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // トップトリガー
    const triggerCounts: Record<string, number> = {};
    allChains.forEach(chain => {
      const trigger = chain.events.find(e => e.type === 'trigger');
      if (trigger) {
        triggerCounts[trigger.name] = (triggerCounts[trigger.name] || 0) + 1;
      }
    });
    const topTriggers = Object.entries(triggerCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // トップエージェント
    const agentCounts: Record<string, number> = {};
    allChains.forEach(chain => {
      chain.events.forEach(event => {
        agentCounts[event.agent] = (agentCounts[event.agent] || 0) + 1;
      });
    });
    const topAgents = Object.entries(agentCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalChains: allChains.length,
      activeChains: activeChains.size,
      successRate,
      avgDuration,
      topTriggers,
      topAgents,
    };
  }

  /**
   * クリア
   */
  clear(): void {
    chains.length = 0;
    activeChains.clear();
  }
}

// シングルトンインスタンス
export const tracer = TriggerTracer.getInstance();

// 便利関数
export function startTrace(triggerName: string, agent: string, data?: unknown): string {
  return tracer.startChain(triggerName, agent, data);
}

export function traceAction(chainId: string, actionName: string, agent: string, parentId?: string, data?: unknown): string {
  return tracer.addAction(chainId, actionName, agent, parentId, data);
}

export function traceResult(chainId: string, eventId: string, status: 'success' | 'failed', result?: unknown): void {
  tracer.addResult(chainId, eventId, status, result);
}

export function endTrace(chainId: string, summary?: string): void {
  tracer.endChain(chainId, summary);
}

export default tracer;

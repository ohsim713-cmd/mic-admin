/**
 * Event Bus - エージェント間通信
 *
 * シンプルなPub/Subパターンでエージェント間の連携を実現
 * 「社内チャット」の役割
 */

import { EventEmitter } from 'events';

// ========================================
// Event Types
// ========================================

export type AgentEventType =
  // 投稿関連
  | 'post:generated'      // 投稿が生成された
  | 'post:scheduled'      // 投稿がスケジュールされた
  | 'post:published'      // 投稿が公開された
  | 'post:failed'         // 投稿が失敗した

  // ストック関連
  | 'stock:low'           // ストックが少ない
  | 'stock:replenished'   // ストックが補充された
  | 'stock:empty'         // ストックが空

  // 分析関連
  | 'analytics:report'    // 分析レポート完了
  | 'analytics:alert'     // パフォーマンス警告

  // スクレイピング関連
  | 'scout:collected'     // 情報収集完了
  | 'scout:trend'         // トレンド検出

  // システム
  | 'system:error'        // システムエラー
  | 'system:health'       // ヘルスチェック
  | 'cycle:start'         // ReActサイクル開始
  | 'cycle:end';          // ReActサイクル終了

export interface AgentEvent {
  type: AgentEventType;
  source: string;         // 発信元エージェント
  timestamp: Date;
  data: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface EventSubscription {
  id: string;
  eventType: AgentEventType | '*';
  handler: (event: AgentEvent) => void | Promise<void>;
  source?: string;        // 特定のソースからのみ受信
}

// ========================================
// Event Bus
// ========================================

class EventBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventLog: AgentEvent[] = [];
  private maxLogSize = 1000;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  /**
   * イベントを発行（エージェントが「叫ぶ」）
   */
  emit(event: Omit<AgentEvent, 'timestamp'>): void {
    const fullEvent: AgentEvent = {
      ...event,
      timestamp: new Date(),
    };

    // ログに記録
    this.eventLog.push(fullEvent);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    console.log(`[EventBus] ${event.source} → ${event.type}`, event.data);

    // 特定のイベントタイプのリスナーに通知
    this.emitter.emit(event.type, fullEvent);

    // ワイルドカードリスナーにも通知
    this.emitter.emit('*', fullEvent);
  }

  /**
   * イベントを購読（エージェントが「聞き耳を立てる」）
   */
  subscribe(
    eventType: AgentEventType | '*',
    handler: (event: AgentEvent) => void | Promise<void>,
    options?: { source?: string }
  ): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const wrappedHandler = (event: AgentEvent) => {
      // ソースフィルタ
      if (options?.source && event.source !== options.source) {
        return;
      }

      try {
        handler(event);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${eventType}:`, error);
      }
    };

    this.subscriptions.set(id, {
      id,
      eventType,
      handler: wrappedHandler,
      source: options?.source,
    });

    this.emitter.on(eventType, wrappedHandler);

    return id;
  }

  /**
   * 購読解除
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    this.emitter.off(subscription.eventType, subscription.handler);
    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * 一度だけ受信
   */
  once(
    eventType: AgentEventType,
    handler: (event: AgentEvent) => void | Promise<void>
  ): void {
    this.emitter.once(eventType, handler);
  }

  /**
   * イベントを待機（Promise版）
   */
  waitFor(eventType: AgentEventType, timeoutMs = 30000): Promise<AgentEvent> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeoutMs);

      this.once(eventType, (event) => {
        clearTimeout(timeout);
        resolve(event);
      });
    });
  }

  /**
   * 最近のイベントログを取得
   */
  getRecentEvents(count = 50, filter?: { type?: AgentEventType; source?: string }): AgentEvent[] {
    let events = this.eventLog.slice(-count);

    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }
    if (filter?.source) {
      events = events.filter(e => e.source === filter.source);
    }

    return events;
  }

  /**
   * 統計情報
   */
  getStats(): {
    totalEvents: number;
    subscriptions: number;
    eventCounts: Record<string, number>;
  } {
    const eventCounts: Record<string, number> = {};
    this.eventLog.forEach(e => {
      eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
    });

    return {
      totalEvents: this.eventLog.length,
      subscriptions: this.subscriptions.size,
      eventCounts,
    };
  }

  /**
   * ログをクリア
   */
  clearLog(): void {
    this.eventLog = [];
  }
}

// ========================================
// Singleton
// ========================================

let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

// ========================================
// Convenience Functions
// ========================================

/**
 * 投稿生成完了を通知
 */
export function emitPostGenerated(source: string, post: { text: string; score: number }): void {
  getEventBus().emit({
    type: 'post:generated',
    source,
    data: { post },
    priority: 'normal',
  });
}

/**
 * 投稿公開完了を通知
 */
export function emitPostPublished(source: string, postId: string, platform: string): void {
  getEventBus().emit({
    type: 'post:published',
    source,
    data: { postId, platform },
    priority: 'normal',
  });
}

/**
 * ストック低下を通知
 */
export function emitStockLow(source: string, count: number): void {
  getEventBus().emit({
    type: 'stock:low',
    source,
    data: { count },
    priority: 'high',
  });
}

/**
 * エラーを通知
 */
export function emitSystemError(source: string, error: string, details?: unknown): void {
  getEventBus().emit({
    type: 'system:error',
    source,
    data: { error, details },
    priority: 'urgent',
  });
}

/**
 * 情報収集完了を通知
 */
export function emitScoutCollected(source: string, items: number, category: string): void {
  getEventBus().emit({
    type: 'scout:collected',
    source,
    data: { items, category },
    priority: 'normal',
  });
}

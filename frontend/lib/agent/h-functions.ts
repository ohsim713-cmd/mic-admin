/**
 * H Functions - エージェント共通ヘルパー関数ライブラリ
 *
 * 全エージェントから利用可能な軽量ユーティリティ
 * Edge Runtime対応
 */

import { getEventBus } from './event-bus';

// ============================================
// Types
// ============================================

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  agent: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface NotificationOptions {
  channel?: 'slack' | 'discord' | 'line' | 'email';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  title?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// In-Memory Storage (Edge対応)
// ============================================

const logs: LogEntry[] = [];
const MAX_LOGS = 1000;

const metrics: Map<string, number> = new Map();
const timers: Map<string, number> = new Map();

// ============================================
// H Functions
// ============================================

export const h = {
  // ----------------------------------------
  // Logging
  // ----------------------------------------

  log: (agent: string, message: string, data?: unknown) => {
    const entry: LogEntry = {
      level: 'info',
      agent,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();
    console.log(`[${agent}] ${message}`, data || '');
    return entry;
  },

  debug: (agent: string, message: string, data?: unknown) => {
    const entry: LogEntry = {
      level: 'debug',
      agent,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${agent}] ${message}`, data || '');
    }
    return entry;
  },

  warn: (agent: string, message: string, data?: unknown) => {
    const entry: LogEntry = {
      level: 'warn',
      agent,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();
    console.warn(`[${agent}] ⚠️ ${message}`, data || '');
    return entry;
  },

  error: (agent: string, message: string, error?: unknown) => {
    const entry: LogEntry = {
      level: 'error',
      agent,
      message,
      data: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      timestamp: new Date().toISOString(),
    };
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();
    console.error(`[${agent}] ❌ ${message}`, error || '');
    return entry;
  },

  getLogs: (options?: { agent?: string; level?: string; limit?: number }) => {
    let result = [...logs];
    if (options?.agent) {
      result = result.filter(l => l.agent === options.agent);
    }
    if (options?.level) {
      result = result.filter(l => l.level === options.level);
    }
    if (options?.limit) {
      result = result.slice(-options.limit);
    }
    return result;
  },

  // ----------------------------------------
  // Metrics
  // ----------------------------------------

  increment: (key: string, amount: number = 1) => {
    const current = metrics.get(key) || 0;
    metrics.set(key, current + amount);
    return metrics.get(key);
  },

  decrement: (key: string, amount: number = 1) => {
    const current = metrics.get(key) || 0;
    metrics.set(key, Math.max(0, current - amount));
    return metrics.get(key);
  },

  setMetric: (key: string, value: number) => {
    metrics.set(key, value);
    return value;
  },

  getMetric: (key: string) => {
    return metrics.get(key) || 0;
  },

  getAllMetrics: () => {
    return Object.fromEntries(metrics);
  },

  // ----------------------------------------
  // Timing
  // ----------------------------------------

  startTimer: (key: string) => {
    timers.set(key, Date.now());
  },

  endTimer: (key: string): number => {
    const start = timers.get(key);
    if (!start) return 0;
    const elapsed = Date.now() - start;
    timers.delete(key);
    return elapsed;
  },

  // ----------------------------------------
  // Validation
  // ----------------------------------------

  validate: {
    post: (content: string): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!content || content.trim().length === 0) {
        errors.push('投稿内容が空です');
      }
      if (content.length > 280) {
        errors.push(`文字数オーバー: ${content.length}/280`);
      }
      if (content.length > 250) {
        warnings.push('文字数が多いです（250文字超）');
      }

      // NGワードチェック
      const ngWords = ['死', '殺', 'クソ'];
      for (const word of ngWords) {
        if (content.includes(word)) {
          errors.push(`NGワード検出: ${word}`);
        }
      }

      // URL検出
      const urlPattern = /https?:\/\/[^\s]+/g;
      const urls = content.match(urlPattern);
      if (urls && urls.length > 2) {
        warnings.push('URLが多すぎます（スパム判定リスク）');
      }

      // ハッシュタグ検出
      const hashtagPattern = /#[^\s#]+/g;
      const hashtags = content.match(hashtagPattern);
      if (hashtags && hashtags.length > 5) {
        warnings.push('ハッシュタグが多すぎます');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },

    url: (url: string): boolean => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },

    email: (email: string): boolean => {
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return pattern.test(email);
    },

    json: (str: string): boolean => {
      try {
        JSON.parse(str);
        return true;
      } catch {
        return false;
      }
    },
  },

  // ----------------------------------------
  // Events (EventBus wrapper)
  // ----------------------------------------

  emit: (type: string, data: unknown) => {
    const bus = getEventBus();
    bus.emit({
      type: type as 'system:health',
      source: 'h-functions',
      data: data as Record<string, unknown>,
      priority: 'normal',
    });
  },

  on: (type: string, handler: (data: unknown) => void) => {
    const bus = getEventBus();
    return bus.subscribe(type as 'system:health', (event) => {
      handler(event.data);
    });
  },

  // ----------------------------------------
  // Notifications
  // ----------------------------------------

  notify: async (message: string, options: NotificationOptions = {}) => {
    const { channel = 'slack', priority = 'normal', title } = options;

    h.log('h.notify', `通知送信: ${channel}`, { message, priority, title });

    // TODO: 実際の通知実装
    // Slack/Discord/LINE Webhookなど

    // イベント発行
    h.emit('system:notification', { message, channel, priority, title });

    return { sent: true, channel };
  },

  // ----------------------------------------
  // Stock Check
  // ----------------------------------------

  checkStock: async (): Promise<{ count: number; low: boolean; empty: boolean }> => {
    try {
      const res = await fetch('/api/automation/stock');
      if (!res.ok) throw new Error('Stock API failed');
      const data = await res.json();
      const count = data.posts?.length || 0;
      return {
        count,
        low: count < 5,
        empty: count === 0,
      };
    } catch (error) {
      h.error('h.checkStock', 'ストック確認失敗', error);
      return { count: 0, low: true, empty: true };
    }
  },

  // ----------------------------------------
  // Utilities
  // ----------------------------------------

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  retry: async <T>(
    fn: () => Promise<T>,
    options: { maxAttempts?: number; delay?: number; backoff?: boolean } = {}
  ): Promise<T> => {
    const { maxAttempts = 3, delay = 1000, backoff = true } = options;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        h.warn('h.retry', `試行 ${attempt}/${maxAttempts} 失敗`, error);

        if (attempt < maxAttempts) {
          const waitTime = backoff ? delay * attempt : delay;
          await h.sleep(waitTime);
        }
      }
    }

    throw lastError;
  },

  debounce: <T extends (...args: unknown[]) => unknown>(
    fn: T,
    ms: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), ms);
    };
  },

  throttle: <T extends (...args: unknown[]) => unknown>(
    fn: T,
    ms: number
  ): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= ms) {
        lastCall = now;
        fn(...args);
      }
    };
  },

  // ----------------------------------------
  // Format
  // ----------------------------------------

  format: {
    date: (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    },

    time: (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      });
    },

    datetime: (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return `${h.format.date(d)} ${h.format.time(d)}`;
    },

    number: (num: number) => {
      return num.toLocaleString('ja-JP');
    },

    percent: (num: number, decimals: number = 1) => {
      return `${(num * 100).toFixed(decimals)}%`;
    },

    truncate: (str: string, length: number) => {
      if (str.length <= length) return str;
      return str.slice(0, length) + '...';
    },
  },

  // ----------------------------------------
  // Random
  // ----------------------------------------

  random: {
    id: () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,

    int: (min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    pick: <T>(array: T[]): T => {
      return array[Math.floor(Math.random() * array.length)];
    },

    shuffle: <T>(array: T[]): T[] => {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
  },
};

// デフォルトエクスポート
export default h;

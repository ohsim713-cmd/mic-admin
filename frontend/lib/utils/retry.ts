/**
 * リトライユーティリティ
 * 投稿失敗時の自動再試行ロジック
 */

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  totalTimeMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'rate limit',
    'timeout',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

/**
 * 指定時間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * エラーがリトライ可能かチェック
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  const errorString = String(error?.message || error || '').toLowerCase();
  const errorCode = error?.code || '';

  return retryableErrors.some(pattern =>
    errorString.includes(pattern.toLowerCase()) ||
    errorCode.includes(pattern)
  );
}

/**
 * 汎用リトライラッパー
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      lastError = error;
      console.log(`[Retry] Attempt ${attempt}/${opts.maxRetries + 1} failed: ${error.message}`);

      // 最後の試行 or リトライ不可能なエラー
      if (attempt > opts.maxRetries || !isRetryableError(error, opts.retryableErrors!)) {
        break;
      }

      // 待機
      console.log(`[Retry] Waiting ${delay}ms before retry...`);
      await sleep(delay);

      // 指数バックオフ
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  return {
    success: false,
    error: lastError?.message || String(lastError),
    attempts: opts.maxRetries + 1,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Twitter投稿専用リトライ
 */
export async function withTwitterRetry<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
  return withRetry(fn, {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'rate limit',
      'Too Many Requests',
      '429',
      '500',
      '502',
      '503',
      'timeout',
      'ETIMEDOUT',
      'ECONNRESET',
    ],
  });
}

/**
 * Gemini API専用リトライ
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
  return withRetry(fn, {
    maxRetries: 2,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: [
      'quota',
      'rate limit',
      '429',
      '500',
      '503',
      'timeout',
      'RESOURCE_EXHAUSTED',
    ],
  });
}

/**
 * 失敗キューに追加（後で再試行用）
 */
export interface FailedPost {
  id: string;
  account: string;
  content: string;
  failedAt: string;
  error: string;
  retryCount: number;
  nextRetryAt: string;
}

import fs from 'fs';
import path from 'path';

const FAILED_QUEUE_FILE = path.join(process.cwd(), 'data', 'failed_posts_queue.json');

export function loadFailedQueue(): FailedPost[] {
  try {
    if (!fs.existsSync(FAILED_QUEUE_FILE)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(FAILED_QUEUE_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveFailedQueue(queue: FailedPost[]): void {
  try {
    const dir = path.dirname(FAILED_QUEUE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FAILED_QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (error) {
    console.error('[Retry] Failed to save queue:', error);
  }
}

export function addToFailedQueue(post: Omit<FailedPost, 'nextRetryAt' | 'retryCount'>): void {
  const queue = loadFailedQueue();

  // 既存のエントリを更新 or 新規追加
  const existing = queue.find(p => p.id === post.id);
  if (existing) {
    existing.retryCount++;
    existing.error = post.error;
    existing.failedAt = post.failedAt;
    // 次のリトライは指数バックオフ（5分, 15分, 45分...）
    const delayMinutes = 5 * Math.pow(3, existing.retryCount - 1);
    existing.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
  } else {
    queue.push({
      ...post,
      retryCount: 1,
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5分後
    });
  }

  // 最大3回リトライで諦める
  const filteredQueue = queue.filter(p => p.retryCount <= 3);
  saveFailedQueue(filteredQueue);
}

export function getRetryablePosts(): FailedPost[] {
  const queue = loadFailedQueue();
  const now = new Date().toISOString();
  return queue.filter(p => p.nextRetryAt <= now && p.retryCount <= 3);
}

export function removeFromFailedQueue(id: string): void {
  const queue = loadFailedQueue();
  const filtered = queue.filter(p => p.id !== id);
  saveFailedQueue(filtered);
}

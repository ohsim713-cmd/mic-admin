/**
 * Arize Phoenix オブザーバビリティ設定
 * トレース・エンベディング可視化・PDCA支援
 */

import { register, trace } from '@arizeai/phoenix-otel';

// Phoenix サーバーのエンドポイント（ローカル）
const PHOENIX_ENDPOINT = process.env.PHOENIX_COLLECTOR_URL || 'http://localhost:6006';

// Phoenix 初期化フラグ
let isInitialized = false;

/**
 * Phoenix トレーシングを初期化
 */
export function initPhoenix() {
  if (isInitialized) {
    return;
  }

  try {
    register({
      projectName: 'post-generator',
      url: PHOENIX_ENDPOINT,
      batch: false, // デバッグ用：即時エクスポート
    });
    isInitialized = true;
    console.log(`[Phoenix] Initialized - url: ${PHOENIX_ENDPOINT}`);
  } catch (error) {
    console.warn('[Phoenix] Failed to initialize:', error);
  }
}

/**
 * トレーサーを取得
 */
export function getTracer(name: string = 'post-generator') {
  if (!isInitialized) {
    initPhoenix();
  }
  return trace.getTracer(name);
}

/**
 * スパンを作成してコールバックを実行
 */
export async function withSpan<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  callback: () => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      // 属性を設定
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      // コールバック実行
      const result = await callback();

      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: String(error) }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * 投稿生成のトレースを記録
 */
export async function tracePostGeneration<T>(
  step: string,
  metadata: {
    account?: string;
    target?: string;
    benefit?: string;
    score?: number;
    revisionCount?: number;
  },
  callback: () => Promise<T>
): Promise<T> {
  return withSpan(
    `post-generation.${step}`,
    {
      'post.step': step,
      'post.account': metadata.account || '',
      'post.target': metadata.target || '',
      'post.benefit': metadata.benefit || '',
      'post.score': metadata.score || 0,
      'post.revision_count': metadata.revisionCount || 0,
    },
    callback
  );
}

/**
 * 品質スコアをトレースに記録
 */
export function recordQualityScore(
  spanName: string,
  score: {
    empathy: number;
    benefit: number;
    cta: number;
    credibility: number;
    urgency: number;
    originality: number;
    engagement: number;
    scrollStop: number;
    total: number;
  }
) {
  const tracer = getTracer();

  tracer.startActiveSpan(spanName, (span) => {
    span.setAttribute('score.empathy', score.empathy);
    span.setAttribute('score.benefit', score.benefit);
    span.setAttribute('score.cta', score.cta);
    span.setAttribute('score.credibility', score.credibility);
    span.setAttribute('score.urgency', score.urgency);
    span.setAttribute('score.originality', score.originality);
    span.setAttribute('score.engagement', score.engagement);
    span.setAttribute('score.scrollStop', score.scrollStop);
    span.setAttribute('score.total', score.total);
    span.end();
  });
}

export { trace };

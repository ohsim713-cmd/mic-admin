/**
 * Canva 一括生成ユーティリティ
 *
 * レート制限対応のバッチ処理でCanvaデザインを一括生成
 */

import {
  createDesignFromTemplate,
  exportDesign,
} from './canva-api';

// ========== 型定義 ==========

export interface DataRow {
  id?: string;
  fields: Record<string, { type: 'text'; text: string } | { type: 'image'; asset_id: string }>;
}

export interface BulkGenerationOptions {
  exportFormat: 'png' | 'jpg' | 'pdf';
  exportQuality: 'regular' | 'high';
  continueOnError: boolean;
}

export interface BulkGenerateResult {
  rowIndex: number;
  rowId?: string;
  success: boolean;
  designId?: string;
  exportUrls?: string[];
  editUrl?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  processingTime: number;
}

export interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  currentItem?: string;
}

// ========== レート制限 ==========

/**
 * Canva API用レートリミッター
 * - 制限: 10リクエスト/分/ユーザー
 * - 安全マージン: 80%（実質8リクエスト/分）
 */
export class CanvaRateLimiter {
  private requestTimes: number[] = [];
  private readonly limit = 10;
  private readonly windowMs = 60000; // 1分
  private readonly safetyMargin = 0.8;

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // 1分以上前のリクエストを削除
    this.requestTimes = this.requestTimes.filter(t => now - t < this.windowMs);

    const effectiveLimit = Math.floor(this.limit * this.safetyMargin);

    if (this.requestTimes.length >= effectiveLimit) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 1000; // 1秒余裕
      console.log(`[Canva Bulk] Rate limit approaching, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requestTimes.push(Date.now());
  }

  getWaitTime(): number {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(t => now - t < this.windowMs);

    const effectiveLimit = Math.floor(this.limit * this.safetyMargin);

    if (this.requestTimes.length >= effectiveLimit) {
      const oldestRequest = this.requestTimes[0];
      return this.windowMs - (now - oldestRequest) + 1000;
    }

    return 0;
  }
}

// ========== バッチ処理 ==========

/**
 * 一括デザイン生成
 *
 * @param accessToken Canvaアクセストークン
 * @param templateId ブランドテンプレートID
 * @param dataRows データ行の配列
 * @param options 生成オプション
 * @param onProgress 進捗コールバック
 */
export async function processBulkGeneration(
  accessToken: string,
  templateId: string,
  dataRows: DataRow[],
  options: BulkGenerationOptions,
  onProgress?: (progress: BulkProgress) => void
): Promise<BulkGenerateResult[]> {
  const rateLimiter = new CanvaRateLimiter();
  const results: BulkGenerateResult[] = [];
  let completed = 0;
  let failed = 0;

  console.log(`[Canva Bulk] Starting batch generation: ${dataRows.length} items`);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const startTime = Date.now();
    const itemId = row.id || `row_${i + 1}`;

    console.log(`[Canva Bulk] Processing ${i + 1}/${dataRows.length}: ${itemId}`);

    try {
      // レート制限待機
      await rateLimiter.waitForSlot();

      // デザイン作成（autofill）
      const title = `Bulk_${templateId.substring(0, 8)}_${i + 1}_${Date.now()}`;
      const design = await createDesignFromTemplate(
        accessToken,
        templateId,
        title,
        row.fields
      );

      if (!design) {
        throw new Error('Failed to create design from template');
      }

      console.log(`[Canva Bulk] Design created: ${design.id}`);

      // レート制限待機（エクスポート用）
      await rateLimiter.waitForSlot();

      // デザインエクスポート
      const exportUrls = await exportDesign(
        accessToken,
        design.id,
        options.exportFormat,
        { quality: options.exportQuality }
      );

      if (!exportUrls || exportUrls.length === 0) {
        throw new Error('Failed to export design');
      }

      console.log(`[Canva Bulk] Export complete: ${exportUrls[0]}`);

      results.push({
        rowIndex: i,
        rowId: row.id,
        success: true,
        designId: design.id,
        exportUrls,
        editUrl: design.urls?.edit_url,
        processingTime: Date.now() - startTime,
      });
      completed++;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRateLimit = errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate');
      const isTimeout = errorMessage.toLowerCase().includes('timeout');

      console.error(`[Canva Bulk] Error on item ${i + 1}:`, errorMessage);

      results.push({
        rowIndex: i,
        rowId: row.id,
        success: false,
        error: {
          code: isRateLimit ? 'RATE_LIMIT' : isTimeout ? 'TIMEOUT' : 'UNKNOWN',
          message: errorMessage,
          retryable: isRateLimit || isTimeout,
        },
        processingTime: Date.now() - startTime,
      });
      failed++;

      if (!options.continueOnError) {
        console.log('[Canva Bulk] Stopping due to error (continueOnError=false)');
        break;
      }
    }

    // 進捗報告
    onProgress?.({
      total: dataRows.length,
      completed,
      failed,
      currentItem: itemId,
    });
  }

  console.log(`[Canva Bulk] Batch complete: ${completed} success, ${failed} failed`);

  return results;
}

/**
 * 処理時間を推定
 *
 * @param itemCount アイテム数
 * @returns 推定秒数
 */
export function estimateProcessingTime(itemCount: number): number {
  // 各アイテム: autofill + export = 2 API呼び出し
  // レート制限: 8リクエスト/分（安全マージン込み）
  // → 4アイテム/分 = 15秒/アイテム
  return itemCount * 15;
}

/**
 * 同期処理可能かどうかを判定
 *
 * @param itemCount アイテム数
 * @param maxDurationSeconds 最大実行時間（秒）
 * @returns true=同期処理可能
 */
export function canProcessSync(itemCount: number, maxDurationSeconds: number = 300): boolean {
  return estimateProcessingTime(itemCount) <= maxDurationSeconds;
}

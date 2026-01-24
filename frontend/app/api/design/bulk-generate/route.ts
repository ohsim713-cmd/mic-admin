/**
 * Canva 一括デザイン生成エンドポイント
 *
 * POST /api/design/bulk-generate
 * - templateId: ブランドテンプレートID
 * - dataRows: データ行の配列
 * - exportFormat: 出力形式 (png, jpg, pdf)
 * - mode: sync | async (自動判定)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getBrandTemplateDataset,
  refreshAccessToken,
} from '@/lib/canva-api';
import {
  processBulkGeneration,
  estimateProcessingTime,
  canProcessSync,
  DataRow,
  BulkGenerateResult,
} from '@/lib/canva-bulk';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5分

// ========== ジョブ管理 ==========

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const JOBS_FILE = path.join(KNOWLEDGE_DIR, 'canva_bulk_jobs.json');

interface BulkJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  templateId: string;
  totalItems: number;
  progress: { completed: number; failed: number };
  results?: BulkGenerateResult[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

function ensureKnowledgeDir(): void {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
}

function loadJobs(): Record<string, BulkJob> {
  try {
    ensureKnowledgeDir();
    if (fs.existsSync(JOBS_FILE)) {
      return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('[Bulk Generate] Failed to load jobs:', error);
  }
  return {};
}

function saveJobs(jobs: Record<string, BulkJob>): void {
  try {
    ensureKnowledgeDir();
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Bulk Generate] Failed to save jobs:', error);
  }
}

// ========== トークン管理 ==========

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  const refreshTokenEnv = process.env.CANVA_REFRESH_TOKEN;

  if (!accessToken) {
    console.error('[Bulk Generate] No access token');
    return null;
  }

  // キャッシュ確認
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  // トークンテスト
  const isValid = await testToken(accessToken);

  if (isValid) {
    cachedToken = {
      accessToken,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    };
    return accessToken;
  }

  // リフレッシュ試行
  if (refreshTokenEnv) {
    console.log('[Bulk Generate] Token expired, refreshing...');
    const refreshed = await refreshAccessToken(refreshTokenEnv);

    if (refreshed) {
      cachedToken = {
        accessToken: refreshed.access_token,
        expiresAt: Date.now() + (refreshed.expires_in * 1000) - 60000,
      };
      console.log('[Bulk Generate] Token refreshed');
      return refreshed.access_token;
    }
  }

  console.error('[Bulk Generate] Token invalid and refresh failed');
  return null;
}

async function testToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.canva.com/rest/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ========== 非同期ジョブ処理 ==========

async function processJobAsync(
  jobId: string,
  accessToken: string,
  templateId: string,
  dataRows: DataRow[],
  exportFormat: 'png' | 'jpg' | 'pdf',
  exportQuality: 'regular' | 'high'
): Promise<void> {
  const jobs = loadJobs();
  jobs[jobId].status = 'processing';
  saveJobs(jobs);

  try {
    const results = await processBulkGeneration(
      accessToken,
      templateId,
      dataRows,
      {
        exportFormat,
        exportQuality,
        continueOnError: true,
      },
      (progress) => {
        const currentJobs = loadJobs();
        if (currentJobs[jobId]) {
          currentJobs[jobId].progress = {
            completed: progress.completed,
            failed: progress.failed,
          };
          saveJobs(currentJobs);
        }
      }
    );

    const finalJobs = loadJobs();
    finalJobs[jobId].status = 'completed';
    finalJobs[jobId].results = results;
    finalJobs[jobId].completedAt = new Date().toISOString();
    saveJobs(finalJobs);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const finalJobs = loadJobs();
    finalJobs[jobId].status = 'failed';
    finalJobs[jobId].error = errorMessage;
    finalJobs[jobId].completedAt = new Date().toISOString();
    saveJobs(finalJobs);
  }
}

// ========== エンドポイント ==========

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateId,
      dataRows,
      exportFormat = 'png',
      exportQuality = 'high',
      mode,
    } = body;

    // バリデーション
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      );
    }

    if (!dataRows || !Array.isArray(dataRows) || dataRows.length === 0) {
      return NextResponse.json(
        { error: 'dataRows must be a non-empty array' },
        { status: 400 }
      );
    }

    if (dataRows.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 items per batch' },
        { status: 400 }
      );
    }

    // アクセストークン取得
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Canva not authenticated. Please run /api/canva/auth first.' },
        { status: 401 }
      );
    }

    // テンプレート検証
    const dataset = await getBrandTemplateDataset(accessToken, templateId);
    if (!dataset) {
      return NextResponse.json(
        {
          error: 'Template not found or not accessible. Make sure it is a brand template with autofill fields.',
          hint: 'In Canva: Share > More > Brand template',
        },
        { status: 404 }
      );
    }

    console.log(`[Bulk Generate] Template dataset:`, dataset);

    // モード決定
    const effectiveMode = mode || (canProcessSync(dataRows.length) ? 'sync' : 'async');
    const estimatedTime = estimateProcessingTime(dataRows.length);

    console.log(`[Bulk Generate] Mode: ${effectiveMode}, Items: ${dataRows.length}, Est: ${estimatedTime}s`);

    if (effectiveMode === 'sync') {
      // 同期処理
      const startTime = Date.now();
      const results = await processBulkGeneration(
        accessToken,
        templateId,
        dataRows,
        {
          exportFormat,
          exportQuality,
          continueOnError: true,
        }
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return NextResponse.json({
        success: true,
        mode: 'sync',
        results,
        summary: {
          total: dataRows.length,
          successful,
          failed,
          totalProcessingTime: Date.now() - startTime,
          averageTimePerItem: Math.round((Date.now() - startTime) / dataRows.length),
        },
      });

    } else {
      // 非同期処理
      const jobId = `bulk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const jobs = loadJobs();
      jobs[jobId] = {
        id: jobId,
        status: 'pending',
        templateId,
        totalItems: dataRows.length,
        progress: { completed: 0, failed: 0 },
        startedAt: new Date().toISOString(),
      };
      saveJobs(jobs);

      // 非同期で処理開始（fire and forget）
      processJobAsync(
        jobId,
        accessToken,
        templateId,
        dataRows,
        exportFormat,
        exportQuality
      );

      return NextResponse.json({
        success: true,
        mode: 'async',
        jobId,
        statusUrl: `/api/design/bulk-generate/${jobId}`,
        estimatedDuration: estimatedTime,
        message: `Processing ${dataRows.length} items in background`,
      });
    }

  } catch (error) {
    console.error('[Bulk Generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: ジョブ一覧
export async function GET() {
  const jobs = loadJobs();

  // 最新10件を返す
  const sortedJobs = Object.values(jobs)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 10);

  return NextResponse.json({
    jobs: sortedJobs.map(job => ({
      id: job.id,
      status: job.status,
      templateId: job.templateId,
      totalItems: job.totalItems,
      progress: job.progress,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    })),
  });
}

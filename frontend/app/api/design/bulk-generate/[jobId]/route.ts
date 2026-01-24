/**
 * 一括生成ジョブステータス確認エンドポイント
 *
 * GET /api/design/bulk-generate/[jobId]
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const JOBS_FILE = path.join(process.cwd(), 'knowledge', 'canva_bulk_jobs.json');

interface BulkJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  templateId: string;
  totalItems: number;
  progress: { completed: number; failed: number };
  results?: Array<{
    rowIndex: number;
    rowId?: string;
    success: boolean;
    designId?: string;
    exportUrls?: string[];
    editUrl?: string;
    error?: { code: string; message: string; retryable: boolean };
    processingTime: number;
  }>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

function loadJobs(): Record<string, BulkJob> {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('[Job Status] Failed to load jobs:', error);
  }
  return {};
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const jobs = loadJobs();
  const job = jobs[jobId];

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }

  const response: {
    jobId: string;
    status: string;
    progress: {
      total: number;
      completed: number;
      failed: number;
      percentage: number;
    };
    startedAt: string;
    completedAt?: string;
    results?: typeof job.results;
    summary?: {
      total: number;
      successful: number;
      failed: number;
    };
    error?: string;
  } = {
    jobId: job.id,
    status: job.status,
    progress: {
      total: job.totalItems,
      completed: job.progress.completed,
      failed: job.progress.failed,
      percentage: Math.round(
        ((job.progress.completed + job.progress.failed) / job.totalItems) * 100
      ),
    },
    startedAt: job.startedAt,
  };

  if (job.status === 'completed' && job.results) {
    response.results = job.results;
    response.completedAt = job.completedAt;
    response.summary = {
      total: job.totalItems,
      successful: job.results.filter(r => r.success).length,
      failed: job.results.filter(r => !r.success).length,
    };
  }

  if (job.status === 'failed') {
    response.error = job.error;
    response.completedAt = job.completedAt;
  }

  return NextResponse.json(response);
}

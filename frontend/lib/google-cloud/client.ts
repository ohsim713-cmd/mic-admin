/**
 * Google Cloud SDK クライアント
 *
 * 利用可能なサービス:
 * - Cloud Storage: ファイル保存
 * - Cloud Scheduler: Cronジョブ
 * - Vertex AI: Gemini API
 */

import { Storage } from '@google-cloud/storage';
import { CloudSchedulerClient } from '@google-cloud/scheduler';
import { VertexAI } from '@google-cloud/vertexai';

// 環境変数
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'asia-northeast1'; // 東京

// ========== Cloud Storage ==========
let storageClient: Storage | null = null;

export function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage({
      projectId: PROJECT_ID,
    });
  }
  return storageClient;
}

// ファイルをCloud Storageにアップロード
export async function uploadFile(
  bucketName: string,
  filePath: string,
  destination: string
): Promise<string> {
  const storage = getStorage();
  await storage.bucket(bucketName).upload(filePath, {
    destination,
  });
  return `gs://${bucketName}/${destination}`;
}

// Cloud StorageからJSONを読み込み
export async function readJsonFromStorage<T>(
  bucketName: string,
  filePath: string
): Promise<T | null> {
  try {
    const storage = getStorage();
    const [content] = await storage.bucket(bucketName).file(filePath).download();
    return JSON.parse(content.toString()) as T;
  } catch (error) {
    console.error('[GCS] Read error:', error);
    return null;
  }
}

// Cloud StorageにJSONを保存
export async function writeJsonToStorage(
  bucketName: string,
  filePath: string,
  data: unknown
): Promise<boolean> {
  try {
    const storage = getStorage();
    const file = storage.bucket(bucketName).file(filePath);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
    });
    return true;
  } catch (error) {
    console.error('[GCS] Write error:', error);
    return false;
  }
}

// ========== Cloud Scheduler ==========
let schedulerClient: CloudSchedulerClient | null = null;

export function getScheduler(): CloudSchedulerClient {
  if (!schedulerClient) {
    schedulerClient = new CloudSchedulerClient();
  }
  return schedulerClient;
}

// Cronジョブを作成
export async function createScheduledJob(options: {
  name: string;
  schedule: string; // Cron形式 (例: '0 * * * *')
  timeZone?: string;
  httpTarget: {
    uri: string;
    httpMethod?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
  };
}): Promise<string | null> {
  try {
    const scheduler = getScheduler();
    const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;

    const [job] = await scheduler.createJob({
      parent,
      job: {
        name: `${parent}/jobs/${options.name}`,
        schedule: options.schedule,
        timeZone: options.timeZone || 'Asia/Tokyo',
        httpTarget: {
          uri: options.httpTarget.uri,
          httpMethod: options.httpTarget.httpMethod || 'POST',
          headers: options.httpTarget.headers,
          body: options.httpTarget.body
            ? Buffer.from(options.httpTarget.body).toString('base64')
            : undefined,
        },
      },
    });

    return job.name || null;
  } catch (error) {
    console.error('[Scheduler] Create error:', error);
    return null;
  }
}

// Cronジョブを削除
export async function deleteScheduledJob(jobName: string): Promise<boolean> {
  try {
    const scheduler = getScheduler();
    await scheduler.deleteJob({
      name: `projects/${PROJECT_ID}/locations/${LOCATION}/jobs/${jobName}`,
    });
    return true;
  } catch (error) {
    console.error('[Scheduler] Delete error:', error);
    return false;
  }
}

// Cronジョブ一覧
export async function listScheduledJobs(): Promise<string[]> {
  try {
    const scheduler = getScheduler();
    const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;
    const [jobs] = await scheduler.listJobs({ parent });
    return jobs.map(job => job.name || '').filter(Boolean);
  } catch (error) {
    console.error('[Scheduler] List error:', error);
    return [];
  }
}

// ========== Vertex AI (Gemini) ==========
let vertexClient: VertexAI | null = null;

export function getVertexAI(): VertexAI {
  if (!vertexClient) {
    vertexClient = new VertexAI({
      project: PROJECT_ID!,
      location: LOCATION,
    });
  }
  return vertexClient;
}

// Geminiで生成
export async function generateWithGemini(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const vertex = getVertexAI();
  const model = vertex.getGenerativeModel({
    model: options?.model || 'gemini-3-flash-preview',
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 2048,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ========== 設定確認 ==========
export function checkGoogleCloudConfig(): {
  configured: boolean;
  projectId: string | undefined;
  location: string;
  services: string[];
} {
  const services: string[] = [];

  if (PROJECT_ID) {
    services.push('Storage', 'Scheduler', 'Vertex AI');
  }

  return {
    configured: !!PROJECT_ID,
    projectId: PROJECT_ID,
    location: LOCATION,
    services,
  };
}

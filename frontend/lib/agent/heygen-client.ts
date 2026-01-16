/**
 * HeyGen API クライアント
 *
 * アバター動画を生成するためのAPI連携
 * Free枠: 月10本まで
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const HEYGEN_LOG_PATH = path.join(DATA_DIR, 'heygen_usage.json');

// ========================================
// 型定義
// ========================================

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: 'male' | 'female';
  preview_image_url: string;
  preview_video_url: string;
}

export interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  preview_audio: string;
}

export interface VideoGenerationRequest {
  script: string;
  avatarId?: string;
  voiceId?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  backgroundUrl?: string;
}

export interface VideoGenerationResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  creditsUsed?: number;
}

export interface HeyGenUsage {
  month: string;
  videosGenerated: number;
  creditsUsed: number;
  limit: number;
  videos: Array<{
    id: string;
    createdAt: string;
    script: string;
    status: string;
    url?: string;
  }>;
}

// ========================================
// 設定
// ========================================

const HEYGEN_API_BASE = 'https://api.heygen.com/v2';
const FREE_MONTHLY_LIMIT = 10; // Free枠の月間上限

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    throw new Error('HEYGEN_API_KEY is not configured');
  }
  return key;
}

// ========================================
// 使用量管理
// ========================================

function loadUsage(): HeyGenUsage {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    if (fs.existsSync(HEYGEN_LOG_PATH)) {
      const data = JSON.parse(fs.readFileSync(HEYGEN_LOG_PATH, 'utf-8'));

      // 月が変わっていたらリセット
      if (data.month !== currentMonth) {
        return {
          month: currentMonth,
          videosGenerated: 0,
          creditsUsed: 0,
          limit: FREE_MONTHLY_LIMIT,
          videos: [],
        };
      }

      return data;
    }
  } catch (e) {
    console.error('[HeyGen] Failed to load usage:', e);
  }

  return {
    month: currentMonth,
    videosGenerated: 0,
    creditsUsed: 0,
    limit: FREE_MONTHLY_LIMIT,
    videos: [],
  };
}

function saveUsage(usage: HeyGenUsage): void {
  try {
    fs.writeFileSync(HEYGEN_LOG_PATH, JSON.stringify(usage, null, 2));
  } catch (e) {
    console.error('[HeyGen] Failed to save usage:', e);
  }
}

export function getUsageStatus(): {
  remaining: number;
  used: number;
  limit: number;
  canGenerate: boolean;
} {
  const usage = loadUsage();
  const remaining = usage.limit - usage.videosGenerated;

  return {
    remaining,
    used: usage.videosGenerated,
    limit: usage.limit,
    canGenerate: remaining > 0,
  };
}

// ========================================
// アバター一覧取得
// ========================================

export async function getAvatars(): Promise<HeyGenAvatar[]> {
  try {
    const response = await fetch(`${HEYGEN_API_BASE}/avatars`, {
      headers: {
        'X-Api-Key': getApiKey(),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data?.avatars || [];
  } catch (e: any) {
    console.error('[HeyGen] Failed to get avatars:', e);
    return [];
  }
}

// ========================================
// 音声一覧取得
// ========================================

export async function getVoices(language: string = 'ja'): Promise<HeyGenVoice[]> {
  try {
    const response = await fetch(`${HEYGEN_API_BASE}/voices`, {
      headers: {
        'X-Api-Key': getApiKey(),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const voices = data.data?.voices || [];

    // 日本語の音声をフィルタ
    return voices.filter((v: HeyGenVoice) =>
      v.language?.toLowerCase().includes(language)
    );
  } catch (e: any) {
    console.error('[HeyGen] Failed to get voices:', e);
    return [];
  }
}

// ========================================
// 動画生成
// ========================================

export async function generateVideo(
  request: VideoGenerationRequest
): Promise<VideoGenerationResult> {
  // 使用量チェック
  const usageStatus = getUsageStatus();
  if (!usageStatus.canGenerate) {
    return {
      success: false,
      status: 'failed',
      error: `月間上限に達しました（${usageStatus.limit}本）。来月までお待ちください。`,
    };
  }

  try {
    const apiKey = getApiKey();

    // デフォルトのアバターと音声を取得
    const avatarId = request.avatarId || await getDefaultAvatarId();
    const voiceId = request.voiceId || await getDefaultVoiceId();

    if (!avatarId || !voiceId) {
      return {
        success: false,
        status: 'failed',
        error: 'アバターまたは音声が見つかりません',
      };
    }

    // 動画生成リクエスト
    const response = await fetch(`${HEYGEN_API_BASE}/video/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: avatarId,
              avatar_style: 'normal',
            },
            voice: {
              type: 'text',
              input_text: request.script,
              voice_id: voiceId,
            },
            background: request.backgroundUrl
              ? { type: 'image', url: request.backgroundUrl }
              : { type: 'color', value: '#FFFFFF' },
          },
        ],
        dimension: {
          width: request.aspectRatio === '9:16' ? 720 : 1280,
          height: request.aspectRatio === '9:16' ? 1280 : 720,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const videoId = data.data?.video_id;

    if (!videoId) {
      throw new Error('Video ID not returned');
    }

    // 使用量を記録
    const usage = loadUsage();
    usage.videosGenerated++;
    usage.creditsUsed += 1;
    usage.videos.push({
      id: videoId,
      createdAt: new Date().toISOString(),
      script: request.script.slice(0, 100) + '...',
      status: 'processing',
    });
    saveUsage(usage);

    console.log(`[HeyGen] Video generation started: ${videoId}`);

    return {
      success: true,
      videoId,
      status: 'processing',
      creditsUsed: 1,
    };
  } catch (e: any) {
    console.error('[HeyGen] Video generation failed:', e);
    return {
      success: false,
      status: 'failed',
      error: e.message,
    };
  }
}

// ========================================
// 動画ステータス確認
// ========================================

export async function getVideoStatus(videoId: string): Promise<VideoGenerationResult> {
  try {
    const response = await fetch(`${HEYGEN_API_BASE}/video_status.get?video_id=${videoId}`, {
      headers: {
        'X-Api-Key': getApiKey(),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const status = data.data?.status;
    const videoUrl = data.data?.video_url;

    // 完了したら使用量を更新
    if (status === 'completed' && videoUrl) {
      const usage = loadUsage();
      const videoIndex = usage.videos.findIndex(v => v.id === videoId);
      if (videoIndex >= 0) {
        usage.videos[videoIndex].status = 'completed';
        usage.videos[videoIndex].url = videoUrl;
        saveUsage(usage);
      }
    }

    return {
      success: status === 'completed',
      videoId,
      videoUrl,
      status: status === 'completed' ? 'completed' :
              status === 'failed' ? 'failed' :
              'processing',
    };
  } catch (e: any) {
    console.error('[HeyGen] Status check failed:', e);
    return {
      success: false,
      videoId,
      status: 'failed',
      error: e.message,
    };
  }
}

// ========================================
// 動画生成完了まで待機
// ========================================

export async function waitForVideo(
  videoId: string,
  maxWaitMs: number = 300000, // 5分
  intervalMs: number = 10000  // 10秒
): Promise<VideoGenerationResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getVideoStatus(videoId);

    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }

    console.log(`[HeyGen] Waiting for video ${videoId}... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return {
    success: false,
    videoId,
    status: 'failed',
    error: 'Timeout waiting for video generation',
  };
}

// ========================================
// ヘルパー関数
// ========================================

async function getDefaultAvatarId(): Promise<string | null> {
  const avatars = await getAvatars();
  // 日本人っぽいアバターを優先、なければ最初のものを使用
  const japaneseAvatar = avatars.find(a =>
    a.avatar_name.toLowerCase().includes('japanese') ||
    a.avatar_name.toLowerCase().includes('asian')
  );
  return japaneseAvatar?.avatar_id || avatars[0]?.avatar_id || null;
}

async function getDefaultVoiceId(): Promise<string | null> {
  const voices = await getVoices('ja');
  // 女性の日本語音声を優先
  const femaleVoice = voices.find(v => v.gender === 'female');
  return femaleVoice?.voice_id || voices[0]?.voice_id || null;
}

// ========================================
// 台本から動画を一括生成
// ========================================

export async function createVideoFromScript(
  script: string,
  options: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    waitForCompletion?: boolean;
  } = {}
): Promise<VideoGenerationResult> {
  const {
    aspectRatio = '9:16', // TikTok/Reels向け
    waitForCompletion = false,
  } = options;

  // 生成開始
  const result = await generateVideo({
    script,
    aspectRatio,
  });

  if (!result.success || !result.videoId) {
    return result;
  }

  // 完了を待つ場合
  if (waitForCompletion) {
    return await waitForVideo(result.videoId);
  }

  return result;
}

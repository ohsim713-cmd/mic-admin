/**
 * Auto Media Generator
 * 画像・動画を自動で継続生成するシステム
 */

export interface MediaJob {
  id: string;
  type: 'image' | 'video' | 'thumbnail';
  target: 'instagram' | 'wordpress' | 'twitter' | 'youtube';
  status: 'queued' | 'generating' | 'processing' | 'completed' | 'failed';
  progress: number;
  prompt?: string;
  result?: string;
  createdAt: string;
  completedAt?: string;
}

export interface MediaQueueConfig {
  enabled: boolean;
  autoGenerate: {
    instagram: boolean;
    wordpress: boolean;
    youtube: boolean;
  };
  batchSize: number;
  intervalMinutes: number;
}

const DEFAULT_CONFIG: MediaQueueConfig = {
  enabled: true,
  autoGenerate: {
    instagram: true,
    wordpress: true,
    youtube: true,
  },
  batchSize: 3,
  intervalMinutes: 15,
};

// メディアタイプの説明
export const MEDIA_TYPE_LABELS = {
  image: '画像',
  video: '動画',
  thumbnail: 'サムネイル',
};

// ターゲットプラットフォーム
export const TARGET_LABELS = {
  instagram: 'Instagram',
  wordpress: 'WordPress',
  twitter: 'X/Twitter',
  youtube: 'YouTube',
};

/**
 * メディア生成ジョブを実行
 */
export async function generateMedia(
  type: MediaJob['type'],
  target: MediaJob['target'],
  prompt: string,
  onProgress?: (progress: number, status: string) => void
): Promise<MediaJob> {
  const job: MediaJob = {
    id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    target,
    status: 'generating',
    progress: 0,
    prompt,
    createdAt: new Date().toISOString(),
  };

  try {
    // 生成開始
    onProgress?.(10, 'プロンプトを解析中...');
    await delay(500);

    onProgress?.(30, 'AIモデルを準備中...');
    await delay(800);

    // 実際のAPI呼び出し
    job.status = 'processing';
    onProgress?.(50, `${MEDIA_TYPE_LABELS[type]}を生成中...`);

    let result: string;

    if (type === 'image' || type === 'thumbnail') {
      result = await generateImage(prompt, target);
    } else {
      result = await generateVideo(prompt, target, (p) => {
        onProgress?.(50 + p * 0.4, '動画をレンダリング中...');
      });
    }

    onProgress?.(95, '最終処理中...');
    await delay(300);

    job.result = result;
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    onProgress?.(100, '完了');

  } catch (error) {
    job.status = 'failed';
    console.error('Media generation failed:', error);
  }

  return job;
}

async function generateImage(prompt: string, target: MediaJob['target']): Promise<string> {
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        platform: target,
        style: getStyleForPlatform(target),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.imageUrl;
    }
  } catch (e) {
    console.error('Image API error:', e);
  }

  // フォールバック: プレースホルダー画像
  return `https://picsum.photos/seed/${Date.now()}/800/800`;
}

async function generateVideo(
  prompt: string,
  target: MediaJob['target'],
  onProgress?: (progress: number) => void
): Promise<string> {
  // 動画生成のシミュレーション（段階的進捗）
  for (let i = 0; i < 10; i++) {
    onProgress?.(i * 10);
    await delay(500);
  }

  try {
    const response = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        platform: target,
        duration: target === 'youtube' ? 60 : 15,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.videoUrl;
    }
  } catch (e) {
    console.error('Video API error:', e);
  }

  return '/placeholder-video.mp4';
}

function getStyleForPlatform(target: MediaJob['target']): string {
  const styles = {
    instagram: 'vibrant, modern, lifestyle',
    wordpress: 'professional, clean, informative',
    twitter: 'eye-catching, bold, shareable',
    youtube: 'thumbnail-optimized, high-contrast',
  };
  return styles[target];
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 自動メディア生成キュー
 */
export class AutoMediaQueue {
  private config: MediaQueueConfig;
  private queue: MediaJob[] = [];
  private processing: MediaJob[] = [];
  private completed: MediaJob[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: Set<(state: MediaQueueState) => void> = new Set();

  constructor(config: Partial<MediaQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start() {
    if (this.intervalId) return;

    // 初回実行
    this.generateBatch();

    // 定期実行
    this.intervalId = setInterval(() => {
      this.generateBatch();
    }, this.config.intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  subscribe(listener: (state: MediaQueueState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state: MediaQueueState = {
      queue: [...this.queue],
      processing: [...this.processing],
      completed: this.completed.slice(-10), // 直近10件
      totalGenerated: this.completed.length,
    };
    this.listeners.forEach(listener => listener(state));
  }

  private async generateBatch() {
    if (!this.config.enabled) return;

    const jobs: Array<{ type: MediaJob['type']; target: MediaJob['target']; prompt: string }> = [];

    // Instagram用
    if (this.config.autoGenerate.instagram) {
      jobs.push({
        type: 'image',
        target: 'instagram',
        prompt: this.generatePromptForPlatform('instagram'),
      });
    }

    // WordPress用
    if (this.config.autoGenerate.wordpress) {
      jobs.push({
        type: 'thumbnail',
        target: 'wordpress',
        prompt: this.generatePromptForPlatform('wordpress'),
      });
    }

    // YouTube用
    if (this.config.autoGenerate.youtube) {
      jobs.push({
        type: 'video',
        target: 'youtube',
        prompt: this.generatePromptForPlatform('youtube'),
      });
    }

    // バッチサイズに合わせてランダム選択
    const selectedJobs = jobs
      .sort(() => Math.random() - 0.5)
      .slice(0, this.config.batchSize);

    for (const jobConfig of selectedJobs) {
      const job: MediaJob = {
        id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...jobConfig,
        status: 'queued',
        progress: 0,
        createdAt: new Date().toISOString(),
      };

      this.queue.push(job);
      this.notify();

      // 順次処理
      await this.processJob(job);
    }
  }

  private async processJob(job: MediaJob) {
    // キューから処理中へ移動
    this.queue = this.queue.filter(j => j.id !== job.id);
    job.status = 'generating';
    this.processing.push(job);
    this.notify();

    try {
      const result = await generateMedia(
        job.type,
        job.target,
        job.prompt || '',
        (progress, status) => {
          job.progress = progress;
          this.notify();
        }
      );

      job.result = result.result;
      job.status = 'completed';
      job.completedAt = new Date().toISOString();

    } catch (error) {
      job.status = 'failed';
    }

    // 処理中から完了へ移動
    this.processing = this.processing.filter(j => j.id !== job.id);
    this.completed.push(job);
    this.notify();
  }

  private generatePromptForPlatform(platform: string): string {
    const themes = [
      '高収入', '在宅ワーク', '副業', '自由な働き方', '女性活躍',
      'ライフスタイル', '成功体験', 'チャットレディ', '稼ぐ方法',
    ];
    const theme = themes[Math.floor(Math.random() * themes.length)];

    const prompts: Record<string, string> = {
      instagram: `${theme}をイメージした、モダンでおしゃれなSNS向け画像。明るく前向きな雰囲気。`,
      wordpress: `${theme}に関するブログ記事のアイキャッチ画像。プロフェッショナルで信頼感のあるデザイン。`,
      youtube: `${theme}についての解説動画。視聴者の興味を引くサムネイルと導入部分。`,
    };

    return prompts[platform] || theme;
  }

  getState(): MediaQueueState {
    return {
      queue: [...this.queue],
      processing: [...this.processing],
      completed: this.completed.slice(-10),
      totalGenerated: this.completed.length,
    };
  }
}

export interface MediaQueueState {
  queue: MediaJob[];
  processing: MediaJob[];
  completed: MediaJob[];
  totalGenerated: number;
}

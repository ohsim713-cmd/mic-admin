/**
 * Media Snatcher - yt-dlp Wrapper
 * 動画ダウンロード・メタデータ取得
 *
 * 対応プラットフォーム:
 * - YouTube
 * - TikTok
 * - Instagram Reels
 * - Twitter/X動画
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// ========================================
// Types
// ========================================

export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  duration: number;       // seconds
  viewCount: number;
  likeCount: number;
  commentCount?: number;
  uploadDate: string;
  uploader: string;
  uploaderUrl?: string;
  thumbnailUrl: string;
  tags?: string[];
  platform: string;
  originalUrl: string;
}

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  info?: VideoInfo;
  error?: string;
}

export interface DownloadOptions {
  outputDir?: string;
  format?: 'best' | 'audio' | 'worst';  // worst = 最小サイズ
  maxFileSize?: string;  // e.g., '50M'
  extractAudio?: boolean;
  writeSubtitles?: boolean;
  writeThumbnail?: boolean;
}

// ========================================
// yt-dlp Wrapper
// ========================================

export class MediaSnatcher {
  private ytdlpPath: string;
  private outputDir: string;

  constructor(options?: { ytdlpPath?: string; outputDir?: string }) {
    this.ytdlpPath = options?.ytdlpPath || 'yt-dlp';
    this.outputDir = options?.outputDir || path.join(process.cwd(), 'downloads');

    // 出力ディレクトリを作成
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 動画情報を取得（ダウンロードなし）
   */
  async getInfo(url: string): Promise<VideoInfo> {
    const cmd = `${this.ytdlpPath} --dump-json --no-download "${url}"`;

    try {
      const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
      const data = JSON.parse(stdout);

      return {
        id: data.id,
        title: data.title || '',
        description: data.description || '',
        duration: data.duration || 0,
        viewCount: data.view_count || 0,
        likeCount: data.like_count || 0,
        commentCount: data.comment_count,
        uploadDate: data.upload_date || '',
        uploader: data.uploader || data.channel || '',
        uploaderUrl: data.uploader_url || data.channel_url,
        thumbnailUrl: data.thumbnail || '',
        tags: data.tags || [],
        platform: data.extractor || this.detectPlatform(url),
        originalUrl: url,
      };
    } catch (error) {
      throw new Error(`Failed to get video info: ${error}`);
    }
  }

  /**
   * 動画をダウンロード
   */
  async download(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    const outputDir = options.outputDir || this.outputDir;
    const outputTemplate = path.join(outputDir, '%(id)s.%(ext)s');

    // コマンド構築
    const args: string[] = [
      this.ytdlpPath,
      `"${url}"`,
      `-o "${outputTemplate}"`,
      '--no-playlist',
      '--write-info-json',
    ];

    // フォーマット指定
    if (options.format === 'audio' || options.extractAudio) {
      args.push('-x', '--audio-format mp3');
    } else if (options.format === 'worst') {
      args.push('-f worst');
    } else {
      args.push('-f "best[filesize<50M]/best"');
    }

    // オプション
    if (options.maxFileSize) {
      args.push(`--max-filesize ${options.maxFileSize}`);
    }
    if (options.writeSubtitles) {
      args.push('--write-subs', '--sub-lang ja,en');
    }
    if (options.writeThumbnail) {
      args.push('--write-thumbnail');
    }

    const cmd = args.join(' ');

    try {
      await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });

      // ダウンロードされたファイルを探す
      const info = await this.getInfo(url);
      const files = fs.readdirSync(outputDir);
      const videoFile = files.find(f => f.startsWith(info.id) && !f.endsWith('.json'));

      return {
        success: true,
        filePath: videoFile ? path.join(outputDir, videoFile) : undefined,
        info,
      };
    } catch (error) {
      return {
        success: false,
        error: `Download failed: ${error}`,
      };
    }
  }

  /**
   * サムネイルのみダウンロード
   */
  async downloadThumbnail(url: string): Promise<string | null> {
    const info = await this.getInfo(url);
    if (!info.thumbnailUrl) return null;

    const outputPath = path.join(this.outputDir, `${info.id}_thumb.jpg`);

    try {
      const { exec: execCallback } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(execCallback);

      await execPromise(`curl -o "${outputPath}" "${info.thumbnailUrl}"`);
      return outputPath;
    } catch {
      return null;
    }
  }

  /**
   * 複数動画の情報を一括取得
   */
  async batchGetInfo(urls: string[]): Promise<VideoInfo[]> {
    const results: VideoInfo[] = [];

    for (const url of urls) {
      try {
        const info = await this.getInfo(url);
        results.push(info);
        // レート制限対策
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`Failed to get info for ${url}:`, e);
      }
    }

    return results;
  }

  /**
   * プラットフォーム検出
   */
  private detectPlatform(url: string): string {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return 'unknown';
  }

  /**
   * ダウンロードフォルダをクリーンアップ
   */
  async cleanup(daysOld = 7): Promise<number> {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let deleted = 0;

    const files = fs.readdirSync(this.outputDir);
    for (const file of files) {
      const filePath = path.join(this.outputDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }

    return deleted;
  }
}

// ========================================
// Function Calling用ツール定義
// ========================================

export const mediaTools = [
  {
    name: 'get_video_info',
    description: '動画のメタデータを取得する（タイトル、再生数、いいね数など）',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '動画のURL（YouTube, TikTok, Instagram, Twitter対応）',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'download_video',
    description: '動画をダウンロードする',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '動画のURL',
        },
        format: {
          type: 'string',
          enum: ['best', 'audio', 'worst'],
          description: 'ダウンロード形式（worst=最小サイズ）',
        },
        extract_audio: {
          type: 'boolean',
          description: '音声のみ抽出するか',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'batch_video_info',
    description: '複数動画の情報を一括取得する',
    parameters: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: '動画URLの配列',
        },
      },
      required: ['urls'],
    },
  },
];

// ========================================
// シングルトン
// ========================================

let _snatcher: MediaSnatcher | null = null;

export function getMediaSnatcher(): MediaSnatcher {
  if (!_snatcher) {
    _snatcher = new MediaSnatcher();
  }
  return _snatcher;
}

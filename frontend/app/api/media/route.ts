/**
 * Media API - yt-dlp Wrapper エンドポイント
 * 動画メタデータ取得、ダウンロード
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMediaSnatcher } from '@/lib/media/video-downloader';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    const snatcher = getMediaSnatcher();

    switch (action) {
      // 動画情報取得
      case 'info': {
        const { url } = params;
        if (!url) {
          return NextResponse.json({ error: 'url is required' }, { status: 400 });
        }

        const info = await snatcher.getInfo(url);

        return NextResponse.json({ success: true, info });
      }

      // 複数動画の情報を一括取得
      case 'batch_info': {
        const { urls } = params;
        if (!urls || !Array.isArray(urls)) {
          return NextResponse.json({ error: 'urls array is required' }, { status: 400 });
        }

        const results = await snatcher.batchGetInfo(urls);

        return NextResponse.json({
          success: true,
          count: results.length,
          videos: results,
        });
      }

      // 動画ダウンロード
      case 'download': {
        const { url, format = 'worst', extractAudio = false } = params;
        if (!url) {
          return NextResponse.json({ error: 'url is required' }, { status: 400 });
        }

        const result = await snatcher.download(url, {
          format,
          extractAudio,
        });

        return NextResponse.json({
          success: result.success,
          filePath: result.filePath,
          info: result.info,
          error: result.error,
        });
      }

      // サムネイルのみダウンロード
      case 'thumbnail': {
        const { url } = params;
        if (!url) {
          return NextResponse.json({ error: 'url is required' }, { status: 400 });
        }

        const path = await snatcher.downloadThumbnail(url);

        return NextResponse.json({
          success: !!path,
          filePath: path,
        });
      }

      // ダウンロードフォルダクリーンアップ
      case 'cleanup': {
        const { daysOld = 7 } = params;
        const deleted = await snatcher.cleanup(daysOld);

        return NextResponse.json({ success: true, deleted });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Media API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// 使い方
export async function GET() {
  return NextResponse.json({
    endpoints: {
      'POST /api/media': {
        actions: {
          info: {
            description: '動画メタデータ取得（ダウンロードなし）',
            params: {
              url: 'string (required) - YouTube, TikTok, Instagram, Twitter対応',
            },
            returns: 'title, description, duration, viewCount, likeCount, uploader, etc.',
          },
          batch_info: {
            description: '複数動画の情報を一括取得',
            params: {
              urls: 'string[] (required)',
            },
          },
          download: {
            description: '動画をダウンロード',
            params: {
              url: 'string (required)',
              format: '"best" | "audio" | "worst" (default: worst)',
              extractAudio: 'boolean (default: false)',
            },
          },
          thumbnail: {
            description: 'サムネイル画像のみダウンロード',
            params: {
              url: 'string (required)',
            },
          },
          cleanup: {
            description: '古いダウンロードファイルを削除',
            params: {
              daysOld: 'number (default: 7)',
            },
          },
        },
      },
    },
    note: 'yt-dlpがシステムにインストールされている必要があります',
  });
}

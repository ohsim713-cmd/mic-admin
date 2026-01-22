/**
 * WordPressサムネイル画像生成API
 *
 * タイトル文字を使ったシンプルなサムネイル画像を生成
 * SVG + sharp で直接描画（無料・高速・日本語対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const maxDuration = 30;

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const WP_SETTINGS_FILE = path.join(KNOWLEDGE_DIR, 'wordpress_credentials.json');

// 画像サイズ（16:9）
const WIDTH = 1200;
const HEIGHT = 675;

// 背景色とスタイルのバリエーション
const THUMBNAIL_STYLES = [
  {
    id: 'pink_gradient',
    bgStart: '#FFE4EC',
    bgEnd: '#FFF5F7',
    textColor: '#C41E3A',
    accentColor: '#FFB6C1',
  },
  {
    id: 'blue_clean',
    bgStart: '#E3F2FD',
    bgEnd: '#BBDEFB',
    textColor: '#1565C0',
    accentColor: '#64B5F6',
  },
  {
    id: 'purple_soft',
    bgStart: '#F3E5F5',
    bgEnd: '#E1BEE7',
    textColor: '#6A1B9A',
    accentColor: '#BA68C8',
  },
  {
    id: 'green_fresh',
    bgStart: '#E8F5E9',
    bgEnd: '#C8E6C9',
    textColor: '#2E7D32',
    accentColor: '#81C784',
  },
  {
    id: 'orange_warm',
    bgStart: '#FFF3E0',
    bgEnd: '#FFE0B2',
    textColor: '#E65100',
    accentColor: '#FFB74D',
  },
];

// タイトルを短くする
function shortenTitle(title: string): string {
  if (title.length <= 20) return title;

  const parts = title.split(/[？！?!]/);
  if (parts[0] && parts[0].length <= 20) {
    return parts[0] + (title.includes('？') ? '？' : '');
  }

  return title.substring(0, 18) + '...';
}

// テキストを複数行に分割
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  let currentLine = '';

  for (const char of text) {
    currentLine += char;
    if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = '';
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// SVGでサムネイル画像を生成
async function generateThumbnailImage(title: string): Promise<Buffer | null> {
  const style = THUMBNAIL_STYLES[Math.floor(Math.random() * THUMBNAIL_STYLES.length)];
  const shortTitle = shortenTitle(title);

  try {
    const lines = wrapText(shortTitle, 10);
    const fontSize = lines.length > 2 ? 56 : 64;
    const lineHeight = fontSize * 1.5;

    // テキストの開始Y位置を計算
    const totalTextHeight = lines.length * lineHeight;
    const startY = (HEIGHT - totalTextHeight) / 2 + lineHeight / 2;

    // 各行のSVGテキスト要素を生成
    const textElements = lines.map((line, index) => {
      const y = startY + index * lineHeight;
      // XMLエスケープ
      const escapedLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${style.textColor}" font-size="${fontSize}" font-weight="bold" font-family="'Noto Sans JP', 'Yu Gothic', 'Hiragino Kaku Gothic ProN', sans-serif">${escapedLine}</text>`;
    }).join('\n    ');

    const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${style.bgStart}"/>
      <stop offset="100%" style="stop-color:${style.bgEnd}"/>
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- 装飾的な円 -->
  <circle cx="${WIDTH * 0.85}" cy="${HEIGHT * 0.2}" r="120" fill="${style.accentColor}" opacity="0.3"/>
  <circle cx="${WIDTH * 0.1}" cy="${HEIGHT * 0.8}" r="80" fill="${style.accentColor}" opacity="0.3"/>

  <!-- テキスト -->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&amp;display=swap');
  </style>
  ${textElements}

  <!-- 下部のアクセントライン -->
  <rect x="${WIDTH * 0.3}" y="${HEIGHT - 40}" width="${WIDTH * 0.4}" height="6" fill="${style.accentColor}"/>
</svg>`;

    // sharpでPNGに変換
    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    return buffer;
  } catch (error) {
    console.error('[Thumbnail] SVG generation error:', error);
    return null;
  }
}

// WordPressに画像をアップロード
async function uploadToWordPress(
  imageBuffer: Buffer,
  title: string
): Promise<{ id: number; url: string } | null> {
  if (!fs.existsSync(WP_SETTINGS_FILE)) {
    console.error('[Thumbnail] WordPress settings not found');
    return null;
  }

  const credentials = JSON.parse(fs.readFileSync(WP_SETTINGS_FILE, 'utf-8'));
  const auth = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64');

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
  const filename = `thumbnail-${Date.now()}.png`;
  formData.append('file', blob, filename);
  formData.append('title', title);
  formData.append('alt_text', title);

  try {
    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: formData,
    });

    if (response.ok) {
      const media = await response.json();
      return {
        id: media.id,
        url: media.source_url,
      };
    }

    console.error('[Thumbnail] Upload failed:', response.status);
    return null;
  } catch (error) {
    console.error('[Thumbnail] Upload error:', error);
    return null;
  }
}

// 記事にサムネイルを設定
async function setFeaturedImage(postId: number, mediaId: number): Promise<boolean> {
  if (!fs.existsSync(WP_SETTINGS_FILE)) {
    return false;
  }

  const credentials = JSON.parse(fs.readFileSync(WP_SETTINGS_FILE, 'utf-8'));
  const auth = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64');

  try {
    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/posts/${postId}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        featured_media: mediaId,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Thumbnail] Set featured image error:', error);
    return false;
  }
}

// POST: サムネイル生成・アップロード・設定
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { title, postId } = body;

    if (!title) {
      return NextResponse.json({ error: 'タイトルが必要です' }, { status: 400 });
    }

    console.log(`[Thumbnail] Generating for: ${title}`);

    // 1. 画像生成（SVG + sharp）
    const imageBuffer = await generateThumbnailImage(title);
    if (!imageBuffer) {
      return NextResponse.json({ error: '画像生成失敗' }, { status: 500 });
    }

    // 2. WordPressにアップロード
    const media = await uploadToWordPress(imageBuffer, title);
    if (!media) {
      return NextResponse.json({
        success: false,
        error: 'アップロード失敗',
        imageGenerated: true,
      }, { status: 500 });
    }

    // 3. 記事にサムネイル設定（postIdがあれば）
    let featuredSet = false;
    if (postId) {
      featuredSet = await setFeaturedImage(postId, media.id);
    }

    console.log(`[Thumbnail] Success: mediaId=${media.id}, featuredSet=${featuredSet}`);

    return NextResponse.json({
      success: true,
      mediaId: media.id,
      mediaUrl: media.url,
      featuredSet,
      processingTime: Date.now() - startTime,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Thumbnail] Error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

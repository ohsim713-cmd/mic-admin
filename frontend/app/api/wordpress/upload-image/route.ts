import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SETTINGS_DIR = path.join(process.cwd(), '..', 'settings');
const WP_SETTINGS_FILE = path.join(SETTINGS_DIR, 'wordpress.json');

export async function POST(request: Request) {
  try {
    // WordPress設定の読み込み
    if (!fs.existsSync(WP_SETTINGS_FILE)) {
      return NextResponse.json(
        { error: 'WordPress設定が保存されていません' },
        { status: 400 }
      );
    }

    const settingsData = fs.readFileSync(WP_SETTINGS_FILE, 'utf-8');
    const credentials = JSON.parse(settingsData);

    // リクエストデータの取得
    const { imageData, filename, title } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: '画像データが必要です' },
        { status: 400 }
      );
    }

    // Base64データからバッファに変換
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // WordPress REST APIに画像をアップロード
    const auth = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('file', blob, filename || 'thumbnail.png');

    if (title) {
      formData.append('title', title);
    }

    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData
    });

    if (response.ok) {
      const media = await response.json();
      return NextResponse.json({
        success: true,
        message: '画像をアップロードしました',
        media: {
          id: media.id,
          url: media.source_url,
          title: media.title.rendered,
          alt_text: media.alt_text
        }
      });
    } else {
      const errorData = await response.json();
      console.error('WordPress Media Upload Error:', errorData);
      return NextResponse.json(
        {
          error: '画像のアップロードに失敗しました',
          details: errorData.message || response.statusText
        },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error('WordPress media upload failed:', error);
    return NextResponse.json(
      {
        error: '画像のアップロード中にエラーが発生しました',
        details: error.message
      },
      { status: 500 }
    );
  }
}

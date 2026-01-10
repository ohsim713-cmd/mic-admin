import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SETTINGS_DIR = path.join(process.cwd(), 'settings');
const WP_SETTINGS_FILE = path.join(SETTINGS_DIR, 'wordpress.json');

export async function POST(request: Request) {
  try {
    // WordPress設定の読み込み
    if (!fs.existsSync(WP_SETTINGS_FILE)) {
      return NextResponse.json(
        { error: 'WordPress設定が保存されていません。設定ページで接続情報を入力してください。' },
        { status: 400 }
      );
    }

    const settingsData = fs.readFileSync(WP_SETTINGS_FILE, 'utf-8');
    const credentials = JSON.parse(settingsData);

    // リクエストデータの取得
    const { title, content, status = 'draft', categories = [], tags = [], featuredImageId } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: 'タイトルと本文は必須です' },
        { status: 400 }
      );
    }

    // WordPress REST APIに投稿
    const auth = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64');

    const postData: any = {
      title,
      content,
      status, // draft, publish, private
    };

    // カテゴリーとタグを追加（IDの配列として）
    if (categories.length > 0) {
      postData.categories = categories;
    }
    if (tags.length > 0) {
      postData.tags = tags;
    }

    // アイキャッチ画像を設定
    if (featuredImageId) {
      postData.featured_media = featuredImageId;
    }

    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (response.ok) {
      const post = await response.json();
      return NextResponse.json({
        success: true,
        message: status === 'publish' ? '記事を公開しました' : '下書きとして保存しました',
        post: {
          id: post.id,
          title: post.title.rendered,
          link: post.link,
          status: post.status
        }
      });
    } else {
      const errorData = await response.json();
      console.error('WordPress API Error:', errorData);
      return NextResponse.json(
        {
          error: '記事の投稿に失敗しました',
          details: errorData.message || response.statusText
        },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error('WordPress post failed:', error);
    return NextResponse.json(
      {
        error: '記事の投稿中にエラーが発生しました',
        details: error.message
      },
      { status: 500 }
    );
  }
}

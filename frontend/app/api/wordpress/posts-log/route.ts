/**
 * WordPress投稿ログ取得API
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const WP_POST_LOG_FILE = path.join(process.cwd(), 'data', 'wordpress_post_log.json');

export async function GET() {
  try {
    if (!fs.existsSync(WP_POST_LOG_FILE)) {
      return NextResponse.json({ posts: [] });
    }

    const data = fs.readFileSync(WP_POST_LOG_FILE, 'utf-8');
    const parsed = JSON.parse(data);

    // 最新順にソート
    const posts = (parsed.posts || []).sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Failed to load WordPress post log:', error);
    return NextResponse.json({ posts: [] });
  }
}

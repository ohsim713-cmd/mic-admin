import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const TRENDING_POSTS_FILE = path.join(process.cwd(), 'knowledge', 'trending_posts.json');

interface TrendingPost {
  id: string;
  text: string;
  source: string;
  category: string;
  whyWorks: string;
  addedAt: string;
}

interface TrendingPostsData {
  description: string;
  lastUpdated: string;
  posts: TrendingPost[];
}

// GET: お手本投稿一覧を取得
export async function GET() {
  try {
    const content = await fs.readFile(TRENDING_POSTS_FILE, 'utf-8');
    const data: TrendingPostsData = JSON.parse(content);
    return NextResponse.json(data);
  } catch (error) {
    // ファイルがない場合は空のデータを返す
    return NextResponse.json({
      description: '業界問わず伸びてる投稿のお手本集',
      lastUpdated: new Date().toISOString(),
      posts: [],
    });
  }
}

// POST: お手本投稿を追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, source, category, whyWorks } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: '投稿テキストが必要です' }, { status: 400 });
    }

    // 既存データを読み込み
    let data: TrendingPostsData;
    try {
      const content = await fs.readFile(TRENDING_POSTS_FILE, 'utf-8');
      data = JSON.parse(content);
    } catch {
      data = {
        description: '業界問わず伸びてる投稿のお手本集。投稿生成時にランダムに1つ選んでライバー/チャトレ用にアレンジ',
        lastUpdated: new Date().toISOString(),
        posts: [],
      };
    }

    // 新しい投稿を追加
    const newPost: TrendingPost = {
      id: `post-${Date.now()}`,
      text: text.trim(),
      source: source || 'chat-input',
      category: category || '未分類',
      whyWorks: whyWorks || '',
      addedAt: new Date().toISOString(),
    };

    data.posts.push(newPost);
    data.lastUpdated = new Date().toISOString();

    // ファイルに保存
    await fs.writeFile(TRENDING_POSTS_FILE, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      post: newPost,
      totalPosts: data.posts.length,
    });
  } catch (error) {
    console.error('[trending-posts] Error adding post:', error);
    return NextResponse.json({ error: '投稿の追加に失敗しました' }, { status: 500 });
  }
}

// DELETE: お手本投稿を削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('id');

    if (!postId) {
      return NextResponse.json({ error: '投稿IDが必要です' }, { status: 400 });
    }

    const content = await fs.readFile(TRENDING_POSTS_FILE, 'utf-8');
    const data: TrendingPostsData = JSON.parse(content);

    const initialLength = data.posts.length;
    data.posts = data.posts.filter(p => p.id !== postId);

    if (data.posts.length === initialLength) {
      return NextResponse.json({ error: '指定された投稿が見つかりません' }, { status: 404 });
    }

    data.lastUpdated = new Date().toISOString();
    await fs.writeFile(TRENDING_POSTS_FILE, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      deletedId: postId,
      totalPosts: data.posts.length,
    });
  } catch (error) {
    console.error('[trending-posts] Error deleting post:', error);
    return NextResponse.json({ error: '投稿の削除に失敗しました' }, { status: 500 });
  }
}

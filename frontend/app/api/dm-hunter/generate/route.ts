import { NextRequest, NextResponse } from 'next/server';
import { generateDMPost, generateMultiplePosts, TARGETS, BENEFITS } from '@/lib/dm-hunter/generator';
import { checkQuality, selectBestPost } from '@/lib/dm-hunter/quality-checker';

// POST: 投稿を生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { count = 3, target, benefit, selectBest = true } = body;

    // 複数生成
    const posts = await generateMultiplePosts(count);

    if (selectBest) {
      // 品質チェックして最良のものを選択
      const best = selectBestPost(posts);
      if (best) {
        return NextResponse.json({
          success: true,
          post: best.post,
          score: best.score,
          allPosts: posts.map(p => ({
            ...p,
            score: checkQuality(p.text),
          })),
        });
      }
    }

    // 全投稿を返す
    return NextResponse.json({
      success: true,
      posts: posts.map(p => ({
        ...p,
        score: checkQuality(p.text),
      })),
    });

  } catch (error: any) {
    console.error('Generate error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// GET: オプション一覧を取得
export async function GET() {
  return NextResponse.json({
    targets: TARGETS,
    benefits: BENEFITS,
  });
}

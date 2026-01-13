/**
 * 投稿取得API
 * GET /api/db/posts?account=liver&status=pending&limit=3
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPosts } from '../../../../lib/database/generated-posts';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account') || undefined;
    const status = searchParams.get('status') as 'draft' | 'pending' | 'approved' | 'posted' | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const minScore = searchParams.get('minScore') ? parseFloat(searchParams.get('minScore')!) : undefined;

    const posts = await getPosts({
      account,
      status,
      limit,
      minScore,
    });

    return NextResponse.json({
      posts: posts.map(p => ({
        id: p.id,
        text: p.text,
        target: p.target,
        benefit: p.benefit,
        score: p.score.total,
        status: p.status,
        account: p.account,
        createdAt: p.createdAt,
      })),
      total: posts.length,
    });
  } catch (error) {
    console.error('投稿取得エラー:', error);
    return NextResponse.json(
      { error: '投稿の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * インプレッション自動取得 Cron ジョブ
 *
 * Vercel Cron: 毎日 UTC 15:00 (JST 24:00)
 * 投稿のインプレッション・エンゲージメントを取得し、
 * 高パフォーマンス投稿から成功パターンを学習
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { learnFromPost, addSuccessPattern } from '@/lib/database/success-patterns-db';

export const runtime = 'nodejs';
export const maxDuration = 120;

const POSTS_HISTORY_FILE = path.join(process.cwd(), 'knowledge', 'posts_history.json');
const CREDENTIALS_FILE = path.join(process.cwd(), 'knowledge', 'x_credentials.json');

type PostHistory = {
  id: string;
  text: string;
  timestamp: string;
  tweetId?: string;
  account?: string;
  impressions?: number;
  engagements?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  score?: number;
};

type XCredentials = {
  tt_liver?: {
    bearerToken: string;
  };
  [key: string]: { bearerToken: string } | undefined;
};

async function loadPostsHistory(): Promise<PostHistory[]> {
  try {
    const data = await fs.readFile(POSTS_HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.posts || [];
  } catch {
    return [];
  }
}

async function savePostsHistory(posts: PostHistory[]): Promise<void> {
  const dir = path.dirname(POSTS_HISTORY_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(POSTS_HISTORY_FILE, JSON.stringify({ posts }, null, 2));
}

async function loadCredentials(): Promise<XCredentials | null> {
  try {
    const data = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * X APIからツイートメトリクスを取得
 */
async function fetchTweetMetrics(
  tweetIds: string[],
  bearerToken: string
): Promise<Map<string, { impressions: number; likes: number; retweets: number; replies: number }>> {
  const results = new Map();
  const decodedToken = decodeURIComponent(bearerToken);

  const batchSize = 100;
  for (let i = 0; i < tweetIds.length; i += batchSize) {
    const batch = tweetIds.slice(i, i + batchSize);
    const idsParam = batch.join(',');

    try {
      const response = await fetch(
        `https://api.twitter.com/2/tweets?ids=${idsParam}&tweet.fields=public_metrics`,
        {
          headers: { Authorization: `Bearer ${decodedToken}` },
        }
      );

      if (!response.ok) {
        console.error('[fetch-impressions] X API error:', response.status);
        continue;
      }

      const data = await response.json();
      if (data.data) {
        for (const tweet of data.data) {
          if (tweet.public_metrics) {
            results.set(tweet.id, {
              impressions: tweet.public_metrics.impression_count || 0,
              likes: tweet.public_metrics.like_count || 0,
              retweets: tweet.public_metrics.retweet_count || 0,
              replies: tweet.public_metrics.reply_count || 0,
            });
          }
        }
      }
    } catch (e) {
      console.error('[fetch-impressions] Failed to fetch batch:', e);
    }

    // レート制限対策
    if (i + batchSize < tweetIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const credentials = await loadCredentials();
    if (!credentials?.tt_liver?.bearerToken) {
      return NextResponse.json({
        success: false,
        error: 'X API credentials not configured',
      });
    }

    const posts = await loadPostsHistory();

    // tweetIdがある投稿でメトリクスがないものを取得
    const postsToUpdate = posts.filter(
      p => p.tweetId && (!p.impressions || p.impressions === 0)
    );

    if (postsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tweets to update',
        totalPosts: posts.length,
      });
    }

    // メトリクス取得
    const tweetIds = postsToUpdate.map(p => p.tweetId!);
    const metricsMap = await fetchTweetMetrics(tweetIds, credentials.tt_liver.bearerToken);

    let updatedCount = 0;
    let learnedCount = 0;

    // 平均インプレッションを計算（既存データから）
    const existingImpressions = posts
      .filter(p => p.impressions && p.impressions > 0)
      .map(p => p.impressions!);
    const avgImpressions =
      existingImpressions.length > 0
        ? existingImpressions.reduce((a, b) => a + b, 0) / existingImpressions.length
        : 500; // デフォルト

    for (const post of postsToUpdate) {
      const metrics = metricsMap.get(post.tweetId!);
      if (metrics) {
        post.impressions = metrics.impressions;
        post.likes = metrics.likes;
        post.retweets = metrics.retweets;
        post.replies = metrics.replies;
        post.engagements = metrics.likes + metrics.retweets + metrics.replies;
        updatedCount++;

        // 高パフォーマンス投稿（平均の1.5倍以上）から自動学習
        if (metrics.impressions >= avgImpressions * 1.5) {
          const score = post.score || 8.0;
          try {
            await learnFromPost(post.text, score, false);
            learnedCount++;
            console.log(`[fetch-impressions] Learned from high-performing post: ${post.tweetId}`);
          } catch (e) {
            console.error('[fetch-impressions] Failed to learn:', e);
          }
        }
      }
    }

    // 更新を保存
    await savePostsHistory(posts);

    console.log(`[CRON] fetch-impressions: updated=${updatedCount}, learned=${learnedCount}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      updated: updatedCount,
      learned: learnedCount,
      avgImpressions: Math.round(avgImpressions),
      totalPosts: posts.length,
    });
  } catch (error) {
    console.error('[CRON] fetch-impressions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch impressions', details: String(error) },
      { status: 500 }
    );
  }
}

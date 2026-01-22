/**
 * クロスプラットフォーム投稿変換 Cron Job
 *
 * 機能:
 * - Xで伸びた投稿を検出
 * - Instagram/TikTok用に自動変換
 * - content_queueに追加
 *
 * 実行頻度: 1日2回（朝と夜）
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  adaptTwitterToInstagramReel,
  adaptTwitterToTikTokOverlay,
  isHighPerformingPost,
  isAlreadyConverted,
  type TwitterPost,
} from '@/lib/content-adapter';

export const runtime = 'nodejs';
export const maxDuration = 60;

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ========== ヘルパー関数 ==========

function loadPostsHistory(): TwitterPost[] {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'posts_history.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // posts_history.json の形式に合わせてマッピング
      return data.map((item: any) => ({
        id: item.tweetId || item.id,
        text: item.text,
        account: item.account,
        impressions: item.impressions || 0,
        likes: item.likes || 0,
        retweets: item.retweets || 0,
        engagementRate: item.engagementRate || 0,
        timestamp: item.timestamp,
      }));
    }
  } catch (error) {
    console.error('[Cross Post] Error loading posts history:', error);
  }
  return [];
}

function loadContentQueue(): { instagram: any[]; tiktok: any[]; updatedAt?: string } {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'content_queue.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[Cross Post] Error loading content queue:', error);
  }
  return { instagram: [], tiktok: [] };
}

function saveContentQueue(queue: any): void {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'content_queue.json');
    fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Cross Post] Error saving content queue:', error);
  }
}

// ========== メイン処理 ==========

async function processHighPerformingPosts(): Promise<{
  checked: number;
  converted: {
    instagram: number;
    tiktok: number;
  };
}> {
  const results = {
    checked: 0,
    converted: {
      instagram: 0,
      tiktok: 0,
    },
  };

  // 投稿履歴を読み込み
  const postsHistory = loadPostsHistory();
  const contentQueue = loadContentQueue();

  // 最近の投稿（7日以内）をチェック
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentPosts = postsHistory.filter(post => {
    if (!post.timestamp) return false;
    const postDate = new Date(post.timestamp);
    return postDate > sevenDaysAgo;
  });

  console.log(`[Cross Post] Checking ${recentPosts.length} recent posts...`);

  for (const post of recentPosts) {
    results.checked++;

    // 伸びた投稿かチェック
    if (!isHighPerformingPost(post)) {
      continue;
    }

    console.log(`[Cross Post] High performing post found: ${post.id} (rate: ${post.engagementRate}%)`);

    // 既に変換済みかチェック
    const converted = isAlreadyConverted(post.id, contentQueue);

    // Instagram用に変換（未変換の場合）
    if (!converted.instagram) {
      try {
        console.log(`[Cross Post] Converting to Instagram: ${post.id}`);
        const igContent = await adaptTwitterToInstagramReel(post);

        const newItem = {
          id: `ig_cross_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          status: 'pending',
          ...igContent,
          createdAt: new Date().toISOString(),
          account: post.account.includes('liver') ? 'liver' : 'chatre',
          source: 'cross_post',
          sourcePostId: post.id,
          originalText: post.text.substring(0, 100),
        };

        contentQueue.instagram.push(newItem);
        results.converted.instagram++;

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Cross Post] Error converting to Instagram:`, error);
      }
    }

    // TikTok用に変換（未変換の場合）
    if (!converted.tiktok) {
      try {
        console.log(`[Cross Post] Converting to TikTok: ${post.id}`);
        const ttContent = await adaptTwitterToTikTokOverlay(post);

        const newItem = {
          id: `tt_cross_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          status: 'pending',
          ...ttContent,
          createdAt: new Date().toISOString(),
          account: post.account.includes('liver') ? 'liver' : 'chatre',
          source: 'cross_post',
          sourcePostId: post.id,
          originalText: post.text.substring(0, 100),
        };

        contentQueue.tiktok.push(newItem);
        results.converted.tiktok++;

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Cross Post] Error converting to TikTok:`, error);
      }
    }

    // 1回の実行で最大5投稿まで変換
    if (results.converted.instagram + results.converted.tiktok >= 10) {
      console.log('[Cross Post] Reached conversion limit');
      break;
    }
  }

  // キューを保存
  if (results.converted.instagram > 0 || results.converted.tiktok > 0) {
    contentQueue.updatedAt = new Date().toISOString();
    saveContentQueue(contentQueue);
  }

  return results;
}

// ========== API ハンドラ ==========

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Cron認証
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cross Post] Starting cross-platform conversion...');

    const results = await processHighPerformingPosts();

    const processingTime = Date.now() - startTime;
    console.log(`[Cross Post] Completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      results,
      processingTime,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cross Post] Error:', error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

// GET: ステータス確認
export async function GET() {
  const postsHistory = loadPostsHistory();
  const contentQueue = loadContentQueue();

  const highPerformingCount = postsHistory.filter(isHighPerformingPost).length;
  const crossPostInstagram = contentQueue.instagram.filter(
    (item: any) => item.source === 'cross_post'
  ).length;
  const crossPostTiktok = contentQueue.tiktok.filter(
    (item: any) => item.source === 'cross_post'
  ).length;

  return NextResponse.json({
    status: 'ok',
    totalPosts: postsHistory.length,
    highPerformingPosts: highPerformingCount,
    crossPosted: {
      instagram: crossPostInstagram,
      tiktok: crossPostTiktok,
    },
  });
}

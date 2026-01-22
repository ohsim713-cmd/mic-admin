/**
 * TikTok データ収集 Cron Job
 *
 * 実行頻度: 1日1回（朝6時 JST = 21:00 UTC前日）
 * 機能:
 * - トレンド動画を取得して buzz_stock に保存
 * - トレンドサウンドを取得して trending_sounds に保存
 * - ハッシュタグ検索で競合コンテンツを収集
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  fetchTrendingVideos,
  fetchHashtagVideos,
  fetchTrendingSounds,
  fetchUserVideos,
  sortByEngagement,
  calculateEngagementRate,
  type TikTokVideo,
  type TikTokSound,
} from '@/lib/tiktok-api';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro: 60秒まで

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const BUZZ_STOCK_FILE = path.join(KNOWLEDGE_DIR, 'tiktok_buzz_stock.json');
const TRENDING_SOUNDS_FILE = path.join(KNOWLEDGE_DIR, 'trending_sounds.json');

// ターゲットハッシュタグ（ライバー・チャトレ関連）
const TARGET_HASHTAGS = {
  liver: [
    'ライバー',
    'ライバー募集',
    '配信者',
    'ライブ配信',
    '事務所所属',
    'TikTokライバー',
    '副業',
    '在宅ワーク',
  ],
  chatre: [
    'チャットレディ',
    'チャトレ',
    '高収入',
    '在宅副業',
    'お小遣い稼ぎ',
    '主婦副業',
  ],
};

// 競合アカウント（後で追加可能）
const COMPETITOR_ACCOUNTS = {
  liver: [] as string[],   // 競合ライバー事務所アカウント
  chatre: [] as string[],  // 競合チャトレ事務所アカウント
};

interface BuzzStockItem {
  id: string;
  platform: 'tiktok';
  type: 'liver' | 'chatre' | 'general';
  desc: string;
  author: string;
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  };
  engagementRate: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  music?: {
    title: string;
    author: string;
  };
  collectedAt: string;
  source: 'trending' | 'hashtag' | 'competitor';
  hashtag?: string;
}

interface TrendingSoundItem {
  id: string;
  platform: 'tiktok';
  title: string;
  author: string;
  playUrl?: string;
  coverUrl?: string;
  videoCount?: number;
  collectedAt: string;
}

/**
 * buzz_stock.json を読み込む
 */
function loadBuzzStock(): BuzzStockItem[] {
  try {
    if (fs.existsSync(BUZZ_STOCK_FILE)) {
      const data = fs.readFileSync(BUZZ_STOCK_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[TikTok Collect] Error loading buzz stock:', error);
  }
  return [];
}

/**
 * buzz_stock.json に保存
 */
function saveBuzzStock(items: BuzzStockItem[]): void {
  try {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }
    fs.writeFileSync(BUZZ_STOCK_FILE, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`[TikTok Collect] Saved ${items.length} items to buzz_stock`);
  } catch (error) {
    console.error('[TikTok Collect] Error saving buzz stock:', error);
  }
}

/**
 * trending_sounds.json を読み込む
 */
function loadTrendingSounds(): TrendingSoundItem[] {
  try {
    if (fs.existsSync(TRENDING_SOUNDS_FILE)) {
      const data = fs.readFileSync(TRENDING_SOUNDS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.tiktok || [];
    }
  } catch (error) {
    console.error('[TikTok Collect] Error loading trending sounds:', error);
  }
  return [];
}

/**
 * trending_sounds.json に保存
 */
function saveTrendingSounds(tiktokSounds: TrendingSoundItem[], instagramSounds: any[] = []): void {
  try {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }

    // 既存のInstagramサウンドを保持
    let existingInstagram: any[] = [];
    if (fs.existsSync(TRENDING_SOUNDS_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(TRENDING_SOUNDS_FILE, 'utf-8'));
        existingInstagram = existing.instagram || [];
      } catch {
        // ignore
      }
    }

    const data = {
      tiktok: tiktokSounds,
      instagram: instagramSounds.length > 0 ? instagramSounds : existingInstagram,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(TRENDING_SOUNDS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[TikTok Collect] Saved ${tiktokSounds.length} TikTok sounds`);
  } catch (error) {
    console.error('[TikTok Collect] Error saving trending sounds:', error);
  }
}

/**
 * TikTok動画をBuzzStockItemに変換
 */
function videoToBuzzItem(
  video: TikTokVideo,
  type: 'liver' | 'chatre' | 'general',
  source: 'trending' | 'hashtag' | 'competitor',
  hashtag?: string
): BuzzStockItem {
  return {
    id: video.id,
    platform: 'tiktok',
    type,
    desc: video.desc,
    author: video.author.uniqueId,
    stats: {
      playCount: video.stats.playCount,
      likeCount: video.stats.likeCount,
      commentCount: video.stats.commentCount,
      shareCount: video.stats.shareCount,
    },
    engagementRate: calculateEngagementRate(video),
    videoUrl: video.video.downloadUrl || video.video.playUrl,
    thumbnailUrl: video.video.coverUrl,
    music: video.music ? {
      title: video.music.title,
      author: video.music.author,
    } : undefined,
    collectedAt: new Date().toISOString(),
    source,
    hashtag,
  };
}

/**
 * TikTokサウンドをTrendingSoundItemに変換
 */
function soundToTrendingItem(sound: TikTokSound): TrendingSoundItem {
  return {
    id: sound.id,
    platform: 'tiktok',
    title: sound.title,
    author: sound.author,
    playUrl: sound.playUrl,
    coverUrl: sound.coverUrl,
    videoCount: sound.videoCount,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * メイン処理
 */
async function collectTikTokData(): Promise<{
  trendingCount: number;
  hashtagCount: number;
  competitorCount: number;
  soundsCount: number;
}> {
  const results = {
    trendingCount: 0,
    hashtagCount: 0,
    competitorCount: 0,
    soundsCount: 0,
  };

  const newBuzzItems: BuzzStockItem[] = [];

  // 1. トレンド動画を取得
  console.log('[TikTok Collect] Fetching trending videos...');
  const trendingVideos = await fetchTrendingVideos('JP', 30);
  if (trendingVideos.length > 0) {
    const sortedTrending = sortByEngagement(trendingVideos).slice(0, 20);
    for (const video of sortedTrending) {
      newBuzzItems.push(videoToBuzzItem(video, 'general', 'trending'));
    }
    results.trendingCount = sortedTrending.length;
    console.log(`[TikTok Collect] Got ${results.trendingCount} trending videos`);
  }

  // 2. ハッシュタグ検索（ライバー関連）
  console.log('[TikTok Collect] Fetching liver hashtag videos...');
  for (const hashtag of TARGET_HASHTAGS.liver.slice(0, 3)) { // API制限を考慮して3つまで
    const videos = await fetchHashtagVideos(hashtag, 10);
    if (videos.length > 0) {
      const sorted = sortByEngagement(videos).slice(0, 5);
      for (const video of sorted) {
        newBuzzItems.push(videoToBuzzItem(video, 'liver', 'hashtag', hashtag));
      }
      results.hashtagCount += sorted.length;
    }
    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 3. ハッシュタグ検索（チャトレ関連）
  console.log('[TikTok Collect] Fetching chatre hashtag videos...');
  for (const hashtag of TARGET_HASHTAGS.chatre.slice(0, 3)) {
    const videos = await fetchHashtagVideos(hashtag, 10);
    if (videos.length > 0) {
      const sorted = sortByEngagement(videos).slice(0, 5);
      for (const video of sorted) {
        newBuzzItems.push(videoToBuzzItem(video, 'chatre', 'hashtag', hashtag));
      }
      results.hashtagCount += sorted.length;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 4. 競合アカウントの動画（設定されている場合）
  for (const [type, accounts] of Object.entries(COMPETITOR_ACCOUNTS)) {
    for (const account of accounts) {
      console.log(`[TikTok Collect] Fetching competitor: ${account}`);
      const videos = await fetchUserVideos(account, 10);
      if (videos.length > 0) {
        const sorted = sortByEngagement(videos).slice(0, 5);
        for (const video of sorted) {
          newBuzzItems.push(videoToBuzzItem(video, type as 'liver' | 'chatre', 'competitor'));
        }
        results.competitorCount += sorted.length;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 5. トレンドサウンドを取得
  console.log('[TikTok Collect] Fetching trending sounds...');
  const trendingSounds = await fetchTrendingSounds('JP', 20);
  if (trendingSounds.length > 0) {
    const soundItems = trendingSounds.map(soundToTrendingItem);
    saveTrendingSounds(soundItems);
    results.soundsCount = soundItems.length;
    console.log(`[TikTok Collect] Got ${results.soundsCount} trending sounds`);
  }

  // 6. 既存のbuzz_stockとマージ（重複除去、古いものは削除）
  const existingBuzz = loadBuzzStock();
  const existingIds = new Set(existingBuzz.map(item => item.id));

  // 新しいアイテムのみ追加
  const uniqueNewItems = newBuzzItems.filter(item => !existingIds.has(item.id));

  // 古いアイテムを削除（7日以上前）
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentItems = existingBuzz.filter(item => {
    const collectedAt = new Date(item.collectedAt);
    return collectedAt > sevenDaysAgo;
  });

  // マージして保存（最大200件）
  const mergedBuzz = [...uniqueNewItems, ...recentItems]
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 200);

  saveBuzzStock(mergedBuzz);

  return results;
}

// GET: ステータス確認用
export async function GET() {
  const buzzStock = loadBuzzStock();
  const sounds = loadTrendingSounds();

  return NextResponse.json({
    status: 'ok',
    buzzStockCount: buzzStock.length,
    tiktokSoundsCount: sounds.length,
    lastUpdated: buzzStock[0]?.collectedAt || null,
  });
}

// POST: データ収集実行
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Cron認証（Vercel Cron用）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TikTok Collect] Starting data collection...');

    const results = await collectTikTokData();

    const processingTime = Date.now() - startTime;

    console.log(`[TikTok Collect] Completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      results,
      processingTime,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TikTok Collect] Error:', error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * Instagram データ収集 Cron Job
 *
 * 実行頻度: 1日1回（朝6時 JST = 21:00 UTC前日）
 * 機能:
 * - ハッシュタグ検索でトレンド投稿を収集
 * - 競合アカウントのリールを収集
 * - トレンドオーディオを収集
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  fetchHashtagPosts,
  fetchUserReels,
  fetchUserProfile,
  fetchTrendingAudio,
  sortByEngagement,
  sortReelsByPlayCount,
  type InstagramPost,
  type InstagramReel,
  type InstagramAudio,
} from '@/lib/instagram-api';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro: 60秒まで

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const BUZZ_STOCK_FILE = path.join(KNOWLEDGE_DIR, 'instagram_buzz_stock.json');
const TRENDING_SOUNDS_FILE = path.join(KNOWLEDGE_DIR, 'trending_sounds.json');

// ターゲットハッシュタグ（ライバー・チャトレ関連）
const TARGET_HASHTAGS = {
  liver: [
    'ライバー',
    'ライバー募集',
    '配信者',
    'ライブ配信',
    'pococha',
    '17live',
    'イチナナライバー',
    '副業女子',
  ],
  chatre: [
    'チャットレディ',
    '高収入バイト',
    '在宅ワーク主婦',
    '副業女子',
    'お小遣い稼ぎ',
    '自由な働き方',
  ],
};

// 競合アカウント（後で追加可能）
const COMPETITOR_ACCOUNTS = {
  liver: [] as string[],   // 競合ライバー事務所アカウント
  chatre: [] as string[],  // 競合チャトレ事務所アカウント
};

interface InstagramBuzzItem {
  id: string;
  shortcode: string;
  platform: 'instagram';
  type: 'liver' | 'chatre' | 'general';
  mediaType: 'image' | 'video' | 'carousel' | 'reel';
  caption: string;
  author: string;
  stats: {
    likeCount: number;
    commentCount: number;
    viewCount?: number;
    playCount?: number;
  };
  engagementScore: number;  // いいね + コメント
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  music?: {
    title: string;
    artist: string;
  };
  collectedAt: string;
  source: 'hashtag' | 'competitor' | 'trending';
  hashtag?: string;
}

interface InstagramSoundItem {
  id: string;
  platform: 'instagram';
  title: string;
  artist: string;
  audioUrl?: string;
  coverUrl?: string;
  useCount?: number;
  collectedAt: string;
}

/**
 * buzz_stock.json を読み込む
 */
function loadBuzzStock(): InstagramBuzzItem[] {
  try {
    if (fs.existsSync(BUZZ_STOCK_FILE)) {
      const data = fs.readFileSync(BUZZ_STOCK_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Instagram Collect] Error loading buzz stock:', error);
  }
  return [];
}

/**
 * buzz_stock.json に保存
 */
function saveBuzzStock(items: InstagramBuzzItem[]): void {
  try {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }
    fs.writeFileSync(BUZZ_STOCK_FILE, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`[Instagram Collect] Saved ${items.length} items to buzz_stock`);
  } catch (error) {
    console.error('[Instagram Collect] Error saving buzz stock:', error);
  }
}

/**
 * trending_sounds.json を読み込む
 */
function loadTrendingSounds(): { tiktok: any[]; instagram: InstagramSoundItem[] } {
  try {
    if (fs.existsSync(TRENDING_SOUNDS_FILE)) {
      const data = fs.readFileSync(TRENDING_SOUNDS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Instagram Collect] Error loading trending sounds:', error);
  }
  return { tiktok: [], instagram: [] };
}

/**
 * trending_sounds.json に保存（Instagram部分のみ更新）
 */
function saveTrendingSounds(instagramSounds: InstagramSoundItem[]): void {
  try {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }

    // 既存のTikTokサウンドを保持
    const existing = loadTrendingSounds();

    const data = {
      tiktok: existing.tiktok || [],
      instagram: instagramSounds,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(TRENDING_SOUNDS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Instagram Collect] Saved ${instagramSounds.length} Instagram sounds`);
  } catch (error) {
    console.error('[Instagram Collect] Error saving trending sounds:', error);
  }
}

/**
 * Instagram投稿をBuzzItemに変換
 */
function postToBuzzItem(
  post: InstagramPost,
  type: 'liver' | 'chatre' | 'general',
  source: 'hashtag' | 'competitor' | 'trending',
  hashtag?: string
): InstagramBuzzItem {
  return {
    id: post.id,
    shortcode: post.shortcode,
    platform: 'instagram',
    type,
    mediaType: post.mediaType,
    caption: post.caption,
    author: post.author.username,
    stats: {
      likeCount: post.stats.likeCount,
      commentCount: post.stats.commentCount,
      viewCount: post.stats.viewCount,
      playCount: post.stats.playCount,
    },
    engagementScore: post.stats.likeCount + post.stats.commentCount,
    imageUrl: post.media.imageUrl,
    videoUrl: post.media.videoUrl,
    thumbnailUrl: post.media.thumbnailUrl,
    music: post.music,
    collectedAt: new Date().toISOString(),
    source,
    hashtag,
  };
}

/**
 * Instagramリールを BuzzItemに変換
 */
function reelToBuzzItem(
  reel: InstagramReel,
  type: 'liver' | 'chatre' | 'general',
  source: 'hashtag' | 'competitor' | 'trending'
): InstagramBuzzItem {
  return {
    id: reel.id,
    shortcode: reel.shortcode,
    platform: 'instagram',
    type,
    mediaType: 'reel',
    caption: reel.caption,
    author: reel.author.username,
    stats: {
      likeCount: reel.stats.likeCount,
      commentCount: reel.stats.commentCount,
      playCount: reel.stats.playCount,
    },
    engagementScore: reel.stats.likeCount + reel.stats.commentCount,
    videoUrl: reel.video.url,
    thumbnailUrl: reel.video.thumbnailUrl,
    music: reel.music,
    collectedAt: new Date().toISOString(),
    source,
  };
}

/**
 * Instagramオーディオを TrendingSoundItemに変換
 */
function audioToSoundItem(audio: InstagramAudio): InstagramSoundItem {
  return {
    id: audio.id,
    platform: 'instagram',
    title: audio.title,
    artist: audio.artist,
    audioUrl: audio.audioUrl,
    coverUrl: audio.coverUrl,
    useCount: audio.useCount,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * メイン処理
 */
async function collectInstagramData(): Promise<{
  hashtagCount: number;
  competitorCount: number;
  soundsCount: number;
}> {
  const results = {
    hashtagCount: 0,
    competitorCount: 0,
    soundsCount: 0,
  };

  const newBuzzItems: InstagramBuzzItem[] = [];
  const collectedSounds = new Map<string, InstagramSoundItem>();

  // 1. ハッシュタグ検索（ライバー関連）
  console.log('[Instagram Collect] Fetching liver hashtag posts...');
  for (const hashtag of TARGET_HASHTAGS.liver.slice(0, 4)) { // API制限を考慮
    const posts = await fetchHashtagPosts(hashtag, 15);
    if (posts.length > 0) {
      const sorted = sortByEngagement(posts).slice(0, 8);
      for (const post of sorted) {
        newBuzzItems.push(postToBuzzItem(post, 'liver', 'hashtag', hashtag));

        // リールの場合、音楽情報を収集
        if (post.mediaType === 'reel' && post.music) {
          const soundItem = {
            id: `ig_${post.id}_music`,
            platform: 'instagram' as const,
            title: post.music.title,
            artist: post.music.artist,
            audioUrl: post.music.audioUrl,
            collectedAt: new Date().toISOString(),
          };
          collectedSounds.set(soundItem.title, soundItem);
        }
      }
      results.hashtagCount += sorted.length;
    }
    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 2. ハッシュタグ検索（チャトレ関連）
  console.log('[Instagram Collect] Fetching chatre hashtag posts...');
  for (const hashtag of TARGET_HASHTAGS.chatre.slice(0, 4)) {
    const posts = await fetchHashtagPosts(hashtag, 15);
    if (posts.length > 0) {
      const sorted = sortByEngagement(posts).slice(0, 8);
      for (const post of sorted) {
        newBuzzItems.push(postToBuzzItem(post, 'chatre', 'hashtag', hashtag));

        if (post.mediaType === 'reel' && post.music) {
          const soundItem = {
            id: `ig_${post.id}_music`,
            platform: 'instagram' as const,
            title: post.music.title,
            artist: post.music.artist,
            audioUrl: post.music.audioUrl,
            collectedAt: new Date().toISOString(),
          };
          collectedSounds.set(soundItem.title, soundItem);
        }
      }
      results.hashtagCount += sorted.length;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 3. 競合アカウントのリール（設定されている場合）
  for (const [type, accounts] of Object.entries(COMPETITOR_ACCOUNTS)) {
    for (const account of accounts) {
      console.log(`[Instagram Collect] Fetching competitor reels: ${account}`);
      const reels = await fetchUserReels(account, 10);
      if (reels.length > 0) {
        const sorted = sortReelsByPlayCount(reels).slice(0, 5);
        for (const reel of sorted) {
          newBuzzItems.push(reelToBuzzItem(reel, type as 'liver' | 'chatre', 'competitor'));

          if (reel.music) {
            const soundItem = {
              id: `ig_${reel.id}_music`,
              platform: 'instagram' as const,
              title: reel.music.title,
              artist: reel.music.artist,
              audioUrl: reel.music.audioUrl,
              collectedAt: new Date().toISOString(),
            };
            collectedSounds.set(soundItem.title, soundItem);
          }
        }
        results.competitorCount += sorted.length;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 4. トレンドオーディオを取得
  console.log('[Instagram Collect] Fetching trending audio...');
  const trendingAudio = await fetchTrendingAudio(20);
  if (trendingAudio.length > 0) {
    for (const audio of trendingAudio) {
      collectedSounds.set(audio.title, audioToSoundItem(audio));
    }
  }

  // 5. サウンド情報を保存
  const soundItems = Array.from(collectedSounds.values());
  if (soundItems.length > 0) {
    saveTrendingSounds(soundItems);
    results.soundsCount = soundItems.length;
    console.log(`[Instagram Collect] Got ${results.soundsCount} sounds`);
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
    .sort((a, b) => b.engagementScore - a.engagementScore)
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
    instagramSoundsCount: sounds.instagram?.length || 0,
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

    console.log('[Instagram Collect] Starting data collection...');

    const results = await collectInstagramData();

    const processingTime = Date.now() - startTime;

    console.log(`[Instagram Collect] Completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      results,
      processingTime,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Instagram Collect] Error:', error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

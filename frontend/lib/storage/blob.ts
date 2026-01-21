/**
 * Vercel Blob ストレージヘルパー
 *
 * JSONファイルの保存・読み込みをVercel Blobで行う
 * Vercel Pro/Enterprise で利用可能
 */

import { put, list, del } from '@vercel/blob';

// Blobファイル名の定数
export const BLOB_FILES = {
  BUZZ_STOCK: 'knowledge/buzz_stock.json',
  TRENDING_POSTS: 'knowledge/trending_posts.json',
  LIVER_TWEETS: 'knowledge/liver_tweets.json',
  TT_LIVER_TWEETS: 'knowledge/tt_liver_tweets.json',
  LITZ_GRP_TWEETS: 'knowledge/litz_grp_tweets.json',
  MS_STRIPCHAT_TWEETS: 'knowledge/ms_stripchat_tweets.json',
  POSTS_HISTORY: 'knowledge/posts_history.json',
} as const;

/**
 * JSONデータをBlobに保存
 */
export async function saveToBlob<T>(filename: string, data: T): Promise<string> {
  const blob = await put(filename, JSON.stringify(data, null, 2), {
    access: 'public',
    addRandomSuffix: false, // 同じファイル名で上書き
  });
  console.log(`[Blob] Saved: ${filename} -> ${blob.url}`);
  return blob.url;
}

/**
 * BlobからJSONデータを読み込み
 * Blobにない場合はローカルファイルにフォールバック
 */
export async function loadFromBlob<T>(filename: string, fallbackData?: T): Promise<T | null> {
  try {
    // Blob URLを構築
    const blobUrl = `${process.env.BLOB_READ_WRITE_TOKEN ? 'https://' : ''}${process.env.VERCEL_BLOB_STORE_ID || ''}.public.blob.vercel-storage.com/${filename}`;

    // まずBlobから取得を試みる
    const blobs = await list({ prefix: filename });

    if (blobs.blobs.length > 0) {
      const response = await fetch(blobs.blobs[0].url);
      if (response.ok) {
        const data = await response.json();
        console.log(`[Blob] Loaded from Blob: ${filename}`);
        return data as T;
      }
    }

    // Blobにない場合、fallbackDataを返す
    if (fallbackData !== undefined) {
      console.log(`[Blob] Using fallback data for: ${filename}`);
      return fallbackData;
    }

    return null;
  } catch (error) {
    console.error(`[Blob] Error loading ${filename}:`, error);

    // エラー時もfallbackDataを返す
    if (fallbackData !== undefined) {
      return fallbackData;
    }
    return null;
  }
}

/**
 * Blobファイルを削除
 */
export async function deleteFromBlob(filename: string): Promise<boolean> {
  try {
    const blobs = await list({ prefix: filename });

    if (blobs.blobs.length > 0) {
      await del(blobs.blobs[0].url);
      console.log(`[Blob] Deleted: ${filename}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[Blob] Error deleting ${filename}:`, error);
    return false;
  }
}

/**
 * Blobファイル一覧を取得
 */
export async function listBlobs(prefix?: string): Promise<string[]> {
  try {
    const blobs = await list({ prefix });
    return blobs.blobs.map(b => b.pathname);
  } catch (error) {
    console.error(`[Blob] Error listing:`, error);
    return [];
  }
}

/**
 * DM Hunter - SNSアダプター
 * 3アカウント対応版
 */

import { TwitterApi } from 'twitter-api-v2';

// アカウント種別
export type AccountType = 'tt_liver' | 'litz_grp' | 'chatre1' | 'chatre2' | 'wordpress';

// アカウント設定
export const ACCOUNTS: {
  id: AccountType;
  name: string;
  handle: string;
  type: 'ライバー' | 'チャトレ';
  platform: 'twitter' | 'wordpress';
  enabled?: boolean;
}[] = [
  { id: 'tt_liver', name: 'ライバー事務所', handle: '@tt_liver', type: 'ライバー', platform: 'twitter', enabled: true },
  { id: 'litz_grp', name: 'ライバー事務所公式', handle: '@Litz_grp', type: 'ライバー', platform: 'twitter', enabled: true },
  { id: 'chatre1', name: 'チャトレ事務所①', handle: '@mic_chat_', type: 'チャトレ', platform: 'twitter', enabled: true },
  { id: 'chatre2', name: 'チャトレ事務所②', handle: '@ms_stripchat', type: 'チャトレ', platform: 'twitter', enabled: false },
  { id: 'wordpress', name: 'WordPress記事', handle: 'チャトレブログ', type: 'チャトレ', platform: 'wordpress', enabled: true },
];

// SNS別の制限
export const SNS_LIMITS = {
  twitter: { maxLength: 280, hashtags: 3 },
  wordpress: { maxLength: 5000, hashtags: 0 },
};

import fs from 'fs';
import path from 'path';

// WordPress認証情報を取得
function getWordPressCredentials(): { siteUrl: string; username: string; appPassword: string } | null {
  try {
    const settingsPath = path.join(process.cwd(), 'knowledge', 'wordpress_credentials.json');
    if (!fs.existsSync(settingsPath)) return null;
    const data = fs.readFileSync(settingsPath, 'utf-8');
    const creds = JSON.parse(data);
    if (!creds.siteUrl || !creds.username || !creds.appPassword) return null;
    return creds;
  } catch {
    return null;
  }
}

export interface PostResult {
  platform: string;
  account: string;
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * 環境変数からTwitterクライアントを取得
 */
function getTwitterClient(account: AccountType): TwitterApi | null {
  let apiKey: string | undefined;
  let apiSecret: string | undefined;
  let accessToken: string | undefined;
  let accessTokenSecret: string | undefined;

  switch (account) {
    case 'tt_liver':
      apiKey = process.env.TWITTER_API_KEY_TT_LIVER;
      apiSecret = process.env.TWITTER_API_SECRET_TT_LIVER;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_TT_LIVER;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_TT_LIVER;
      console.log(`[Twitter] tt_liver auth check - apiKey: ${apiKey ? apiKey.substring(0, 5) + '...' : 'NONE'}, accessToken: ${accessToken ? accessToken.substring(0, 10) + '...' : 'NONE'}`);
      break;
    case 'litz_grp':
      apiKey = process.env.TWITTER_API_KEY_LITZ_GRP;
      apiSecret = process.env.TWITTER_API_SECRET_LITZ_GRP;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_LITZ_GRP;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_LITZ_GRP;
      break;
    case 'chatre1':
      apiKey = process.env.TWITTER_API_KEY_MIC_CHAT;
      apiSecret = process.env.TWITTER_API_SECRET_MIC_CHAT;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_MIC_CHAT;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_MIC_CHAT;
      break;
    case 'chatre2':
      apiKey = process.env.TWITTER_API_KEY_MS_STRIPCHAT;
      apiSecret = process.env.TWITTER_API_SECRET_MS_STRIPCHAT;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_MS_STRIPCHAT;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_MS_STRIPCHAT;
      break;
  }

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return null;
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });
}

/**
 * 投稿をTwitter用にフォーマット
 */
export function formatForTwitter(text: string): string {
  let formatted = text;

  // ハッシュタグを除去
  formatted = formatted.replace(/#[^\s#]+/g, '').trim();

  // X Premium対応 - 長文投稿OK（最大25,000文字）
  // 文字数制限は削除（AIプロンプト側で制御）

  // CTAを確認して追加
  if (!formatted.includes('DM') && !formatted.includes('メッセージ')) {
    if (formatted.length < 250) {
      formatted += '\n\n気になる方はDMで💬';
    }
  }

  return formatted;
}

/**
 * 画像をTwitterにアップロードしてmedia_idを取得
 */
export async function uploadMediaToTwitter(
  account: AccountType,
  imageBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
): Promise<string | null> {
  try {
    const client = getTwitterClient(account);
    if (!client) {
      console.error(`[Twitter] ${account}: 認証情報なし`);
      return null;
    }

    // v1.1 APIでメディアアップロード
    const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType });
    console.log(`[Twitter] Media uploaded: ${mediaId}`);
    return mediaId;
  } catch (error: any) {
    console.error(`[Twitter] Media upload error:`, error.message);
    return null;
  }
}

/**
 * URLから画像をダウンロードしてBufferを取得
 */
export async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Image] Failed to download: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error(`[Image] Download error:`, error.message);
    return null;
  }
}

/**
 * 指定アカウントにTwitter投稿（画像オプション付き）
 */
export async function postToTwitterAccount(
  text: string,
  account: AccountType,
  options?: {
    mediaIds?: string[];
    imageUrls?: string[];
    imageBuffers?: Buffer[];
  }
): Promise<PostResult> {
  const accountInfo = ACCOUNTS.find(a => a.id === account);
  const accountName = accountInfo?.handle || account;

  // アカウントが無効化されている場合はスキップ
  if (accountInfo && accountInfo.enabled === false) {
    console.log(`[Twitter] Skipping disabled account: ${accountName}`);
    return {
      platform: 'twitter',
      account: accountName,
      success: false,
      error: `${accountName}は無効化されています`,
    };
  }

  try {
    const client = getTwitterClient(account);

    if (!client) {
      return {
        platform: 'twitter',
        account: accountName,
        success: false,
        error: `${accountName}の認証情報が設定されていません`,
      };
    }

    const formatted = formatForTwitter(text);
    console.log(`[Twitter] Posting to ${accountName}, text length: ${formatted.length}`);

    // 画像アップロード処理
    let mediaIds: string[] = options?.mediaIds || [];

    // URLから画像をダウンロードしてアップロード
    if (options?.imageUrls && options.imageUrls.length > 0) {
      for (const url of options.imageUrls.slice(0, 4)) { // 最大4枚
        const buffer = await downloadImage(url);
        if (buffer) {
          const mediaId = await uploadMediaToTwitter(account, buffer);
          if (mediaId) mediaIds.push(mediaId);
        }
      }
    }

    // Bufferから直接アップロード
    if (options?.imageBuffers && options.imageBuffers.length > 0) {
      for (const buffer of options.imageBuffers.slice(0, 4 - mediaIds.length)) {
        const mediaId = await uploadMediaToTwitter(account, buffer);
        if (mediaId) mediaIds.push(mediaId);
      }
    }

    // 投稿（画像付きまたはテキストのみ）
    const tweetOptions: any = { text: formatted };
    if (mediaIds.length > 0) {
      tweetOptions.media = { media_ids: mediaIds };
      console.log(`[Twitter] Posting with ${mediaIds.length} images`);
    }

    const tweet = await client.v2.tweet(tweetOptions);

    return {
      platform: 'twitter',
      account: accountName,
      success: true,
      id: tweet.data.id,
    };
  } catch (error: any) {
    // 詳細なエラーログ
    console.error(`[Twitter] Error posting to ${accountName}:`, {
      message: error.message,
      code: error.code,
      data: error.data,
      errors: error.errors,
    });
    return {
      platform: 'twitter',
      account: accountName,
      success: false,
      error: error.message,
    };
  }
}

/**
 * 全アカウントに投稿（それぞれ別の内容、画像オプション付き）
 */
export async function postToAllAccounts(
  posts: {
    account: AccountType;
    text: string;
    imageUrls?: string[];
    imageBuffers?: Buffer[];
  }[]
): Promise<PostResult[]> {
  const promises = posts.map(p => postToTwitterAccount(p.text, p.account, {
    imageUrls: p.imageUrls,
    imageBuffers: p.imageBuffers,
  }));
  const results = await Promise.allSettled(promises);

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      platform: 'twitter',
      account: posts[i].account,
      success: false,
      error: result.reason?.message || 'Unknown error',
    };
  });
}

/**
 * 単一アカウントの認証状態確認
 */
export async function checkAccountStatus(account: AccountType): Promise<{
  connected: boolean;
  username?: string;
  error?: string;
}> {
  // WordPressアカウントの場合
  if (account === 'wordpress') {
    const wpStatus = await checkWordPressStatus();
    return {
      connected: wpStatus.connected,
      username: wpStatus.siteName,
      error: wpStatus.error,
    };
  }

  // Twitterアカウントの場合
  try {
    const client = getTwitterClient(account);

    if (!client) {
      return { connected: false, error: '認証情報未設定' };
    }

    const me = await client.v2.me();
    return {
      connected: true,
      username: me.data.username,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * 全アカウントの認証状態確認
 */
export async function checkAllAccountsStatus(): Promise<{
  account: AccountType;
  name: string;
  handle: string;
  connected: boolean;
  username?: string;
  error?: string;
}[]> {
  const results = await Promise.all(
    ACCOUNTS.map(async (acc) => {
      const status = await checkAccountStatus(acc.id);
      return {
        account: acc.id,
        name: acc.name,
        handle: acc.handle,
        ...status,
      };
    })
  );
  return results;
}

/**
 * WordPressに投稿
 */
export async function postToWordPress(
  title: string,
  content: string,
  status: 'draft' | 'publish' = 'draft'
): Promise<PostResult> {
  try {
    const creds = getWordPressCredentials();

    if (!creds) {
      return {
        platform: 'wordpress',
        account: 'WordPress',
        success: false,
        error: 'WordPress認証情報が設定されていません',
      };
    }

    const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64');

    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        status,
      }),
    });

    if (response.ok) {
      const post = await response.json();
      return {
        platform: 'wordpress',
        account: 'WordPress',
        success: true,
        id: String(post.id),
      };
    } else {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      return {
        platform: 'wordpress',
        account: 'WordPress',
        success: false,
        error: error.message || response.statusText,
      };
    }
  } catch (error: any) {
    return {
      platform: 'wordpress',
      account: 'WordPress',
      success: false,
      error: error.message,
    };
  }
}

/**
 * WordPressの認証状態確認
 */
export async function checkWordPressStatus(): Promise<{
  connected: boolean;
  siteName?: string;
  error?: string;
}> {
  try {
    const creds = getWordPressCredentials();

    if (!creds) {
      return { connected: false, error: '認証情報未設定' };
    }

    const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64');

    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/users/me`, {
      headers: { 'Authorization': `Basic ${auth}` },
    });

    if (response.ok) {
      const user = await response.json();
      return { connected: true, siteName: user.name };
    } else {
      return { connected: false, error: '認証失敗' };
    }
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

// ========== エンゲージメント取得 ==========

export interface TweetMetrics {
  tweetId: string;
  text: string;
  createdAt: string;
  metrics: {
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
  };
}

/**
 * 指定アカウントの最近のツイートのエンゲージメントを取得
 */
export async function getTweetMetrics(
  account: AccountType,
  maxResults: number = 10
): Promise<TweetMetrics[]> {
  if (account === 'wordpress') {
    return [];
  }

  try {
    const client = getTwitterClient(account);
    if (!client) {
      console.error(`[Metrics] ${account}: 認証情報なし`);
      return [];
    }

    // 自分のユーザーIDを取得
    const me = await client.v2.me();
    const userId = me.data.id;

    // 最近のツイートを取得（メトリクス付き）
    const tweets = await client.v2.userTimeline(userId, {
      max_results: maxResults,
      'tweet.fields': ['created_at', 'public_metrics', 'non_public_metrics', 'organic_metrics'],
    });

    const results: TweetMetrics[] = [];

    for (const tweet of tweets.data?.data || []) {
      // public_metricsは常に取得可能
      const publicMetrics: Record<string, number> = (tweet.public_metrics || {}) as Record<string, number>;
      // non_public_metricsはツイート作成者のみ取得可能（impressions含む）
      const nonPublicMetrics: Record<string, number> = ((tweet as any).non_public_metrics || {}) as Record<string, number>;

      results.push({
        tweetId: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at || '',
        metrics: {
          impressions: nonPublicMetrics['impression_count'] || 0,
          likes: publicMetrics['like_count'] || 0,
          retweets: publicMetrics['retweet_count'] || 0,
          replies: publicMetrics['reply_count'] || 0,
          quotes: publicMetrics['quote_count'] || 0,
          bookmarks: publicMetrics['bookmark_count'] || 0,
        },
      });
    }

    return results;
  } catch (error: any) {
    console.error(`[Metrics] ${account}: エラー -`, error.message);
    return [];
  }
}

/**
 * 全アカウントのエンゲージメントを取得
 */
export async function getAllAccountsMetrics(
  maxResults: number = 10
): Promise<{ account: AccountType; metrics: TweetMetrics[] }[]> {
  const twitterAccounts = ACCOUNTS.filter(a => a.platform === 'twitter');

  const results = await Promise.all(
    twitterAccounts.map(async (acc) => ({
      account: acc.id,
      metrics: await getTweetMetrics(acc.id, maxResults),
    }))
  );

  return results;
}

/**
 * エンゲージメント率を計算
 */
export function calculateEngagementRate(metrics: TweetMetrics): number {
  if (metrics.metrics.impressions === 0) return 0;

  const engagements =
    metrics.metrics.likes +
    metrics.metrics.retweets +
    metrics.metrics.replies +
    metrics.metrics.quotes;

  return (engagements / metrics.metrics.impressions) * 100;
}

/**
 * 過去のツイートを一括取得（ページネーション対応）
 * X API v2 の userTimeline を使用
 * @param account アカウント種別
 * @param maxTweets 取得する最大ツイート数（デフォルト100）
 */
export async function fetchHistoricalTweets(
  account: AccountType,
  maxTweets: number = 100
): Promise<{
  tweets: TweetMetrics[];
  totalFetched: number;
  hasMore: boolean;
}> {
  if (account === 'wordpress') {
    return { tweets: [], totalFetched: 0, hasMore: false };
  }

  const client = getTwitterClient(account);
  if (!client) {
    console.error(`[HistoricalTweets] ${account}: 認証情報なし`);
    return { tweets: [], totalFetched: 0, hasMore: false };
  }

  const allTweets: TweetMetrics[] = [];
  let paginationToken: string | undefined;
  let hasMore = true;

  try {
    // 自分のユーザーIDを取得
    const me = await client.v2.me();
    const userId = me.data.id;
    console.log(`[HistoricalTweets] ${account}: ユーザーID ${userId} の過去ツイートを取得中...`);

    while (allTweets.length < maxTweets && hasMore) {
      const batchSize = Math.min(100, maxTweets - allTweets.length);

      const tweets = await client.v2.userTimeline(userId, {
        max_results: batchSize,
        pagination_token: paginationToken,
        'tweet.fields': ['created_at', 'public_metrics', 'non_public_metrics', 'organic_metrics'],
        exclude: ['retweets', 'replies'], // リツイートとリプライを除外
      });

      if (!tweets.data?.data || tweets.data.data.length === 0) {
        hasMore = false;
        break;
      }

      for (const tweet of tweets.data.data) {
        const publicMetrics: Record<string, number> = (tweet.public_metrics || {}) as Record<string, number>;
        const nonPublicMetrics: Record<string, number> = ((tweet as any).non_public_metrics || {}) as Record<string, number>;

        allTweets.push({
          tweetId: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at || '',
          metrics: {
            impressions: nonPublicMetrics['impression_count'] || 0,
            likes: publicMetrics['like_count'] || 0,
            retweets: publicMetrics['retweet_count'] || 0,
            replies: publicMetrics['reply_count'] || 0,
            quotes: publicMetrics['quote_count'] || 0,
            bookmarks: publicMetrics['bookmark_count'] || 0,
          },
        });
      }

      // 次のページがあるか確認
      paginationToken = tweets.data.meta?.next_token;
      if (!paginationToken) {
        hasMore = false;
      }

      // レート制限対策（1秒待機）
      if (hasMore && allTweets.length < maxTweets) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`[HistoricalTweets] ${account}: ${allTweets.length}件取得済み`);
    }

    console.log(`[HistoricalTweets] ${account}: 合計${allTweets.length}件取得完了`);
    return {
      tweets: allTweets,
      totalFetched: allTweets.length,
      hasMore,
    };
  } catch (error: any) {
    console.error(`[HistoricalTweets] ${account}: エラー -`, error.message);
    return {
      tweets: allTweets,
      totalFetched: allTweets.length,
      hasMore: false,
    };
  }
}

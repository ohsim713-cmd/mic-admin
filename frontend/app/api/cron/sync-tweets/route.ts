/**
 * 自アカウント投稿同期 Cron ジョブ
 *
 * Vercel Cron: 1日1回実行
 * tt_liver, litz_grp の最新投稿を取得してBlobに保存
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { saveToBlob, loadFromBlob, BLOB_FILES } from '@/lib/storage/blob';

export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Pro: 5分まで

type AccountType = 'tt_liver' | 'litz_grp' | 'ms_stripchat';

interface TweetData {
  id: string;
  text: string;
  createdAt: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  engagement: number;
}

interface AccountTweets {
  accountId: string;
  lastUpdated: string;
  tweets: TweetData[];
}

/**
 * アカウント別のTwitterクライアントを取得
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
      break;
    case 'litz_grp':
      apiKey = process.env.TWITTER_API_KEY_LITZ_GRP;
      apiSecret = process.env.TWITTER_API_SECRET_LITZ_GRP;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_LITZ_GRP;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_LITZ_GRP;
      break;
    case 'ms_stripchat':
      apiKey = process.env.TWITTER_API_KEY_MS_STRIPCHAT;
      apiSecret = process.env.TWITTER_API_SECRET_MS_STRIPCHAT;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_MS_STRIPCHAT;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_MS_STRIPCHAT;
      break;
  }

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.error(`[SyncTweets] Missing credentials for ${account}`);
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
 * アカウントの最新投稿を取得
 */
async function fetchAccountTweets(account: AccountType, maxResults: number = 100): Promise<TweetData[]> {
  const client = getTwitterClient(account);
  if (!client) return [];

  try {
    // まず自分のユーザーIDを取得
    const me = await client.v2.me();
    const userId = me.data.id;

    // 最新投稿を取得
    const tweets = await client.v2.userTimeline(userId, {
      max_results: maxResults,
      'tweet.fields': ['created_at', 'public_metrics', 'text'],
      exclude: ['retweets', 'replies'],
    });

    const tweetList: TweetData[] = [];

    for (const tweet of tweets.data.data || []) {
      const metrics = tweet.public_metrics || { like_count: 0, retweet_count: 0, reply_count: 0 };
      const engagement = (metrics.like_count || 0) + (metrics.retweet_count || 0) * 3 + (metrics.reply_count || 0) * 2;

      tweetList.push({
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at || new Date().toISOString(),
        metrics: {
          likes: metrics.like_count || 0,
          retweets: metrics.retweet_count || 0,
          replies: metrics.reply_count || 0,
        },
        engagement,
      });
    }

    console.log(`[SyncTweets] ${account}: Fetched ${tweetList.length} tweets`);
    return tweetList;
  } catch (error: any) {
    console.error(`[SyncTweets] ${account}: Error -`, error.message);
    return [];
  }
}

/**
 * Blobファイル名を取得
 */
function getBlobFilename(account: AccountType): string {
  switch (account) {
    case 'tt_liver':
      return BLOB_FILES.TT_LIVER_TWEETS;
    case 'litz_grp':
      return BLOB_FILES.LITZ_GRP_TWEETS;
    case 'ms_stripchat':
      return BLOB_FILES.MS_STRIPCHAT_TWEETS;
  }
}

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const accounts: AccountType[] = ['tt_liver', 'litz_grp', 'ms_stripchat'];
  const results: Record<string, { success: boolean; count: number; error?: string }> = {};

  for (const account of accounts) {
    try {
      // 最新投稿を取得
      const newTweets = await fetchAccountTweets(account, 100);

      if (newTweets.length === 0) {
        results[account] = { success: false, count: 0, error: 'No tweets fetched' };
        continue;
      }

      // 既存データを取得
      const blobFile = getBlobFilename(account);
      const existingData = await loadFromBlob<AccountTweets>(blobFile);

      // 既存の投稿IDセット
      const existingIds = new Set(existingData?.tweets.map(t => t.id) || []);

      // 新規投稿を追加（重複除外）
      const mergedTweets = [...newTweets];
      if (existingData?.tweets) {
        for (const tweet of existingData.tweets) {
          if (!mergedTweets.find(t => t.id === tweet.id)) {
            mergedTweets.push(tweet);
          }
        }
      }

      // 日付順にソート（新しい順）
      mergedTweets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 最大200件に制限
      const limitedTweets = mergedTweets.slice(0, 200);

      // 保存データを構築
      const saveData: AccountTweets = {
        accountId: account,
        lastUpdated: new Date().toISOString(),
        tweets: limitedTweets,
      };

      // Blobに保存
      await saveToBlob(blobFile, saveData);

      const newCount = newTweets.filter(t => !existingIds.has(t.id)).length;
      results[account] = { success: true, count: limitedTweets.length };
      console.log(`[SyncTweets] ${account}: Saved ${limitedTweets.length} tweets (${newCount} new)`);

      // レート制限対策
      await new Promise(r => setTimeout(r, 2000));
    } catch (error: any) {
      console.error(`[SyncTweets] ${account}: Error -`, error.message);
      results[account] = { success: false, count: 0, error: error.message };
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}

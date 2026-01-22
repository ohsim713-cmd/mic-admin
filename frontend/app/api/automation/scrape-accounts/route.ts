/**
 * 競合アカウントスクレイピングAPI
 *
 * 指定したTwitterアカウントの投稿を取得してbuzz_stockに追加
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveToBlob, loadFromBlob, BLOB_FILES } from '@/lib/storage/blob';

export const runtime = 'nodejs';
export const maxDuration = 300;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'twitter241.p.rapidapi.com';

// スクレイピング対象アカウント
const TARGET_ACCOUNTS = {
  chatre: [
    'zeno_chatlady',
    'terakado_chat55',
    'STRIPCHAT_Queen',
    'DXLIVE_Queenca',
    'UfIkERsxf941392',
    'Noah_ChatLady',
    'chatlady_yuniko',
    'DX_JOB',
    'amica_chatlady',
  ],
  liver: [
    'seed_Liver',
    'muse_studio0700',
    'azu_live_xxx',
  ],
};

interface Tweet {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  author: string;
  createdAt: string;
}

interface BuzzPost {
  id: string;
  text: string;
  engagement: number;
  whyWorks: string;
  topics: string[];
  author: string;
  addedAt: string;
  source: 'competitor';
}

/**
 * ユーザーIDを取得
 */
async function getUserId(username: string): Promise<string | null> {
  const url = `https://${RAPIDAPI_HOST}/user?username=${username}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.result?.data?.user?.result?.rest_id || null;
  } catch {
    return null;
  }
}

/**
 * ユーザーのツイートを取得
 */
async function getUserTweets(userId: string, count: number = 20): Promise<unknown> {
  const url = `https://${RAPIDAPI_HOST}/user-tweets?user=${userId}&count=${count}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`User tweets failed: ${response.status}`);
  }

  return await response.json();
}

/**
 * ツイートデータをパース
 */
function parseTweets(data: unknown, username: string): Tweet[] {
  const tweets: Tweet[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instructions = (data as any).result?.timeline?.instructions || [];

  for (const instruction of instructions) {
    const entries = instruction.entries || [];
    for (const entry of entries) {
      const result = entry.content?.itemContent?.tweet_results?.result;
      if (result) {
        const tweet = extractTweetData(result, username);
        if (tweet) tweets.push(tweet);
      }
    }
  }

  return tweets;
}

/**
 * ツイートデータを抽出
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTweetData(result: any, username: string): Tweet | null {
  const legacy = result.legacy || result.tweet?.legacy;

  if (!legacy || !legacy.full_text) return null;
  if (legacy.full_text.startsWith('RT @')) return null; // RTは除外
  if (legacy.full_text.length < 30) return null;

  const text = legacy.full_text.replace(/https?:\/\/\S+/g, '').trim();
  if (text.length < 20) return null;

  return {
    id: legacy.id_str,
    text: text,
    likes: legacy.favorite_count || 0,
    retweets: legacy.retweet_count || 0,
    replies: legacy.reply_count || 0,
    quotes: legacy.quote_count || 0,
    author: username,
    createdAt: legacy.created_at || '',
  };
}

/**
 * エンゲージメントスコア計算
 */
function calculateEngagement(tweet: Tweet): number {
  return tweet.likes + (tweet.retweets * 3) + (tweet.replies * 2) + (tweet.quotes * 4);
}

/**
 * バズった理由を分析
 */
function analyzeWhyWorks(tweet: Tweet): string {
  const text = tweet.text;
  const reasons: string[] = [];

  if (/\d+/.test(text)) reasons.push('数字');
  if (text.includes('\n') && text.split('\n').length >= 3) reasons.push('リスト');
  if (/ぶっちゃけ|正直|実は|ここだけ|本音/.test(text)) reasons.push('本音');
  if (/\?|？/.test(text)) reasons.push('問いかけ');
  if (/【|】|「|」/.test(text)) reasons.push('強調');
  if (/〜した結果|やってみた|続けた/.test(text)) reasons.push('体験談');
  if (/稼|収入|万円/.test(text)) reasons.push('収益');

  const engagement = calculateEngagement(tweet);
  if (engagement > 500) reasons.push('高エンゲージ');

  return reasons.length > 0 ? reasons.join('+') : '競合参考';
}

/**
 * トピック抽出
 */
function extractTopics(text: string): string[] {
  const topics: string[] = [];

  const numberMatch = text.match(/(\d+[年月日回個件万円歳%時間])/g);
  if (numberMatch) topics.push(...numberMatch.slice(0, 2));

  // チャトレ・ライバー関連キーワード
  const keywords = ['チャトレ', 'ライバー', '配信', '在宅', '副業', '稼ぐ', 'ストチャ', 'Pococha', 'TikTok'];
  for (const kw of keywords) {
    if (text.includes(kw)) topics.push(kw);
  }

  return [...new Set(topics)].slice(0, 5);
}

export async function POST(request: NextRequest) {
  // 認証チェック
  const authHeader = request.headers.get('authorization');
  const secret = process.env.AUTO_POST_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    const body = await request.json().catch(() => ({}));
    if (body.secret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { category = 'all', accounts: customAccounts } = body;

    console.log('[ScrapeAccounts] Starting competitor scraping...');

    // スクレイピング対象を決定
    let targetAccounts: string[] = [];
    if (customAccounts && Array.isArray(customAccounts)) {
      targetAccounts = customAccounts;
    } else if (category === 'chatre') {
      targetAccounts = TARGET_ACCOUNTS.chatre;
    } else if (category === 'liver') {
      targetAccounts = TARGET_ACCOUNTS.liver;
    } else {
      targetAccounts = [...TARGET_ACCOUNTS.chatre, ...TARGET_ACCOUNTS.liver];
    }

    console.log(`[ScrapeAccounts] Targets: ${targetAccounts.length} accounts`);

    // buzz_stock読み込み
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let buzzStock: any;
    try {
      buzzStock = await loadFromBlob(BLOB_FILES.BUZZ_STOCK);
      if (!buzzStock) {
        buzzStock = {
          genres: {
            competitor: { name: '競合参考', posts: [] },
            career: { name: 'キャリア', posts: [] },
            sideBusiness: { name: '副業', posts: [] },
            mental: { name: 'メンタル', posts: [] },
            relationship: { name: '人間関係', posts: [] },
            lifestyle: { name: 'ライフスタイル', posts: [] },
            mindset: { name: 'マインド', posts: [] },
            lifeLesson: { name: '人生論', posts: [] },
            beauty: { name: '美容', posts: [] },
            general: { name: 'その他', posts: [] },
          },
          stats: { totalPosts: 0, lastScrapeAt: '', scrapeHistory: [] },
          lastUpdated: '',
        };
      }
    } catch {
      return NextResponse.json({ error: 'Failed to load buzz_stock' }, { status: 500 });
    }

    // competitorジャンルがなければ追加
    if (!buzzStock.genres.competitor) {
      buzzStock.genres.competitor = { name: '競合参考', posts: [] };
    }

    // 既存IDを収集
    const existingIds = new Set<string>();
    for (const genre of Object.values(buzzStock.genres) as { posts: BuzzPost[] }[]) {
      for (const post of genre.posts) {
        existingIds.add(post.id);
      }
    }

    let allTweets: Tweet[] = [];
    let apiCalls = 0;
    const results: { account: string; status: string; tweets: number }[] = [];

    // 各アカウントからツイート取得
    for (const username of targetAccounts) {
      console.log(`[ScrapeAccounts] Fetching @${username}...`);

      try {
        // ユーザーID取得
        const userId = await getUserId(username);
        apiCalls++;

        if (!userId) {
          console.log(`[ScrapeAccounts] @${username}: User not found`);
          results.push({ account: username, status: 'not_found', tweets: 0 });
          continue;
        }

        // レート制限対策
        await new Promise(r => setTimeout(r, 1000));

        // ツイート取得
        const data = await getUserTweets(userId, 20);
        apiCalls++;

        const tweets = parseTweets(data, username);
        console.log(`[ScrapeAccounts] @${username}: ${tweets.length} tweets`);

        allTweets = allTweets.concat(tweets);
        results.push({ account: username, status: 'success', tweets: tweets.length });

        // レート制限対策
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(`[ScrapeAccounts] @${username} error:`, e);
        results.push({ account: username, status: 'error', tweets: 0 });
      }
    }

    // 新規ツイートを追加
    let addedCount = 0;

    for (const tweet of allTweets) {
      const postId = `comp-${tweet.id}`;
      if (existingIds.has(postId)) continue;

      const engagement = calculateEngagement(tweet);
      // 競合アカウントは低エンゲージでも参考になるので閾値を下げる
      if (engagement < 10) continue;

      const post: BuzzPost = {
        id: postId,
        text: tweet.text,
        engagement: engagement,
        whyWorks: analyzeWhyWorks(tweet),
        topics: extractTopics(tweet.text),
        author: tweet.author,
        addedAt: new Date().toISOString(),
        source: 'competitor',
      };

      buzzStock.genres.competitor.posts.unshift(post);
      existingIds.add(postId);
      addedCount++;
    }

    // 投稿数を制限（100件まで）
    if (buzzStock.genres.competitor.posts.length > 100) {
      buzzStock.genres.competitor.posts = buzzStock.genres.competitor.posts.slice(0, 100);
    }

    // 統計更新
    let totalPosts = 0;
    for (const genre of Object.values(buzzStock.genres) as { posts: BuzzPost[] }[]) {
      totalPosts += genre.posts.length;
    }

    buzzStock.stats.totalPosts = totalPosts;
    buzzStock.stats.lastScrapeAt = new Date().toISOString();
    buzzStock.lastUpdated = new Date().toISOString();

    // Blobに保存
    await saveToBlob(BLOB_FILES.BUZZ_STOCK, buzzStock);

    console.log(`[ScrapeAccounts] Added ${addedCount} posts from competitors`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      accounts: results,
      apiCalls,
      tweetsFound: allTweets.length,
      tweetsAdded: addedCount,
      totalStock: totalPosts,
    });
  } catch (error: unknown) {
    console.error('[ScrapeAccounts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape accounts', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// GET: 対象アカウント一覧を返す
export async function GET() {
  return NextResponse.json({
    accounts: TARGET_ACCOUNTS,
    total: TARGET_ACCOUNTS.chatre.length + TARGET_ACCOUNTS.liver.length,
  });
}

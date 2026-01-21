/**
 * バズ投稿スクレイピング Cron ジョブ
 *
 * Vercel Cron: 1日1回実行（朝6時 JST）
 * 外部のチャトレ系・副業系アカウントからバズ投稿を収集
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { saveToBlob, loadFromBlob, BLOB_FILES } from '@/lib/storage/blob';

export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Pro: 5分まで

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'twitter241.p.rapidapi.com';

// 検索クエリグループ（日替わりで使用）
const QUERY_GROUPS = [
  // グループA: キャリア・副業系
  ['転職 気づいた OR 副業 成功', 'フリーランス OR 在宅ワーク 稼ぐ'],
  // グループB: メンタル・人間関係系
  ['メンタル 大事 OR 自己肯定感', '習慣 変わった OR 朝活 効果'],
  // グループC: 人生論・マインド系
  ['人生 後悔 OR 気づいた 大切', '成功 秘訣 OR 成長 マインド'],
  // グループD: チャトレ・ライバー系
  ['チャトレ 稼ぐ OR チャットレディ 収入', 'ライバー 事務所 OR TikTok 配信'],
  // グループE: 在宅・副業女性向け
  ['在宅ワーク 女性 OR 副業 主婦', '高収入 バイト OR 日払い 在宅'],
  // グループF: 美容・自己投資系
  ['美容 習慣 OR 自己投資', '整形 OR 脱毛 OR 美容医療'],
];

interface Tweet {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  author: string;
}

interface BuzzPost {
  id: string;
  text: string;
  engagement: number;
  whyWorks: string;
  topics: string[];
  author: string;
  addedAt: string;
}

/**
 * Twitter241 APIで検索
 */
async function searchTweets(query: string, count: number = 40): Promise<unknown> {
  const url = `https://${RAPIDAPI_HOST}/search?query=${encodeURIComponent(query)}&count=${count}&type=Top`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return await response.json();
}

/**
 * ツイートデータをパース
 */
function parseTweets(data: unknown): Tweet[] {
  const tweets: Tweet[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instructions = (data as any).result?.timeline?.instructions || [];

  for (const instruction of instructions) {
    const entries = instruction.entries || [];
    for (const entry of entries) {
      if (entry.content?.itemContent?.tweet_results?.result) {
        const tweet = extractTweetData(entry.content.itemContent.tweet_results.result);
        if (tweet) tweets.push(tweet);
      }

      if (entry.content?.items) {
        for (const item of entry.content.items) {
          const result = item.item?.itemContent?.tweet_results?.result;
          if (result) {
            const tweet = extractTweetData(result);
            if (tweet) tweets.push(tweet);
          }
        }
      }
    }
  }

  return tweets;
}

/**
 * ツイートデータを抽出
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTweetData(result: any): Tweet | null {
  const legacy = result.legacy || result.tweet?.legacy;
  const userLegacy = result.core?.user_results?.result?.legacy ||
                    result.tweet?.core?.user_results?.result?.legacy;

  if (!legacy || !legacy.full_text) return null;
  if (legacy.full_text.startsWith('RT @')) return null;
  if (legacy.full_text.length < 50) return null;

  const text = legacy.full_text.replace(/https?:\/\/\S+/g, '').trim();
  if (text.length < 30) return null;

  // 日本語を含まない投稿は除外
  if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return null;

  return {
    id: legacy.id_str,
    text: text,
    likes: legacy.favorite_count || 0,
    retweets: legacy.retweet_count || 0,
    replies: legacy.reply_count || 0,
    quotes: legacy.quote_count || 0,
    author: userLegacy?.screen_name || 'unknown',
  };
}

/**
 * エンゲージメントスコア計算
 */
function calculateEngagement(tweet: Tweet): number {
  return tweet.likes + (tweet.retweets * 3) + (tweet.replies * 2) + (tweet.quotes * 4);
}

/**
 * ジャンル判定
 */
function detectGenre(text: string): string {
  const genrePatterns: Record<string, RegExp> = {
    career: /転職|仕事|会社|働き方|キャリア|上司|退職|正社員/,
    sideBusiness: /副業|収入|稼|お金|投資|年収|月収/,
    mental: /メンタル|心|病|休|疲|自己肯定|自分を|つらい/,
    relationship: /人間関係|友達|嫌|好|合わない|距離|付き合/,
    lifestyle: /朝|夜|習慣|ルーティン|生活|時間|睡眠/,
    mindset: /マインド|考え方|成功|努力|挑戦|成長|行動/,
    lifeLesson: /人生|後悔|気づ|学|大事|経験|大切/,
    beauty: /美容|肌|健康|ダイエット|体|運動|整形|脱毛/,
    competitor: /ライバー|チャトレ|チャットレディ|配信|事務所|在宅ワーク|ストチャ/,
  };

  for (const [genre, pattern] of Object.entries(genrePatterns)) {
    if (pattern.test(text)) return genre;
  }
  return 'general';
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

  const engagement = calculateEngagement(tweet);
  if (engagement > 1000) reasons.push('高エンゲージ');

  return reasons.length > 0 ? reasons.join('+') : 'バイラル';
}

/**
 * トピック抽出
 */
function extractTopics(text: string): string[] {
  const topics: string[] = [];

  const numberMatch = text.match(/(\d+[年月日回個件万円歳%])/g);
  if (numberMatch) topics.push(...numberMatch.slice(0, 2));

  const keywordPatterns = [
    /(?:大事|重要|必要|大切)(?:な|だ)/,
    /(?:やめた|始めた|変えた|気づいた)/,
  ];

  for (const pattern of keywordPatterns) {
    const match = text.match(pattern);
    if (match) topics.push(match[0]);
  }

  return [...new Set(topics)].slice(0, 5);
}

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY not configured' }, { status: 500 });
  }

  try {
    console.log('[CRON/ScrapeBuzz] Starting buzz scraping...');

    // 今日使うクエリグループを決定
    const dayOfMonth = new Date().getDate();
    const groupIndex = dayOfMonth % QUERY_GROUPS.length;
    const queries = QUERY_GROUPS[groupIndex];

    console.log(`[CRON/ScrapeBuzz] Using query group ${groupIndex}:`, queries);

    // buzz_stock.json読み込み（Blob優先、ローカルファイルにフォールバック）
    const buzzPath = path.join(process.cwd(), 'knowledge', 'buzz_stock.json');
    let buzzStock;
    try {
      // まずBlobから取得を試みる
      const blobData = await loadFromBlob(BLOB_FILES.BUZZ_STOCK);
      if (blobData) {
        buzzStock = blobData;
        console.log('[CRON/ScrapeBuzz] Loaded from Blob');
      } else {
        // Blobにない場合はローカルファイルから
        const content = await fs.readFile(buzzPath, 'utf-8');
        buzzStock = JSON.parse(content);
        console.log('[CRON/ScrapeBuzz] Loaded from local file');
      }
    } catch {
      return NextResponse.json({ error: 'buzz_stock.json not found' }, { status: 500 });
    }

    let allTweets: Tweet[] = [];
    let apiCalls = 0;

    // 各クエリで検索
    for (const query of queries) {
      console.log(`[CRON/ScrapeBuzz] Searching: "${query}"`);
      try {
        const data = await searchTweets(query, 40);
        apiCalls++;
        const tweets = parseTweets(data);
        console.log(`[CRON/ScrapeBuzz] Found: ${tweets.length} tweets`);
        allTweets = allTweets.concat(tweets);
      } catch (e) {
        console.error(`[CRON/ScrapeBuzz] Error:`, e);
      }
      // レート制限対策
      await new Promise(r => setTimeout(r, 1500));
    }

    // 重複排除
    const seen = new Set<string>();
    allTweets = allTweets.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // エンゲージメント順でソート
    allTweets.sort((a, b) => calculateEngagement(b) - calculateEngagement(a));

    // 既存IDを収集
    const existingIds = new Set<string>();
    for (const genre of Object.values(buzzStock.genres) as { posts: BuzzPost[] }[]) {
      for (const post of genre.posts) {
        existingIds.add(post.id);
      }
    }

    // 新規ツイートをジャンル別に追加
    let addedCount = 0;

    for (const tweet of allTweets) {
      const postId = `x-${tweet.id}`;
      if (existingIds.has(postId)) continue;

      const engagement = calculateEngagement(tweet);
      if (engagement < 100) continue;

      const genre = detectGenre(tweet.text);
      const post: BuzzPost = {
        id: postId,
        text: tweet.text,
        engagement: engagement,
        whyWorks: analyzeWhyWorks(tweet),
        topics: extractTopics(tweet.text),
        author: tweet.author,
        addedAt: new Date().toISOString(),
      };

      if (buzzStock.genres[genre]) {
        buzzStock.genres[genre].posts.unshift(post);
        existingIds.add(postId);
        addedCount++;
      }
    }

    // 各ジャンルの投稿数を制限（50件まで）
    for (const genre of Object.values(buzzStock.genres) as { posts: BuzzPost[] }[]) {
      if (genre.posts.length > 50) {
        genre.posts = genre.posts.slice(0, 50);
      }
    }

    // 統計更新
    let totalPosts = 0;
    for (const genre of Object.values(buzzStock.genres) as { posts: BuzzPost[] }[]) {
      totalPosts += genre.posts.length;
    }

    buzzStock.stats.totalPosts = totalPosts;
    buzzStock.stats.lastScrapeAt = new Date().toISOString();
    buzzStock.stats.scrapeHistory.unshift({
      date: new Date().toISOString().split('T')[0],
      apiCalls: apiCalls,
      tweetsFound: allTweets.length,
      tweetsAdded: addedCount,
    });

    if (buzzStock.stats.scrapeHistory.length > 30) {
      buzzStock.stats.scrapeHistory = buzzStock.stats.scrapeHistory.slice(0, 30);
    }

    buzzStock.lastUpdated = new Date().toISOString();

    // Vercel Blobに保存（read-only対策）
    try {
      await saveToBlob(BLOB_FILES.BUZZ_STOCK, buzzStock);
      console.log('[CRON/ScrapeBuzz] Saved to Blob');
    } catch (blobError) {
      console.error('[CRON/ScrapeBuzz] Blob save failed:', blobError);
      // ローカル環境用のフォールバック（開発時のみ）
      if (process.env.NODE_ENV === 'development') {
        await fs.writeFile(buzzPath, JSON.stringify(buzzStock, null, 2), 'utf-8');
      }
    }

    console.log(`[CRON/ScrapeBuzz] Added ${addedCount} posts, total: ${totalPosts}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      queryGroup: groupIndex,
      apiCalls,
      tweetsFound: allTweets.length,
      tweetsAdded: addedCount,
      totalStock: totalPosts,
    });
  } catch (error: unknown) {
    console.error('[CRON/ScrapeBuzz] Error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape buzz', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

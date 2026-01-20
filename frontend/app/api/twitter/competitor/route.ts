/**
 * 競合アカウント分析API
 * Twitter241 APIを使って競合のツイートを取得し、伸びてる投稿をtrending_postsに追加
 */

import { NextRequest, NextResponse } from 'next/server';
import { Twitter241Client } from '@/lib/api/twitter241-client';
import { promises as fs } from 'fs';
import path from 'path';

const TRENDING_POSTS_PATH = path.join(process.cwd(), 'knowledge', 'trending_posts.json');

interface TrendingPost {
  id: string;
  text: string;
  source: string;
  category: string;
  whyWorks: string;
  addedAt: string;
  engagement?: number;
  author?: string;
}

interface TrendingPostsData {
  description: string;
  lastUpdated: string;
  posts: TrendingPost[];
}

/**
 * GET: 競合アカウントの伸びてるツイートを取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const query = searchParams.get('query');
    const count = parseInt(searchParams.get('count') || '10');
    const minEngagement = parseInt(searchParams.get('minEngagement') || '100');

    const client = new Twitter241Client();

    if (!client.isAvailable()) {
      return NextResponse.json(
        { error: 'RAPIDAPI_KEY not configured', hint: 'Set RAPIDAPI_KEY in .env.local' },
        { status: 503 }
      );
    }

    let tweets;

    if (username) {
      // ユーザー指定で取得
      tweets = await client.getTopTweets(username, count, minEngagement);
    } else if (query) {
      // キーワード検索で取得
      tweets = await client.searchTopTweets(query, count, minEngagement);
    } else {
      return NextResponse.json(
        { error: 'username or query parameter required' },
        { status: 400 }
      );
    }

    // エンゲージメントスコアを追加
    const tweetsWithScore = tweets.map(t => ({
      ...t,
      engagement: client.calculateEngagement(t),
    }));

    return NextResponse.json({
      success: true,
      count: tweetsWithScore.length,
      tweets: tweetsWithScore,
    });
  } catch (error) {
    console.error('[Competitor API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tweets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST: 伸びてるツイートをtrending_postsに追加
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, query, count = 5, minEngagement = 100, autoAnalyze = true } = body;

    const client = new Twitter241Client();

    if (!client.isAvailable()) {
      return NextResponse.json(
        { error: 'RAPIDAPI_KEY not configured' },
        { status: 503 }
      );
    }

    // ツイート取得
    let tweets;
    if (username) {
      tweets = await client.getTopTweets(username, count, minEngagement);
    } else if (query) {
      tweets = await client.searchTopTweets(query, count, minEngagement);
    } else {
      return NextResponse.json(
        { error: 'username or query required in body' },
        { status: 400 }
      );
    }

    if (tweets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tweets found matching criteria',
        added: 0,
      });
    }

    // trending_posts.jsonを読み込み
    let trendingData: TrendingPostsData;
    try {
      const content = await fs.readFile(TRENDING_POSTS_PATH, 'utf-8');
      trendingData = JSON.parse(content);
    } catch {
      trendingData = {
        description: '業界問わず伸びてる投稿のお手本集',
        lastUpdated: new Date().toISOString(),
        posts: [],
      };
    }

    // 既存IDをセットで管理
    const existingIds = new Set(trendingData.posts.map(p => p.id));

    // 新しいツイートを追加
    const newPosts: TrendingPost[] = [];
    for (const tweet of tweets) {
      const postId = `x-${tweet.id}`;
      if (existingIds.has(postId)) continue;

      // 簡易カテゴリ分析
      const category = autoAnalyze ? analyzeCategory(tweet.text) : '未分類';
      const whyWorks = autoAnalyze ? analyzeWhyWorks(tweet, client.calculateEngagement(tweet)) : '高エンゲージメント';

      newPosts.push({
        id: postId,
        text: cleanTweetText(tweet.text),
        source: 'X (Twitter)',
        category,
        whyWorks,
        addedAt: new Date().toISOString(),
        engagement: client.calculateEngagement(tweet),
        author: tweet.author?.username,
      });
    }

    if (newPosts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All tweets already exist in trending_posts',
        added: 0,
      });
    }

    // 追加して保存
    trendingData.posts = [...newPosts, ...trendingData.posts];
    trendingData.lastUpdated = new Date().toISOString();

    // 最大100件に制限（古いものを削除）
    if (trendingData.posts.length > 100) {
      trendingData.posts = trendingData.posts.slice(0, 100);
    }

    await fs.writeFile(TRENDING_POSTS_PATH, JSON.stringify(trendingData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      added: newPosts.length,
      total: trendingData.posts.length,
      newPosts: newPosts.map(p => ({
        id: p.id,
        preview: p.text.substring(0, 50) + '...',
        category: p.category,
        engagement: p.engagement,
      })),
    });
  } catch (error) {
    console.error('[Competitor API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add tweets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * ツイートテキストをクリーンアップ
 */
function cleanTweetText(text: string): string {
  return text
    // URLを除去
    .replace(/https?:\/\/\S+/g, '')
    // メンションを除去
    .replace(/@\w+/g, '')
    // 余分な空白を整理
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 簡易カテゴリ分析
 */
function analyzeCategory(text: string): string {
  const lowerText = text.toLowerCase();

  if (/副業|収入|稼|お金|投資/.test(text)) return '副業・収入';
  if (/転職|仕事|会社|働き方|キャリア/.test(text)) return 'キャリア';
  if (/メンタル|心|病|休|疲/.test(text)) return 'メンタル';
  if (/人間関係|友達|嫌|好|合わない/.test(text)) return '人間関係';
  if (/美容|肌|健康|睡眠|ダイエット/.test(text)) return '美容・健康';
  if (/人生|後悔|気づ|学|大事/.test(text)) return '人生論';
  if (/マインド|考え方|成功|努力/.test(text)) return 'マインド';
  if (/朝|夜|習慣|ルーティン/.test(text)) return 'ライフスタイル';

  return '一般';
}

/**
 * なぜ伸びたかを簡易分析
 */
function analyzeWhyWorks(tweet: { text: string; public_metrics: { like_count: number; retweet_count: number; reply_count: number } }, engagement: number): string {
  const text = tweet.text;
  const reasons: string[] = [];

  // 構造分析
  if (/\d+/.test(text)) reasons.push('具体的な数字');
  if (text.includes('\n')) reasons.push('リスト形式');
  if (/ぶっちゃけ|正直|実は|ここだけ/.test(text)) reasons.push('本音フック');
  if (/\?|？/.test(text)) reasons.push('問いかけ');
  if (/【|】|「|」/.test(text)) reasons.push('視覚的な強調');

  // エンゲージメント分析
  if (engagement > 500) reasons.push('高エンゲージメント');
  if (tweet.public_metrics.reply_count > tweet.public_metrics.like_count * 0.1) reasons.push('議論を呼ぶ');
  if (tweet.public_metrics.retweet_count > tweet.public_metrics.like_count * 0.3) reasons.push('シェアしたくなる');

  return reasons.length > 0 ? reasons.join(' + ') : 'バイラル要素あり';
}

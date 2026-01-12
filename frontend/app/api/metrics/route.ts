import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const SETTINGS_FILE = path.join(KNOWLEDGE_DIR, 'twitter_credentials.json');
const AUTO_POST_LOG = path.join(KNOWLEDGE_DIR, 'auto_post_log.json');
const METRICS_LOG = path.join(KNOWLEDGE_DIR, 'post_metrics.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';

// 復号化
function decrypt(text: string): string {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

// Twitter認証情報読み込み
function loadCredentials() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      apiKey: parsed.apiKey ? decrypt(parsed.apiKey) : '',
      apiSecret: parsed.apiSecret ? decrypt(parsed.apiSecret) : '',
      accessToken: parsed.accessToken ? decrypt(parsed.accessToken) : '',
      accessSecret: parsed.accessSecret ? decrypt(parsed.accessSecret) : '',
    };
  } catch {
    return null;
  }
}

// 投稿ログ読み込み
function loadPostLogs() {
  try {
    if (!fs.existsSync(AUTO_POST_LOG)) return [];
    return JSON.parse(fs.readFileSync(AUTO_POST_LOG, 'utf-8'));
  } catch {
    return [];
  }
}

// メトリクスログ読み込み
function loadMetrics() {
  try {
    if (!fs.existsSync(METRICS_LOG)) return {};
    return JSON.parse(fs.readFileSync(METRICS_LOG, 'utf-8'));
  } catch {
    return {};
  }
}

// メトリクスログ保存
function saveMetrics(metrics: Record<string, any>) {
  try {
    fs.writeFileSync(METRICS_LOG, JSON.stringify(metrics, null, 2));
  } catch (e) {
    console.error('Failed to save metrics:', e);
  }
}

export interface PostMetrics {
  tweetId: string;
  postedAt: string;
  postType: string;
  qualityScore?: number;
  // エンゲージメント
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  // 更新情報
  lastUpdated: string;
  // DM追跡（将来用）
  dmCount?: number;
}

// GET: メトリクス一覧・分析データを取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'list'; // list | summary | by-type

  const metrics = loadMetrics();
  const postLogs = loadPostLogs();

  // 投稿ログとメトリクスを結合
  const enrichedPosts = postLogs
    .filter((log: any) => log.success && log.tweetId)
    .map((log: any) => ({
      ...log,
      metrics: metrics[log.tweetId] || null,
    }))
    .reverse();

  if (view === 'summary') {
    // サマリービュー: 集計データ
    const withMetrics = enrichedPosts.filter((p: any) => p.metrics);
    const totalLikes = withMetrics.reduce((sum: number, p: any) => sum + (p.metrics?.likes || 0), 0);
    const totalRTs = withMetrics.reduce((sum: number, p: any) => sum + (p.metrics?.retweets || 0), 0);
    const totalReplies = withMetrics.reduce((sum: number, p: any) => sum + (p.metrics?.replies || 0), 0);
    const totalImpressions = withMetrics.reduce((sum: number, p: any) => sum + (p.metrics?.impressions || 0), 0);

    return NextResponse.json({
      totalPosts: enrichedPosts.length,
      postsWithMetrics: withMetrics.length,
      totals: {
        likes: totalLikes,
        retweets: totalRTs,
        replies: totalReplies,
        impressions: totalImpressions,
      },
      averages: {
        likes: withMetrics.length > 0 ? (totalLikes / withMetrics.length).toFixed(1) : 0,
        retweets: withMetrics.length > 0 ? (totalRTs / withMetrics.length).toFixed(1) : 0,
        replies: withMetrics.length > 0 ? (totalReplies / withMetrics.length).toFixed(1) : 0,
        impressions: withMetrics.length > 0 ? (totalImpressions / withMetrics.length).toFixed(1) : 0,
      },
      engagementRate: totalImpressions > 0
        ? (((totalLikes + totalRTs + totalReplies) / totalImpressions) * 100).toFixed(2) + '%'
        : '0%',
    });
  }

  if (view === 'by-type') {
    // タイプ別集計
    const byType: Record<string, { count: number; likes: number; retweets: number; replies: number; impressions: number }> = {};

    for (const post of enrichedPosts) {
      const type = post.type || 'その他';
      if (!byType[type]) {
        byType[type] = { count: 0, likes: 0, retweets: 0, replies: 0, impressions: 0 };
      }
      byType[type].count++;
      if (post.metrics) {
        byType[type].likes += post.metrics.likes || 0;
        byType[type].retweets += post.metrics.retweets || 0;
        byType[type].replies += post.metrics.replies || 0;
        byType[type].impressions += post.metrics.impressions || 0;
      }
    }

    // 平均値を計算
    const byTypeWithAvg = Object.entries(byType).map(([type, data]) => ({
      type,
      ...data,
      avgLikes: data.count > 0 ? (data.likes / data.count).toFixed(1) : 0,
      avgRetweets: data.count > 0 ? (data.retweets / data.count).toFixed(1) : 0,
      engagementRate: data.impressions > 0
        ? (((data.likes + data.retweets + data.replies) / data.impressions) * 100).toFixed(2) + '%'
        : '0%',
    }));

    return NextResponse.json({ byType: byTypeWithAvg });
  }

  // デフォルト: リストビュー
  return NextResponse.json({
    posts: enrichedPosts.slice(0, 50), // 最新50件
    lastRefreshed: metrics._lastRefreshed || null,
  });
}

// POST: X APIからメトリクスを取得して更新
export async function POST(request: NextRequest) {
  const credentials = loadCredentials();
  if (!credentials?.apiKey) {
    return NextResponse.json({ error: 'X API credentials not configured' }, { status: 400 });
  }

  const client = new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessSecret,
  });

  const postLogs = loadPostLogs();
  const metrics = loadMetrics();

  // 成功した投稿のtweetIdを収集（最新30件）
  const tweetIds = postLogs
    .filter((log: any) => log.success && log.tweetId)
    .slice(-30)
    .map((log: any) => log.tweetId);

  if (tweetIds.length === 0) {
    return NextResponse.json({ message: 'No tweets to fetch metrics for', updated: 0 });
  }

  let updated = 0;
  const errors: string[] = [];

  // X API v2でツイート詳細を取得
  // 注意: APIプランによっては制限あり
  try {
    // バッチで取得（最大100件）
    const tweets = await client.v2.tweets(tweetIds, {
      'tweet.fields': ['public_metrics', 'created_at'],
    });

    if (tweets.data) {
      for (const tweet of tweets.data) {
        const publicMetrics = tweet.public_metrics;
        if (publicMetrics) {
          metrics[tweet.id] = {
            tweetId: tweet.id,
            likes: publicMetrics.like_count || 0,
            retweets: publicMetrics.retweet_count || 0,
            replies: publicMetrics.reply_count || 0,
            impressions: publicMetrics.impression_count || 0,
            lastUpdated: new Date().toISOString(),
          };
          updated++;
        }
      }
    }
  } catch (error: any) {
    console.error('Failed to fetch tweet metrics:', error);
    errors.push(error.message || 'Failed to fetch metrics from X API');
  }

  // 最終更新時刻を記録
  metrics._lastRefreshed = new Date().toISOString();
  saveMetrics(metrics);

  return NextResponse.json({
    success: true,
    updated,
    total: tweetIds.length,
    errors: errors.length > 0 ? errors : undefined,
    lastRefreshed: metrics._lastRefreshed,
  });
}

/**
 * エンゲージメント監視 Cron ジョブ
 *
 * 投稿後24-48時間のツイートを監視し、
 * 閾値を超えたら自動でストックに追加（フィードバックループ）
 *
 * Vercel Cron: 1日2回（12時間間隔）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTweetMetrics,
  AccountType,
  TweetMetrics,
  calculateEngagementRate,
} from '@/lib/dm-hunter/sns-adapter';
import { notifyPostSuccess, notifyError } from '@/lib/discord';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 閾値設定
const THRESHOLDS = {
  // いいね数がこれ以上なら「伸びた」と判定
  likes: 10,
  // エンゲージメント率がこれ以上なら「伸びた」と判定
  engagementRate: 3.0,
  // 監視対象の投稿数（直近N件）
  maxTweets: 20,
};

// 保存済み投稿の型
interface SavedTweet {
  id: string;
  text: string;
  createdAt: string;
  engagement: number;
  metrics: {
    likes: number;
    retweets: number;
    impressions: number;
  };
  source?: string;
  template?: string;
  addedAt: string;
  isHit?: boolean;
}

interface TweetsFile {
  accountId: string;
  lastUpdated: string;
  tweets: SavedTweet[];
}

// 勝ちパターン分析結果の型
interface WinningPattern {
  templates: Record<string, { count: number; avgEngagement: number }>;
  genres: Record<string, { count: number; avgEngagement: number }>;
  timeSlots: Record<string, { count: number; avgEngagement: number }>;
  topPosts: Array<{ text: string; engagement: number; template?: string }>;
}

// 投稿ストックを読み込み
async function loadTweetsFile(accountId: AccountType): Promise<TweetsFile> {
  const filePath = path.join(process.cwd(), 'knowledge', `${accountId}_tweets.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      accountId,
      lastUpdated: new Date().toISOString(),
      tweets: [],
    };
  }
}

// 投稿ストックを保存
async function saveTweetsFile(accountId: AccountType, data: TweetsFile): Promise<void> {
  const filePath = path.join(process.cwd(), 'knowledge', `${accountId}_tweets.json`);
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// 投稿履歴から生成情報を取得
async function getPostHistory(): Promise<Map<string, { source: string; template?: string }>> {
  const historyPath = path.join(process.cwd(), 'knowledge', 'posts_history.json');
  const result = new Map<string, { source: string; template?: string }>();

  try {
    const data = JSON.parse(await fs.readFile(historyPath, 'utf-8'));
    for (const post of data.posts || []) {
      if (post.tweetId) {
        result.set(post.tweetId, {
          source: post.target || 'unknown',
          template: post.target?.startsWith('テンプレート:') ? post.target.replace('テンプレート: ', '') : undefined,
        });
      }
    }
  } catch {
    // 履歴ファイルがなければ空のMapを返す
  }

  return result;
}

// 勝ちパターンを分析
function analyzeWinningPatterns(tweets: SavedTweet[]): WinningPattern {
  const hitPosts = tweets.filter(t => t.isHit);

  const templates: Record<string, { count: number; totalEngagement: number }> = {};
  const genres: Record<string, { count: number; totalEngagement: number }> = {};
  const timeSlots: Record<string, { count: number; totalEngagement: number }> = {};

  for (const post of hitPosts) {
    // テンプレート別集計
    const templateName = post.template || 'その他';
    if (!templates[templateName]) {
      templates[templateName] = { count: 0, totalEngagement: 0 };
    }
    templates[templateName].count++;
    templates[templateName].totalEngagement += post.engagement;

    // ソース別集計
    const sourceName = post.source || 'unknown';
    if (!genres[sourceName]) {
      genres[sourceName] = { count: 0, totalEngagement: 0 };
    }
    genres[sourceName].count++;
    genres[sourceName].totalEngagement += post.engagement;

    // 時間帯別集計
    const hour = new Date(post.createdAt).getHours();
    const slot = `${Math.floor(hour / 3) * 3}:00-${Math.floor(hour / 3) * 3 + 3}:00`;
    if (!timeSlots[slot]) {
      timeSlots[slot] = { count: 0, totalEngagement: 0 };
    }
    timeSlots[slot].count++;
    timeSlots[slot].totalEngagement += post.engagement;
  }

  // 平均エンゲージメントを計算
  const formatStats = (stats: Record<string, { count: number; totalEngagement: number }>) =>
    Object.fromEntries(
      Object.entries(stats).map(([key, val]) => [
        key,
        { count: val.count, avgEngagement: Math.round(val.totalEngagement / val.count) },
      ])
    );

  return {
    templates: formatStats(templates),
    genres: formatStats(genres),
    timeSlots: formatStats(timeSlots),
    topPosts: hitPosts
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5)
      .map(p => ({ text: p.text, engagement: p.engagement, template: p.template })),
  };
}

// 勝ちパターンを保存
async function saveWinningPatterns(accountId: AccountType, patterns: WinningPattern): Promise<void> {
  const filePath = path.join(process.cwd(), 'knowledge', `${accountId}_winning_patterns.json`);
  await fs.writeFile(filePath, JSON.stringify({
    accountId,
    lastUpdated: new Date().toISOString(),
    patterns,
  }, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const accountId: AccountType = 'tt_liver';

  try {
    console.log('[Monitor] Starting engagement monitoring...');

    // 1. 最近のツイートのメトリクスを取得
    const recentMetrics = await getTweetMetrics(accountId, THRESHOLDS.maxTweets);

    if (recentMetrics.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tweets to monitor',
        processingTime: Date.now() - startTime,
      });
    }

    console.log(`[Monitor] Got ${recentMetrics.length} tweets`);

    // 2. 既存のストックを読み込み
    const tweetsFile = await loadTweetsFile(accountId);
    const existingIds = new Set(tweetsFile.tweets.map(t => t.id));

    // 3. 投稿履歴から生成情報を取得
    const postHistory = await getPostHistory();

    // 4. 新しくヒットした投稿を検出
    const newHits: SavedTweet[] = [];
    const updatedTweets: SavedTweet[] = [];

    for (const tweet of recentMetrics) {
      const engagement = tweet.metrics.likes + tweet.metrics.retweets;
      const engagementRate = calculateEngagementRate(tweet);

      const isHit = tweet.metrics.likes >= THRESHOLDS.likes || engagementRate >= THRESHOLDS.engagementRate;

      const historyInfo = postHistory.get(tweet.tweetId);

      const savedTweet: SavedTweet = {
        id: tweet.tweetId,
        text: tweet.text,
        createdAt: tweet.createdAt,
        engagement,
        metrics: {
          likes: tweet.metrics.likes,
          retweets: tweet.metrics.retweets,
          impressions: tweet.metrics.impressions,
        },
        source: historyInfo?.source,
        template: historyInfo?.template,
        addedAt: new Date().toISOString(),
        isHit,
      };

      if (existingIds.has(tweet.tweetId)) {
        // 既存の投稿を更新
        const existingIndex = tweetsFile.tweets.findIndex(t => t.id === tweet.tweetId);
        if (existingIndex !== -1) {
          const wasHit = tweetsFile.tweets[existingIndex].isHit;
          tweetsFile.tweets[existingIndex] = savedTweet;

          // 新しくヒットになった場合
          if (isHit && !wasHit) {
            newHits.push(savedTweet);
          }
        }
        updatedTweets.push(savedTweet);
      } else {
        // 新規追加
        tweetsFile.tweets.unshift(savedTweet);
        if (isHit) {
          newHits.push(savedTweet);
        }
        updatedTweets.push(savedTweet);
      }
    }

    // 5. エンゲージメント順にソート
    tweetsFile.tweets.sort((a, b) => b.engagement - a.engagement);

    // 6. 保存
    await saveTweetsFile(accountId, tweetsFile);

    // 7. 勝ちパターンを分析・保存
    const patterns = analyzeWinningPatterns(tweetsFile.tweets);
    await saveWinningPatterns(accountId, patterns);

    // 8. 新しいヒットがあればDiscord通知
    if (newHits.length > 0) {
      for (const hit of newHits) {
        notifyPostSuccess({
          account: accountId,
          tweetId: hit.id,
          postText: `🎯 HIT! ${hit.text.substring(0, 50)}...`,
          qualityScore: hit.engagement,
          slot: 0,
        }).catch(console.error);
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`[Monitor] Completed in ${processingTime}ms`);
    console.log(`[Monitor] New hits: ${newHits.length}, Total tweets: ${tweetsFile.tweets.length}`);

    return NextResponse.json({
      success: true,
      accountId,
      monitored: recentMetrics.length,
      newHits: newHits.length,
      totalStocked: tweetsFile.tweets.length,
      hitCount: tweetsFile.tweets.filter(t => t.isHit).length,
      patterns: {
        topTemplates: Object.entries(patterns.templates)
          .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)
          .slice(0, 3)
          .map(([name, stats]) => ({ name, ...stats })),
      },
      processingTime,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Monitor] Error:', error);

    notifyError({
      title: 'Monitor実行エラー',
      error: errorMessage,
      context: 'engagement-monitor',
    }).catch(console.error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

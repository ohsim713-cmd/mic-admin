import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const POSTS_HISTORY_FILE = path.join(process.cwd(), 'knowledge', 'posts_history.json');
const CREDENTIALS_FILE = path.join(process.cwd(), 'knowledge', 'x_credentials.json');

type PostHistory = {
    id: string;
    text: string;
    timestamp: string;
    tweetId?: string;
    account?: string;
    impressions?: number;
    engagements?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
};

type XCredentials = {
    tt_liver?: {
        bearerToken: string;
        clientId?: string;
    };
    [key: string]: {
        bearerToken: string;
        clientId?: string;
    } | undefined;
};

function loadPostsHistory(): PostHistory[] {
    try {
        if (!fs.existsSync(POSTS_HISTORY_FILE)) {
            return [];
        }
        const data = fs.readFileSync(POSTS_HISTORY_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.posts || [];
    } catch (e) {
        console.error('Failed to load posts history:', e);
        return [];
    }
}

function savePostsHistory(posts: PostHistory[]) {
    try {
        const dir = path.dirname(POSTS_HISTORY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(POSTS_HISTORY_FILE, JSON.stringify({ posts }, null, 2));
    } catch (e) {
        console.error('Failed to save posts history:', e);
    }
}

function loadCredentials(): XCredentials | null {
    try {
        if (!fs.existsSync(CREDENTIALS_FILE)) {
            return null;
        }
        const data = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Failed to load credentials:', e);
        return null;
    }
}

/**
 * 複数ツイートを一括取得（最大100件）
 */
async function fetchMultipleTweetMetrics(tweetIds: string[], bearerToken: string): Promise<Map<string, {
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
}>> {
    const results = new Map();

    // URLデコード
    const decodedToken = decodeURIComponent(bearerToken);

    // 100件ずつバッチ処理
    const batchSize = 100;
    for (let i = 0; i < tweetIds.length; i += batchSize) {
        const batch = tweetIds.slice(i, i + batchSize);
        const idsParam = batch.join(',');

        try {
            const response = await fetch(
                `https://api.twitter.com/2/tweets?ids=${idsParam}&tweet.fields=public_metrics`,
                {
                    headers: {
                        'Authorization': `Bearer ${decodedToken}`
                    }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`X API batch error:`, response.status, errorText);
                continue;
            }

            const data = await response.json();

            if (data.data) {
                for (const tweet of data.data) {
                    if (tweet.public_metrics) {
                        results.set(tweet.id, {
                            impressions: tweet.public_metrics.impression_count || 0,
                            likes: tweet.public_metrics.like_count || 0,
                            retweets: tweet.public_metrics.retweet_count || 0,
                            replies: tweet.public_metrics.reply_count || 0
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to fetch batch metrics:`, e);
        }

        // レート制限対策: バッチ間で少し待機
        if (i + batchSize < tweetIds.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { account = 'tt_liver' } = body;

        const credentials = loadCredentials();
        if (!credentials) {
            return NextResponse.json(
                { error: 'X API credentials file not found' },
                { status: 400 }
            );
        }

        const accountCreds = credentials[account];
        if (!accountCreds?.bearerToken) {
            return NextResponse.json(
                { error: `Bearer token not configured for account: ${account}` },
                { status: 400 }
            );
        }

        const posts = loadPostsHistory();

        // tweetIdがある投稿のみ取得（アカウントでフィルタ可能）
        const postsWithTweetId = posts.filter(p =>
            p.tweetId && (!p.account || p.account === account)
        );

        if (postsWithTweetId.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No tweets to fetch metrics for',
                updated: 0
            });
        }

        // まだメトリクスがない、または更新が必要な投稿を抽出
        const postsToUpdate = postsWithTweetId.filter(p =>
            !p.impressions || p.impressions === 0
        );

        if (postsToUpdate.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All tweets already have metrics',
                updated: 0,
                total: postsWithTweetId.length
            });
        }

        // 一括取得
        const tweetIds = postsToUpdate.map(p => p.tweetId!);
        const metricsMap = await fetchMultipleTweetMetrics(tweetIds, accountCreds.bearerToken);

        let updatedCount = 0;
        let failedCount = 0;

        for (const post of postsToUpdate) {
            const metrics = metricsMap.get(post.tweetId!);
            if (metrics) {
                post.impressions = metrics.impressions;
                post.likes = metrics.likes;
                post.retweets = metrics.retweets;
                post.replies = metrics.replies;
                post.engagements = metrics.likes + metrics.retweets + metrics.replies;
                updatedCount++;
            } else {
                failedCount++;
            }
        }

        // 更新された投稿履歴を保存
        savePostsHistory(posts);

        console.log(`[fetch-impressions] Updated: ${updatedCount}, Failed: ${failedCount}`);

        return NextResponse.json({
            success: true,
            message: `${updatedCount}件の投稿メトリクスを更新しました`,
            updated: updatedCount,
            failed: failedCount,
            total: postsWithTweetId.length
        });
    } catch (error: any) {
        console.error('Failed to fetch impressions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch impressions', details: error.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        endpoint: '/api/automation/fetch-impressions',
        description: 'X APIからツイートのインプレッションを取得',
        usage: {
            method: 'POST',
            body: {
                account: 'アカウント名（デフォルト: tt_liver）'
            }
        }
    });
}

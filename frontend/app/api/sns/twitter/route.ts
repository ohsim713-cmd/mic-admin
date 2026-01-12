import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import * as fs from 'fs';
import * as path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'knowledge', 'sns_credentials.json');

function loadCredentials() {
    try {
        if (fs.existsSync(CREDENTIALS_PATH)) {
            const data = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load credentials:', error);
    }
    return null;
}

// POST: X (Twitter)に投稿
export async function POST(request: NextRequest) {
    try {
        const { text } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const credentials = loadCredentials();
        if (!credentials?.twitter?.apiKey ||
            !credentials?.twitter?.apiSecret ||
            !credentials?.twitter?.accessToken ||
            !credentials?.twitter?.accessTokenSecret) {
            return NextResponse.json({
                error: 'Twitter credentials not configured',
                needsSetup: true
            }, { status: 401 });
        }

        const client = new TwitterApi({
            appKey: credentials.twitter.apiKey,
            appSecret: credentials.twitter.apiSecret,
            accessToken: credentials.twitter.accessToken,
            accessSecret: credentials.twitter.accessTokenSecret,
        });

        const tweet = await client.v2.tweet(text);

        return NextResponse.json({
            success: true,
            id: tweet.data.id,
            text: tweet.data.text
        });

    } catch (error: any) {
        console.error('Twitter post error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to post to Twitter'
        }, { status: 500 });
    }
}

// GET: 接続状態を確認
export async function GET() {
    try {
        const credentials = loadCredentials();

        if (!credentials?.twitter?.apiKey ||
            !credentials?.twitter?.apiSecret ||
            !credentials?.twitter?.accessToken ||
            !credentials?.twitter?.accessTokenSecret) {
            return NextResponse.json({
                connected: false,
                needsSetup: true
            });
        }

        const client = new TwitterApi({
            appKey: credentials.twitter.apiKey,
            appSecret: credentials.twitter.apiSecret,
            accessToken: credentials.twitter.accessToken,
            accessSecret: credentials.twitter.accessTokenSecret,
        });

        const me = await client.v2.me();

        return NextResponse.json({
            connected: true,
            username: me.data.username,
            displayName: me.data.name
        });

    } catch (error: any) {
        return NextResponse.json({
            connected: false,
            error: error.message
        });
    }
}

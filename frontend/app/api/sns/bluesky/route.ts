import { NextRequest, NextResponse } from 'next/server';
import { BskyAgent } from '@atproto/api';
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

function saveCredentials(credentials: any) {
    try {
        fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
    } catch (error) {
        console.error('Failed to save credentials:', error);
    }
}

// POST: Blueskyに投稿
export async function POST(request: NextRequest) {
    try {
        const { text } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const credentials = loadCredentials();
        if (!credentials?.bluesky?.identifier || !credentials?.bluesky?.password) {
            return NextResponse.json({
                error: 'Bluesky credentials not configured',
                needsSetup: true
            }, { status: 401 });
        }

        const agent = new BskyAgent({
            service: 'https://bsky.social'
        });

        await agent.login({
            identifier: credentials.bluesky.identifier,
            password: credentials.bluesky.password
        });

        const response = await agent.post({
            text: text,
            createdAt: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            uri: response.uri,
            cid: response.cid
        });

    } catch (error: any) {
        console.error('Bluesky post error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to post to Bluesky'
        }, { status: 500 });
    }
}

// GET: 接続状態を確認
export async function GET() {
    try {
        const credentials = loadCredentials();

        if (!credentials?.bluesky?.identifier || !credentials?.bluesky?.password) {
            return NextResponse.json({
                connected: false,
                needsSetup: true
            });
        }

        const agent = new BskyAgent({
            service: 'https://bsky.social'
        });

        await agent.login({
            identifier: credentials.bluesky.identifier,
            password: credentials.bluesky.password
        });

        const profile = await agent.getProfile({ actor: credentials.bluesky.identifier });

        return NextResponse.json({
            connected: true,
            handle: profile.data.handle,
            displayName: profile.data.displayName
        });

    } catch (error: any) {
        return NextResponse.json({
            connected: false,
            error: error.message
        });
    }
}

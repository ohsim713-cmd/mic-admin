import { NextRequest, NextResponse } from 'next/server';
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

// POST: Threadsに投稿
export async function POST(request: NextRequest) {
    try {
        const { text } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const credentials = loadCredentials();
        if (!credentials?.threads?.accessToken || !credentials?.threads?.userId) {
            return NextResponse.json({
                error: 'Threads credentials not configured',
                needsSetup: true
            }, { status: 401 });
        }

        const { accessToken, userId } = credentials.threads;

        // Step 1: Create media container
        const createResponse = await fetch(
            `https://graph.threads.net/v1.0/${userId}/threads`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    media_type: 'TEXT',
                    text: text,
                    access_token: accessToken
                })
            }
        );

        const createData = await createResponse.json();

        if (createData.error) {
            throw new Error(createData.error.message);
        }

        const containerId = createData.id;

        // Step 2: Publish the container
        const publishResponse = await fetch(
            `https://graph.threads.net/v1.0/${userId}/threads_publish`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: containerId,
                    access_token: accessToken
                })
            }
        );

        const publishData = await publishResponse.json();

        if (publishData.error) {
            throw new Error(publishData.error.message);
        }

        return NextResponse.json({
            success: true,
            id: publishData.id
        });

    } catch (error: any) {
        console.error('Threads post error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to post to Threads'
        }, { status: 500 });
    }
}

// GET: 接続状態を確認
export async function GET() {
    try {
        const credentials = loadCredentials();

        if (!credentials?.threads?.accessToken || !credentials?.threads?.userId) {
            return NextResponse.json({
                connected: false,
                needsSetup: true
            });
        }

        const { accessToken, userId } = credentials.threads;

        const response = await fetch(
            `https://graph.threads.net/v1.0/${userId}?fields=username,name&access_token=${accessToken}`
        );

        const data = await response.json();

        if (data.error) {
            return NextResponse.json({
                connected: false,
                error: data.error.message
            });
        }

        return NextResponse.json({
            connected: true,
            username: data.username,
            displayName: data.name
        });

    } catch (error: any) {
        return NextResponse.json({
            connected: false,
            error: error.message
        });
    }
}

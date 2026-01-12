import { NextResponse } from 'next/server';
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

export async function GET() {
    try {
        const credentials = loadCredentials();

        // OAuth 2.0トークンがあるかチェック
        const hasOAuthToken = !!credentials?.twitter?.oauthAccessToken;

        // 従来のAPI Key方式もチェック
        const hasApiKeys = !!(
            credentials?.twitter?.apiKey &&
            credentials?.twitter?.apiSecret &&
            credentials?.twitter?.accessToken &&
            credentials?.twitter?.accessTokenSecret
        );

        return NextResponse.json({
            connected: hasOAuthToken || hasApiKeys,
            method: hasOAuthToken ? 'oauth' : hasApiKeys ? 'apikey' : 'none',
            message: hasOAuthToken
                ? 'OAuth 2.0で連携済み'
                : hasApiKeys
                    ? 'API Keyで連携済み'
                    : '未連携'
        });

    } catch (error: any) {
        return NextResponse.json({
            connected: false,
            error: error.message
        });
    }
}

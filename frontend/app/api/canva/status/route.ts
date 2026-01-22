/**
 * Canva 認証ステータス確認エンドポイント
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const TOKEN_FILE = path.join(process.cwd(), 'knowledge', 'canva_token.json');

export async function GET() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return NextResponse.json({
        authenticated: false,
        message: 'Not authenticated. Visit /api/canva/auth to connect.',
      });
    }

    const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));

    const isExpired = Date.now() > tokenData.expires_at;

    return NextResponse.json({
      authenticated: !isExpired,
      expires_at: new Date(tokenData.expires_at).toISOString(),
      is_expired: isExpired,
      scope: tokenData.scope,
      updated_at: tokenData.updated_at,
      message: isExpired
        ? 'Token expired. Visit /api/canva/auth to reconnect.'
        : 'Connected to Canva',
    });

  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: String(error),
    });
  }
}

/**
 * Canva OAuth コールバックエンドポイント
 *
 * Canvaからリダイレクトされてきて、トークンを取得・保存する
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const TOKEN_FILE = path.join(process.cwd(), 'knowledge', 'canva_token.json');

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  scope: string;
  updated_at: string;
}

function saveToken(tokenData: TokenData): void {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // エラーチェック
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Unknown error';
    return NextResponse.json(
      { error, description: errorDescription },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Missing authorization code' },
      { status: 400 }
    );
  }

  // Cookie からcode_verifierとstateを取得
  const codeVerifier = request.cookies.get('canva_code_verifier')?.value;
  const savedState = request.cookies.get('canva_state')?.value;

  if (!codeVerifier) {
    return NextResponse.json(
      { error: 'Missing code_verifier. Please start the auth flow again.' },
      { status: 400 }
    );
  }

  // State検証（CSRF対策）
  if (state !== savedState) {
    return NextResponse.json(
      { error: 'State mismatch. Possible CSRF attack.' },
      { status: 400 }
    );
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing Canva credentials in environment variables' },
      { status: 500 }
    );
  }

  try {
    // トークン交換
    const tokenResponse = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[Canva Callback] Token exchange failed:', errorData);
      return NextResponse.json(
        { error: 'Token exchange failed', details: errorData },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();

    // トークンを保存
    const saveData: TokenData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      updated_at: new Date().toISOString(),
    };

    saveToken(saveData);

    console.log('[Canva Callback] Token saved successfully');

    // Cookieをクリア
    const response = NextResponse.redirect(new URL('/dashboard/content', request.url));
    response.cookies.delete('canva_code_verifier');
    response.cookies.delete('canva_state');

    return response;

  } catch (error) {
    console.error('[Canva Callback] Error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange token', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Canva OAuth認証開始エンドポイント
 *
 * このURLにアクセスすると、Canvaのログイン画面にリダイレクトされる
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

// PKCE用のcode_verifierを生成
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// code_challengeを生成
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function GET() {
  const clientId = process.env.CANVA_CLIENT_ID;
  const redirectUri = process.env.CANVA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'CANVA_CLIENT_ID and CANVA_REDIRECT_URI are required' },
      { status: 500 }
    );
  }

  // PKCE用のコード生成
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // stateはCSRF対策用
  const state = crypto.randomBytes(16).toString('hex');

  // スコープ（Developer Portalで設定したものと一致させる）
  const scopes = [
    'asset:read',
    'asset:write',
    'brandtemplate:content:read',
    'brandtemplate:meta:read',
    'design:content:read',
    'design:content:write',
    'design:meta:read',
    'profile:read',
  ];

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://www.canva.com/api/oauth/authorize?${params.toString()}`;

  // code_verifierをcookieに保存（callbackで使う）
  const response = NextResponse.redirect(authUrl);

  response.cookies.set('canva_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10分
    path: '/',
  });

  response.cookies.set('canva_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}

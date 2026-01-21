/**
 * Twitter OAuth 1.0a - Step 1: Request Token取得
 *
 * 使い方:
 * 1. GET /api/auth/twitter/request-token?account=tt_liver
 * 2. 返ってきたauth_urlにアクセス
 * 3. Twitterで許可
 * 4. callbackでAccess Tokenが取得できる
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

type AccountType = 'tt_liver' | 'mic_chat' | 'ms_stripchat';

function getCredentials(account: AccountType) {
  const suffix = account.toUpperCase().replace('_', '_');
  return {
    apiKey: process.env[`TWITTER_API_KEY_${suffix}`] || process.env.TWITTER_API_KEY || '',
    apiSecret: process.env[`TWITTER_API_SECRET_${suffix}`] || process.env.TWITTER_API_SECRET || '',
  };
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  apiSecret: string,
  tokenSecret: string = ''
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(tokenSecret)}`;

  return crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const account = (searchParams.get('account') || 'tt_liver') as AccountType;

  const { apiKey, apiSecret } = getCredentials(account);

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'API credentials not found' }, { status: 500 });
  }

  // Callback URL（Vercelの本番URLまたはローカル）
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const callbackUrl = `${protocol}://${host}/api/auth/twitter/callback?account=${account}`;

  const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';

  const oauthParams: Record<string, string> = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };

  oauthParams.oauth_signature = generateOAuthSignature(
    'POST',
    requestTokenUrl,
    oauthParams,
    apiSecret
  );

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  try {
    const response = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('Twitter request token error:', text);
      return NextResponse.json({
        error: 'Failed to get request token',
        details: text
      }, { status: response.status });
    }

    const params = new URLSearchParams(text);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken) {
      return NextResponse.json({ error: 'No oauth_token received' }, { status: 500 });
    }

    // 認証URLを生成
    const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`;

    return NextResponse.json({
      success: true,
      account,
      auth_url: authUrl,
      oauth_token: oauthToken,
      oauth_token_secret: oauthTokenSecret,
      message: `このURLにアクセスして${account}アカウントで認証してください`,
    });
  } catch (error) {
    console.error('OAuth request token error:', error);
    return NextResponse.json({
      error: 'OAuth request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

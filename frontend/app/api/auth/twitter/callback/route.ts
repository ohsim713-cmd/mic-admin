/**
 * Twitter OAuth 1.0a - Step 2: Callback & Access Token取得
 *
 * Twitterで認証後、このURLにリダイレクトされる
 * Access Token/Secretが表示される
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

type AccountType = 'tt_liver' | 'litz_grp' | 'mic_chat' | 'ms_stripchat';

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
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');
  const account = (searchParams.get('account') || 'tt_liver') as AccountType;
  const denied = searchParams.get('denied');

  if (denied) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head><title>認証キャンセル</title></head>
      <body style="font-family: sans-serif; padding: 40px;">
        <h1>❌ 認証がキャンセルされました</h1>
        <p>もう一度やり直してください。</p>
        <a href="/api/auth/twitter/request-token?account=${account}">再試行</a>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.json({
      error: 'Missing oauth_token or oauth_verifier'
    }, { status: 400 });
  }

  const { apiKey, apiSecret } = getCredentials(account);

  const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier,
    oauth_version: '1.0',
  };

  oauthParams.oauth_signature = generateOAuthSignature(
    'POST',
    accessTokenUrl,
    oauthParams,
    apiSecret,
    '' // Request tokenのsecretは不要
  );

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  try {
    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('Twitter access token error:', text);
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head><title>エラー</title></head>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1>❌ Access Token取得エラー</h1>
          <pre>${text}</pre>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const params = new URLSearchParams(text);
    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');
    const userId = params.get('user_id');
    const screenName = params.get('screen_name');

    const suffix = account.toUpperCase();

    // HTMLで結果を表示（コピペしやすいように）
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>認証成功 - ${screenName}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .success { color: green; }
          .box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
          .copy-btn { margin-left: 10px; cursor: pointer; }
          pre { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 8px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ 認証成功！</h1>

        <div class="box">
          <h2>アカウント情報</h2>
          <p><strong>Screen Name:</strong> @${screenName}</p>
          <p><strong>User ID:</strong> ${userId}</p>
          <p><strong>Account:</strong> ${account}</p>
        </div>

        <div class="box">
          <h2>🔑 Vercelに設定する環境変数</h2>
          <p>以下をVercelのEnvironment Variablesにコピペしてください：</p>

          <pre>
TWITTER_ACCESS_TOKEN_${suffix}=${accessToken}

TWITTER_ACCESS_TOKEN_SECRET_${suffix}=${accessTokenSecret}
          </pre>
        </div>

        <div class="box">
          <h2>📋 設定手順</h2>
          <ol>
            <li>Vercel Dashboard → Settings → Environment Variables</li>
            <li>上記の2つの変数を追加（または更新）</li>
            <li>Deployments → 最新のデプロイを「Redeploy」</li>
            <li>Cron Jobsで「Run」を押してテスト</li>
          </ol>
        </div>

        <p><a href="/">ホームに戻る</a></p>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  } catch (error) {
    console.error('OAuth access token error:', error);
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head><title>エラー</title></head>
      <body style="font-family: sans-serif; padding: 40px;">
        <h1>❌ エラー</h1>
        <pre>${error instanceof Error ? error.message : 'Unknown error'}</pre>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

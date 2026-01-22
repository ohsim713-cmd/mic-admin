/**
 * Canva 認証ステータス確認エンドポイント
 *
 * 環境変数のトークンを使用してCanva APIへの接続を確認
 */

import { NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/canva-api';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const accessToken = process.env.CANVA_ACCESS_TOKEN;
    const refreshToken = process.env.CANVA_REFRESH_TOKEN;

    if (!accessToken) {
      return NextResponse.json({
        authenticated: false,
        message: 'Not authenticated. Visit /api/canva/auth to connect.',
        has_access_token: false,
        has_refresh_token: !!refreshToken,
      });
    }

    // トークンの有効性をテスト
    const testResponse = await fetch('https://api.canva.com/rest/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (testResponse.ok) {
      const userData = await testResponse.json();
      return NextResponse.json({
        authenticated: true,
        message: 'Connected to Canva',
        user: userData.user?.display_name || 'Unknown',
        has_refresh_token: !!refreshToken,
      });
    }

    // トークンが無効 - リフレッシュを試みる
    if (refreshToken) {
      console.log('[Canva Status] Token invalid, attempting refresh...');
      const refreshed = await refreshAccessToken(refreshToken);

      if (refreshed) {
        return NextResponse.json({
          authenticated: true,
          message: 'Token was refreshed. Update environment variables with new tokens.',
          token_refreshed: true,
          new_access_token: refreshed.access_token,
          new_refresh_token: refreshed.refresh_token,
          expires_in: refreshed.expires_in,
          action_required: 'Please update CANVA_ACCESS_TOKEN and CANVA_REFRESH_TOKEN in Vercel with the new values above.',
        });
      }
    }

    return NextResponse.json({
      authenticated: false,
      message: 'Token expired and refresh failed. Visit /api/canva/auth to reconnect.',
      has_access_token: true,
      has_refresh_token: !!refreshToken,
    });

  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: String(error),
    });
  }
}

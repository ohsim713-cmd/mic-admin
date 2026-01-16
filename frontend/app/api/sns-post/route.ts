/**
 * SNS Post API - Playwrightを使った実際のSNS投稿
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSNSPoster, Platform, LoginCredentials } from '@/lib/agent/sns-poster';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    const poster = getSNSPoster();

    switch (action) {
      // 投稿を実行
      case 'post': {
        const { platform, accountId, text, mediaUrls, replyToId } = params;

        if (!platform || !accountId || !text) {
          return NextResponse.json(
            { error: 'platform, accountId, and text are required' },
            { status: 400 }
          );
        }

        const result = await poster.post({
          platform: platform as Platform,
          accountId,
          text,
          mediaUrls,
          replyToId,
        });

        return NextResponse.json({
          success: result.success,
          ...result,
        });
      }

      // ログイン状態を確認
      case 'check_login': {
        const { platform, accountId } = params;

        if (!platform || !accountId) {
          return NextResponse.json(
            { error: 'platform and accountId are required' },
            { status: 400 }
          );
        }

        const isLoggedIn = await poster.checkLoginStatus(
          platform as Platform,
          accountId
        );

        return NextResponse.json({
          success: true,
          platform,
          accountId,
          isLoggedIn,
        });
      }

      // ログインを実行
      case 'login': {
        const { platform, accountId, username, password, totpSecret } = params;

        if (!platform || !accountId || !username || !password) {
          return NextResponse.json(
            { error: 'platform, accountId, username, and password are required' },
            { status: 400 }
          );
        }

        const credentials: LoginCredentials = {
          username,
          password,
          totpSecret,
        };

        const success = await poster.login(
          platform as Platform,
          accountId,
          credentials
        );

        return NextResponse.json({
          success,
          message: success ? 'Login successful' : 'Login failed',
        });
      }

      // ブラウザを閉じる
      case 'close': {
        await poster.close();

        return NextResponse.json({
          success: true,
          message: 'Browser closed',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[SNS Post API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'Playwrightを使ったSNS投稿API',
    endpoints: {
      'POST /api/sns-post': {
        actions: {
          post: {
            description: 'SNSに投稿を実行',
            params: {
              platform: '"twitter" | "instagram" | "threads"',
              accountId: 'string (required)',
              text: 'string (required)',
              mediaUrls: 'string[] (optional)',
              replyToId: 'string (optional)',
            },
          },
          check_login: {
            description: 'ログイン状態を確認',
            params: {
              platform: 'string (required)',
              accountId: 'string (required)',
            },
          },
          login: {
            description: 'ログインを実行（クッキーを保存）',
            params: {
              platform: 'string (required)',
              accountId: 'string (required)',
              username: 'string (required)',
              password: 'string (required)',
              totpSecret: 'string (optional, for 2FA)',
            },
          },
          close: {
            description: 'ブラウザを閉じる',
          },
        },
      },
    },
    note: 'セッション（クッキー）は暗号化して保存されます。一度ログインすれば30日間有効です。',
  });
}

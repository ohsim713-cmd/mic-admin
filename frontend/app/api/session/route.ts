/**
 * Session API - クッキー/セッション管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionManager } from '@/lib/agent/session-manager';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    const sessionManager = getSessionManager();

    switch (action) {
      case 'list': {
        const sessions = sessionManager.listSessions();

        return NextResponse.json({
          success: true,
          sessions,
        });
      }

      case 'check': {
        const { platform, accountId } = params;
        if (!platform || !accountId) {
          return NextResponse.json(
            { error: 'platform and accountId are required' },
            { status: 400 }
          );
        }

        const isValid = sessionManager.isSessionValid(platform, accountId);

        return NextResponse.json({
          success: true,
          platform,
          accountId,
          isValid,
        });
      }

      case 'invalidate': {
        const { platform, accountId } = params;
        if (!platform || !accountId) {
          return NextResponse.json(
            { error: 'platform and accountId are required' },
            { status: 400 }
          );
        }

        sessionManager.invalidateSession(platform, accountId);

        return NextResponse.json({
          success: true,
          message: `Session invalidated: ${platform}/${accountId}`,
        });
      }

      case 'cleanup': {
        const cleaned = sessionManager.cleanup();

        return NextResponse.json({
          success: true,
          cleaned,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Session API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const sessionManager = getSessionManager();
    const sessions = sessionManager.listSessions();

    return NextResponse.json({
      success: true,
      sessions,
      endpoints: {
        'POST /api/session': {
          actions: {
            list: {
              description: '保存されているセッション一覧',
            },
            check: {
              description: 'セッションの有効性を確認',
              params: {
                platform: 'string (required)',
                accountId: 'string (required)',
              },
            },
            invalidate: {
              description: 'セッションを無効化',
              params: {
                platform: 'string (required)',
                accountId: 'string (required)',
              },
            },
            cleanup: {
              description: '期限切れセッションを削除',
            },
          },
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

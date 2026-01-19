/**
 * H Functions API - Edge Runtime
 *
 * 軽量・低レイテンシのヘルパー関数エンドポイント
 */

import { NextRequest, NextResponse } from 'next/server';

// Edge Runtime指定
export const runtime = 'edge';

// In-memory storage (Edge対応 - インスタンスごと)
const logs: Array<{
  level: string;
  agent: string;
  message: string;
  data?: unknown;
  timestamp: string;
}> = [];

const metrics: Record<string, number> = {};

// ============================================
// GET: ログ・メトリクス取得
// ============================================
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'logs';
  const agent = searchParams.get('agent');
  const level = searchParams.get('level');
  const limit = parseInt(searchParams.get('limit') || '100');

  if (type === 'metrics') {
    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  }

  // ログ取得
  let filteredLogs = [...logs];
  if (agent) filteredLogs = filteredLogs.filter(l => l.agent === agent);
  if (level) filteredLogs = filteredLogs.filter(l => l.level === level);
  filteredLogs = filteredLogs.slice(-limit);

  return NextResponse.json({
    success: true,
    logs: filteredLogs,
    total: logs.length,
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// POST: ログ追加・メトリクス更新
// ============================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'log': {
        const { level = 'info', agent, message, data } = body;
        const entry = {
          level,
          agent: agent || 'unknown',
          message: message || '',
          data,
          timestamp: new Date().toISOString(),
        };
        logs.push(entry);
        if (logs.length > 1000) logs.shift();
        return NextResponse.json({ success: true, entry });
      }

      case 'metric': {
        const { key, value, operation = 'set' } = body;
        if (!key) {
          return NextResponse.json({ success: false, error: 'key required' }, { status: 400 });
        }

        switch (operation) {
          case 'increment':
            metrics[key] = (metrics[key] || 0) + (value || 1);
            break;
          case 'decrement':
            metrics[key] = Math.max(0, (metrics[key] || 0) - (value || 1));
            break;
          case 'set':
          default:
            metrics[key] = value || 0;
        }

        return NextResponse.json({ success: true, key, value: metrics[key] });
      }

      case 'validate': {
        const { type, content } = body;

        if (type === 'post') {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (!content || content.trim().length === 0) {
            errors.push('投稿内容が空です');
          } else {
            if (content.length > 280) {
              errors.push(`文字数オーバー: ${content.length}/280`);
            }
            if (content.length > 250) {
              warnings.push('文字数が多いです（250文字超）');
            }

            // NGワードチェック
            const ngWords = ['死', '殺'];
            for (const word of ngWords) {
              if (content.includes(word)) {
                errors.push(`NGワード検出: ${word}`);
              }
            }

            // ハッシュタグ数チェック
            const hashtags = content.match(/#[^\s#]+/g) || [];
            if (hashtags.length > 5) {
              warnings.push('ハッシュタグが多すぎます');
            }
          }

          return NextResponse.json({
            success: true,
            valid: errors.length === 0,
            errors,
            warnings,
          });
        }

        return NextResponse.json({ success: false, error: 'Unknown validation type' }, { status: 400 });
      }

      case 'notify': {
        const { message, channel = 'slack', priority = 'normal', title } = body;

        // TODO: 実際のWebhook送信
        console.log(`[Notification] ${channel}:${priority} - ${title || ''} ${message}`);

        return NextResponse.json({
          success: true,
          sent: true,
          channel,
          priority,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

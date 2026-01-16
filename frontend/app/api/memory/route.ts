/**
 * Memory API - Vector Memory エンドポイント
 * セマンティック検索、保存、統計
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVectorMemory, MemoryDocument } from '@/lib/database/vector-memory';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    const memory = getVectorMemory();

    switch (action) {
      // セマンティック検索
      case 'search': {
        const { query, limit = 10, threshold = 0.7, source, category } = params;
        if (!query) {
          return NextResponse.json({ error: 'query is required' }, { status: 400 });
        }

        const results = await memory.search(query, {
          limit,
          threshold,
          filter: { source, category },
        });

        return NextResponse.json({
          success: true,
          count: results.length,
          results,
        });
      }

      // ドキュメント保存
      case 'store': {
        const { content, metadata } = params;
        if (!content) {
          return NextResponse.json({ error: 'content is required' }, { status: 400 });
        }

        const doc: MemoryDocument = {
          content,
          metadata: metadata || { source: 'manual' },
        };

        const id = await memory.store(doc);

        return NextResponse.json({ success: true, id });
      }

      // 一括保存
      case 'store_batch': {
        const { documents } = params;
        if (!documents || !Array.isArray(documents)) {
          return NextResponse.json({ error: 'documents array is required' }, { status: 400 });
        }

        const ids = await memory.storeBatch(documents);

        return NextResponse.json({ success: true, count: ids.length, ids });
      }

      // 類似チェック（重複検知）
      case 'find_similar': {
        const { content, threshold = 0.95 } = params;
        if (!content) {
          return NextResponse.json({ error: 'content is required' }, { status: 400 });
        }

        const similar = await memory.findSimilar(content, threshold);

        return NextResponse.json({
          success: true,
          isDuplicate: similar.length > 0,
          similar,
        });
      }

      // 統計情報
      case 'stats': {
        const stats = await memory.getStats();

        return NextResponse.json({ success: true, stats });
      }

      // クリーンアップ
      case 'cleanup': {
        const { daysOld = 90 } = params;
        const deleted = await memory.cleanup(daysOld);

        return NextResponse.json({ success: true, deleted });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Memory API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// 使い方
export async function GET() {
  try {
    const memory = getVectorMemory();
    const stats = await memory.getStats();

    return NextResponse.json({
      status: 'ok',
      stats,
      endpoints: {
        'POST /api/memory': {
          actions: {
            search: {
              description: 'セマンティック検索',
              params: {
                query: 'string (required)',
                limit: 'number (default: 10)',
                threshold: 'number (default: 0.7)',
                source: 'string (optional filter)',
                category: 'string (optional filter)',
              },
            },
            store: {
              description: 'ドキュメント保存',
              params: {
                content: 'string (required)',
                metadata: 'object (optional)',
              },
            },
            store_batch: {
              description: '一括保存',
              params: {
                documents: 'MemoryDocument[] (required)',
              },
            },
            find_similar: {
              description: '類似ドキュメント検索（重複検知）',
              params: {
                content: 'string (required)',
                threshold: 'number (default: 0.95)',
              },
            },
            stats: {
              description: '統計情報取得',
            },
            cleanup: {
              description: '古いドキュメント削除',
              params: {
                daysOld: 'number (default: 90)',
              },
            },
          },
        },
      },
    });
  } catch {
    return NextResponse.json({
      status: 'not_configured',
      message: 'Vector memory not configured. Run SQL migration first.',
    });
  }
}

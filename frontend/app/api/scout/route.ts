/**
 * Scout API - Playwright Agent エンドポイント
 * note記事収集、スクレイピング、OCR
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlaywrightAgent } from '@/lib/agent/sub-agents/playwright-agent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    const agent = getPlaywrightAgent();

    switch (action) {
      // note記事を検索して収集
      case 'search_note': {
        const { query, maxResults = 10, saveToMemory = true } = params;
        if (!query) {
          return NextResponse.json({ error: 'query is required' }, { status: 400 });
        }

        await agent.launch();
        const articles = await agent.scrapeNoteSearch(query, maxResults);

        if (saveToMemory && articles.length > 0) {
          const ids = await agent.saveToMemory(articles, 'note');
          return NextResponse.json({
            success: true,
            count: articles.length,
            savedIds: ids,
            articles: articles.map(a => ({
              title: a.title,
              url: a.url,
              author: a.author,
              contentLength: a.content.length,
            })),
          });
        }

        return NextResponse.json({
          success: true,
          count: articles.length,
          articles,
        });
      }

      // 任意のページをスクレイピング
      case 'scrape': {
        const { url, selector, saveToMemory = false } = params;
        if (!url) {
          return NextResponse.json({ error: 'url is required' }, { status: 400 });
        }

        await agent.launch();
        const result = await agent.scrapePage(url, { selector });

        if (saveToMemory) {
          const ids = await agent.saveToMemory([result], 'web');
          return NextResponse.json({ success: true, result, savedId: ids[0] });
        }

        return NextResponse.json({ success: true, result });
      }

      // OCR（スクリーンショット + Vision API）
      case 'ocr': {
        const { url, selector } = params;
        if (!url) {
          return NextResponse.json({ error: 'url is required' }, { status: 400 });
        }

        await agent.launch();
        const result = await agent.captureAndOCR(url, selector);

        return NextResponse.json({ success: true, result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Scout API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    // ブラウザをクリーンアップ
    try {
      const agent = getPlaywrightAgent();
      await agent.close();
    } catch {
      // ignore
    }
  }
}

// 使い方
export async function GET() {
  return NextResponse.json({
    endpoints: {
      'POST /api/scout': {
        actions: {
          search_note: {
            description: 'noteで検索して記事を収集',
            params: {
              query: 'string (required)',
              maxResults: 'number (default: 10)',
              saveToMemory: 'boolean (default: true)',
            },
          },
          scrape: {
            description: '任意のページをスクレイピング',
            params: {
              url: 'string (required)',
              selector: 'string (optional)',
              saveToMemory: 'boolean (default: false)',
            },
          },
          ocr: {
            description: 'スクリーンショットからテキスト抽出',
            params: {
              url: 'string (required)',
              selector: 'string (optional)',
            },
          },
        },
      },
    },
  });
}

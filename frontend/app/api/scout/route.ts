/**
 * Scout API - 強化版スカウトエンドポイント
 * Playwright + Tavily + Feedback統合
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlaywrightAgent } from '@/lib/agent/sub-agents/playwright-agent';
import enhancedScout from '@/lib/agent/sub-agents/enhanced-scout';
import tavilyAgent from '@/lib/agent/sub-agents/tavily-agent';
import feedbackAgent from '@/lib/agent/sub-agents/feedback-agent';

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

      // ========== Tavily/Feedback 関連 ==========

      // トレンド検索（Tavily）
      case 'trends': {
        const { industry = 'liver' } = params;
        const trends = await tavilyAgent.detectTrends(industry);
        return NextResponse.json({ success: true, trends });
      }

      // 競合コンテンツリサーチ（Tavily）
      case 'competitor': {
        const { industry = 'liver' } = params;
        const posts = await tavilyAgent.researchCompetitorContent(industry);
        return NextResponse.json({ success: true, posts });
      }

      // フルスカウト（Tavily + Feedback + 知識DB）
      case 'full_scout': {
        const { industry = 'liver' } = params;
        const report = await enhancedScout.fullScout(industry);
        return NextResponse.json({ success: true, report });
      }

      // クイックスカウト（キャッシュ優先）
      case 'quick_scout': {
        const { industry = 'liver' } = params;
        const data = await enhancedScout.quickScout(industry);
        return NextResponse.json({ success: true, ...data });
      }

      // 投稿改善分析
      case 'analyze_post': {
        const { post, industry = 'liver' } = params;
        if (!post) {
          return NextResponse.json({ error: 'post is required' }, { status: 400 });
        }
        const analysis = await tavilyAgent.analyzeForImprovement(post, industry);
        return NextResponse.json({ success: true, analysis });
      }

      // 投稿パフォーマンス記録
      case 'record_post': {
        const { text, target, benefit, predictedScore, tweetId } = params;
        if (!text || predictedScore === undefined) {
          return NextResponse.json({ error: 'text and predictedScore required' }, { status: 400 });
        }
        const postId = feedbackAgent.recordPost({
          tweetId,
          text,
          target: target || '',
          benefit: benefit || '',
          predictedScore,
          postedAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true, postId });
      }

      // メトリクス更新
      case 'update_metrics': {
        const { postId, tweetId, impressions, likes, retweets, replies, clicks, profileVisits } = params;
        if (!postId && !tweetId) {
          return NextResponse.json({ error: 'postId or tweetId required' }, { status: 400 });
        }
        const metrics = { impressions, likes, retweets, replies, clicks, profileVisits };
        if (postId) {
          feedbackAgent.updateMetrics(postId, metrics);
        } else if (tweetId) {
          feedbackAgent.updateByTweetId(tweetId, metrics);
        }
        return NextResponse.json({ success: true });
      }

      // フィードバック分析
      case 'feedback_analysis': {
        const analysis = feedbackAgent.analyzePerformance();
        const stats = feedbackAgent.getStats();
        return NextResponse.json({ success: true, analysis, stats });
      }

      // キャッシュクリア
      case 'clear_cache': {
        enhancedScout.clearCache();
        return NextResponse.json({ success: true, message: 'Cache cleared' });
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
          // Playwright系
          search_note: {
            description: 'noteで検索して記事を収集',
            params: { query: 'string (required)', maxResults: 'number', saveToMemory: 'boolean' },
          },
          scrape: {
            description: '任意のページをスクレイピング',
            params: { url: 'string (required)', selector: 'string', saveToMemory: 'boolean' },
          },
          ocr: {
            description: 'スクリーンショットからテキスト抽出',
            params: { url: 'string (required)', selector: 'string' },
          },
          // Tavily系
          trends: {
            description: 'Tavilyでトレンド検索',
            params: { industry: "'liver' | 'chatlady'" },
          },
          competitor: {
            description: '競合コンテンツリサーチ',
            params: { industry: "'liver' | 'chatlady'" },
          },
          // 統合系
          full_scout: {
            description: 'フルスカウト（Tavily + Feedback + 知識DB統合）',
            params: { industry: "'liver' | 'chatlady'" },
          },
          quick_scout: {
            description: 'クイックスカウト（キャッシュ優先・軽量）',
            params: { industry: "'liver' | 'chatlady'" },
          },
          analyze_post: {
            description: '投稿の改善分析',
            params: { post: 'string (required)', industry: "'liver' | 'chatlady'" },
          },
          // Feedback系
          record_post: {
            description: '投稿パフォーマンス記録',
            params: { text: 'string', target: 'string', benefit: 'string', predictedScore: 'number', tweetId: 'string' },
          },
          update_metrics: {
            description: 'エンゲージメントメトリクス更新',
            params: { postId: 'string', tweetId: 'string', impressions: 'number', likes: 'number', retweets: 'number', replies: 'number' },
          },
          feedback_analysis: {
            description: 'フィードバック分析・統計',
            params: {},
          },
          clear_cache: {
            description: 'スカウトキャッシュクリア',
            params: {},
          },
        },
      },
    },
  });
}

/**
 * SEOデータ定期収集API（Vercel Cron用）
 *
 * - 自サイトの検索順位チェック
 * - 競合サイトの記事スクレイピング
 * - note.comのバズ記事収集
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5分

const CRON_SECRET = process.env.CRON_SECRET || '';

// ターゲットキーワード
const TARGET_KEYWORDS = [
  'チャットレディ 求人',
  'チャットレディ 稼げる',
  'チャットレディ 副業',
  'チャトレ 稼ぐ コツ',
  'ライブチャット 高収入',
];

// 競合ドメイン
const COMPETITOR_DOMAINS = [
  'chatladybaito.com',
  'chatlady-navi.com',
  'chatladyjob.com',
];

interface RankingResult {
  keyword: string;
  ourPosition: number | null;
  topResults: { position: number; domain: string; title: string }[];
  checkedAt: string;
}

interface SEOCollectionReport {
  lastCollected: string;
  rankings: RankingResult[];
  noteArticles: {
    keyword: string;
    articles: { title: string; url: string; likes: number }[];
  }[];
  summary: {
    keywordsChecked: number;
    avgOurPosition: number | null;
    noteArticlesCollected: number;
  };
}

// Jina AI Readerで検索結果を取得
async function checkSearchRanking(keyword: string): Promise<RankingResult> {
  try {
    const searchUrl = `https://www.google.co.jp/search?q=${encodeURIComponent(keyword)}&num=20&hl=ja`;
    const jinaUrl = `https://r.jina.ai/${searchUrl}`;

    const response = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain' },
    });

    if (!response.ok) {
      console.log(`[SEO-Cron] Search failed for "${keyword}": ${response.status}`);
      return {
        keyword,
        ourPosition: null,
        topResults: [],
        checkedAt: new Date().toISOString(),
      };
    }

    const text = await response.text();
    const topResults: { position: number; domain: string; title: string }[] = [];
    let ourPosition: number | null = null;

    // URLパターンを検出
    const urlPattern = /https?:\/\/([^\/\s\]]+)/g;
    const seenDomains = new Set<string>();
    let position = 1;

    let match;
    while ((match = urlPattern.exec(text)) !== null) {
      const domain = match[1].replace('www.', '');

      // Google関連ドメインを除外
      if (seenDomains.has(domain) ||
          domain.includes('google') ||
          domain.includes('gstatic') ||
          domain.includes('googleapis')) {
        continue;
      }

      seenDomains.add(domain);

      // 自サイトチェック
      if (domain.includes('ms-livechat')) {
        ourPosition = position;
      }

      // 上位10件を記録
      if (position <= 10) {
        topResults.push({
          position,
          domain,
          title: '', // 簡易版ではタイトル取得省略
        });
      }

      position++;
      if (position > 20) break;
    }

    return {
      keyword,
      ourPosition,
      topResults,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[SEO-Cron] Error checking "${keyword}":`, error);
    return {
      keyword,
      ourPosition: null,
      topResults: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

// note.comの人気記事を取得
async function fetchNotePopularArticles(keyword: string): Promise<{ title: string; url: string; likes: number }[]> {
  const articles: { title: string; url: string; likes: number }[] = [];

  try {
    const searchUrl = `https://note.com/api/v2/search?q=${encodeURIComponent(keyword)}&size=20&start=0`;
    const response = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.log(`[SEO-Cron] Note search failed: ${response.status}`);
      return articles;
    }

    const data = await response.json();
    const notes = data?.data?.notes || [];

    for (const note of notes) {
      const likes = note.likeCount || 0;
      if (likes >= 10) { // スキ10以上のみ
        articles.push({
          title: note.name || '無題',
          url: `https://note.com/${note.user?.urlname}/n/${note.key}`,
          likes,
        });
      }
    }

    // スキ数順にソート
    articles.sort((a, b) => b.likes - a.likes);
    return articles.slice(0, 10);
  } catch (error) {
    console.error(`[SEO-Cron] Note fetch error for "${keyword}":`, error);
    return articles;
  }
}

// GET: SEOデータ収集（Cron実行用）
export async function GET(request: NextRequest) {
  // 認証チェック
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.nextUrl.searchParams.get('secret');

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[SEO-Cron] Starting SEO data collection...');

  try {
    const rankings: RankingResult[] = [];
    const noteArticles: { keyword: string; articles: { title: string; url: string; likes: number }[] }[] = [];

    // キーワードごとに順位チェック
    for (const keyword of TARGET_KEYWORDS) {
      console.log(`[SEO-Cron] Checking: ${keyword}`);

      // 検索順位チェック
      const ranking = await checkSearchRanking(keyword);
      rankings.push(ranking);

      // note.com記事収集
      const notes = await fetchNotePopularArticles(keyword);
      if (notes.length > 0) {
        noteArticles.push({ keyword, articles: notes });
      }

      // レート制限対策: 5秒待機
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // サマリー計算
    const ourPositions = rankings
      .map(r => r.ourPosition)
      .filter((p): p is number => p !== null);

    const avgPosition = ourPositions.length > 0
      ? Math.round((ourPositions.reduce((a, b) => a + b, 0) / ourPositions.length) * 10) / 10
      : null;

    const totalNoteArticles = noteArticles.reduce((sum, n) => sum + n.articles.length, 0);

    // レポート作成
    const report: SEOCollectionReport = {
      lastCollected: new Date().toISOString(),
      rankings,
      noteArticles,
      summary: {
        keywordsChecked: TARGET_KEYWORDS.length,
        avgOurPosition: avgPosition,
        noteArticlesCollected: totalNoteArticles,
      },
    };

    // 保存
    const reportPath = path.join(process.cwd(), 'knowledge', 'seo_collection.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    const processingTime = Date.now() - startTime;
    console.log(`[SEO-Cron] Completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      processingTime,
      summary: report.summary,
      rankings: rankings.map(r => ({
        keyword: r.keyword,
        ourPosition: r.ourPosition,
      })),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SEO-Cron] Error:', error);
    return NextResponse.json({
      error: errorMessage,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * SEO検索パフォーマンスAPI
 *
 * Google Search Console APIを使用して自サイトの検索パフォーマンスを取得
 * + 競合サイトの検索順位をチェック
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

// SEOデータの型定義
interface SearchPerformanceData {
  date: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface SEOReport {
  siteUrl: string;
  lastUpdated: string;
  summary: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  };
  topQueries: SearchPerformanceData[];
  topPages: SearchPerformanceData[];
  competitorRankings: CompetitorRanking[];
}

interface CompetitorRanking {
  keyword: string;
  ourPosition: number | null;
  competitors: {
    domain: string;
    position: number;
    title: string;
  }[];
  checkedAt: string;
}

// Google Search Console API（サービスアカウント使用時）
// 注: 初回は手動でSearch Consoleにサイトを登録し、サービスアカウントに権限を付与する必要あり

// 競合キーワードリスト
const TARGET_KEYWORDS = [
  'チャットレディ 求人',
  'チャットレディ 稼げる',
  'チャットレディ 副業',
  'チャットレディ 在宅',
  'チャットレディ 未経験',
  'チャットレディ 事務所',
  'チャトレ 稼ぐ',
  'ライブチャット 求人',
  '高収入 在宅 女性',
];

// 競合サイトリスト
const COMPETITOR_DOMAINS = [
  'chatladybaito.com',
  'chatlady-navi.com',
  'chatladyjob.com',
  'chatlady-work.jp',
];

// Google検索結果をスクレイピング（無料代替）
async function checkSearchRanking(keyword: string): Promise<CompetitorRanking> {
  try {
    // Jina AI Readerを使ってGoogle検索結果を取得
    const searchUrl = `https://www.google.co.jp/search?q=${encodeURIComponent(keyword)}&num=20&hl=ja`;
    const jinaUrl = `https://r.jina.ai/${searchUrl}`;

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
      },
    });

    if (!response.ok) {
      console.log(`[SEO] Search check failed for "${keyword}": ${response.status}`);
      return {
        keyword,
        ourPosition: null,
        competitors: [],
        checkedAt: new Date().toISOString(),
      };
    }

    const text = await response.text();

    // 検索結果からドメインと順位を抽出
    const competitors: { domain: string; position: number; title: string }[] = [];
    let ourPosition: number | null = null;

    // URLパターンを検出
    const urlPattern = /https?:\/\/([^\/\s]+)/g;
    const matches = text.matchAll(urlPattern);

    let position = 1;
    const seenDomains = new Set<string>();

    for (const match of matches) {
      const domain = match[1].replace('www.', '');

      // 重複とGoogle関連ドメインを除外
      if (seenDomains.has(domain) ||
          domain.includes('google') ||
          domain.includes('youtube') ||
          domain.includes('gstatic') ||
          domain.includes('googleapis')) {
        continue;
      }

      seenDomains.add(domain);

      // 自サイトチェック（ms-livechat.com）
      if (domain.includes('ms-livechat')) {
        ourPosition = position;
      }

      // 競合サイトチェック
      if (COMPETITOR_DOMAINS.some(comp => domain.includes(comp.replace('www.', '')))) {
        competitors.push({
          domain,
          position,
          title: '', // Jina経由では正確なタイトル取得が難しい
        });
      }

      position++;
      if (position > 20) break; // 上位20件まで
    }

    return {
      keyword,
      ourPosition,
      competitors,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[SEO] Error checking "${keyword}":`, error);
    return {
      keyword,
      ourPosition: null,
      competitors: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

// SEOレポートを保存
async function saveSEOReport(report: SEOReport): Promise<void> {
  const reportPath = path.join(process.cwd(), 'knowledge', 'seo_performance.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
}

// SEOレポートを読み込み
async function loadSEOReport(): Promise<SEOReport | null> {
  const reportPath = path.join(process.cwd(), 'knowledge', 'seo_performance.json');
  try {
    const data = await fs.readFile(reportPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// GET: 現在のSEOレポートを取得
export async function GET() {
  try {
    const report = await loadSEOReport();

    if (!report) {
      return NextResponse.json({
        message: 'No SEO report found. Run POST to collect data.',
        targetKeywords: TARGET_KEYWORDS,
        competitorDomains: COMPETITOR_DOMAINS,
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST: SEOデータを収集
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { keywords = TARGET_KEYWORDS.slice(0, 5) } = body; // デフォルトは上位5キーワード

    console.log('[SEO] Starting search performance collection...');
    console.log(`[SEO] Checking ${keywords.length} keywords`);

    // 競合順位チェック（レート制限を考慮して順次実行）
    const competitorRankings: CompetitorRanking[] = [];

    for (const keyword of keywords) {
      console.log(`[SEO] Checking: ${keyword}`);
      const ranking = await checkSearchRanking(keyword);
      competitorRankings.push(ranking);

      // レート制限対策: 3秒待機
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // レポート作成
    const report: SEOReport = {
      siteUrl: 'https://ms-livechat.com',
      lastUpdated: new Date().toISOString(),
      summary: {
        totalClicks: 0, // Search Console API連携時に取得
        totalImpressions: 0,
        avgCtr: 0,
        avgPosition: 0,
      },
      topQueries: [], // Search Console API連携時に取得
      topPages: [],
      competitorRankings,
    };

    // 自サイト順位のサマリー計算
    const ourPositions = competitorRankings
      .map(r => r.ourPosition)
      .filter((p): p is number => p !== null);

    if (ourPositions.length > 0) {
      report.summary.avgPosition =
        Math.round((ourPositions.reduce((a, b) => a + b, 0) / ourPositions.length) * 10) / 10;
    }

    // 保存
    await saveSEOReport(report);

    const processingTime = Date.now() - startTime;
    console.log(`[SEO] Completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      processingTime,
      keywordsChecked: keywords.length,
      ourRankings: competitorRankings.map(r => ({
        keyword: r.keyword,
        position: r.ourPosition,
      })),
      summary: report.summary,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SEO] Error:', error);
    return NextResponse.json({
      error: errorMessage,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * 競合サイト記事スクレイピングAPI
 *
 * チャトレ・海外チャトレ関連の競合サイト記事を収集
 * - 国内チャトレブログ
 * - 海外チャトレ（Stripchat, Chaturbate, DXLIVE等）
 * - Note記事
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/model';

export const runtime = 'nodejs';
export const maxDuration = 120;

// 競合サイト定義
const COMPETITOR_SOURCES = {
  domestic_chatlady: {
    name: '国内チャトレブログ',
    description: 'チャットレディ関連の国内ブログ・情報サイト',
    searchQueries: [
      'チャットレディ 始め方 稼ぐ',
      'チャトレ 月収 体験談',
      'チャットレディ 安全 身バレ',
      'チャトレ 初心者 コツ',
      'チャットレディ 事務所 比較',
    ],
  },
  stripchat: {
    name: 'Stripchat関連',
    description: '海外チャトレ Stripchat の情報',
    searchQueries: [
      'Stripchat 稼ぎ方 日本人',
      'ストリップチャット 始め方',
      'Stripchat 報酬 仕組み',
      'ストチャ チャトレ 体験談',
    ],
  },
  fc2: {
    name: 'FC2ライブチャット関連',
    description: 'FC2ライブチャットの情報',
    searchQueries: [
      'FC2ライブチャット 稼ぐ',
      'FC2チャトレ 始め方',
      'FC2ライブ 報酬 仕組み',
    ],
  },
  fc2_lovechip: {
    name: 'FC2ラブチップ関連',
    description: 'FC2ラブチップの情報',
    searchQueries: [
      'FC2ラブチップ 稼ぐ',
      'ラブチップ チャトレ',
      'FC2ラブチップ 報酬',
    ],
  },
  dxlive: {
    name: 'DXLIVE関連',
    description: '海外チャトレ DXLIVE の情報',
    searchQueries: [
      'DXLIVE チャトレ 稼ぐ',
      'DXLIVE 報酬 体験談',
    ],
  },
  note: {
    name: 'Note記事',
    description: 'Noteのチャトレ関連記事',
    searchQueries: [
      'site:note.com チャットレディ',
      'site:note.com チャトレ 稼ぐ',
      'site:note.com 海外チャトレ',
      'site:note.com ストリップチャット',
    ],
  },
};

// 記事ストックの型
interface CompetitorArticle {
  id: string;
  source: string;
  title: string;
  url: string;
  excerpt: string;
  content: string;
  keywords: string[];
  scrapedAt: string;
}

interface CompetitorStock {
  description: string;
  lastUpdated: string;
  config: {
    maxArticles: number;
    retentionDays: number;
  };
  sources: Record<string, {
    name: string;
    articles: CompetitorArticle[];
  }>;
}

// URLからコンテンツを取得
async function fetchArticleContent(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    // タイトル抽出
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // メインコンテンツ抽出（簡易版）
    let content = '';

    // article タグ内を優先
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    } else {
      // main タグ
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      if (mainMatch) {
        content = mainMatch[1];
      } else {
        // body タグ
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          content = bodyMatch[1];
        }
      }
    }

    // HTMLタグを除去
    content = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 最初の5000文字に制限
    content = content.substring(0, 5000);

    return { title, content };
  } catch (error) {
    console.error(`[Scrape] Failed to fetch ${url}:`, error);
    return null;
  }
}

// Jina AI Readerで記事本文を取得
async function fetchWithJina(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
      },
    });

    if (!response.ok) {
      console.log(`[Scrape] Jina fetch failed for ${url}: ${response.status}`);
      return null;
    }

    const text = await response.text();

    // タイトルを抽出（最初の行がタイトルになることが多い）
    const lines = text.split('\n').filter(line => line.trim());
    const title = lines[0]?.replace(/^#\s*/, '').trim() || '';

    // 本文（タイトル以降）
    const content = lines.slice(1).join('\n').trim();

    return { title, content: content.substring(0, 5000) };
  } catch (error) {
    console.error(`[Scrape] Jina error for ${url}:`, error);
    return null;
  }
}

// note.comの記事をスキ数付きで取得
async function fetchNoteArticles(keyword: string): Promise<CompetitorArticle[]> {
  const articles: CompetitorArticle[] = [];

  try {
    // note.com APIでハッシュタグ検索
    const searchUrl = `https://note.com/api/v2/search?q=${encodeURIComponent(keyword)}&size=10&start=0`;
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`[Scrape] Note search failed: ${response.status}`);
      return articles;
    }

    const data = await response.json();
    const notes = data?.data?.notes || [];

    for (const note of notes.slice(0, 5)) {
      // スキ数をエンゲージメント指標として使用
      const likeCount = note.likeCount || 0;

      // 一定以上のスキ数のみ収集
      if (likeCount < 10) continue;

      const noteUrl = `https://note.com/${note.user?.urlname}/n/${note.key}`;

      // Jina AI Readerで本文取得
      const content = await fetchWithJina(noteUrl);
      if (!content || content.content.length < 100) continue;

      articles.push({
        id: `note_${note.id}_${Date.now()}`,
        source: 'note',
        title: note.name || content.title,
        url: noteUrl,
        excerpt: (note.body || content.content).substring(0, 200),
        content: content.content,
        keywords: [keyword, `スキ${likeCount}`],
        scrapedAt: new Date().toISOString(),
        engagement: likeCount, // エンゲージメント指標追加
      } as CompetitorArticle & { engagement: number });

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error('[Scrape] Note fetch error:', error);
  }

  return articles;
}

// Google検索結果からURLを抽出（Jina経由）
async function searchArticles(query: string): Promise<string[]> {
  try {
    const searchUrl = `https://www.google.co.jp/search?q=${encodeURIComponent(query)}&num=10&hl=ja`;
    const jinaUrl = `https://r.jina.ai/${searchUrl}`;

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
      },
    });

    if (!response.ok) {
      console.log(`[Scrape] Search failed: ${response.status}`);
      return [];
    }

    const text = await response.text();

    // URLを抽出
    const urlPattern = /https?:\/\/[^\s\])\n]+/g;
    const matches = text.match(urlPattern) || [];

    // Google関連のURLを除外
    const filteredUrls = matches.filter(url =>
      !url.includes('google.') &&
      !url.includes('gstatic.') &&
      !url.includes('googleapis.') &&
      !url.includes('youtube.') &&
      !url.includes('schema.org')
    );

    console.log(`[Scrape] Found ${filteredUrls.length} URLs for: ${query}`);
    return [...new Set(filteredUrls)].slice(0, 5);
  } catch (error) {
    console.error(`[Scrape] Search error for "${query}":`, error);
    return [];
  }
}

// AIで記事を要約・キーワード抽出
async function analyzeArticle(title: string, content: string): Promise<{ excerpt: string; keywords: string[] }> {
  try {
    const result = await generateText({
      model: getModel(),
      system: `あなたは記事分析の専門家です。以下の記事を分析してください。`,
      prompt: `以下の記事を分析して、JSON形式で返してください。

タイトル: ${title}
本文: ${content.substring(0, 2000)}

出力形式:
{
  "excerpt": "記事の要約（200文字以内）",
  "keywords": ["キーワード1", "キーワード2", "キーワード3"]
}

JSONのみを出力してください。`,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Scrape] AI analysis failed:', error);
  }

  return {
    excerpt: content.substring(0, 200),
    keywords: [],
  };
}

// サンプル記事（手動追加用）
function getSampleArticles(): CompetitorArticle[] {
  return [
    {
      id: `sample_domestic_${Date.now()}_1`,
      source: 'domestic_chatlady',
      title: 'チャットレディの始め方完全ガイド｜初心者でも月10万円稼ぐコツ',
      url: 'https://example.com/chatlady-guide',
      excerpt: 'チャットレディを始めたい方向けの完全ガイド。未経験でも安心して始められる方法と、月10万円以上稼ぐためのコツを解説。',
      content: `チャットレディとは、パソコンやスマホを使ってお客様とチャットするお仕事です。

【チャットレディのメリット】
・在宅で働ける
・好きな時間に働ける
・高収入が期待できる
・特別なスキル不要

【始め方】
1. 事務所を選ぶ
2. 登録・面接
3. 機材の準備
4. プロフィール作成
5. 配信開始

【稼ぐコツ】
・笑顔を大切に
・聞き上手になる
・定期的にログイン
・プロフィールを充実させる`,
      keywords: ['チャットレディ', '始め方', '月10万'],
      scrapedAt: new Date().toISOString(),
    },
    {
      id: `sample_stripchat_${Date.now()}_1`,
      source: 'stripchat',
      title: 'Stripchatで日本人が稼ぐ方法｜海外サイトのメリットとデメリット',
      url: 'https://example.com/stripchat-japan',
      excerpt: 'Stripchatは世界最大級のライブチャットサイト。日本人パフォーマーが稼ぐためのコツとメリット・デメリットを解説。',
      content: `Stripchat（ストリップチャット）は、世界中のパフォーマーが配信するライブチャットサイトです。

【Stripchatの特徴】
・世界最大級のユーザー数
・日本人パフォーマーの需要が高い
・報酬率が高い（最大60%）
・チップ制で稼ぎやすい

【稼ぐコツ】
・プロフィールを英語で作成
・配信時間は欧米のゴールデンタイムを狙う
・チップメニューを設定
・常連客を大切にする

【デメリット】
・英語でのコミュニケーション
・海外サイトなので規約が複雑
・換金に時間がかかる場合がある`,
      keywords: ['Stripchat', '海外チャトレ', '報酬率'],
      scrapedAt: new Date().toISOString(),
    },
    {
      id: `sample_fc2_${Date.now()}_1`,
      source: 'fc2',
      title: 'FC2ライブチャットの始め方と稼ぎ方｜国内最大級サイトで月20万',
      url: 'https://example.com/fc2-live-guide',
      excerpt: 'FC2ライブチャットで稼ぐための完全ガイド。登録方法から報酬の仕組み、効率的に稼ぐテクニックまで解説。',
      content: `FC2ライブチャットは、国内最大級のライブチャットサイトです。

【FC2ライブの特徴】
・国内最大級のユーザー数
・日本語対応
・ポイント制
・報酬率は50%程度

【登録方法】
1. FC2アカウント作成
2. ライブ配信者登録
3. 身分証明書を提出
4. 承認後、配信開始

【稼ぐテクニック】
・ゴールデンタイムに配信
・常連さんを大切に
・プロフィールを充実
・定期的に配信`,
      keywords: ['FC2ライブ', 'チャトレ', '月20万'],
      scrapedAt: new Date().toISOString(),
    },
    {
      id: `sample_fc2_lovechip_${Date.now()}_1`,
      source: 'fc2_lovechip',
      title: 'FC2ラブチップとは？通常FC2との違いと稼ぎ方を徹底解説',
      url: 'https://example.com/fc2-lovechip-guide',
      excerpt: 'FC2ラブチップは投げ銭型のライブチャット。通常のFC2ライブとの違いや、効率的に稼ぐコツを解説。',
      content: `FC2ラブチップは、投げ銭（チップ）型のライブチャットサービスです。

【FC2ラブチップの特徴】
・チップ制で稼ぎやすい
・視聴者が多い
・アダルト・ノンアダルト両方OK
・報酬率が高め

【通常FC2との違い】
・ポイント制 vs チップ制
・視聴者層が異なる
・稼ぎ方のアプローチが違う

【稼ぐコツ】
・チップメニューを設定
・リクエストに応える
・ファンを増やす
・SNSで告知`,
      keywords: ['FC2ラブチップ', 'チップ制', '投げ銭'],
      scrapedAt: new Date().toISOString(),
    },
    {
      id: `sample_dxlive_${Date.now()}_1`,
      source: 'dxlive',
      title: 'DXLIVEとは？日本人向け海外チャトレサイトの特徴と稼ぎ方',
      url: 'https://example.com/dxlive-info',
      excerpt: 'DXLIVEは日本人向けの海外チャトレサイト。報酬の仕組みや他サイトとの違い、効率的な稼ぎ方を解説。',
      content: `DXLIVE（ディーエックスライブ）は、日本人向けの海外ライブチャットサイトです。

【DXLIVEの特徴】
・日本語対応
・日本人ユーザーが多い
・報酬は分単位
・身バレリスクが低い

【報酬システム】
・1分あたり30-50円
・パーティーチャット、2ショットなど
・ボーナス制度あり

【メリット】
・日本語OK
・サポートが充実
・安定した報酬

【デメリット】
・報酬率は国内サイトと同程度
・競争が激しい`,
      keywords: ['DXLIVE', '日本人向け', '海外チャトレ'],
      scrapedAt: new Date().toISOString(),
    },
    {
      id: `sample_note_${Date.now()}_1`,
      source: 'note',
      title: '【体験談】チャットレディで月30万稼いだ私の1日のスケジュール',
      url: 'https://note.com/example/chatlady-schedule',
      excerpt: '実際にチャットレディとして月30万円稼いでいる私の1日のスケジュールと、効率的に稼ぐためのコツを公開。',
      content: `こんにちは。チャットレディ歴2年の〇〇です。

今回は、月30万円稼いでいる私の1日のスケジュールを公開します。

【私の1日】
8:00 起床、朝食
10:00-12:00 午前の配信（2時間）
12:00-13:00 昼食・休憩
14:00-17:00 午後の配信（3時間）
17:00-19:00 夕食・家事
21:00-24:00 夜の配信（3時間）

合計8時間の配信で、平均日給1万円くらい。

【稼ぐコツ】
・常連さんを大切にする
・プロフィールは定期的に更新
・体調管理が大切
・無理のない範囲で`,
      keywords: ['体験談', '月30万', 'スケジュール'],
      scrapedAt: new Date().toISOString(),
    },
  ];
}

// POST: 競合記事をスクレイピング
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const {
      sources: targetSources = Object.keys(COMPETITOR_SOURCES),
      urls = [] as string[],
      useSamples = true,
    } = body;

    console.log('[Scrape] Starting competitor articles collection...');
    console.log(`[Scrape] Target sources: ${targetSources.join(', ')}`);

    // 既存のストックを読み込み
    const stockPath = path.join(process.cwd(), 'knowledge', 'competitor_articles.json');
    let stock: CompetitorStock;

    try {
      stock = JSON.parse(await fs.readFile(stockPath, 'utf-8'));
    } catch {
      stock = {
        description: '競合サイト記事ストック（チャトレ・海外チャトレ関連）',
        lastUpdated: new Date().toISOString(),
        config: {
          maxArticles: 200,
          retentionDays: 90,
        },
        sources: {},
      };
    }

    let addedCount = 0;
    const results: Record<string, number> = {};

    // 各ソースを処理
    for (const sourceKey of targetSources) {
      const sourceConfig = COMPETITOR_SOURCES[sourceKey as keyof typeof COMPETITOR_SOURCES];
      if (!sourceConfig) continue;

      // ソースがなければ初期化
      if (!stock.sources[sourceKey]) {
        stock.sources[sourceKey] = {
          name: sourceConfig.name,
          articles: [],
        };
      }

      // サンプル記事を追加
      if (useSamples) {
        const samples = getSampleArticles().filter(a => a.source === sourceKey);
        const existingIds = new Set(stock.sources[sourceKey].articles.map(a => a.id));

        for (const sample of samples) {
          const isDuplicate = stock.sources[sourceKey].articles.some(
            a => a.title === sample.title || a.url === sample.url
          );

          if (!isDuplicate && !existingIds.has(sample.id)) {
            stock.sources[sourceKey].articles.push(sample);
            addedCount++;
          }
        }
      }

      // 指定URLからスクレイピング
      for (const url of urls) {
        const articleContent = await fetchArticleContent(url);
        if (articleContent && articleContent.content.length > 100) {
          const analysis = await analyzeArticle(articleContent.title, articleContent.content);

          const article: CompetitorArticle = {
            id: `scraped_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            source: sourceKey,
            title: articleContent.title,
            url,
            excerpt: analysis.excerpt,
            content: articleContent.content,
            keywords: analysis.keywords,
            scrapedAt: new Date().toISOString(),
          };

          // 重複チェック
          const isDuplicate = stock.sources[sourceKey].articles.some(
            a => a.url === url || a.title === articleContent.title
          );

          if (!isDuplicate) {
            stock.sources[sourceKey].articles.push(article);
            addedCount++;
          }
        }
      }

      // 最大件数に制限
      const maxPerSource = Math.floor(stock.config.maxArticles / Object.keys(COMPETITOR_SOURCES).length);
      stock.sources[sourceKey].articles = stock.sources[sourceKey].articles.slice(0, maxPerSource);

      results[sourceKey] = stock.sources[sourceKey].articles.length;
    }

    // 更新日時を更新
    stock.lastUpdated = new Date().toISOString();

    // 保存
    await fs.writeFile(stockPath, JSON.stringify(stock, null, 2), 'utf-8');

    const processingTime = Date.now() - startTime;

    console.log(`[Scrape] Completed in ${processingTime}ms, added ${addedCount} articles`);

    return NextResponse.json({
      success: true,
      addedCount,
      totalBySource: results,
      processingTime,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Scrape] Error:', error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

// GET: 現在の競合記事ストック状況を取得
export async function GET() {
  try {
    const stockPath = path.join(process.cwd(), 'knowledge', 'competitor_articles.json');
    const stock: CompetitorStock = JSON.parse(await fs.readFile(stockPath, 'utf-8'));

    const summary = Object.entries(stock.sources).map(([key, source]) => ({
      source: key,
      name: source.name,
      count: source.articles.length,
      latestArticle: source.articles[0]?.title || 'なし',
    }));

    return NextResponse.json({
      lastUpdated: stock.lastUpdated,
      totalArticles: Object.values(stock.sources).reduce((sum, s) => sum + s.articles.length, 0),
      sources: summary,
      availableSources: Object.keys(COMPETITOR_SOURCES),
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to read competitor stock',
      availableSources: Object.keys(COMPETITOR_SOURCES),
    }, { status: 500 });
  }
}

/**
 * ストックしたバズ投稿からネタ・テーマを抽出して投稿生成
 *
 * フロー:
 * 1. buzz_stock.jsonから今日使うネタを選定
 * 2. そのネタをライバー/チャトレ向けにアレンジして投稿生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const BUZZ_STOCK_PATH = path.join(process.cwd(), 'knowledge', 'buzz_stock.json');
const ACCOUNTS_PATH = path.join(process.cwd(), 'knowledge', 'account_personas.json');

interface BuzzPost {
  id: string;
  text: string;
  engagement: number;
  whyWorks: string;
  topics: string[];
  author: string;
  addedAt: string;
}

interface BuzzStock {
  genres: {
    [key: string]: {
      name: string;
      posts: BuzzPost[];
    };
  };
}

/**
 * POST: ストックからネタを選んで投稿生成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      accountId = 'mic_chat_',
      postCount = 3,
      preferredGenres = ['career', 'sideBusiness', 'mental', 'lifeLesson', 'mindset'],
    } = body;

    // buzz_stock.json読み込み
    let buzzStock: BuzzStock;
    try {
      const content = await fs.readFile(BUZZ_STOCK_PATH, 'utf-8');
      buzzStock = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'buzz_stock.json not found. Run daily-buzz-scraper.js first.' },
        { status: 404 }
      );
    }

    // アカウント情報読み込み
    let accounts;
    try {
      const content = await fs.readFile(ACCOUNTS_PATH, 'utf-8');
      accounts = JSON.parse(content);
    } catch {
      accounts = { accounts: [] };
    }

    const account = accounts.accounts?.find((a: { id: string }) => a.id === accountId) || {
      id: accountId,
      displayName: 'チャトレ事務所',
      tone: '優しく寄り添う',
      industry: 'チャットレディ事務所',
    };

    // 各ジャンルからネタを選定
    const selectedPosts: Array<BuzzPost & { genre: string; genreName: string }> = [];

    for (const genre of preferredGenres) {
      if (!buzzStock.genres[genre]) continue;
      const posts = buzzStock.genres[genre].posts;
      if (posts.length === 0) continue;

      // エンゲージメント上位から1つ選択（ランダム性も入れる）
      const topPosts = posts.slice(0, 5);
      const randomIndex = Math.floor(Math.random() * topPosts.length);
      selectedPosts.push({
        ...topPosts[randomIndex],
        genre,
        genreName: buzzStock.genres[genre].name,
      });
    }

    if (selectedPosts.length === 0) {
      return NextResponse.json(
        { error: 'No posts found in stock. Run daily-buzz-scraper.js first.' },
        { status: 404 }
      );
    }

    // 必要な数だけ選択
    const postsToUse = selectedPosts.slice(0, postCount);

    // 各ネタから投稿を生成
    const generatedPosts = [];

    // Gemini モデル初期化
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.8, maxOutputTokens: 256 },
    });

    for (const sourcePost of postsToUse) {
      const prompt = buildPrompt(sourcePost, account);

      try {
        const result = await model.generateContent(prompt);
        const generatedText = result.response.text();

        generatedPosts.push({
          source: {
            id: sourcePost.id,
            genre: sourcePost.genreName,
            topics: sourcePost.topics || [],
            whyWorks: sourcePost.whyWorks || 'バイラル',
            originalText: (sourcePost.text || '').substring(0, 100) + '...',
            engagement: sourcePost.engagement || 0,
          },
          generated: {
            text: generatedText,
            type: detectPostType(generatedText),
          },
        });
      } catch (error) {
        console.error('[FromStock] Generation error:', error);
        generatedPosts.push({
          source: {
            id: sourcePost.id,
            genre: sourcePost.genreName,
          },
          error: 'Generation failed',
        });
      }
    }

    return NextResponse.json({
      success: true,
      accountId,
      generated: generatedPosts,
      stats: {
        stockSize: Object.values(buzzStock.genres).reduce((sum, g) => sum + g.posts.length, 0),
        usedPosts: postsToUse.length,
      },
    });
  } catch (error) {
    console.error('[FromStock] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate from stock', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * プロンプト構築
 */
function buildPrompt(sourcePost: BuzzPost & { genre: string; genreName: string }, account: { displayName: string; tone: string; industry: string }): string {
  return `あなたは${account.industry}のSNS担当です。

以下のバズった投稿を参考に、${account.displayName}の投稿を1つ作成してください。

## 参考にするバズ投稿
ジャンル: ${sourcePost.genreName}
エンゲージメント: ${sourcePost.engagement}
バズった理由: ${sourcePost.whyWorks || 'バイラル'}
キーワード: ${(sourcePost.topics || []).join(', ') || 'なし'}

投稿内容:
"""
${sourcePost.text}
"""

## あなたが作る投稿の条件
- 事務所の公式アカウントとして発信（「私」は使わない、「うちの事務所」「チャトレって」など）
- 参考投稿の「構造」と「テーマ」を活かす（パクリではなくアレンジ）
- ${account.industry}で働く女性に刺さる内容に変換
- ${account.tone}な文体
- 絵文字は控えめに（0〜1個）
- 100-120文字（Xタイムラインで全文表示される長さ）
- 存在しないサービスや機能は言及しない

## バズ要素を引き継ぐ
${(sourcePost.whyWorks || '').includes('数字') ? '- 具体的な数字を入れる' : ''}
${(sourcePost.whyWorks || '').includes('リスト') ? '- リスト形式（箇条書き）で見やすく' : ''}
${(sourcePost.whyWorks || '').includes('本音') ? '- 本音っぽいフックを入れる（「ぶっちゃけ」「正直」など）' : ''}
${(sourcePost.whyWorks || '').includes('問いかけ') ? '- 問いかけで共感を誘う' : ''}
${(sourcePost.whyWorks || '').includes('体験談') ? '- 実体験風に（「〜した結果」など）' : ''}

投稿文のみを出力:`;
}

/**
 * 投稿タイプを判定
 */
function detectPostType(text: string): string {
  if (/募集|応募|DM|お問い合わせ/.test(text)) return 'closing';
  if (/コツ|方法|秘訣|ポイント|大事/.test(text)) return 'knowhow';
  return 'trust';
}

/**
 * GET: ストック状況を確認
 */
export async function GET() {
  try {
    const content = await fs.readFile(BUZZ_STOCK_PATH, 'utf-8');
    const buzzStock = JSON.parse(content);

    const genreStats: { [key: string]: { name: string; count: number; topEngagement: number } } = {};

    for (const [key, genre] of Object.entries(buzzStock.genres) as [string, { name: string; posts: BuzzPost[] }][]) {
      genreStats[key] = {
        name: genre.name,
        count: genre.posts.length,
        topEngagement: genre.posts[0]?.engagement || 0,
      };
    }

    return NextResponse.json({
      lastUpdated: buzzStock.lastUpdated,
      stats: buzzStock.stats,
      genres: genreStats,
    });
  } catch {
    return NextResponse.json(
      { error: 'buzz_stock.json not found' },
      { status: 404 }
    );
  }
}

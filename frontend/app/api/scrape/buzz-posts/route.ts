/**
 * バズ投稿スクレイピングAPI
 *
 * 複数ジャンルのバズ投稿を収集してbuzz_stock.jsonに追加
 * - 女性向け（恋愛、美容、メンタル）
 * - お金・稼ぐ系（副業、投資、節約）
 * - ライフスタイル（在宅ワーク、自由な働き方）
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ジャンル定義
const GENRES = {
  women: {
    name: '女性向け全般',
    keywords: ['恋愛', '彼氏', '結婚', '美容', 'ダイエット', 'メンタル', '人間関係', '自己肯定感', 'HSP'],
    searchQueries: [
      '彼氏 min_faves:500',
      '恋愛 辛い min_faves:300',
      '結婚 不安 min_faves:300',
      '美容 おすすめ min_faves:500',
      'ダイエット 成功 min_faves:300',
      'メンタル 回復 min_faves:300',
      '人間関係 疲れた min_faves:500',
      '自己肯定感 低い min_faves:300',
      'HSP あるある min_faves:300',
    ],
  },
  money: {
    name: 'お金・稼ぐ系',
    keywords: ['副業', '稼ぐ', '投資', '節約', '貯金', 'お金', '収入', 'フリーランス'],
    searchQueries: [
      '副業 始めた min_faves:500',
      '稼ぐ 方法 min_faves:300',
      '投資 初心者 min_faves:300',
      '節約 コツ min_faves:300',
      '貯金 できない min_faves:300',
      'お金 不安 min_faves:500',
      '収入 増やす min_faves:300',
      'フリーランス リアル min_faves:300',
    ],
  },
  lifestyle: {
    name: 'ライフスタイル',
    keywords: ['在宅ワーク', 'リモートワーク', '働き方', '時間', '自由', '退職', '転職'],
    searchQueries: [
      '在宅ワーク 最高 min_faves:300',
      'リモートワーク メリット min_faves:300',
      '働き方 変えた min_faves:300',
      '時間 使い方 min_faves:300',
      '会社 辞めた min_faves:500',
      '退職 して min_faves:300',
      '転職 成功 min_faves:300',
    ],
  },
  mindset: {
    name: 'マインドセット',
    keywords: ['考え方', '人生', '幸せ', '成長', 'ポジティブ', '名言'],
    searchQueries: [
      '人生 変わった min_faves:500',
      '幸せ とは min_faves:300',
      '考え方 変えた min_faves:300',
      '成長 できた min_faves:300',
      '大切なこと min_faves:500',
    ],
  },
};

// バズ投稿ストックの型
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
  description: string;
  lastUpdated: string;
  config: {
    maxPosts: number;
    retentionDays: number;
  };
  genres: Record<string, {
    name: string;
    keywords: string[];
    posts: BuzzPost[];
  }>;
}

// バズ要因を分析
function analyzeWhyWorks(text: string): string {
  const factors: string[] = [];

  // 数字チェック
  if (/\d+万|\d+円|\d+%|\d+年|\d+ヶ月|\d+日/.test(text)) {
    factors.push('数字');
  }

  // リスト形式チェック
  if (/[・\-①②③④⑤🥇🥈🥉]/.test(text) || /\n.*\n.*\n/.test(text)) {
    factors.push('リスト');
  }

  // 問いかけチェック
  if (/[？?]|ですか|ませんか|思いません/.test(text)) {
    factors.push('問いかけ');
  }

  // 強調表現チェック
  if (/【|】|「|」|『|』|《|》/.test(text)) {
    factors.push('強調');
  }

  // 体験談チェック
  if (/私は|自分は|実は|正直|ぶっちゃけ/.test(text)) {
    factors.push('体験談');
  }

  // 本音フックチェック
  if (/言いたくない|怒られる|炎上|禁止|ヤバい/.test(text)) {
    factors.push('本音');
  }

  return factors.length > 0 ? factors.join('+') : '共感';
}

// トピック抽出
function extractTopics(text: string): string[] {
  const topics: string[] = [];

  // 数字関連
  const numbers = text.match(/\d+万円?|\d+%|\d+年|\d+ヶ月/g);
  if (numbers) topics.push(...numbers.slice(0, 2));

  // キーワード
  const keywords = ['副業', '転職', '在宅', '稼ぐ', 'フリーランス', '退職', '結婚', '恋愛'];
  keywords.forEach(kw => {
    if (text.includes(kw)) topics.push(kw);
  });

  return [...new Set(topics)].slice(0, 3);
}

// 手動でサンプル投稿を追加（APIがない場合のフォールバック）
function getSamplePosts(genre: string): BuzzPost[] {
  const samples: Record<string, BuzzPost[]> = {
    women: [
      {
        id: `sample_women_${Date.now()}_1`,
        text: '「私なんか」が口癖だった頃、何をしても自信が持てなかった。でも「私だから」に変えてみたら、同じ行動でも結果が変わり始めた。言葉って本当に大事。自分を下げる言葉を使い続けると、脳がそれを事実だと認識してしまう。まずは言葉から変えてみて。',
        engagement: 850,
        whyWorks: '体験談+共感',
        topics: ['自己肯定感'],
        author: 'sample',
        addedAt: new Date().toISOString(),
      },
      {
        id: `sample_women_${Date.now()}_2`,
        text: '人間関係で疲れたら「期待しない」を意識するといい。相手に期待するから裏切られた気持ちになる。期待をゼロにすると、感謝だけが残る。これ実践したら本当に楽になった。',
        engagement: 720,
        whyWorks: '体験談+問いかけ',
        topics: ['人間関係', 'メンタル'],
        author: 'sample',
        addedAt: new Date().toISOString(),
      },
    ],
    money: [
      {
        id: `sample_money_${Date.now()}_1`,
        text: '副業で月5万稼げるようになって変わったこと\n\n・「高い」と思わなくなった\n・将来の不安が減った\n・本業のストレスが軽くなった\n・選択肢が増えた\n\n金額以上に「自分で稼げる」という自信が人生を変える。',
        engagement: 1200,
        whyWorks: '数字+リスト',
        topics: ['副業', '5万'],
        author: 'sample',
        addedAt: new Date().toISOString(),
      },
      {
        id: `sample_money_${Date.now()}_2`,
        text: '貯金ゼロだった私が1年で100万貯めた方法\n\n①固定費を徹底見直し（-3万）\n②サブスク全解約（-1万）\n③自炊メイン（-2万）\n④副業開始（+5万）\n\n支出を減らすより収入を増やす方が早い。でも両方やると最強。',
        engagement: 980,
        whyWorks: '数字+リスト+体験談',
        topics: ['100万', '貯金', '副業'],
        author: 'sample',
        addedAt: new Date().toISOString(),
      },
    ],
    lifestyle: [
      {
        id: `sample_lifestyle_${Date.now()}_1`,
        text: '在宅ワーク3年目の本音\n\n良い点\n・通勤時間ゼロ\n・自分のペースで働ける\n・家事と両立しやすい\n\n悪い点\n・運動不足\n・孤独を感じる時もある\n・オンオフの切り替えが難しい\n\nでも私は二度と満員電車に乗りたくない。',
        engagement: 890,
        whyWorks: 'リスト+本音',
        topics: ['在宅ワーク', '3年'],
        author: 'sample',
        addedAt: new Date().toISOString(),
      },
    ],
    mindset: [
      {
        id: `sample_mindset_${Date.now()}_1`,
        text: '人生変えたいなら「環境」を変えるのが一番早い。\n\n・付き合う人を変える\n・住む場所を変える\n・働く場所を変える\n・情報源を変える\n\n意志の力に頼らなくていい。環境が変われば行動が変わる。行動が変われば結果が変わる。',
        engagement: 1500,
        whyWorks: 'リスト+強調',
        topics: ['人生', '環境'],
        author: 'sample',
        addedAt: new Date().toISOString(),
      },
    ],
  };

  return samples[genre] || [];
}

// POST: バズ投稿を収集
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { genres: targetGenres = Object.keys(GENRES), useSamples = true } = body;

    console.log('[Scrape] Starting buzz posts collection...');
    console.log(`[Scrape] Target genres: ${targetGenres.join(', ')}`);

    // 既存のbuzz_stock.jsonを読み込み
    const buzzPath = path.join(process.cwd(), 'knowledge', 'buzz_stock.json');
    let buzzStock: BuzzStock;

    try {
      buzzStock = JSON.parse(await fs.readFile(buzzPath, 'utf-8'));
    } catch {
      // 新規作成
      buzzStock = {
        description: '多ジャンルのバズ投稿ストック',
        lastUpdated: new Date().toISOString(),
        config: {
          maxPosts: 500,
          retentionDays: 90,
        },
        genres: {},
      };
    }

    let addedCount = 0;
    const results: Record<string, number> = {};

    // 各ジャンルを処理
    for (const genreKey of targetGenres) {
      const genreConfig = GENRES[genreKey as keyof typeof GENRES];
      if (!genreConfig) continue;

      // ジャンルがなければ初期化
      if (!buzzStock.genres[genreKey]) {
        buzzStock.genres[genreKey] = {
          name: genreConfig.name,
          keywords: genreConfig.keywords,
          posts: [],
        };
      }

      // サンプル投稿を追加（APIがない場合）
      if (useSamples) {
        const samples = getSamplePosts(genreKey);
        const existingIds = new Set(buzzStock.genres[genreKey].posts.map(p => p.id));

        for (const sample of samples) {
          // 重複チェック（テキストの最初の50文字で比較）
          const isDuplicate = buzzStock.genres[genreKey].posts.some(
            p => p.text.substring(0, 50) === sample.text.substring(0, 50)
          );

          if (!isDuplicate && !existingIds.has(sample.id)) {
            buzzStock.genres[genreKey].posts.push(sample);
            addedCount++;
          }
        }
      }

      // エンゲージメント順にソート
      buzzStock.genres[genreKey].posts.sort((a, b) => b.engagement - a.engagement);

      // 最大件数に制限
      const maxPerGenre = Math.floor(buzzStock.config.maxPosts / Object.keys(GENRES).length);
      buzzStock.genres[genreKey].posts = buzzStock.genres[genreKey].posts.slice(0, maxPerGenre);

      results[genreKey] = buzzStock.genres[genreKey].posts.length;
    }

    // 更新日時を更新
    buzzStock.lastUpdated = new Date().toISOString();

    // 保存
    await fs.writeFile(buzzPath, JSON.stringify(buzzStock, null, 2), 'utf-8');

    const processingTime = Date.now() - startTime;

    console.log(`[Scrape] Completed in ${processingTime}ms, added ${addedCount} posts`);

    return NextResponse.json({
      success: true,
      addedCount,
      totalByGenre: results,
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

// GET: 現在のバズ投稿ストック状況を取得
export async function GET() {
  try {
    const buzzPath = path.join(process.cwd(), 'knowledge', 'buzz_stock.json');
    const buzzStock: BuzzStock = JSON.parse(await fs.readFile(buzzPath, 'utf-8'));

    const summary = Object.entries(buzzStock.genres).map(([key, genre]) => ({
      genre: key,
      name: genre.name,
      count: genre.posts.length,
      topEngagement: genre.posts[0]?.engagement || 0,
      avgEngagement: Math.round(
        genre.posts.reduce((sum, p) => sum + p.engagement, 0) / (genre.posts.length || 1)
      ),
    }));

    return NextResponse.json({
      lastUpdated: buzzStock.lastUpdated,
      totalPosts: Object.values(buzzStock.genres).reduce((sum, g) => sum + g.posts.length, 0),
      genres: summary,
      availableGenres: Object.keys(GENRES),
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to read buzz stock',
      availableGenres: Object.keys(GENRES),
    }, { status: 500 });
  }
}

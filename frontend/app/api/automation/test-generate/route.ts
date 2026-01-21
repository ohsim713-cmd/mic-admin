/**
 * テスト生成API
 *
 * 複数パターンを生成して比較用に返す
 * 実際には投稿しない（dryRun専用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/model';
import { AccountType, ACCOUNTS } from '@/lib/dm-hunter/sns-adapter';
import { promises as fs } from 'fs';
import path from 'path';

// アカウント別の禁止ワード
const FORBIDDEN_WORDS: Record<AccountType, string[]> = {
  tt_liver: ['チャトレ', 'チャットレディ', 'ストチャ', 'Stripchat', 'アダルト', '脱ぐ', 'エロ', 'セクシー', '下着', '裸'],
  litz_grp: ['チャトレ', 'チャットレディ', 'ストチャ', 'Stripchat', 'アダルト', '脱ぐ', 'エロ', 'セクシー', '下着', '裸'],
  chatre1: ['ライバー', 'TikTok', 'TikTokライブ', 'Pococha', '17LIVE', 'BIGO'],
  chatre2: ['ライバー', 'TikTok', 'TikTokライブ', 'Pococha', '17LIVE', 'BIGO'],
  wordpress: [],
};

// 禁止ワードチェック
function validatePost(text: string, accountId: AccountType): { valid: boolean; reason?: string } {
  const forbidden = FORBIDDEN_WORDS[accountId] || [];
  for (const word of forbidden) {
    if (text.toLowerCase().includes(word.toLowerCase())) {
      return { valid: false, reason: `NGワード「${word}」が含まれています` };
    }
  }
  return { valid: true };
}

// アカウント別の詳細説明
function getAccountDescription(accountId: AccountType): string {
  const descriptions: Record<AccountType, string> = {
    tt_liver: `ライバー事務所（@tt_liver）
- ライブ配信者を募集する事務所
- 対応プラットフォーム: Pococha、TikTok LIVE、17LIVE、BIGO LIVE、IRIAM、ふわっち、REALITY、SHOWROOM
- 立場: 事務所のスタッフとして、ライバーになりたい女性を募集する
- ターゲット: ライブ配信で稼ぎたい女性
- トーン: 敬語ベースだけど親しみやすい口調。「〜ですよね」「〜なんです」など柔らかい敬語
- 【禁止表現】「高収入を目指しませんか」「サポートします」「無料相談」「お気軽にお問い合わせください」など求人サイトっぽい硬い表現は絶対NG
- 【絶対禁止ワード】チャトレ、チャットレディ、ストチャ、Stripchat、アダルト、脱ぐ、エロ、セクシー、下着、裸
- 【OK表現】「実はこれ、〜なんです」「気になる方はDMください」「〜って知ってました？」など自然で親しみやすい敬語
- キーワード: ライバー、配信、稼ぐ、副業、Pococha、17LIVE、TikTokライブ`,
    litz_grp: `ライバー事務所公式（@Litz_grp）
- ライブ配信者を募集する事務所の公式アカウント
- 対応プラットフォーム: Pococha、TikTok LIVE、17LIVE、BIGO LIVE、IRIAM、ふわっち、REALITY、SHOWROOM
- 立場: 事務所の公式として、ライバーになりたい女性を募集する
- ターゲット: ライブ配信で稼ぎたい女性
- トーン: 敬語ベースだけど親しみやすい口調。「〜ですよね」「〜なんです」など柔らかい敬語
- 【禁止表現】「高収入を目指しませんか」「サポートします」「無料相談」「お気軽にお問い合わせください」など求人サイトっぽい硬い表現は絶対NG
- 【絶対禁止ワード】チャトレ、チャットレディ、ストチャ、Stripchat、アダルト、脱ぐ、エロ、セクシー、下着、裸
- キーワード: ライバー、配信、稼ぐ、副業、Pococha、17LIVE、TikTokライブ`,
    chatre1: `チャトレ事務所（@mic_chat_）
- チャットレディ事務所の代表アカウント
- ターゲット: 在宅で稼ぎたい女性
- トーン: 敬語ベースで親しみやすい口調
- 【絶対禁止ワード】ライバー、TikTok、TikTokライブ
- キーワード: チャトレ、配信、稼ぐ、在宅、ストチャ`,
    chatre2: `海外チャトレ専門（@ms_stripchat）
- Stripchat特化の海外チャトレ事務所
- ターゲット: 高単価で稼ぎたい女性
- トーン: 敬語ベースで親しみやすい口調
- 【絶対禁止ワード】ライバー、TikTok、TikTokライブ
- キーワード: 海外チャトレ、ストチャ、Stripchat、高単価、ドル建て`,
    wordpress: `WordPressブログ
- チャットレディ関連の記事
- ターゲット: チャトレに興味がある女性`,
  };
  return descriptions[accountId] || '';
}

// バズ投稿を取得
async function getBuzzPosts(limit: number = 10) {
  const buzzPath = path.join(process.cwd(), 'knowledge', 'buzz_stock.json');
  const trendingPath = path.join(process.cwd(), 'knowledge', 'trending_posts.json');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let all: any[] = [];
  try {
    const buzzStock = JSON.parse(await fs.readFile(buzzPath, 'utf-8'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    all.push(...Object.values(buzzStock.genres).flatMap((g: any) => g.posts));
  } catch {
    // ignore
  }
  try {
    const trending = JSON.parse(await fs.readFile(trendingPath, 'utf-8'));
    all.push(...trending.posts);
  } catch {
    // ignore
  }

  const isJapanese = (text: string) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);

  return all
    .filter((p) => isJapanese(p.text || ''))
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, limit)
    .map((p) => ({ text: p.text, engagement: p.engagement }));
}

// 保存済みの過去投稿を取得
async function getSavedPosts(accountId: AccountType) {
  try {
    const filePath = path.join(process.cwd(), 'knowledge', `${accountId}_tweets.json`);
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    return data.tweets || [];
  } catch {
    return [];
  }
}

// 過去の伸びた投稿を取得（engagement上位）
async function getOldPosts(accountId: AccountType, limit: number = 10) {
  const posts = await getSavedPosts(accountId);
  return posts
    .slice(5)
    .sort((a: { engagement?: number; metrics?: { likes: number; retweets: number } }, b: { engagement?: number; metrics?: { likes: number; retweets: number } }) => {
      const aScore = a.engagement || (a.metrics?.likes || 0) + (a.metrics?.retweets || 0);
      const bScore = b.engagement || (b.metrics?.likes || 0) + (b.metrics?.retweets || 0);
      return bScore - aScore;
    })
    .slice(0, limit)
    .map((p: { text: string; metrics?: { likes: number; retweets: number }; engagement?: number }) => ({
      text: p.text,
      likes: p.metrics?.likes || 0,
      retweets: p.metrics?.retweets || 0,
    }));
}

// トーンサンプル用
async function getRecentPosts(accountId: AccountType, limit: number = 5) {
  const posts = await getSavedPosts(accountId);
  return posts
    .slice(5)
    .sort((a: { engagement?: number; metrics?: { likes: number; retweets: number } }, b: { engagement?: number; metrics?: { likes: number; retweets: number } }) => {
      const aScore = a.engagement || (a.metrics?.likes || 0) + (a.metrics?.retweets || 0);
      const bScore = b.engagement || (b.metrics?.likes || 0) + (b.metrics?.retweets || 0);
      return bScore - aScore;
    })
    .slice(0, limit)
    .map((p: { text: string }) => p.text);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const {
      accountId = 'tt_liver' as AccountType,
      count = 3,
      mode: requestedMode,
      minChars = 140,
      maxChars = 280,
    } = body;

    // アカウント検証
    const account = ACCOUNTS.find(a => a.id === accountId);
    if (!account) {
      return NextResponse.json({ success: false, error: 'Invalid account' }, { status: 400 });
    }

    console.log(`[TestGenerate] Generating ${count} patterns for ${accountId}...`);

    // データを取得
    const recentPosts = await getRecentPosts(accountId, 5);
    const oldPosts = await getOldPosts(accountId, 10);
    const buzzPosts = await getBuzzPosts(10);

    // モード選択 - 50:50
    const mode = requestedMode || (Math.random() < 0.5 ? 'self' : 'transform');

    const sourcePosts = mode === 'self' ? oldPosts : buzzPosts;
    const accountDescription = getAccountDescription(accountId);

    // プロンプト構築
    const systemPrompt = mode === 'self'
      ? `あなたはSNS運用のエキスパートです。
以下のアカウントの過去の伸びた投稿を1つ選び、同じトーンで別表現に書き直してください。

## アカウント情報
${accountDescription}

## 過去の伸びた投稿
${sourcePosts.map((p: { text: string }, i: number) => `${i + 1}. ${p.text}`).join('\n\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}

## 条件
- 元ネタの「メッセージ」は維持しつつ、「表現」を変える
- 【必須】${minChars}〜${maxChars}文字で書くこと
- 絵文字は控えめに（0〜2個）
- 最初の10文字は元ネタと違う書き出しにする
- 【重要】適度に改行を入れて読みやすくする
- 【重要】ハッシュタグは絶対に使用禁止

【重要】投稿文のみを出力。説明や前置きは一切不要。`
      : `あなたはSNS運用のエキスパートです。
以下のバズ投稿から1つ選び、そのテーマを借りて指定アカウントのトーンで完全に書き直してください。

## アカウント情報
${accountDescription}

## バズ投稿（参考）
${sourcePosts.map((p: { text: string; engagement?: number }, i: number) => `${i + 1}. ${JSON.stringify(p)}`).join('\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}

## 条件
- テーマだけ借りて完全オリジナル化
- 構造を変える（リスト形式なら文章形式に、など）
- 数字があれば変える
- 最初の10文字は元ネタと違う書き出しにする
- 【必須】${minChars}〜${maxChars}文字で書くこと
- 絵文字は控えめに（0〜2個）
- 【重要】適度に改行を入れて読みやすくする
- 【重要】ハッシュタグは絶対に使用禁止

【重要】投稿文のみを出力。説明や前置きは一切不要。`;

    // 複数パターンを生成
    const patterns: { text: string; chars: number; valid: boolean; reason?: string }[] = [];

    for (let i = 0; i < count; i++) {
      const result = await generateText({
        model: getModel(),
        system: systemPrompt,
        prompt: `アカウント「${accountId}」向けの投稿を1つ生成してください。（パターン${i + 1}）`,
      });

      const text = result.text.trim();
      const validation = validatePost(text, accountId);

      patterns.push({
        text,
        chars: text.length,
        valid: validation.valid,
        reason: validation.reason,
      });
    }

    const processingTime = Date.now() - startTime;

    console.log(`[TestGenerate] Generated ${patterns.length} patterns in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      accountId,
      mode,
      patterns,
      sourcePosts: sourcePosts.slice(0, 3),
      processingTime,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TestGenerate] Error:', error);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

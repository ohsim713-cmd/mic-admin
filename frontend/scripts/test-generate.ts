/**
 * 投稿生成テスト
 * 実際には投稿せず、生成される投稿内容を確認する
 *
 * 使い方:
 * npx tsx scripts/test-generate.ts tt_liver
 * npx tsx scripts/test-generate.ts litz_grp
 * npx tsx scripts/test-generate.ts tt_liver 3  (3件生成)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { promises as fs } from 'fs';

// .env.local を読み込み
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

type AccountType = 'tt_liver' | 'litz_grp' | 'chatre1' | 'chatre2' | 'ms_stripchat' | 'wordpress';

const descriptions: Record<AccountType, string> = {
  tt_liver: `ライバー事務所（@tt_liver）
- TikTokライブ配信者を募集する事務所
- 立場: 事務所のスタッフとして、ライバーになりたい女性を募集する
- ターゲット: ライブ配信で稼ぎたい女性
- トーン: 親しみやすく、ライブ配信の魅力や稼げる可能性を伝える
- キーワード: ライバー、配信、稼ぐ、副業、TikTok、事務所
- 【重要】個人ライバーの体験談ではなく、事務所としてライバーを勧誘する投稿にすること
- 【禁止】毎回DMや相談に誘導しない。くどくなるので自然な投稿で終わらせる`,
  litz_grp: `ライバー事務所公式（@Litz_grp）
- ライブ配信者を募集する事務所の公式アカウント
- 対応プラットフォーム: Pococha、TikTok LIVE、17LIVE、BIGO LIVE、IRIAM、ふわっち、REALITY、SHOWROOM
- 立場: 事務所の公式として、ライバーになりたい女性を募集する
- ターゲット: ライブ配信で稼ぎたい女性
- トーン: 敬語ベースだけど親しみやすい口調。「〜ですよね」「〜なんです」など柔らかい敬語
- 【禁止表現】「高収入を目指しませんか」「サポートします」「無料相談」「お気軽にお問い合わせください」など求人サイトっぽい硬い表現は絶対NG
- 【絶対禁止ワード】チャトレ、チャットレディ、ストチャ、Stripchat、アダルト、脱ぐ、エロ、セクシー、下着、裸 ← これらのワードは絶対に使用禁止！ライバーは健全な配信なのでアダルト要素は一切NG
- 【禁止】毎回DMや相談に誘導しない。くどくなるので自然な投稿で終わらせる
- キーワード: ライバー、配信、稼ぐ、副業、Pococha、17LIVE、TikTokライブ
- 【重要】個人ライバーの体験談ではなく、事務所としてライバーを勧誘する投稿にすること`,
  chatre1: `チャトレ事務所①（@mic_chat_）`,
  chatre2: `チャトレ事務所②（@ms_stripchat）`,
  ms_stripchat: `チャトレ事務所（@ms_stripchat）
- 海外向けチャットレディを募集する事務所（Stripchat専門）
- 立場: 事務所のスタッフとして、海外チャトレになりたい女性を募集する
- ターゲット: 高単価で稼ぎたい女性、在宅で自由に働きたい女性
- トーン: 親しみやすく、海外サイトの魅力や高単価をアピール
- 【禁止表現】「高収入を目指しませんか」「無料相談」など求人サイトっぽい硬い表現はNG
- 【OK表現】「実はこれ、〜なんです」「気になる方はDMください」「〜って知ってました？」など自然な表現
- キーワード: チャトレ、ストチャ、Stripchat、高単価、稼ぐ、在宅、海外サイト
- 【重要】個人チャトレの体験談ではなく、事務所としてチャトレを勧誘する投稿にすること
- 【禁止】毎回DMや相談に誘導しない。くどくなるので自然な投稿で終わらせる
- 【絶対禁止ワード】ライバー、TikTok、Pococha、17LIVE、BIGO ← ライバー関連ワードは使用禁止`,
  wordpress: `WordPressブログ`,
};

function getModel() {
  return google('gemini-3-pro-preview');
}

async function getSavedPosts(accountId: AccountType) {
  try {
    const filePath = path.join(process.cwd(), 'knowledge', `${accountId}_tweets.json`);
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    return data.tweets || [];
  } catch {
    // litz_grp は liver のデータを参照
    if (accountId === 'litz_grp') {
      try {
        const filePath = path.join(process.cwd(), 'knowledge', 'liver_tweets.json');
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        return data.tweets || [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

async function getOldPosts(accountId: AccountType, limit: number = 10) {
  const posts = await getSavedPosts(accountId);
  return posts
    .sort((a: any, b: any) => {
      const aScore = a.engagement || (a.metrics?.likes || 0) + (a.metrics?.retweets || 0);
      const bScore = b.engagement || (b.metrics?.likes || 0) + (b.metrics?.retweets || 0);
      return bScore - aScore;
    })
    .slice(0, limit)
    .map((p: any) => ({
      text: p.text,
      likes: p.metrics?.likes || 0,
      retweets: p.metrics?.retweets || 0,
    }));
}

async function getRecentPosts(accountId: AccountType, limit: number = 5) {
  const posts = await getSavedPosts(accountId);
  return posts.slice(0, limit).map((p: any) => p.text);
}

async function getBuzzPosts(limit: number = 10) {
  const buzzPath = path.join(process.cwd(), 'knowledge', 'buzz_stock.json');
  const trendingPath = path.join(process.cwd(), 'knowledge', 'trending_posts.json');

  let all: any[] = [];
  try {
    const buzzStock = JSON.parse(await fs.readFile(buzzPath, 'utf-8'));
    all.push(...Object.values(buzzStock.genres).flatMap((g: any) => g.posts));
  } catch {}
  try {
    const trending = JSON.parse(await fs.readFile(trendingPath, 'utf-8'));
    all.push(...trending.posts);
  } catch {}

  return all
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, limit)
    .map((p) => ({ text: p.text, engagement: p.engagement }));
}

async function generatePost(accountId: AccountType): Promise<{ text: string; mode: string }> {
  const minChars = 200;
  const maxChars = 300;

  const mode = Math.random() < 0.5 ? 'self' : 'transform';
  const recentPosts = await getRecentPosts(accountId, 5);
  const sourcePosts = mode === 'self'
    ? await getOldPosts(accountId, 10)
    : await getBuzzPosts(10);

  const systemPrompt = mode === 'self'
    ? `あなたはSNS運用のエキスパートです。
以下のアカウントの過去の伸びた投稿を1つ選び、同じトーンで別表現に書き直してください。

## アカウント情報
${descriptions[accountId]}

## 過去の伸びた投稿
${sourcePosts.map((p: { text: string }, i: number) => `${i + 1}. ${p.text}`).join('\n\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}

## 条件
- このアカウントのターゲット層に響く内容
- 元ネタの「メッセージ」は維持しつつ、「表現」を変える
- 【必須】${minChars}〜${maxChars}文字で書くこと
- 【絵文字禁止】絵文字は一切使わない
- 最初の10文字は元ネタと違う書き出しにする
- パクリに見えないように巧妙にアレンジ
- 自然な日本語で、押し売り感のない文章
- 【重要】適度に改行を入れて読みやすくする（3〜5文ごとに空行）

【重要】投稿文のみを出力。説明や前置きは一切不要。`
    : `あなたはSNS運用のエキスパートです。
以下のバズ投稿から1つ選び、そのテーマを借りて指定アカウントのトーンで完全に書き直してください。

## アカウント情報
${descriptions[accountId]}

## バズ投稿（参考）
${sourcePosts.map((p: { text: string; engagement?: number }, i: number) => `${i + 1}. ${JSON.stringify(p)}`).join('\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}

## 条件
- このアカウントのターゲット層に響く内容
- テーマだけ借りて完全オリジナル化
- 構造を変える（リスト形式なら文章形式に、など）
- 数字があれば変える
- 最初の10文字は元ネタと違う書き出しにする
- 【必須】${minChars}〜${maxChars}文字で書くこと
- 【絵文字禁止】絵文字は一切使わない
- 自然な日本語で、押し売り感のない文章
- 【重要】適度に改行を入れて読みやすくする（3〜5文ごとに空行）

【重要】投稿文のみを出力。説明や前置きは一切不要。`;

  const result = await generateText({
    model: getModel(),
    system: systemPrompt,
    prompt: `アカウント「${accountId}」向けの投稿を1つ生成してください。`,
  });

  return { text: result.text.trim(), mode };
}

async function main() {
  const accountId = (process.argv[2] || 'tt_liver') as AccountType;
  const count = parseInt(process.argv[3] || '3', 10);

  if (!['tt_liver', 'litz_grp', 'ms_stripchat'].includes(accountId)) {
    console.error('Invalid account. Use: tt_liver, litz_grp, or ms_stripchat');
    process.exit(1);
  }

  console.log(`\n=== ${accountId} の投稿テスト (${count}件) ===\n`);

  for (let i = 0; i < count; i++) {
    console.log(`--- パターン ${i + 1} ---`);
    try {
      const { text, mode } = await generatePost(accountId);
      console.log(`Mode: ${mode}`);
      console.log(`\n${text}\n`);
      console.log(`(${text.length}文字)\n`);
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

main();

/**
 * 自動投稿 Cron ジョブ
 *
 * Vercel Cron: 1日15回（1.5時間間隔）
 * 新しい Vercel AI SDK 版の自動投稿を実行
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/model';
import {
  postToAllAccounts,
  AccountType,
  ACCOUNTS,
} from '@/lib/dm-hunter/sns-adapter';
// import { addToPostsHistory } from '@/lib/analytics/posts-history'; // Vercelはread-only
import { notifyPostSuccess, notifyError } from '@/lib/discord';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 120;

// アカウント情報を取得
function getAccountInfo(accountId: AccountType) {
  const account = ACCOUNTS.find(a => a.id === accountId);
  if (!account) return null;

  const descriptions: Record<AccountType, string> = {
    liver: `ライバー事務所（@tt_liver）
- TikTokライブ配信者を募集する事務所
- 立場: 事務所のスタッフとして、ライバーになりたい女性を募集する
- ターゲット: ライブ配信で稼ぎたい女性
- トーン: 親しみやすく、稼げる可能性を伝える。「うちで一緒にやりませんか？」「サポートします」
- キーワード: ライバー、配信、稼ぐ、副業、TikTok、事務所、サポート
- 【重要】個人ライバーの体験談ではなく、事務所としてライバーを勧誘する投稿にすること`,
    chatre1: `チャトレ事務所①（@mic_chat_）
- チャットレディを募集する事務所
- 立場: 事務所のスタッフとして、チャトレになりたい女性を募集する
- ターゲット: 在宅で稼ぎたい女性
- トーン: プロフェッショナル、稼ぐコツを伝える。「うちで始めませんか？」「サポートします」
- キーワード: チャトレ、配信、稼ぐ、在宅、ストチャ、事務所、サポート
- 【重要】個人チャトレの体験談ではなく、事務所としてチャトレを勧誘する投稿にすること`,
    chatre2: `チャトレ事務所②（@ms_stripchat）
- 海外向けチャットレディを募集する事務所（Stripchat）
- 立場: 事務所のスタッフとして、海外チャトレになりたい女性を募集する
- ターゲット: 高単価で稼ぎたい女性
- トーン: 海外サイトの魅力、高単価をアピール。「うちで始めませんか？」「サポートします」
- キーワード: 海外チャトレ、ストチャ、高単価、稼ぐ、事務所、サポート
- 【重要】個人チャトレの体験談ではなく、事務所としてチャトレを勧誘する投稿にすること`,
    wordpress: `WordPressブログ
- チャットレディ関連の記事
- ターゲット: チャトレに興味がある女性`,
  };

  return {
    ...account,
    description: descriptions[accountId] || '',
  };
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

// 過去の伸びた投稿を取得
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

// 最近の投稿を取得
async function getRecentPosts(accountId: AccountType, limit: number = 5) {
  const posts = await getSavedPosts(accountId);
  return posts.slice(0, limit).map((p: any) => p.text);
}

// バズ投稿を取得
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const accountId: AccountType = 'liver'; // 現在はliverのみ
  const minChars = 200;
  const maxChars = 300;

  try {
    console.log('[CRON] Starting auto-post...');

    const accountInfo = getAccountInfo(accountId);
    if (!accountInfo) {
      return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
    }

    // モード選択（50:50）
    const mode = Math.random() < 0.5 ? 'self' : 'transform';

    // データ取得
    const recentPosts = await getRecentPosts(accountId, 5);
    const sourcePosts = mode === 'self'
      ? await getOldPosts(accountId, 10)
      : await getBuzzPosts(10);

    console.log(`[CRON] Mode: ${mode}, Sources: ${sourcePosts.length}`);

    // プロンプト構築
    const systemPrompt = mode === 'self'
      ? `あなたはSNS運用のエキスパートです。
以下のアカウントの過去の伸びた投稿を1つ選び、同じトーンで別表現に書き直してください。

## アカウント情報
${accountInfo.description}

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
${accountInfo.description}

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

    // AI生成
    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: `アカウント「${accountId}」向けの投稿を1つ生成してください。`,
    });

    const generatedText = result.text.trim();
    const processingTime = Date.now() - startTime;

    console.log(`[CRON] Generated in ${processingTime}ms`);
    console.log(`[CRON] Text: ${generatedText.substring(0, 80)}...`);

    // 実際に投稿
    const [postResult] = await postToAllAccounts([
      { account: accountId, text: generatedText },
    ]);

    if (postResult.success) {
      // Note: Vercelはread-onlyなのでファイル書き込みスキップ
      // 将来的にはSupabaseに保存する
      console.log(`[CRON] Posted successfully: ${postResult.id}`);

      notifyPostSuccess({
        account: accountId,
        tweetId: postResult.id || '',
        postText: generatedText,
        qualityScore: 10,
        slot: 0,
      }).catch(console.error);

      return NextResponse.json({
        success: true,
        accountId,
        mode,
        tweetId: postResult.id,
        text: generatedText,
        processingTime,
      });
    } else {
      notifyError({
        title: 'Cron投稿失敗',
        error: postResult.error || 'Unknown error',
        context: accountId,
      }).catch(console.error);

      return NextResponse.json({
        success: false,
        error: postResult.error,
        processingTime,
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRON] Error:', error);

    notifyError({
      title: 'Cron実行エラー',
      error: errorMessage,
      context: 'auto-post',
    }).catch(console.error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

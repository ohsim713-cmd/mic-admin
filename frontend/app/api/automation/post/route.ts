import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/model';
import {
  postToAllAccounts,
  AccountType,
  ACCOUNTS,
} from '@/lib/dm-hunter/sns-adapter';
import { POSTING_SCHEDULE } from '@/lib/automation/scheduler';
import { addToPostsHistory } from '@/lib/analytics/posts-history';
import { notifyPostSuccess, notifyError } from '@/lib/discord';
import { promises as fs } from 'fs';
import path from 'path';

// アカウント情報を取得
function getAccountInfo(accountId: AccountType) {
  const account = ACCOUNTS.find(a => a.id === accountId);
  if (!account) return null;

  // アカウント別の詳細説明
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

// バズ投稿を取得（ジャンル指定可能）
async function getBuzzPosts(limit: number = 10, genre?: string) {
  const buzzPath = path.join(process.cwd(), 'knowledge', 'buzz_stock.json');
  const trendingPath = path.join(process.cwd(), 'knowledge', 'trending_posts.json');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let all: any[] = [];
  try {
    const buzzStock = JSON.parse(await fs.readFile(buzzPath, 'utf-8'));
    if (genre && buzzStock.genres[genre]) {
      // 特定ジャンルのみ
      all.push(...buzzStock.genres[genre].posts);
    } else {
      // 全ジャンル
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      all.push(...Object.values(buzzStock.genres).flatMap((g: any) => g.posts));
    }
  } catch {
    // ignore
  }
  try {
    const trending = JSON.parse(await fs.readFile(trendingPath, 'utf-8'));
    all.push(...trending.posts);
  } catch {
    // ignore
  }

  return all
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, limit)
    .map((p) => ({ text: p.text, engagement: p.engagement, whyWorks: p.whyWorks }));
}

// 投稿テンプレートを取得
interface PostTemplate {
  id: string;
  name: string;
  structure: string;
  example: string;
  whyWorks: string;
  bestFor: string[];
}

async function getPostTemplates(): Promise<PostTemplate[]> {
  try {
    const templatePath = path.join(process.cwd(), 'knowledge', 'post_templates.json');
    const data = JSON.parse(await fs.readFile(templatePath, 'utf-8'));
    return data.templates || [];
  } catch {
    return [];
  }
}

// ランダムにテンプレートを選択
async function getRandomTemplate(): Promise<PostTemplate | null> {
  const templates = await getPostTemplates();
  if (templates.length === 0) return null;
  return templates[Math.floor(Math.random() * templates.length)];
}

// 保存済みの過去投稿を取得（JSONファイルから）
async function getSavedPosts(accountId: AccountType) {
  try {
    const filePath = path.join(process.cwd(), 'knowledge', `${accountId}_tweets.json`);
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    return data.tweets || [];
  } catch (error) {
    console.error(`[Automation] Failed to load saved posts for ${accountId}:`, error);
    return [];
  }
}

// 過去の伸びた投稿を取得（JSONファイルから）
async function getOldPosts(accountId: AccountType, limit: number = 10) {
  const posts = await getSavedPosts(accountId);

  // エンゲージメント順にソートして上位を返す
  return posts
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

// 最近の投稿を取得（トーンサンプル用）
async function getRecentPosts(accountId: AccountType, limit: number = 5) {
  const posts = await getSavedPosts(accountId);
  // 最新のものをlimit件返す（JSONは既にソート済み想定）
  return posts.slice(0, limit).map((p: { text: string }) => p.text);
}

// POST: 自動投稿実行（Vercel AI SDK版）
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const {
      dryRun = false,
      accountId = 'liver' as AccountType,
      mode: requestedMode,
      templateId,
      genre,
      minChars = 140,
      maxChars = 280,
    } = body;

    console.log('[Automation] Starting auto-post with Vercel AI SDK...');

    // 現在時刻（JST）を確認
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    const jstMinute = now.getMinutes();
    const currentTime = `${jstHour.toString().padStart(2, '0')}:${jstMinute.toString().padStart(2, '0')}`;

    console.log(`[Automation] Generating post at ${currentTime} JST for ${accountId}`);

    // アカウント情報を取得
    const accountInfo = getAccountInfo(accountId);
    if (!accountInfo) {
      return NextResponse.json({ success: false, error: 'Invalid account' }, { status: 400 });
    }

    // モード選択（self:transform:template = 33:33:33）- リクエストで指定があればそれを使用
    const modeRandom = Math.random();
    const mode = requestedMode || (modeRandom < 0.33 ? 'self' : modeRandom < 0.66 ? 'transform' : 'template');

    // データを先に取得
    const recentPosts = await getRecentPosts(accountId, 5);
    const sourcePosts = mode === 'self'
      ? await getOldPosts(accountId, 10)
      : await getBuzzPosts(10, genre);

    // テンプレートを取得（templateモード時）
    const template = mode === 'template' ? (templateId ? (await getPostTemplates()).find(t => t.id === templateId) : await getRandomTemplate()) : null;

    console.log(`[Automation] Mode: ${mode}, Source posts: ${sourcePosts.length}, Recent: ${recentPosts.length}, Template: ${template?.name || 'none'}`);

    // プロンプトを構築
    let systemPrompt: string;

    if (mode === 'self') {
      systemPrompt = `あなたはSNS運用のエキスパートです。
以下のアカウントの過去の伸びた投稿を1つ選び、同じトーンで別表現に書き直してください。

## アカウント情報
${accountInfo.description}

## 過去の伸びた投稿
${sourcePosts.map((p: { text: string }, i: number) => `${i + 1}. ${p.text}`).join('\n\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}

## 条件
- このアカウントのターゲット層（${accountInfo.type}に興味がある女性）に響く内容
- 元ネタの「メッセージ」は維持しつつ、「表現」を変える
- 【必須】${minChars}〜${maxChars}文字で書くこと（短すぎNG、必ずこの範囲に収める）
- 絵文字は控えめに（0〜2個）
- 最初の10文字は元ネタと違う書き出しにする
- パクリに見えないように巧妙にアレンジ
- 【重要】適度に改行を入れて読みやすくする（3〜5文ごとに空行）

【重要】投稿文のみを出力。説明や前置きは一切不要。「投稿を作成しました」等の文言も禁止。`;
    } else if (mode === 'template' && template) {
      systemPrompt = `あなたはSNS運用のエキスパートです。
以下のテンプレートの「型」に沿って、指定アカウント向けの投稿を作成してください。

## アカウント情報
${accountInfo.description}

## 使用するテンプレート
名前: ${template.name}
構造: ${template.structure}
例:
${template.example}

バズる理由: ${template.whyWorks}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}

## 条件
- このアカウントのターゲット層（${accountInfo.type}に興味がある女性）に響く内容
- テンプレートの「構造・型」を守る（例と全く同じ内容はNG、構造だけ借りる）
- ライバー/配信に関連したオリジナルの内容を考える
- 【必須】${minChars}〜${maxChars}文字で書くこと（短すぎNG、必ずこの範囲に収める）
- 絵文字は控えめに（0〜2個）
- 【重要】適度に改行を入れて読みやすくする

【重要】投稿文のみを出力。説明や前置きは一切不要。`;
    } else {
      // transform モード
      systemPrompt = `あなたはSNS運用のエキスパートです。
以下のバズ投稿から1つ選び、そのテーマを借りて指定アカウントのトーンで完全に書き直してください。

## アカウント情報
${accountInfo.description}

## バズ投稿（参考）
${sourcePosts.map((p: { text: string; engagement?: number; whyWorks?: string }, i: number) => `${i + 1}. ${JSON.stringify(p)}`).join('\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}

## 条件
- このアカウントのターゲット層（${accountInfo.type}に興味がある女性）に響く内容
- テーマだけ借りて完全オリジナル化
- 構造を変える（リスト形式なら文章形式に、など）
- 数字があれば変える
- 最初の10文字は元ネタと違う書き出しにする
- 【必須】${minChars}〜${maxChars}文字で書くこと（短すぎNG、必ずこの範囲に収める）
- 絵文字は控えめに（0〜2個）
- 【重要】適度に改行を入れて読みやすくする（3〜5文ごとに空行）

【重要】投稿文のみを出力。説明や前置きは一切不要。「投稿を作成しました」等の文言も禁止。`;
    }

    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: `アカウント「${accountId}」向けの投稿を1つ生成してください。`,
    });

    const generatedText = result.text.trim();
    const processingTime = Date.now() - startTime;

    console.log(`[Automation] Generated in ${processingTime}ms, mode=${mode}`);
    console.log(`[Automation] Text: ${generatedText.substring(0, 100)}...`);

    // ドライラン
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        mode,
        accountId,
        generatedText,
        sourcePostsCount: sourcePosts.length,
        template: template ? { id: template.id, name: template.name } : null,
        processingTime,
      });
    }

    // 実際に投稿
    const [postResult] = await postToAllAccounts([
      { account: accountId, text: generatedText },
    ]);

    if (postResult.success) {
      // 投稿履歴に記録
      const targetLabel = mode === 'self' ? '過去投稿リライト' : mode === 'template' ? `テンプレート: ${template?.name}` : 'バズ投稿変換';
      await addToPostsHistory({
        id: postResult.id || `post_${Date.now()}`,
        text: generatedText,
        account: accountId,
        target: targetLabel,
        benefit: 'AI自動生成',
        score: 10,
        tweetId: postResult.id,
        timestamp: new Date().toISOString(),
      });

      // Discord通知
      notifyPostSuccess({
        account: accountId,
        tweetId: postResult.id || '',
        postText: generatedText,
        qualityScore: 10,
        slot: 0,
      }).catch(console.error);
    } else {
      notifyError({
        title: '自動投稿失敗',
        error: postResult.error || 'Unknown error',
        context: accountId,
      }).catch(console.error);
    }

    return NextResponse.json({
      success: postResult.success,
      posted: true,
      mode,
      accountId,
      tweetId: postResult.id,
      text: generatedText,
      error: postResult.error,
      processingTime,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Automation] Error:', error);

    notifyError({
      title: '投稿生成エラー',
      error: errorMessage,
      context: 'Vercel AI SDK',
    }).catch(console.error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// GET: スケジュール情報を取得
export async function GET() {
  try {
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    const currentTime = `${jstHour.toString().padStart(2, '0')}:00`;

    const passedSlots = POSTING_SCHEDULE.slots.filter(
      (slot) => slot.time <= currentTime
    );
    const upcomingSlots = POSTING_SCHEDULE.slots.filter(
      (slot) => slot.time > currentTime
    );

    return NextResponse.json({
      date: new Date().toISOString().split('T')[0],
      currentTime,
      jstHour,
      slots: {
        passed: passedSlots.length,
        upcoming: upcomingSlots.length,
        total: POSTING_SCHEDULE.slots.length,
      },
      schedule: POSTING_SCHEDULE,
      model: process.env.AI_MODEL || 'claude-3.5-haiku',
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

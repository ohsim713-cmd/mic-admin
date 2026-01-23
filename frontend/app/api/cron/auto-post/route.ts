/**
 * 自動投稿 Cron ジョブ
 *
 * Vercel Cron: 1日15回（1.5時間間隔）
 * 新しい Vercel AI SDK 版の自動投稿を実行
 *
 * 環境変数 PAUSE_AUTOMATION=true で一時停止可能
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
import { loadFromBlob, BLOB_FILES } from '@/lib/storage/blob';
import { generateImageForPost } from '@/lib/ai/image-generator';
// Note: fs/path は使わない（Vercel read-only対策）

export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Pro: 5分まで

// 一時停止チェック
function isPaused(): boolean {
  return process.env.PAUSE_AUTOMATION === 'true';
}

// アカウント情報を取得
function getAccountInfo(accountId: AccountType) {
  const account = ACCOUNTS.find(a => a.id === accountId);
  if (!account) return null;

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
    chatre1: `チャトレ事務所①（@mic_chat_）
- チャットレディを募集する事務所
- 立場: 事務所のスタッフとして、チャトレになりたい女性を募集する
- ターゲット: 在宅で稼ぎたい女性
- トーン: プロフェッショナル、稼ぐコツを伝える。「うちで始めませんか？」「サポートします」
- キーワード: チャトレ、配信、稼ぐ、在宅、ストチャ、事務所、サポート
- 【重要】個人チャトレの体験談ではなく、事務所としてチャトレを勧誘する投稿にすること`,
    chatre2: `チャトレ事務所（@ms_stripchat）
- 国内・海外両方のチャトレサイトに対応する事務所
- 国内サイト: FANZA、エンジェルライブ、ジュエルライブなど
- 海外サイト: Stripchat、FC2、FC2ラブチップ、デラックスライブなど
- ターゲット: チャトレで稼ぎたい女性（国内・海外問わず）
- トーン: 敬語ベースで親しみやすい口調。「〜なんですよね」「〜だったりします」など柔らかい敬語
- 【禁止表現】「高収入を目指しませんか」「サポートします」「無料相談」など求人サイトっぽい硬い表現は絶対NG
- 【絶対禁止ワード】ライバー、TikTok、TikTokライブ ← これらはライバー事務所のワードなので使用禁止
- 【OK表現】「うちでは国内も海外も〜」「FANZAだと〜ですよね」「ストチャなら〜」「詳しくはDMで」など自然な敬語
- キーワード: チャトレ、FANZA、エンジェルライブ、ストチャ、Stripchat、FC2、高単価
- 【重要】国内・海外サイトの違いや特徴をリアルに発信すること
- 【禁止】毎回DMや相談に誘導しない。くどくなるので自然な投稿で終わらせる`,
    wordpress: `WordPressブログ
- チャットレディ関連の記事
- ターゲット: チャトレに興味がある女性`,
  };

  return {
    ...account,
    description: descriptions[accountId] || '',
  };
}

// 保存済みの過去投稿を取得（Blobのみ - Vercel read-only対策）
async function getSavedPosts(accountId: AccountType) {
  // アカウント別のBlobファイル名
  const blobFile = accountId === 'tt_liver' ? BLOB_FILES.TT_LIVER_TWEETS
    : accountId === 'litz_grp' ? BLOB_FILES.LITZ_GRP_TWEETS
    : accountId === 'chatre2' ? BLOB_FILES.MS_STRIPCHAT_TWEETS
    : BLOB_FILES.LIVER_TWEETS;

  try {
    const blobData = await loadFromBlob<{ tweets: any[] }>(blobFile);
    if (blobData?.tweets) {
      console.log(`[CRON] Loaded ${accountId} tweets from Blob (${blobData.tweets.length} tweets)`);
      return blobData.tweets;
    }
    console.log(`[CRON] No tweets in Blob for ${accountId}`);
  } catch (e) {
    console.error(`[CRON] Failed to load tweets from Blob for ${accountId}:`, e);
  }

  // litz_grp の場合は tt_liver のデータを参照
  if (accountId === 'litz_grp') {
    try {
      const fallbackData = await loadFromBlob<{ tweets: any[] }>(BLOB_FILES.TT_LIVER_TWEETS);
      if (fallbackData?.tweets) {
        console.log(`[CRON] Using tt_liver tweets as fallback for litz_grp`);
        return fallbackData.tweets;
      }
    } catch {
      // ignore
    }
  }

  return [];
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

// バズ投稿を取得（Blobのみ - Vercel read-only対策）
async function getBuzzPosts(limit: number = 10) {
  let all: any[] = [];

  // Blobから取得（ローカルファイルは使わない）
  try {
    const blobData = await loadFromBlob<{ genres: Record<string, { posts: any[] }> }>(BLOB_FILES.BUZZ_STOCK);
    if (blobData) {
      all.push(...Object.values(blobData.genres).flatMap((g: any) => g.posts));
      console.log('[CRON] Loaded buzz_stock from Blob');
    } else {
      console.log('[CRON] No buzz_stock in Blob');
    }
  } catch (e) {
    console.error('[CRON] Failed to load buzz_stock from Blob:', e);
  }

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

  // 一時停止チェック（環境変数 PAUSE_AUTOMATION=true で停止）
  if (isPaused()) {
    console.log('[CRON] Auto-post is PAUSED');
    return NextResponse.json({
      success: true,
      paused: true,
      message: 'Auto-post is paused via PAUSE_AUTOMATION env var',
    });
  }

  // クエリパラメータでアカウント指定（デフォルトはtt_liver）
  const { searchParams } = new URL(request.url);
  const accountParam = searchParams.get('account');
  const validAccounts: AccountType[] = ['tt_liver', 'litz_grp', 'chatre2'];
  const accountId: AccountType = validAccounts.includes(accountParam as AccountType)
    ? (accountParam as AccountType)
    : 'tt_liver';

  const minChars = 200;
  const maxChars = 400; // X Premiumなら長文OK、文章が途切れないよう余裕を持たせる

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

    // DM誘導するかどうか（3回に1回程度）
    const shouldIncludeCTA = Math.random() < 0.33;

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
${shouldIncludeCTA ? '- 最後にさりげなくDM誘導を入れてもOK（「気になる方はDMください」程度）' : '- 【重要】DM誘導や問い合わせ誘導は入れないこと。情報提供で終わる投稿にする'}

【重要】投稿文のみを出力。説明や前置きは一切不要。`
      : `あなたはSNS運用のエキスパートです。
以下のバズ投稿から1つ選び、そのテーマを借りて指定アカウントのトーンで完全に書き直してください。

## アカウント情報
${accountInfo.description}

## バズ投稿（参考）- これらがバズった理由を分析して活かすこと
${sourcePosts.map((p: { text: string; engagement?: number }, i: number) => `${i + 1}. ${JSON.stringify(p)}`).join('\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}

## バズる投稿の特徴（必ず1つ以上取り入れる）
- 冒頭で「え？」「実は」「意外と」など興味を引く
- 具体的な数字を入れる（「月○万円」「○時間で」など）
- 読み手の「あるある」や「知らなかった」を刺激
- 最後にオチや気づきがある
- 短文でリズムよく

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
${shouldIncludeCTA ? '- 最後にさりげなくDM誘導を入れてもOK（「気になる方はDMください」程度）' : '- 【重要】DM誘導や問い合わせ誘導は入れないこと。情報提供や気づきで終わる投稿にする'}

【重要】投稿文のみを出力。説明や前置きは一切不要。`;

    // AI生成
    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: `アカウント「${accountId}」向けの投稿を1つ生成してください。`,
    });

    const generatedText = result.text.trim();
    const textGeneratedAt = Date.now() - startTime;

    console.log(`[CRON] Text generated in ${textGeneratedAt}ms`);
    console.log(`[CRON] Text: ${generatedText.substring(0, 80)}...`);

    // 画像生成（現在は無効化 - テスト段階）
    // TODO: テスト完了後に有効化
    // const shouldGenerateImage = Math.random() < 0.3; // 30%で画像付き
    const imageBuffer: Buffer | null = null;
    /*
    if (shouldGenerateImage) {
      const accountType = accountId === 'chatre2' ? 'chatre' : 'liver';
      console.log(`[CRON] Generating image for ${accountType}...`);
      imageBuffer = await generateImageForPost(generatedText, accountType);
      if (imageBuffer) {
        console.log(`[CRON] Image generated: ${imageBuffer.length} bytes`);
      } else {
        console.log(`[CRON] Image generation failed, posting without image`);
      }
    }
    */

    const processingTime = Date.now() - startTime;

    // 実際に投稿
    const [postResult] = await postToAllAccounts([
      {
        account: accountId,
        text: generatedText,
        imageBuffers: imageBuffer ? [imageBuffer] : undefined,
      },
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
        hasImage: !!imageBuffer,
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

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/model';
import {
  postToAllAccounts,
  AccountType,
  ACCOUNTS,
} from '@/lib/dm-hunter/sns-adapter';
import { POSTING_SCHEDULE } from '@/lib/automation/scheduler';
// import { addToPostsHistory } from '@/lib/analytics/posts-history'; // Vercelはread-only
import { notifyPostSuccess, notifyError } from '@/lib/discord';
import { loadFromBlob, BLOB_FILES } from '@/lib/storage/blob';
// Note: fs/path は使わない（Vercel read-only対策）

export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Pro: 5分まで

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

// アカウント情報を取得
function getAccountInfo(accountId: AccountType) {
  const account = ACCOUNTS.find(a => a.id === accountId);
  if (!account) return null;

  // アカウント別の詳細説明
  const descriptions: Record<AccountType, string> = {
    tt_liver: `ライバー事務所（@tt_liver）
- ライブ配信者を募集する事務所
- 対応プラットフォーム: Pococha、TikTok LIVE、17LIVE、BIGO LIVE、IRIAM、ふわっち、REALITY、SHOWROOM
- 立場: 事務所のスタッフとして、ライバーになりたい女性を募集する
- ターゲット: ライブ配信で稼ぎたい女性
- トーン: 敬語ベースだけど親しみやすい口調。「〜ですよね」「〜なんです」など柔らかい敬語
- 【禁止表現】「高収入を目指しませんか」「サポートします」「無料相談」「お気軽にお問い合わせください」など求人サイトっぽい硬い表現は絶対NG
- 【絶対禁止ワード】チャトレ、チャットレディ、ストチャ、Stripchat、アダルト、脱ぐ、エロ、セクシー、下着、裸 ← これらのワードは絶対に使用禁止！ライバーは健全な配信なのでアダルト要素は一切NG
- 【禁止】毎回DMや相談に誘導しない。くどくなるので自然な投稿で終わらせる
- キーワード: ライバー、配信、稼ぐ、副業、Pococha、17LIVE、TikTokライブ
- 【重要】個人ライバーの体験談ではなく、事務所としてライバーを勧誘する投稿にすること`,
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
    chatre1: `チャトレ事務所（@mic_chat_）
- チャットレディ事務所の代表アカウント
- ターゲット: 在宅で稼ぎたい女性
- トーン: 敬語ベースで親しみやすい口調。「〜なんですよね」「〜だったりします」「〜ですよね」など柔らかい敬語
- 【禁止表現】「高収入を目指しませんか」「サポートします」「無料相談」「お気軽にお問い合わせください」など求人サイトっぽい硬い表現は絶対NG。「ズバリ」「やばい」「〜わよ」などおねえ言葉もNG
- 【絶対禁止ワード】ライバー、TikTok、TikTokライブ ← これらはライバー事務所のワードなので使用禁止
- 【OK表現】「うちでは〜なんですよね」「実際〜だったりします」「気になる方はDMください」など自然な敬語
- キーワード: チャトレ、配信、稼ぐ、在宅、ストチャ
- 【重要】現場の経験を踏まえた実感のこもった投稿にすること`,
    chatre2: `海外チャトレ専門（@ms_stripchat）
- Stripchat特化の海外チャトレ事務所
- ターゲット: 高単価で稼ぎたい女性
- トーン: 敬語ベースで親しみやすい口調。「〜なんですよね」「〜だったりします」など柔らかい敬語
- 【禁止表現】「高収入を目指しませんか」「サポートします」「無料相談」「お気軽にお問い合わせください」など求人サイトっぽい硬い表現は絶対NG。「ズバリ」「やばい」「〜わよ」などおねえ言葉もNG
- 【絶対禁止ワード】ライバー、TikTok、TikTokライブ ← これらはライバー事務所のワードなので使用禁止
- 【OK表現】「海外チャトレって実は〜なんです」「ストチャだと〜ですよね」「詳しくはDMで」など自然な敬語
- キーワード: 海外チャトレ、ストチャ、Stripchat、高単価、ドル建て
- 【重要】海外チャトレの魅力や情報をリアルに発信すること`,
    wordpress: `WordPressブログ
- チャットレディ関連の記事
- ターゲット: チャトレに興味がある女性`,
  };

  return {
    ...account,
    description: descriptions[accountId] || '',
  };
}

// バズ投稿を取得（日本語のみ、英語除外）- Blobのみ（Vercel read-only対策）
async function getBuzzPosts(limit: number = 10) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let all: any[] = [];

  // Blobから取得（ローカルファイルは使わない）
  try {
    const blobData = await loadFromBlob<{ genres: Record<string, { posts: any[] }> }>(BLOB_FILES.BUZZ_STOCK);
    if (blobData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      all.push(...Object.values(blobData.genres).flatMap((g: any) => g.posts));
      console.log('[Automation] Loaded buzz_stock from Blob');
    } else {
      console.log('[Automation] No buzz_stock in Blob');
    }
  } catch (e) {
    console.error('[Automation] Failed to load buzz_stock from Blob:', e);
  }

  // 日本語を含む投稿のみ（英語広告を除外）
  const isJapanese = (text: string) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);

  return all
    .filter((p) => isJapanese(p.text || ''))
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, limit)
    .map((p) => ({ text: p.text, engagement: p.engagement }));
}

// 保存済みの過去投稿を取得（Blobのみ - Vercel read-only対策）
async function getSavedPosts(accountId: AccountType) {
  // アカウント別のBlobファイル名
  const blobFile = accountId === 'tt_liver' ? BLOB_FILES.TT_LIVER_TWEETS
    : accountId === 'litz_grp' ? BLOB_FILES.LITZ_GRP_TWEETS
    : accountId === 'ms_stripchat' ? BLOB_FILES.MS_STRIPCHAT_TWEETS
    : BLOB_FILES.LIVER_TWEETS;

  try {
    const blobData = await loadFromBlob<{ tweets: any[] }>(blobFile);
    if (blobData?.tweets) {
      console.log(`[Automation] Loaded ${accountId} tweets from Blob (${blobData.tweets.length} tweets)`);
      return blobData.tweets;
    }
    console.log(`[Automation] No tweets in Blob for ${accountId}`);
  } catch (e) {
    console.error(`[Automation] Failed to load tweets from Blob for ${accountId}:`, e);
  }

  // litz_grp の場合は tt_liver のデータを参照
  if (accountId === 'litz_grp') {
    try {
      const fallbackData = await loadFromBlob<{ tweets: any[] }>(BLOB_FILES.TT_LIVER_TWEETS);
      if (fallbackData?.tweets) {
        console.log(`[Automation] Using tt_liver tweets as fallback for litz_grp`);
        return fallbackData.tweets;
      }
    } catch {
      // ignore
    }
  }

  return [];
}

// 過去の伸びた投稿を取得（JSONファイルから）
// 最新5件は除外（「またかよ」を防ぐ）、engagement上位を返す
async function getOldPosts(accountId: AccountType, limit: number = 10) {
  const posts = await getSavedPosts(accountId);

  // エンゲージメント順にソートして、最新5件を除外、上位を返す
  return posts
    .slice(5) // 最新5件を除外
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

// トーンサンプル用（伸びてる投稿から取得、最新は除外）
async function getRecentPosts(accountId: AccountType, limit: number = 5) {
  const posts = await getSavedPosts(accountId);
  // 伸びてる投稿からトーンを学ぶ（最新5件は除外）
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

// POST: 自動投稿実行（Vercel AI SDK版）
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const {
      dryRun = false,
      accountId = 'liver' as AccountType,
      mode: requestedMode,
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

    // データを先に取得
    const recentPosts = await getRecentPosts(accountId, 5);
    const oldPosts = await getOldPosts(accountId, 10);
    const buzzPosts = await getBuzzPosts(10);

    // モード選択 - 50:50
    const mode = requestedMode || (Math.random() < 0.5 ? 'self' : 'transform');

    const sourcePosts = mode === 'self' ? oldPosts : buzzPosts;

    console.log(`[Automation] Mode: ${mode}, Source posts: ${sourcePosts.length}, Recent: ${recentPosts.length}`);

    // DM誘導するかどうか（3回に1回程度）
    const shouldIncludeCTA = Math.random() < 0.33;

    // プロンプトを構築
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
- このアカウントのターゲット層（${accountInfo.type}に興味がある女性）に響く内容
- 元ネタの「メッセージ」は維持しつつ、「表現」を変える
- 【必須】${minChars}〜${maxChars}文字で書くこと（短すぎNG、必ずこの範囲に収める）
- 絵文字は控えめに（0〜2個）
- 最初の10文字は元ネタと違う書き出しにする
- パクリに見えないように巧妙にアレンジ
- 【重要】適度に改行を入れて読みやすくする（3〜5文ごとに空行）
- 【重要】ハッシュタグは絶対に使用禁止
${shouldIncludeCTA ? '- 最後にさりげなくDM誘導を入れてもOK（「気になる方はDMください」程度）' : '- 【重要】DM誘導や問い合わせ誘導は入れないこと。情報提供で終わる投稿にする'}

【重要】投稿文のみを出力。説明や前置きは一切不要。「投稿を作成しました」等の文言も禁止。`
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
- このアカウントのターゲット層（${accountInfo.type}に興味がある女性）に響く内容
- テーマだけ借りて完全オリジナル化
- 構造を変える（リスト形式なら文章形式に、など）
- 数字があれば変える
- 最初の10文字は元ネタと違う書き出しにする
- 【必須】${minChars}〜${maxChars}文字で書くこと（短すぎNG、必ずこの範囲に収める）
- 絵文字は控えめに（0〜2個）
- 【重要】適度に改行を入れて読みやすくする（3〜5文ごとに空行）
- 【重要】ハッシュタグは絶対に使用禁止
${shouldIncludeCTA ? '- 最後にさりげなくDM誘導を入れてもOK（「気になる方はDMください」程度）' : '- 【重要】DM誘導や問い合わせ誘導は入れないこと。情報提供や気づきで終わる投稿にする'}

【重要】投稿文のみを出力。説明や前置きは一切不要。「投稿を作成しました」等の文言も禁止。`;

    // 最大3回まで再生成（NGワードチェック）
    let generatedText = '';
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      const result = await generateText({
        model: getModel(),
        system: systemPrompt,
        prompt: `アカウント「${accountId}」向けの投稿を1つ生成してください。`,
      });

      generatedText = result.text.trim();
      const validation = validatePost(generatedText, accountId);

      if (validation.valid) {
        break;
      }

      console.log(`[Automation] NGワード検出（試行${retryCount + 1}）: ${validation.reason}`);
      retryCount++;

      if (retryCount >= maxRetries) {
        console.error(`[Automation] ${maxRetries}回再生成してもNGワードが除去できませんでした`);
        return NextResponse.json({
          success: false,
          error: `NGワードが除去できません: ${validation.reason}`,
          accountId,
          retries: retryCount,
        }, { status: 400 });
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`[Automation] Generated in ${processingTime}ms, mode=${mode}, retries=${retryCount}`);
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
        processingTime,
      });
    }

    // 実際に投稿
    const [postResult] = await postToAllAccounts([
      { account: accountId, text: generatedText },
    ]);

    if (postResult.success) {
      // Note: Vercelはread-onlyなのでファイル書き込みスキップ
      // 将来的にはSupabaseに保存する
      // await addToPostsHistory({
      //   id: postResult.id || `post_${Date.now()}`,
      //   text: generatedText,
      //   account: accountId,
      //   target: mode === 'self' ? '過去投稿リライト' : 'バズ投稿変換',
      //   benefit: 'AI自動生成',
      //   score: 10,
      //   tweetId: postResult.id,
      //   timestamp: new Date().toISOString(),
      // });

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

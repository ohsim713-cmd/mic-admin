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
    chatre2: `チャトレ事務所（@ms_stripchat）
- 国内・海外両方のチャトレサイトに対応する事務所
- 国内サイト: FANZA、エンジェルライブ、ジュエルライブなど
- 海外サイト: Stripchat、FC2、FC2ラブチップ、デラックスライブなど
- ターゲット: チャトレで稼ぎたい女性（国内・海外問わず）
- トーン: 敬語ベースで親しみやすい口調。「〜なんですよね」「〜だったりします」など柔らかい敬語
- 【禁止表現】「高収入を目指しませんか」「サポートします」「無料相談」「お気軽にお問い合わせください」など求人サイトっぽい硬い表現は絶対NG。「ズバリ」「やばい」「〜わよ」などおねえ言葉もNG
- 【絶対禁止ワード】ライバー、TikTok、TikTokライブ ← これらはライバー事務所のワードなので使用禁止
- 【OK表現】「うちでは国内も海外も〜」「FANZAだと〜ですよね」「ストチャなら〜」「詳しくはDMで」など自然な敬語
- キーワード: チャトレ、FANZA、エンジェルライブ、ストチャ、Stripchat、FC2、高単価
- 【重要】国内・海外サイトの違いや特徴をリアルに発信すること`,
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

// 競合アカウントの投稿を取得（ライバー系のみ）
async function getCompetitorPosts(accountType: 'liver' | 'chatre', limit: number = 10) {
  const fs = await import('fs');
  const path = await import('path');

  // ライバー系競合アカウント
  const liverCompetitors = [
    'meg_lsm',        // @meg_lsm
    'gofine_contact', // @gofine_contact
  ];
  // チャトレ系競合アカウント
  const chatreCompetitors = [
    'zeno_chatlady',    // @zeno_chatlady (eng:143)
    'terakado_chat55',  // @terakado_chat55 (eng:84)
    'stripchat_queen',  // @STRIPCHAT_Queen (eng:37)
    'dxlive_queenca',   // @DXLIVE_Queenca (eng:261)
    'ufikersx',         // @UfIkERsxf941392 (eng:67)
    'noah_chatlady',    // @Noah_ChatLady (eng:74)
    'chatlady_yuniko',  // @chatlady_yuniko (eng:55)
    'dx_job',           // @DX_JOB (eng:22)
    'amica_chatlady',   // @amica_chatlady (eng:43)
    'seed_liver',       // @seed_Liver (eng:235)
    'muse_studio',      // @muse_studio0700 (eng:13)
    'azu_live',         // @azu_live_xxx (eng:11)
  ];

  const targetCompetitors = accountType === 'liver' ? liverCompetitors : chatreCompetitors;

  if (targetCompetitors.length === 0) return [];

  const benchmarkDir = path.join(process.cwd(), 'knowledge', 'benchmark');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPosts: any[] = [];

  try {
    if (!fs.existsSync(benchmarkDir)) return [];

    for (const competitor of targetCompetitors) {
      const filePath = path.join(benchmarkDir, `${competitor}.json`);
      if (!fs.existsSync(filePath)) continue;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const tweets = data.tweets || data.originalTweets || [];

      // 競合アカウント情報を付与
      for (const tweet of tweets) {
        allPosts.push({
          text: tweet.text,
          engagement: tweet.engagement || (tweet.metrics?.likes || 0) + (tweet.metrics?.retweets || 0) * 3,
          source: `@${competitor}`,
        });
      }
    }

    console.log(`[Automation] Loaded ${allPosts.length} competitor posts for ${accountType}`);

    // エンゲージメント順でソートして上位を返す
    return allPosts
      .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
      .slice(0, limit);
  } catch (e) {
    console.error('[Automation] Failed to load competitor posts:', e);
    return [];
  }
}

// note記事からネタを取得（ライバー/チャトレ完全分離）
async function getNoteContent(accountType: 'liver' | 'chatre', limit: number = 5) {
  const fs = await import('fs');
  const path = await import('path');

  const noteDir = path.join(process.cwd(), 'knowledge', 'note');
  const articles: { title: string; excerpt: string; likeCount: number }[] = [];

  // チャトレ系noteアカウント
  const chatreNoteAccounts = ['terakado_chat55', 'noire_ni', 'ribonchandesu', 'sugarmint', 'reina_dayoooo'];
  // ライバー系noteアカウント（今後追加）
  const liverNoteAccounts: string[] = [];

  const targetAccounts = accountType === 'chatre' ? chatreNoteAccounts : liverNoteAccounts;

  try {
    if (!fs.existsSync(noteDir)) return [];

    const files = fs.readdirSync(noteDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      // アカウントタイプでフィルタ
      const accountName = file.replace('.json', '');
      if (!targetAccounts.includes(accountName)) continue;

      const data = JSON.parse(fs.readFileSync(path.join(noteDir, file), 'utf-8'));
      if (data.articles) {
        for (const article of data.articles) {
          // 本文から最初の300文字を抽出
          const body = article.body || '';
          const excerpt = body.replace(/^#.*$/gm, '').replace(/\n+/g, ' ').trim().slice(0, 300);
          articles.push({
            title: article.title,
            excerpt,
            likeCount: article.likeCount || 0,
          });
        }
      }
    }

    // いいね順でソートして返す
    return articles
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, limit);
  } catch (e) {
    console.error('[Automation] Failed to load note content:', e);
    return [];
  }
}

// WordPress/ブログ記事からネタを取得（ライバー/チャトレ完全分離）
async function getBlogContent(accountType: 'liver' | 'chatre', limit: number = 5) {
  const fs = await import('fs');
  const path = await import('path');

  // チャトレ: knowledge/chatre/, ライバー: knowledge/liver/
  const blogDir = path.join(process.cwd(), 'knowledge', accountType === 'chatre' ? 'chatre' : 'liver');
  const articles: { title: string; excerpt: string; source: string }[] = [];

  try {
    if (!fs.existsSync(blogDir)) return [];

    const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(blogDir, file), 'utf-8'));
      if (data.articles) {
        for (const article of data.articles) {
          // 本文から最初の300文字を抽出
          const body = article.body || '';
          const excerpt = body.replace(/^#.*$/gm, '').replace(/\n+/g, ' ').trim().slice(0, 300);
          articles.push({
            title: article.title,
            excerpt,
            source: data.siteName || file,
          });
        }
      }
    }

    // ランダムに並べ替えて返す
    return articles
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);
  } catch (e) {
    console.error('[Automation] Failed to load blog content:', e);
    return [];
  }
}

// 保存済みの過去投稿を取得（Blobのみ - Vercel read-only対策）
async function getSavedPosts(accountId: AccountType) {
  // アカウント別のBlobファイル名
  const blobFile = accountId === 'tt_liver' ? BLOB_FILES.TT_LIVER_TWEETS
    : accountId === 'litz_grp' ? BLOB_FILES.LITZ_GRP_TWEETS
    : accountId === 'ms_stripchat' ? BLOB_FILES.MS_STRIPCHAT_TWEETS
    : accountId === 'chatre1' ? BLOB_FILES.MIC_CHAT_TWEETS
    : accountId === 'chatre2' ? BLOB_FILES.MIC_CHAT_TWEETS
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

  // chatre1/chatre2 の場合はローカルファイルからフォールバック
  if (accountId === 'chatre1' || accountId === 'chatre2') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const localPath = path.join(process.cwd(), 'knowledge', 'mic_chat_tweets_clean.json');
      if (fs.existsSync(localPath)) {
        const data = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        // originalTweetsを使用（プレゼント企画以外）
        const tweets = data.originalTweets || data.allTweets || [];
        console.log(`[Automation] Loaded ${accountId} tweets from local file (${tweets.length} tweets)`);
        return tweets;
      }
    } catch (e) {
      console.error(`[Automation] Failed to load local file for ${accountId}:`, e);
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

    // アカウントタイプを判定
    const isLiver = accountId === 'tt_liver' || accountId === 'litz_grp';
    const accountType = isLiver ? 'liver' : 'chatre';

    // note記事からネタを取得（アカウントタイプで分離）
    const noteContent = await getNoteContent(accountType, 10);
    const blogContent = await getBlogContent(accountType, 10);
    // 競合アカウントの投稿を取得（ライバー系のみ）
    const competitorPosts = await getCompetitorPosts(accountType, 15);
    console.log(`[Automation] Note: ${noteContent.length}, Blog: ${blogContent.length}, Competitor: ${competitorPosts.length} (${accountType})`);

    // 投稿フォーマット（ランダム選択）
    const formats = ['standard', 'qa', 'tips', 'myth'] as const;
    const postFormat = formats[Math.floor(Math.random() * formats.length)];

    // モード選択 - 両方とも競合モードあり
    // ライバー系: 25% self, 20% transform, 20% note, 15% blog, 20% competitor
    // チャトレ系: 25% self, 20% transform, 20% note, 15% blog, 20% competitor
    const rand = Math.random();
    const mode = requestedMode || (
      rand < 0.25 ? 'self' :
      rand < 0.45 ? 'transform' :
      rand < 0.65 ? 'note' :
      rand < 0.80 ? 'blog' : 'competitor'
    );

    const sourcePosts = mode === 'self' ? oldPosts
      : mode === 'transform' ? buzzPosts
      : mode === 'competitor' ? competitorPosts
      : [];

    console.log(`[Automation] Mode: ${mode}, Format: ${postFormat}, Source: ${sourcePosts.length}, Note: ${noteContent.length}, Blog: ${blogContent.length}, Competitor: ${competitorPosts.length}`);

    // DM誘導するかどうか（3回に1回程度）
    const shouldIncludeCTA = Math.random() < 0.33;

    // フォーマット別の指示
    const formatInstructions = {
      standard: '',
      qa: `
## 投稿フォーマット: Q&A形式
- 「Q. 〜？」で始めて「A. 〜」で答える形式
- よくある質問や疑問に答える形で書く
- 例: 「Q. チャトレって顔出し必須？ A. 実は...」`,
      tips: `
## 投稿フォーマット: Tips形式
- 「【知らないと損】」「【意外と知らない】」「【裏ワザ】」などで始める
- 実践的なアドバイスを短くまとめる`,
      myth: `
## 投稿フォーマット: 誤解解消形式
- 「〜って思ってませんか？実は...」の形式
- よくある誤解や思い込みを解消する内容`,
    };

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
${formatInstructions[postFormat]}

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
      : mode === 'note'
      ? `あなたはSNS運用のエキスパートです。
以下のnote記事から1つ選び、そのエッセンスを抽出してX(Twitter)用の投稿に変換してください。

## アカウント情報
${accountInfo.description}

## 参考note記事（人気順）
${noteContent.map((n, i) => `${i + 1}. 【${n.title}】\n${n.excerpt}...`).join('\n\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}
${formatInstructions[postFormat]}

## 条件
- 記事の核心部分や気づきを、X向けに短くまとめる
- 長い説明を省いて、インパクトのある一言にする
- 【必須】${minChars}〜${maxChars}文字で書くこと
- 絵文字は控えめに（0〜2個）
- 【重要】適度に改行を入れて読みやすくする
- 【重要】ハッシュタグは絶対に使用禁止
- 【重要】記事の宣伝やリンク誘導はしない。独立した投稿として価値がある内容に
${shouldIncludeCTA ? '- 最後にさりげなくDM誘導を入れてもOK' : '- DM誘導は入れない。情報提供で終わる投稿にする'}

【重要】投稿文のみを出力。説明や前置きは一切不要。`
      : mode === 'blog'
      ? `あなたはSNS運用のエキスパートです。
以下のブログ記事から1つ選び、そのエッセンスを抽出してX(Twitter)用の投稿に変換してください。

## アカウント情報
${accountInfo.description}

## 参考ブログ記事
${blogContent.map((b, i) => `${i + 1}. 【${b.title}】(${b.source})\n${b.excerpt}...`).join('\n\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}
${formatInstructions[postFormat]}

## 条件
- 記事の核心部分や実践的なアドバイスを、X向けに短くまとめる
- 専門的な内容をわかりやすく言い換える
- 【必須】${minChars}〜${maxChars}文字で書くこと
- 絵文字は控えめに（0〜2個）
- 【重要】適度に改行を入れて読みやすくする
- 【重要】ハッシュタグは絶対に使用禁止
- 【重要】記事の宣伝やリンク誘導はしない。独立した投稿として価値がある内容に
${shouldIncludeCTA ? '- 最後にさりげなくDM誘導を入れてもOK' : '- DM誘導は入れない。情報提供で終わる投稿にする'}

【重要】投稿文のみを出力。説明や前置きは一切不要。`
      : mode === 'competitor'
      ? `あなたはSNS運用のエキスパートです。
以下の競合アカウントの伸びた投稿から1つ選び、そのテーマやアプローチを参考に、自社アカウントのトーンで完全オリジナルの投稿を作成してください。

## アカウント情報
${accountInfo.description}

## 競合アカウントの伸びた投稿（参考）
${sourcePosts.map((p: { text: string; engagement?: number; source?: string }, i: number) => `${i + 1}. [${p.source || '競合'}] eng:${p.engagement || 0}\n${p.text}`).join('\n\n')}

## 自社の最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}
${formatInstructions[postFormat]}

## 競合分析のポイント
- なぜこの投稿がエンゲージメントを獲得したのかを分析
- 共感ポイント、情報価値、感情の動きを把握
- 良い点を取り入れつつ、自社らしさを出す

## 条件
- 競合のテーマやアプローチは参考にするが、表現は完全オリジナル
- 【重要】競合の投稿をコピーしない。エッセンスだけ抽出して自分の言葉で書く
- このアカウントのターゲット層（${accountInfo.type}に興味がある女性）に響く内容
- 【必須】${minChars}〜${maxChars}文字で書くこと
- 絵文字は控えめに（0〜2個）
- 【重要】適度に改行を入れて読みやすくする
- 【重要】ハッシュタグは絶対に使用禁止
${shouldIncludeCTA ? '- 最後にさりげなくDM誘導を入れてもOK' : '- DM誘導は入れない。情報提供で終わる投稿にする'}

【重要】投稿文のみを出力。説明や前置きは一切不要。`
      : `あなたはSNS運用のエキスパートです。
以下のバズ投稿から1つ選び、そのテーマを借りて指定アカウントのトーンで完全に書き直してください。

## アカウント情報
${accountInfo.description}

## バズ投稿（参考）- これらがバズった理由を分析して活かすこと
${sourcePosts.map((p: { text: string; engagement?: number }, i: number) => `${i + 1}. ${JSON.stringify(p)}`).join('\n')}

## 最近の投稿（トーン参考）
${recentPosts.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n\n')}
${formatInstructions[postFormat]}

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
        format: postFormat,
        accountId,
        accountType,
        generatedText,
        sourcePostsCount: sourcePosts.length,
        noteCount: noteContent.length,
        blogCount: blogContent.length,
        competitorCount: competitorPosts.length,
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

/**
 * Vercel AI SDK で投稿生成テスト
 */
import dotenv from 'dotenv';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.local を読み込み
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// バズ投稿を取得
function getBuzzPosts() {
  const buzzPath = path.join(__dirname, '..', 'knowledge', 'buzz_stock.json');
  const buzz = JSON.parse(fs.readFileSync(buzzPath, 'utf-8'));
  const isJapanese = (text) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);

  return Object.values(buzz.genres)
    .flatMap(g => g.posts)
    .filter(p => isJapanese(p.text || ''))
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 10);
}

// 過去投稿を取得
function getOldPosts(accountId) {
  const filePath = path.join(__dirname, '..', 'knowledge', `${accountId}_tweets.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.tweets
      .slice(5)
      .sort((a, b) => {
        const aScore = a.engagement || (a.metrics?.likes || 0) + (a.metrics?.retweets || 0);
        const bScore = b.engagement || (b.metrics?.likes || 0) + (b.metrics?.retweets || 0);
        return bScore - aScore;
      })
      .slice(0, 5);
  } catch {
    return [];
  }
}

const accountDescriptions = {
  liver: `ライバー事務所（@tt_liver）
- Pococha、TikTok LIVE、17LIVE等でライブ配信者を募集
- 敬語ベースで親しみやすい口調
- 【絶対禁止】チャトレ、ストチャ、アダルト系ワード`,
  chatre1: `チャトレ事務所（@mic_chat_）
- チャットレディ募集
- 敬語ベースで親しみやすい口調
- 【絶対禁止】ライバー、TikTok系ワード`,
  chatre2: `海外チャトレ専門（@ms_stripchat）
- Stripchat特化、高単価
- 敬語ベースで親しみやすい口調
- 【絶対禁止】ライバー、TikTok系ワード`
};

async function generatePost(accountId, buzzPost) {
  const recentPosts = getOldPosts(accountId).slice(0, 3).map(p => p.text);

  const systemPrompt = `あなたはSNS運用のエキスパートです。
以下のバズ投稿のテーマを借りて、指定アカウントのトーンで完全に書き直してください。

## アカウント
${accountDescriptions[accountId]}

## バズ投稿（テーマ参考）
${buzzPost.text}

## このアカウントの過去投稿（トーン参考）
${recentPosts.map((t, i) => `${i+1}. ${t}`).join('\n\n')}

## 条件
- 140〜280文字
- テーマだけ借りて完全オリジナル化
- 構造を変える
- 最初の10文字は元ネタと違う書き出し
- ハッシュタグ禁止
- 絵文字は0〜2個

【重要】投稿文のみを出力。説明不要。`;

  const result = await generateText({
    model: google('gemini-2.0-flash'),
    prompt: systemPrompt,
  });

  return result.text.trim();
}

async function main() {
  console.log('=== transformモード テスト ===\n');

  const buzzPosts = getBuzzPosts();

  // 3つのバズ投稿でテスト
  const testBuzz = [buzzPosts[0], buzzPosts[2], buzzPosts[4]];

  for (let i = 0; i < testBuzz.length; i++) {
    const buzz = testBuzz[i];
    console.log(`\n--- 元ネタ ${i+1} (E:${buzz.engagement}) ---`);
    console.log(buzz.text.substring(0, 100) + '...\n');

    // liver
    console.log('【liver】');
    const liver = await generatePost('liver', buzz);
    console.log(liver);
    console.log(`(${liver.length}文字)\n`);

    // chatre1
    console.log('【chatre1】');
    const chatre1 = await generatePost('chatre1', buzz);
    console.log(chatre1);
    console.log(`(${chatre1.length}文字)\n`);
  }
}

main().catch(console.error);

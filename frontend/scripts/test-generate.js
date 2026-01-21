/**
 * 投稿生成テスト
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.log('GEMINI_API_KEY が未設定です');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function generatePost(accountId, mode) {
  // 過去投稿を取得
  const filePath = path.join(__dirname, '..', 'knowledge', accountId + '_tweets.json');
  let posts = [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    posts = data.tweets || [];
  } catch {}

  // engagement上位を取得
  const oldPosts = posts
    .slice(5)
    .sort((a, b) => {
      const aScore = a.engagement || (a.metrics?.likes || 0) + (a.metrics?.retweets || 0);
      const bScore = b.engagement || (b.metrics?.likes || 0) + (b.metrics?.retweets || 0);
      return bScore - aScore;
    })
    .slice(0, 5);

  // バズ投稿
  let buzzPosts = [];
  try {
    const buzzPath = path.join(__dirname, '..', 'knowledge', 'buzz_stock.json');
    const buzz = JSON.parse(fs.readFileSync(buzzPath, 'utf-8'));
    const isJapanese = (text) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    buzzPosts = Object.values(buzz.genres)
      .flatMap(g => g.posts)
      .filter(p => isJapanese(p.text || ''))
      .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
      .slice(0, 5);
  } catch {}

  const sourcePosts = mode === 'self' ? oldPosts : buzzPosts;

  const accountDescriptions = {
    liver: 'ライバー事務所（@tt_liver）- Pococha、TikTok LIVE、17LIVE等でライブ配信者を募集。敬語ベースで親しみやすい口調。【絶対禁止】チャトレ、ストチャ、アダルト系ワード',
    chatre1: 'チャトレ事務所（@mic_chat_）- チャットレディ募集。敬語ベースで親しみやすい口調。【絶対禁止】ライバー、TikTok系ワード',
    chatre2: '海外チャトレ専門（@ms_stripchat）- Stripchat特化。【絶対禁止】ライバー、TikTok系ワード'
  };

  let systemPrompt;
  if (mode === 'self') {
    systemPrompt = `あなたはSNS運用のエキスパートです。
以下の過去投稿を1つ選び、同じトーンで別表現に書き直してください。

## アカウント
${accountDescriptions[accountId]}

## 過去の伸びた投稿
${sourcePosts.map((p, i) => (i+1) + '. ' + p.text).join('\n\n')}

## 条件
- 140〜280文字
- 絵文字は0〜2個
- ハッシュタグ禁止
- 最初の10文字は元ネタと違う書き出し

【重要】投稿文のみを出力。説明不要。`;
  } else {
    systemPrompt = `あなたはSNS運用のエキスパートです。
以下のバズ投稿から1つ選び、テーマを借りて完全に書き直してください。

## アカウント
${accountDescriptions[accountId]}

## バズ投稿
${sourcePosts.map((p, i) => (i+1) + '. ' + p.text).join('\n\n')}

## 条件
- 140〜280文字
- テーマだけ借りて完全オリジナル化
- ハッシュタグ禁止

【重要】投稿文のみを出力。説明不要。`;
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(systemPrompt);
  return result.response.text().trim();
}

async function main() {
  console.log('=== 投稿生成テスト ===\n');

  // liver (self mode)
  console.log('【liver - selfモード】');
  const liver = await generatePost('liver', 'self');
  console.log(liver);
  console.log('文字数:', liver.length);
  console.log('');

  // chatre1 (self mode)
  console.log('【chatre1 - selfモード】');
  const chatre1 = await generatePost('chatre1', 'self');
  console.log(chatre1);
  console.log('文字数:', chatre1.length);
  console.log('');

  // chatre2 (transform mode)
  console.log('【chatre2 - transformモード】');
  const chatre2 = await generatePost('chatre2', 'transform');
  console.log(chatre2);
  console.log('文字数:', chatre2.length);
}

main().catch(console.error);

/**
 * 毎日1回実行するバズ投稿スクレイパー
 *
 * 目的:
 * - 多ジャンルのバズ投稿を収集してストック
 * - API使用量を最小化（月500回制限）
 * - 収集したネタ・テーマから毎日の投稿を生成
 *
 * API使用量:
 * - 1日1回実行 × 2検索 = 2リクエスト/日
 * - 月60リクエスト程度（余裕あり）
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '30bdff99b9mshfab5d2727125d43p189157jsn574e512b628c';
const RAPIDAPI_HOST = 'twitter241.p.rapidapi.com';

const BUZZ_STOCK_PATH = path.join(__dirname, '..', 'knowledge', 'buzz_stock.json');
const TRENDING_POSTS_PATH = path.join(__dirname, '..', 'knowledge', 'trending_posts.json');

// 検索クエリグループ（1日2つを交互に使用）
const QUERY_GROUPS = [
  // グループA: キャリア・副業系
  ['転職 気づいた OR 副業 成功 OR 仕事辞めたい', 'フリーランス OR 在宅ワーク 稼ぐ'],
  // グループB: メンタル・人間関係系
  ['メンタル 大事 OR 自己肯定感 OR 人間関係', '習慣 変わった OR 朝活 効果'],
  // グループC: 人生論・マインド系
  ['人生 後悔 OR 気づいた 大切 OR 経験 学んだ', '成功 秘訣 OR 成長 マインド'],
  // グループD: チャトレ・ライバー系（強化）
  ['チャトレ 稼ぐ OR チャットレディ 収入 OR ストチャ', 'ライバー 事務所 OR TikTok 配信 稼ぐ'],
  // グループE: 在宅・副業女性向け
  ['在宅ワーク 女性 OR 副業 主婦 OR 在宅 稼げる', '高収入 バイト OR 日払い 在宅'],
  // グループF: 美容・自己投資系
  ['美容 習慣 OR 自己投資 OR ダイエット 続けた', '整形 OR 脱毛 OR 美容医療'],
];

/**
 * Twitter241 APIで検索
 */
async function searchTweets(query, count = 40) {
  const url = `https://${RAPIDAPI_HOST}/search?query=${encodeURIComponent(query)}&count=${count}&type=Top`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return await response.json();
}

/**
 * ツイートデータをパース
 */
function parseTweets(data) {
  const tweets = [];
  const instructions = data.result?.timeline?.instructions || [];

  for (const instruction of instructions) {
    const entries = instruction.entries || [];
    for (const entry of entries) {
      // 通常のツイートエントリ
      if (entry.content?.itemContent?.tweet_results?.result) {
        const tweet = extractTweetData(entry.content.itemContent.tweet_results.result);
        if (tweet) tweets.push(tweet);
      }

      // グループ化されたツイート
      if (entry.content?.items) {
        for (const item of entry.content.items) {
          const result = item.item?.itemContent?.tweet_results?.result;
          if (result) {
            const tweet = extractTweetData(result);
            if (tweet) tweets.push(tweet);
          }
        }
      }
    }
  }

  return tweets;
}

/**
 * ツイートデータを抽出
 */
function extractTweetData(result) {
  const legacy = result.legacy || result.tweet?.legacy;
  const userLegacy = result.core?.user_results?.result?.legacy ||
                    result.tweet?.core?.user_results?.result?.legacy;

  if (!legacy || !legacy.full_text) return null;
  if (legacy.full_text.startsWith('RT @')) return null; // RT除外
  if (legacy.full_text.length < 50) return null; // 短すぎるの除外

  const text = legacy.full_text.replace(/https?:\/\/\S+/g, '').trim();
  if (text.length < 30) return null;

  return {
    id: legacy.id_str,
    text: text,
    likes: legacy.favorite_count || 0,
    retweets: legacy.retweet_count || 0,
    replies: legacy.reply_count || 0,
    quotes: legacy.quote_count || 0,
    author: userLegacy?.screen_name || 'unknown',
    createdAt: legacy.created_at,
  };
}

/**
 * エンゲージメントスコア計算
 */
function calculateEngagement(tweet) {
  return tweet.likes + (tweet.retweets * 3) + (tweet.replies * 2) + (tweet.quotes * 4);
}

/**
 * ジャンル判定
 */
function detectGenre(text) {
  const genrePatterns = {
    career: /転職|仕事|会社|働き方|キャリア|上司|退職|正社員/,
    sideBusiness: /副業|収入|稼|お金|投資|年収|月収/,
    mental: /メンタル|心|病|休|疲|自己肯定|自分を|つらい/,
    relationship: /人間関係|友達|嫌|好|合わない|距離|付き合/,
    lifestyle: /朝|夜|習慣|ルーティン|生活|時間|睡眠/,
    mindset: /マインド|考え方|成功|努力|挑戦|成長|行動/,
    lifeLesson: /人生|後悔|気づ|学|大事|経験|大切/,
    beauty: /美容|肌|健康|ダイエット|体|運動/,
    competitor: /ライバー|チャトレ|配信|事務所|在宅ワーク/,
  };

  for (const [genre, pattern] of Object.entries(genrePatterns)) {
    if (pattern.test(text)) return genre;
  }
  return 'general';
}

/**
 * バズった理由を分析
 */
function analyzeWhyWorks(tweet) {
  const text = tweet.text;
  const reasons = [];

  if (/\d+/.test(text)) reasons.push('数字');
  if (text.includes('\n') && text.split('\n').length >= 3) reasons.push('リスト');
  if (/ぶっちゃけ|正直|実は|ここだけ|本音/.test(text)) reasons.push('本音');
  if (/\?|？/.test(text)) reasons.push('問いかけ');
  if (/【|】|「|」/.test(text)) reasons.push('強調');
  if (/〜した結果|やってみた|続けた/.test(text)) reasons.push('体験談');
  if (/共感|わかる|あるある/.test(text)) reasons.push('共感');

  const engagement = calculateEngagement(tweet);
  if (engagement > 1000) reasons.push('高エンゲージ');

  return reasons.length > 0 ? reasons.join('+') : 'バイラル';
}

/**
 * ネタ・テーマを抽出
 */
function extractTopics(tweet) {
  const text = tweet.text;
  const topics = [];

  // 数字を含むパターン
  const numberMatch = text.match(/(\d+[年月日回個件万円歳%])/g);
  if (numberMatch) topics.push(...numberMatch.slice(0, 2));

  // 「〜すること」「〜なこと」パターン
  const thingMatch = text.match(/[ぁ-んァ-ン一-龥]+(?:する|した|な)こと/g);
  if (thingMatch) topics.push(...thingMatch.slice(0, 2));

  // キーワード抽出
  const keywordPatterns = [
    /(?:大事|重要|必要|大切)(?:な|だ)/,
    /(?:やめた|始めた|変えた|気づいた)/,
    /(?:成功|失敗|経験|学び)/,
  ];

  for (const pattern of keywordPatterns) {
    const match = text.match(pattern);
    if (match) topics.push(match[0]);
  }

  return [...new Set(topics)].slice(0, 5);
}

/**
 * メイン処理
 */
async function main() {
  console.log('=== Daily Buzz Scraper ===');
  console.log('Time:', new Date().toISOString());

  // 今日使うクエリグループを決定（日付ベースでローテーション）
  const dayOfMonth = new Date().getDate();
  const groupIndex = dayOfMonth % QUERY_GROUPS.length;
  const queries = QUERY_GROUPS[groupIndex];

  console.log(`Using query group ${groupIndex}:`, queries);

  // buzz_stock.json読み込み
  let buzzStock;
  try {
    const content = fs.readFileSync(BUZZ_STOCK_PATH, 'utf-8');
    buzzStock = JSON.parse(content);
  } catch {
    console.error('buzz_stock.json not found, creating...');
    return;
  }

  let allTweets = [];
  let apiCalls = 0;

  // 各クエリで検索
  for (const query of queries) {
    console.log(`\nSearching: "${query}"`);
    try {
      const data = await searchTweets(query, 40); // 1クエリで40件
      apiCalls++;
      const tweets = parseTweets(data);
      console.log(`  Found: ${tweets.length} tweets`);
      allTweets = allTweets.concat(tweets);
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
    // レート制限対策
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nTotal API calls: ${apiCalls}`);
  console.log(`Total tweets fetched: ${allTweets.length}`);

  // 重複排除
  const seen = new Set();
  allTweets = allTweets.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // エンゲージメント順でソート
  allTweets.sort((a, b) => calculateEngagement(b) - calculateEngagement(a));

  // 既存IDを収集
  const existingIds = new Set();
  for (const genre of Object.values(buzzStock.genres)) {
    for (const post of genre.posts) {
      existingIds.add(post.id);
    }
  }

  // 新規ツイートをジャンル別に追加
  let addedCount = 0;
  const todaysPosts = []; // 今日のトップ投稿

  for (const tweet of allTweets) {
    const postId = `x-${tweet.id}`;
    if (existingIds.has(postId)) continue;

    const engagement = calculateEngagement(tweet);
    if (engagement < 100) continue; // 低エンゲージは除外

    const genre = detectGenre(tweet.text);
    const post = {
      id: postId,
      text: tweet.text,
      engagement: engagement,
      whyWorks: analyzeWhyWorks(tweet),
      topics: extractTopics(tweet),
      author: tweet.author,
      addedAt: new Date().toISOString(),
    };

    buzzStock.genres[genre].posts.unshift(post);
    existingIds.add(postId);
    addedCount++;

    // 今日のトップ10を記録
    if (todaysPosts.length < 10) {
      todaysPosts.push({ ...post, genre });
    }
  }

  // 各ジャンルの投稿数を制限（50件まで）
  for (const genre of Object.values(buzzStock.genres)) {
    if (genre.posts.length > 50) {
      genre.posts = genre.posts.slice(0, 50);
    }
  }

  // 統計更新
  let totalPosts = 0;
  for (const genre of Object.values(buzzStock.genres)) {
    totalPosts += genre.posts.length;
  }

  buzzStock.stats.totalPosts = totalPosts;
  buzzStock.stats.lastScrapeAt = new Date().toISOString();
  buzzStock.stats.scrapeHistory.unshift({
    date: new Date().toISOString().split('T')[0],
    apiCalls: apiCalls,
    tweetsFound: allTweets.length,
    tweetsAdded: addedCount,
  });

  // 履歴は30日分まで
  if (buzzStock.stats.scrapeHistory.length > 30) {
    buzzStock.stats.scrapeHistory = buzzStock.stats.scrapeHistory.slice(0, 30);
  }

  buzzStock.lastUpdated = new Date().toISOString();

  // 保存
  fs.writeFileSync(BUZZ_STOCK_PATH, JSON.stringify(buzzStock, null, 2), 'utf-8');

  // 結果表示
  console.log('\n=== Results ===');
  console.log(`Added: ${addedCount} new posts`);
  console.log(`Total stock: ${totalPosts} posts`);
  console.log('\nPosts by genre:');
  for (const [key, genre] of Object.entries(buzzStock.genres)) {
    console.log(`  ${genre.name}: ${genre.posts.length}`);
  }

  // 今日のトップ投稿を表示
  console.log('\n=== Today\'s Top Posts ===');
  for (const post of todaysPosts.slice(0, 5)) {
    console.log('---');
    console.log(`Genre: ${post.genre}`);
    console.log(`Engagement: ${post.engagement}`);
    console.log(`Why: ${post.whyWorks}`);
    console.log(`Topics: ${post.topics.join(', ')}`);
    console.log(`Text: ${post.text.substring(0, 100)}...`);
  }

  // trending_posts.jsonにもトップ5を追加
  await updateTrendingPosts(todaysPosts.slice(0, 5));

  console.log('\n=== Done ===');
}

/**
 * trending_posts.jsonを更新
 */
async function updateTrendingPosts(topPosts) {
  let trendingData;
  try {
    const content = fs.readFileSync(TRENDING_POSTS_PATH, 'utf-8');
    trendingData = JSON.parse(content);
  } catch {
    return;
  }

  const existingIds = new Set(trendingData.posts.map(p => p.id));
  let added = 0;

  for (const post of topPosts) {
    if (existingIds.has(post.id)) continue;

    trendingData.posts.unshift({
      id: post.id,
      text: post.text,
      source: 'X (Twitter)',
      category: getJapaneseCategory(post.genre),
      whyWorks: post.whyWorks,
      addedAt: post.addedAt,
      engagement: post.engagement,
      author: post.author,
    });
    added++;
  }

  if (trendingData.posts.length > 100) {
    trendingData.posts = trendingData.posts.slice(0, 100);
  }

  trendingData.lastUpdated = new Date().toISOString();
  fs.writeFileSync(TRENDING_POSTS_PATH, JSON.stringify(trendingData, null, 2), 'utf-8');

  console.log(`\nUpdated trending_posts.json: +${added} posts`);
}

function getJapaneseCategory(genre) {
  const map = {
    career: 'キャリア',
    sideBusiness: '副業・収入',
    mental: 'メンタル',
    relationship: '人間関係',
    lifestyle: 'ライフスタイル',
    mindset: 'マインド',
    lifeLesson: '人生論',
    beauty: '美容・健康',
    competitor: '競合・業界',
    general: '一般',
  };
  return map[genre] || '一般';
}

main().catch(console.error);

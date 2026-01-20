const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '30bdff99b9mshfab5d2727125d43p189157jsn574e512b628c';
const RAPIDAPI_HOST = 'twitter241.p.rapidapi.com';

async function searchTweets(query) {
  const url = `https://${RAPIDAPI_HOST}/search?query=${encodeURIComponent(query)}&count=20&type=Top`;

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

function parseTweets(data) {
  const tweets = [];
  const instructions = data.result?.timeline?.instructions || [];

  for (const instruction of instructions) {
    const entries = instruction.entries || [];
    for (const entry of entries) {
      // Tweet entries
      if (entry.content?.itemContent?.tweet_results?.result) {
        const result = entry.content.itemContent.tweet_results.result;
        const legacy = result.legacy || result.tweet?.legacy;
        const userLegacy = result.core?.user_results?.result?.legacy ||
                          result.tweet?.core?.user_results?.result?.legacy;

        if (legacy && legacy.full_text && !legacy.full_text.startsWith('RT @')) {
          tweets.push({
            id: legacy.id_str,
            text: legacy.full_text.replace(/https?:\/\/\S+/g, '').trim(),
            likes: legacy.favorite_count || 0,
            retweets: legacy.retweet_count || 0,
            replies: legacy.reply_count || 0,
            author: userLegacy?.screen_name || 'unknown',
          });
        }
      }

      // Module entries (grouped tweets)
      if (entry.content?.items) {
        for (const item of entry.content.items) {
          const result = item.item?.itemContent?.tweet_results?.result;
          const legacy = result?.legacy || result?.tweet?.legacy;
          const userLegacy = result?.core?.user_results?.result?.legacy ||
                            result?.tweet?.core?.user_results?.result?.legacy;

          if (legacy && legacy.full_text && !legacy.full_text.startsWith('RT @')) {
            tweets.push({
              id: legacy.id_str,
              text: legacy.full_text.replace(/https?:\/\/\S+/g, '').trim(),
              likes: legacy.favorite_count || 0,
              retweets: legacy.retweet_count || 0,
              replies: legacy.reply_count || 0,
              author: userLegacy?.screen_name || 'unknown',
            });
          }
        }
      }
    }
  }

  return tweets;
}

function analyzeCategory(text) {
  if (/副業|収入|稼|お金|投資/.test(text)) return '副業・収入';
  if (/転職|仕事|会社|働き方|キャリア/.test(text)) return 'キャリア';
  if (/メンタル|心|病|休|疲/.test(text)) return 'メンタル';
  if (/人間関係|友達|嫌|好|合わない/.test(text)) return '人間関係';
  if (/人生|後悔|気づ|学|大事/.test(text)) return '人生論';
  if (/マインド|考え方|成功|努力/.test(text)) return 'マインド';
  return '一般';
}

function analyzeWhyWorks(tweet) {
  const reasons = [];
  const text = tweet.text;

  if (/\d+/.test(text)) reasons.push('具体的な数字');
  if (text.includes('\n')) reasons.push('リスト形式');
  if (/ぶっちゃけ|正直|実は|ここだけ/.test(text)) reasons.push('本音フック');
  if (/\?|？/.test(text)) reasons.push('問いかけ');
  if (/【|】|「|」/.test(text)) reasons.push('視覚的な強調');

  const engagement = tweet.likes + tweet.retweets * 3 + tweet.replies * 2;
  if (engagement > 500) reasons.push('高エンゲージメント');

  return reasons.length > 0 ? reasons.join(' + ') : 'バイラル要素あり';
}

async function main() {
  // 複数のキーワードで検索
  const queries = ['副業 成功', '転職 気づき', 'フリーランス 本音', '仕事辞めたい'];

  let allTweets = [];

  for (const query of queries) {
    console.log('Searching:', query);
    try {
      const data = await searchTweets(query);
      const tweets = parseTweets(data);
      console.log('  Found:', tweets.length, 'tweets');
      allTweets = allTweets.concat(tweets);
    } catch (e) {
      console.error('  Error:', e.message);
    }
    // レート制限回避
    await new Promise(r => setTimeout(r, 1000));
  }

  // 重複排除
  const seen = new Set();
  allTweets = allTweets.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // エンゲージメント順でソート
  allTweets.sort((a, b) => {
    const scoreA = a.likes + a.retweets * 3 + a.replies * 2;
    const scoreB = b.likes + b.retweets * 3 + b.replies * 2;
    return scoreB - scoreA;
  });

  // 上位10件を表示
  console.log('\n=== Top Tweets ===');
  const topTweets = allTweets.slice(0, 10);

  for (const tweet of topTweets) {
    const engagement = tweet.likes + tweet.retweets * 3 + tweet.replies * 2;
    console.log('---');
    console.log('Engagement:', engagement, '(likes:', tweet.likes, 'RT:', tweet.retweets, ')');
    console.log('Author:', tweet.author);
    console.log('Text:', tweet.text.substring(0, 150));
  }

  // trending_posts.jsonに追加
  const trendingPath = path.join(__dirname, '..', 'knowledge', 'trending_posts.json');
  let trendingData;

  try {
    const content = fs.readFileSync(trendingPath, 'utf-8');
    trendingData = JSON.parse(content);
  } catch {
    trendingData = {
      description: '業界問わず伸びてる投稿のお手本集',
      lastUpdated: new Date().toISOString(),
      posts: [],
    };
  }

  const existingIds = new Set(trendingData.posts.map(p => p.id));
  let added = 0;

  for (const tweet of topTweets) {
    const postId = `x-${tweet.id}`;
    if (existingIds.has(postId)) continue;
    if (tweet.text.length < 30) continue; // 短すぎるのは除外

    trendingData.posts.unshift({
      id: postId,
      text: tweet.text,
      source: 'X (Twitter)',
      category: analyzeCategory(tweet.text),
      whyWorks: analyzeWhyWorks(tweet),
      addedAt: new Date().toISOString(),
      engagement: tweet.likes + tweet.retweets * 3 + tweet.replies * 2,
      author: tweet.author,
    });
    added++;
  }

  // 最大100件に制限
  if (trendingData.posts.length > 100) {
    trendingData.posts = trendingData.posts.slice(0, 100);
  }

  trendingData.lastUpdated = new Date().toISOString();

  fs.writeFileSync(trendingPath, JSON.stringify(trendingData, null, 2), 'utf-8');
  console.log('\n=== Added', added, 'tweets to trending_posts.json ===');
  console.log('Total posts:', trendingData.posts.length);
}

main().catch(console.error);

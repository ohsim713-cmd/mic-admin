const { TwitterApi } = require('twitter-api-v2');

async function testLongTweet() {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY_TT_LIVER,
    appSecret: process.env.TWITTER_API_SECRET_TT_LIVER,
    accessToken: process.env.TWITTER_ACCESS_TOKEN_TT_LIVER,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET_TT_LIVER,
  });

  // 400文字以上のテスト文
  const longText = `【テスト投稿】X API v2 長文テスト

ライブ配信の世界では、特別なスキルがなくても稼げる人が増えています。

実際に未経験から始めた方でも、初月で5万円、3ヶ月後には月20万円を超えることも珍しくありません。

Pocochaや17LIVEなどのプラットフォームでは、ランクやギフトという明確な仕組みがあって、毎日コツコツ続けるだけで時給のような報酬が発生する制度もあるんです。

大切なのは毎日決まった時間に配信を続けること。

これだけで少しずつファンが増えていきます。興味があれば、まずは1日30分から始めてみませんか？

※これはAPI長文テストです`;

  console.log('テスト文字数:', longText.length);
  
  try {
    const result = await client.v2.tweet(longText);
    console.log('成功！Tweet ID:', result.data.id);
    console.log('全文投稿できた！');
    
    // テスト投稿を削除
    await client.v2.deleteTweet(result.data.id);
    console.log('テスト投稿を削除しました');
  } catch (error) {
    console.log('エラー:', error.message);
    if (error.data) {
      console.log('詳細:', JSON.stringify(error.data, null, 2));
    }
    if (error.code) {
      console.log('コード:', error.code);
    }
  }
}

testLongTweet();

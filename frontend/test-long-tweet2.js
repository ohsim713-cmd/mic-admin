const { TwitterApi } = require('twitter-api-v2');

async function testLongTweet() {
  // litz_grp で試す
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY_LITZ_GRP,
    appSecret: process.env.TWITTER_API_SECRET_LITZ_GRP,
    accessToken: process.env.TWITTER_ACCESS_TOKEN_LITZ_GRP,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET_LITZ_GRP,
  });

  // 400文字以上のテスト文
  const longText = `【長文テスト投稿】

ライブ配信の世界では、特別なスキルがなくても稼げる人が増えています。実際に未経験から始めた方でも、初月で5万円、3ヶ月後には月20万円を超えることも珍しくありません。

Pocochaや17LIVEなどのプラットフォームでは、ランクやギフトという明確な仕組みがあって、毎日コツコツ続けるだけで時給のような報酬が発生する制度もあるんです。

大切なのは毎日決まった時間に配信を続けること。最初は誰も見てくれなくて不安になるかもしれません。でも毎日決まった時間にスマホの前に座るだけで少しずつ常連さんが増えていくのが配信の面白いところです。

今の生活を少しでも変えたいけれど特別なスキルがないからと諦めていませんか。そんな方にこそスマホ一つで始められるライブ配信の世界を知ってほしいと思います。

これはAPIテストです。`;

  console.log('テスト文字数:', longText.length);
  
  try {
    const result = await client.v2.tweet(longText);
    console.log('成功！Tweet ID:', result.data.id);
    console.log('長文投稿成功！');
    
    // テスト投稿を削除
    setTimeout(async () => {
      await client.v2.deleteTweet(result.data.id);
      console.log('テスト投稿を削除しました');
    }, 3000);
  } catch (error) {
    console.log('エラー:', error.message);
    if (error.data) {
      console.log('詳細:', JSON.stringify(error.data, null, 2));
    }
  }
}

testLongTweet();

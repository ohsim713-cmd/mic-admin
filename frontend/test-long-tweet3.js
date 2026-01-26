const { TwitterApi } = require('twitter-api-v2');

async function testLongTweet() {
  // mic_chat で試す
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY_MIC_CHAT,
    appSecret: process.env.TWITTER_API_SECRET_MIC_CHAT,
    accessToken: process.env.TWITTER_ACCESS_TOKEN_MIC_CHAT,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET_MIC_CHAT,
  });

  // 450文字のテスト文
  const longText = `【長文テスト】

ライブ配信の世界では、特別なスキルがなくても稼げる人が増えています。実際に未経験から始めた方でも、初月で5万円、3ヶ月後には月20万円を超えることも珍しくありません。

Pocochaや17LIVEなどのプラットフォームでは、ランクやギフトという明確な仕組みがあって、毎日コツコツ続けるだけで時給のような報酬が発生する制度もあるんです。

大切なのは毎日決まった時間に配信を続けること。最初は誰も見てくれなくて不安になるかもしれません。でも毎日決まった時間にスマホの前に座るだけで少しずつ常連さんが増えていくのが配信の面白いところです。

今の生活を少しでも変えたいけれど特別なスキルがないからと諦めていませんか。そんな方にこそスマホ一つで始められるライブ配信の世界を知ってほしいと思います。

※これはAPI長文テストです。後で削除します。`;

  console.log('文字数:', longText.length);
  
  try {
    const result = await client.v2.tweet(longText);
    console.log('SUCCESS! Tweet ID:', result.data.id);
    console.log('長文投稿OK！');
    return result.data.id;
  } catch (error) {
    console.log('ERROR:', error.message);
    if (error.data) {
      console.log('DETAIL:', JSON.stringify(error.data, null, 2));
    }
  }
}

testLongTweet();

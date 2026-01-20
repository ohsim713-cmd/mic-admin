/**
 * 過去投稿を一括取得してJSONに保存（RapidAPI版）
 * Twitter API v2のレート制限を回避するためRapidAPIを使用
 */
import dotenv from 'dotenv';
import path from 'path';

// .env.local を読み込み
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { Twitter241Client } from '../lib/api/twitter241-client';
import { ACCOUNTS } from '../lib/dm-hunter/sns-adapter';
import fs from 'fs/promises';

async function main() {
  const knowledgePath = path.join(process.cwd(), 'knowledge');

  // knowledgeディレクトリがなければ作成
  try {
    await fs.mkdir(knowledgePath, { recursive: true });
  } catch {}

  const client = new Twitter241Client();

  if (!client.isAvailable()) {
    console.error('RAPIDAPI_KEY が設定されていません');
    process.exit(1);
  }

  const twitterAccounts = ACCOUNTS.filter(a => a.platform === 'twitter');

  for (const account of twitterAccounts) {
    const username = account.handle.replace('@', '');
    console.log(`\n========== ${account.name} (${account.handle}) ==========`);

    try {
      // RapidAPIで最大100件取得
      const tweets = await client.getUserTweets(username, 100);

      console.log(`取得件数: ${tweets.length}`);

      if (tweets.length > 0) {
        // エンゲージメントスコアを計算してソート
        const sorted = tweets
          .map(t => ({
            tweetId: t.id,
            text: t.text,
            createdAt: t.created_at,
            metrics: {
              likes: t.public_metrics.like_count,
              retweets: t.public_metrics.retweet_count,
              replies: t.public_metrics.reply_count,
              quotes: t.public_metrics.quote_count,
            },
            engagement: client.calculateEngagement(t),
          }))
          .sort((a, b) => b.engagement - a.engagement);

        // 保存
        const outputPath = path.join(knowledgePath, `${account.id}_tweets.json`);
        await fs.writeFile(outputPath, JSON.stringify({
          account: account.id,
          handle: account.handle,
          name: account.name,
          fetchedAt: new Date().toISOString(),
          source: 'rapidapi',
          totalTweets: sorted.length,
          tweets: sorted,
        }, null, 2));

        console.log(`保存先: ${outputPath}`);

        // トップ5表示
        console.log('\n【エンゲージメント上位5件】');
        sorted.slice(0, 5).forEach((t, i) => {
          console.log(`${i + 1}. [❤️${t.metrics.likes} 🔄${t.metrics.retweets}] ${t.text.substring(0, 50)}...`);
        });
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      console.error(`エラー: ${error.message}`);
    }
  }

  console.log('\n========== 完了 ==========');
}

main().catch(console.error);

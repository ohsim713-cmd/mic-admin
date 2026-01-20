/**
 * 過去投稿を一括取得してJSONに保存
 */
import dotenv from 'dotenv';
import path from 'path';

// .env.local を読み込み
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { fetchHistoricalTweets, ACCOUNTS } from '../lib/dm-hunter/sns-adapter';
import fs from 'fs/promises';

async function main() {
  const knowledgePath = path.join(process.cwd(), 'knowledge');

  // knowledgeディレクトリがなければ作成
  try {
    await fs.mkdir(knowledgePath, { recursive: true });
  } catch {}

  const twitterAccounts = ACCOUNTS.filter(a => a.platform === 'twitter');

  for (const account of twitterAccounts) {
    console.log(`\n========== ${account.name} (${account.handle}) ==========`);

    try {
      // 最大200件取得
      const result = await fetchHistoricalTweets(account.id, 200);

      console.log(`取得件数: ${result.totalFetched}`);
      console.log(`続きあり: ${result.hasMore}`);

      if (result.tweets.length > 0) {
        // エンゲージメント順にソート
        const sorted = result.tweets.sort((a, b) =>
          (b.metrics.likes + b.metrics.retweets) - (a.metrics.likes + a.metrics.retweets)
        );

        // 保存
        const outputPath = path.join(knowledgePath, `${account.id}_tweets.json`);
        await fs.writeFile(outputPath, JSON.stringify({
          account: account.id,
          handle: account.handle,
          name: account.name,
          fetchedAt: new Date().toISOString(),
          totalTweets: sorted.length,
          tweets: sorted,
        }, null, 2));

        console.log(`保存先: ${outputPath}`);

        // トップ5表示
        console.log('\n【トップ5】');
        sorted.slice(0, 5).forEach((t, i) => {
          console.log(`${i + 1}. [❤️${t.metrics.likes} 🔄${t.metrics.retweets}] ${t.text.substring(0, 50)}...`);
        });
      }
    } catch (error: any) {
      console.error(`エラー: ${error.message}`);
    }
  }
}

main().catch(console.error);

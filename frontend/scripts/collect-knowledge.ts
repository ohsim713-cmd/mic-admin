/**
 * ナレッジ収集スクリプト
 * GitHub Actionsから毎日実行
 */

import { runKnowledgeCollection } from '../lib/knowledge/google-search-collector';

async function main() {
  console.log('=== Starting Daily Knowledge Collection ===');
  console.log(`Date: ${new Date().toISOString()}`);

  try {
    const results = await runKnowledgeCollection('both');

    console.log('\n=== Collection Results ===');

    if (results.liver) {
      console.log(`Liver:`);
      console.log(`  - Topics: ${results.liver.results.length}`);
      console.log(`  - Insights: ${results.liver.results.reduce((sum, r) => sum + r.insights.length, 0)}`);
      console.log(`  - Statistics: ${results.liver.results.reduce((sum, r) => sum + r.statistics.length, 0)}`);
      console.log(`  - Saved to: ${results.liver.savedPath}`);
    }

    if (results.chatlady) {
      console.log(`Chatlady:`);
      console.log(`  - Topics: ${results.chatlady.results.length}`);
      console.log(`  - Insights: ${results.chatlady.results.reduce((sum, r) => sum + r.insights.length, 0)}`);
      console.log(`  - Statistics: ${results.chatlady.results.reduce((sum, r) => sum + r.statistics.length, 0)}`);
      console.log(`  - Saved to: ${results.chatlady.savedPath}`);
    }

    console.log('\n=== Daily Knowledge Collection Complete ===');
  } catch (error) {
    console.error('Knowledge collection failed:', error);
    process.exit(1);
  }
}

main();

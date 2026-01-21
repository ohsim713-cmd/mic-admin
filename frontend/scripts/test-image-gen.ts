/**
 * 画像生成テスト
 *
 * 使い方:
 * npx tsx scripts/test-image-gen.ts liver          # ランダム
 * npx tsx scripts/test-image-gen.ts liver catchcopy    # キャッチコピー
 * npx tsx scripts/test-image-gen.ts liver infographic  # 資料風
 * npx tsx scripts/test-image-gen.ts chatre infographic
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function loadImageGenerator() {
  const { generateImageForPost, generateTextImage, generateInfoGraphic } = await import('../lib/ai/image-generator');
  return { generateImageForPost, generateTextImage, generateInfoGraphic };
}

async function main() {
  const { generateImageForPost, generateTextImage, generateInfoGraphic } = await loadImageGenerator();

  const accountType = (process.argv[2] || 'liver') as 'liver' | 'chatre';
  const imageType = process.argv[3] as 'catchcopy' | 'infographic' | undefined;

  console.log(`\n=== 画像生成テスト (${accountType}, ${imageType || 'random'}) ===\n`);

  // 両方のタイプを生成
  if (!imageType) {
    // キャッチコピー
    console.log('1. キャッチコピー画像を生成中...');
    const catchcopyBuffer = await generateImageForPost('', accountType, 'catchcopy');
    if (catchcopyBuffer) {
      const outputPath = path.join(process.cwd(), `test-catchcopy-${accountType}-${Date.now()}.png`);
      fs.writeFileSync(outputPath, catchcopyBuffer);
      console.log(`   保存: ${outputPath}`);
    }

    // 資料風
    console.log('2. 資料風インフォグラフィックを生成中...');
    const infoBuffer = await generateImageForPost('', accountType, 'infographic');
    if (infoBuffer) {
      const outputPath = path.join(process.cwd(), `test-infographic-${accountType}-${Date.now()}.png`);
      fs.writeFileSync(outputPath, infoBuffer);
      console.log(`   保存: ${outputPath}`);
    }

    console.log('\n両方の画像を生成しました！');
  } else {
    // 指定されたタイプのみ
    console.log(`${imageType}画像を生成中...`);
    const buffer = await generateImageForPost('', accountType, imageType);

    if (buffer) {
      const outputPath = path.join(process.cwd(), `test-${imageType}-${accountType}-${Date.now()}.png`);
      fs.writeFileSync(outputPath, buffer);
      console.log(`\n画像を保存しました: ${outputPath}`);
      console.log(`サイズ: ${buffer.length} bytes`);
    } else {
      console.log('\n画像生成に失敗しました');
    }
  }
}

main().catch(console.error);

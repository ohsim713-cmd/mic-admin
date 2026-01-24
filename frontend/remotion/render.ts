/**
 * Remotion レンダリングユーティリティ
 *
 * テンプレートから画像を生成
 */

import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

export interface RenderOptions {
  compositionId: 'ReelTemplate' | 'SquareTemplate' | 'TwitterTemplate';
  props: Record<string, unknown>;
  outputPath: string;
}

export interface BulkRenderOptions {
  compositionId: 'ReelTemplate' | 'SquareTemplate' | 'TwitterTemplate';
  dataRows: Array<{
    id?: string;
    props: Record<string, unknown>;
  }>;
  outputDir: string;
}

let bundledPath: string | null = null;

/**
 * Remotion バンドルを作成（初回のみ）
 */
async function getBundledPath(): Promise<string> {
  if (bundledPath) {
    return bundledPath;
  }

  console.log('[Remotion] Bundling...');
  const entryPoint = path.join(__dirname, 'index.ts');

  bundledPath = await bundle({
    entryPoint,
    onProgress: (progress) => {
      if (progress % 20 === 0) {
        console.log(`[Remotion] Bundle progress: ${progress}%`);
      }
    },
  });

  console.log('[Remotion] Bundle complete');
  return bundledPath;
}

/**
 * 単一画像をレンダリング
 */
export async function renderImage(options: RenderOptions): Promise<string> {
  const { compositionId, props, outputPath } = options;

  const bundlePath = await getBundledPath();

  // 出力ディレクトリを作成
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[Remotion] Rendering ${compositionId}...`);

  // Compositionを取得
  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: compositionId,
    inputProps: props,
  });

  await renderStill({
    serveUrl: bundlePath,
    composition,
    output: outputPath,
    inputProps: props,
    imageFormat: 'png',
  });

  console.log(`[Remotion] Saved to ${outputPath}`);
  return outputPath;
}

/**
 * 複数画像を一括レンダリング
 */
export async function renderBulkImages(
  options: BulkRenderOptions
): Promise<Array<{ id: string; path: string; success: boolean; error?: string }>> {
  const { compositionId, dataRows, outputDir } = options;
  const results: Array<{ id: string; path: string; success: boolean; error?: string }> = [];

  // 出力ディレクトリを作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // バンドルを事前に作成
  await getBundledPath();

  console.log(`[Remotion] Bulk rendering ${dataRows.length} images...`);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const id = row.id || `image_${i + 1}`;
    const outputPath = path.join(outputDir, `${id}.png`);

    try {
      await renderImage({
        compositionId,
        props: row.props,
        outputPath,
      });

      results.push({ id, path: outputPath, success: true });
      console.log(`[Remotion] ${i + 1}/${dataRows.length} complete`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ id, path: outputPath, success: false, error: errorMessage });
      console.error(`[Remotion] ${i + 1}/${dataRows.length} failed:`, errorMessage);
    }
  }

  const successful = results.filter((r) => r.success).length;
  console.log(`[Remotion] Bulk render complete: ${successful}/${dataRows.length} successful`);

  return results;
}

/**
 * 画像をBase64で取得
 */
export async function renderImageToBase64(
  compositionId: 'ReelTemplate' | 'SquareTemplate' | 'TwitterTemplate',
  props: Record<string, unknown>
): Promise<string> {
  const tempPath = path.join('/tmp', `remotion_${Date.now()}.png`);

  await renderImage({
    compositionId,
    props,
    outputPath: tempPath,
  });

  const imageBuffer = fs.readFileSync(tempPath);
  const base64 = imageBuffer.toString('base64');

  // 一時ファイルを削除
  fs.unlinkSync(tempPath);

  return `data:image/png;base64,${base64}`;
}

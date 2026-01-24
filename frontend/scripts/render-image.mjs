/**
 * Remotion 画像レンダリングスクリプト
 * CLIの代わりに直接APIを使用
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ESMでbundleとrenderStillをインポート
const { bundle } = await import('@remotion/bundler');
const { renderStill, selectComposition } = await import('@remotion/renderer');

const props = JSON.parse(process.argv[2] || '{"topic":"テスト","description":"動作確認"}');
const compositionId = process.argv[3] || 'ReelTemplate';
const outputPath = process.argv[4] || path.join(projectRoot, 'public', 'generated', 'render_test.png');

console.log('[Remotion Script] Starting render...');
console.log('[Remotion Script] Props:', props);
console.log('[Remotion Script] Composition:', compositionId);

try {
  // エントリーポイント
  const entryPoint = path.join(projectRoot, 'remotion', 'index.ts');

  console.log('[Remotion Script] Bundling...');
  const bundlePath = await bundle({
    entryPoint,
    // Webpackオーバーライドでエイリアスとフォールバックを修正
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          '@remotion/studio/renderEntry': path.resolve(
            projectRoot,
            'node_modules/@remotion/studio/dist/renderEntry.js'
          ),
        },
        fallback: {
          ...config.resolve?.fallback,
          path: false,
          fs: false,
          os: false,
          crypto: false,
        },
      },
    }),
  });
  console.log('[Remotion Script] Bundle ready:', bundlePath);

  console.log('[Remotion Script] Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: compositionId,
    inputProps: props,
  });

  console.log('[Remotion Script] Rendering...');
  await renderStill({
    serveUrl: bundlePath,
    composition,
    output: outputPath,
    inputProps: props,
    imageFormat: 'png',
  });

  console.log('[Remotion Script] ✅ Render complete:', outputPath);
} catch (error) {
  console.error('[Remotion Script] ❌ Error:', error.message);
  process.exit(1);
}

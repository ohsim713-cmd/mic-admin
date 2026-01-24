/**
 * Remotion 画像生成エンドポイント
 *
 * GET  - テンプレート一覧
 * POST - 画像生成
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

// GET: 利用可能なテンプレート一覧（軽量）
export async function GET() {
  return NextResponse.json({
    templates: [
      {
        id: 'reel',
        name: 'Instagram Reel / TikTok',
        size: '1080x1920',
        compositionId: 'ReelTemplate',
      },
      {
        id: 'square',
        name: 'Instagram Post',
        size: '1080x1080',
        compositionId: 'SquareTemplate',
      },
      {
        id: 'twitter',
        name: 'Twitter/X Post',
        size: '1200x675',
        compositionId: 'TwitterTemplate',
      },
    ],
    propsSchema: {
      topic: { type: 'string', required: true, description: 'メイントピック' },
      description: { type: 'string', required: true, description: '説明文' },
      subDescription: { type: 'string', required: false, description: 'サブ説明' },
      backgroundColor: { type: 'string', default: '#FFE4EC', description: '背景色' },
      accentColor: { type: 'string', default: '#FF6B9D', description: 'アクセント色' },
      textColor: { type: 'string', default: '#333333', description: 'テキスト色' },
    },
    example: {
      template: 'reel',
      props: {
        topic: '事務所がやること',
        description: '配信者様と一緒に\\nアカウントを育てていく',
      },
    },
    status: 'ready',
  });
}

// テンプレートID マッピング
const TEMPLATE_MAP: Record<string, string> = {
  reel: 'ReelTemplate',
  square: 'SquareTemplate',
  twitter: 'TwitterTemplate',
};

// POST: 画像生成（Remotionは動的インポート）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template = 'reel', props, bulk } = body;

    const compositionId = TEMPLATE_MAP[template];
    if (!compositionId) {
      return NextResponse.json(
        { error: `Invalid template: ${template}. Use: reel, square, twitter` },
        { status: 400 }
      );
    }

    // 動的インポート（POST時のみロード）
    const path = await import('path');
    const fs = await import('fs');
    const { bundle } = await import('@remotion/bundler');
    const { renderStill, selectComposition } = await import('@remotion/renderer');

    // バンドル作成
    console.log('[Remotion API] Creating bundle...');
    const entryPoint = path.join(process.cwd(), 'remotion', 'index.ts');
    const bundlePath = await bundle({ entryPoint });
    console.log('[Remotion API] Bundle ready');

    const outputDir = path.join(process.cwd(), 'public', 'generated');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // レンダリング関数
    const renderImage = async (compId: string, inputProps: Record<string, unknown>, outputPath: string) => {
      const composition = await selectComposition({
        serveUrl: bundlePath,
        id: compId,
        inputProps,
      });
      await renderStill({
        serveUrl: bundlePath,
        composition,
        output: outputPath,
        inputProps,
        imageFormat: 'png',
      });
    };

    // 一括生成モード
    if (bulk && Array.isArray(bulk)) {
      console.log(`[Remotion API] Bulk rendering ${bulk.length} images...`);
      const results: Array<{ id: string; url: string; success: boolean; error?: string }> = [];

      for (let i = 0; i < bulk.length; i++) {
        const item = bulk[i];
        const id = item.id || `bulk_${Date.now()}_${i}`;
        const outputPath = path.join(outputDir, `${id}.png`);

        try {
          await renderImage(compositionId, item.props || {}, outputPath);
          results.push({ id, url: `/generated/${id}.png`, success: true });
          console.log(`[Remotion API] ${i + 1}/${bulk.length} complete`);
        } catch (error) {
          results.push({
            id,
            url: '',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return NextResponse.json({
        success: true,
        mode: 'bulk',
        results,
        summary: {
          total: bulk.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      });
    }

    // 単一生成モード
    if (!props) {
      return NextResponse.json(
        { error: 'props is required for single image generation' },
        { status: 400 }
      );
    }

    console.log(`[Remotion API] Rendering single image...`);
    const id = `single_${Date.now()}`;
    const outputPath = path.join(outputDir, `${id}.png`);

    await renderImage(compositionId, props, outputPath);

    const imageBuffer = fs.readFileSync(outputPath);
    const base64 = imageBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      mode: 'single',
      id,
      url: `/generated/${id}.png`,
      base64: `data:image/png;base64,${base64}`,
    });
  } catch (error) {
    console.error('[Remotion API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

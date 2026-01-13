/**
 * Auto Hub - 画像自動生成API
 * Instagram投稿用の画像を自動生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const LOGS_PATH = path.join(process.cwd(), 'knowledge', 'auto_hub_logs.json');
const IMAGE_STOCK_PATH = path.join(process.cwd(), 'knowledge', 'image_stock.json');

// 画像テーマのバリエーション
const IMAGE_THEMES = [
  { id: 'nail_trendy', prompt: 'trendy nail art design, gradient ombre, minimalist chic style' },
  { id: 'nail_elegant', prompt: 'elegant french manicure, luxury gold accents, sophisticated design' },
  { id: 'nail_cute', prompt: 'cute nail art with hearts and stars, pastel colors, kawaii style' },
  { id: 'nail_seasonal', prompt: 'seasonal nail design with nature elements, flowers and leaves' },
  { id: 'nail_glam', prompt: 'glamorous nail art with rhinestones and glitter, party style' },
];

// 季節に応じたスタイル
function getSeasonalStyle(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'cherry blossom pink, soft pastels, floral patterns, fresh green accents';
  if (month >= 6 && month <= 8) return 'vibrant colors, ocean blue, tropical motifs, bright neon, holographic';
  if (month >= 9 && month <= 11) return 'burgundy, amber, gold leaf, tortoiseshell, warm earth tones';
  return 'snowflake designs, silver glitter, deep red, white and gold, festive sparkle';
}

async function generateImageWithImagen(prompt: string): Promise<string | null> {
  const fullPrompt = `Generate a stunning professional nail art photograph:

${prompt}

STYLE REQUIREMENTS:
- Ultra high-end nail salon quality photograph
- Elegant female hands with perfectly manicured nails
- Close-up macro shot focusing on the nail art details
- ${getSeasonalStyle()}

TECHNICAL SPECIFICATIONS:
- Professional studio lighting with soft diffused light
- Shallow depth of field (bokeh background)
- Clean, minimalist background (white marble, soft pink, or neutral)
- 8K resolution quality
- Magazine editorial style
- Photorealistic rendering

COMPOSITION:
- Hands positioned elegantly at 45-degree angle
- Fingers slightly curved to showcase nail art
- Instagram-worthy aesthetic

Create an image that would make viewers want to book an appointment immediately.`;

  // Imagen 3.0で生成
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: fullPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1"
        }
      })
    }
  );

  if (!response.ok) {
    console.error('[Auto Hub Image] Imagen API error:', response.status);
    return null;
  }

  const data = await response.json();
  if (data.predictions?.[0]?.bytesBase64Encoded) {
    return `data:image/jpeg;base64,${data.predictions[0].bytesBase64Encoded}`;
  }

  return null;
}

async function saveToStock(imageData: string, theme: string): Promise<void> {
  let stock: any[] = [];
  try {
    const data = await fs.readFile(IMAGE_STOCK_PATH, 'utf-8');
    stock = JSON.parse(data);
  } catch {}

  stock.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    imageData,
    theme,
    createdAt: new Date().toISOString(),
    used: false,
  });

  // 最新50枚を保持
  if (stock.length > 50) {
    stock = stock.slice(-50);
  }

  const dir = path.dirname(IMAGE_STOCK_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(IMAGE_STOCK_PATH, JSON.stringify(stock, null, 2));
}

async function logGeneration(success: boolean, theme: string, error?: string): Promise<void> {
  let logs: any = { text: [], image: [], video: [] };
  try {
    const data = await fs.readFile(LOGS_PATH, 'utf-8');
    logs = JSON.parse(data);
  } catch {}

  logs.image = logs.image || [];
  logs.image.unshift({
    id: `${Date.now()}`,
    timestamp: new Date().toISOString(),
    success,
    theme,
    error,
  });

  // 最新100件を保持
  logs.image = logs.image.slice(0, 100);

  const dir = path.dirname(LOGS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(LOGS_PATH, JSON.stringify(logs, null, 2));
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { theme, dryRun = false, saveToStockOnly = false } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEYが設定されていません' }, { status: 500 });
    }

    // テーマを選択（指定がなければランダム）
    const selectedTheme = theme
      ? IMAGE_THEMES.find(t => t.id === theme) || IMAGE_THEMES[0]
      : IMAGE_THEMES[Math.floor(Math.random() * IMAGE_THEMES.length)];

    console.log(`[Auto Hub Image] Generating with theme: ${selectedTheme.id}`);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        theme: selectedTheme.id,
        prompt: selectedTheme.prompt,
      });
    }

    // 画像生成
    const imageUrl = await generateImageWithImagen(selectedTheme.prompt);

    if (!imageUrl) {
      await logGeneration(false, selectedTheme.id, 'Image generation failed');
      return NextResponse.json({
        success: false,
        error: '画像生成に失敗しました',
      }, { status: 500 });
    }

    // ストックに保存
    if (saveToStockOnly) {
      await saveToStock(imageUrl, selectedTheme.id);
      await logGeneration(true, selectedTheme.id);

      return NextResponse.json({
        success: true,
        savedToStock: true,
        theme: selectedTheme.id,
        processingTime: Date.now() - startTime,
      });
    }

    await logGeneration(true, selectedTheme.id);

    return NextResponse.json({
      success: true,
      imageUrl,
      theme: selectedTheme.id,
      processingTime: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error('[Auto Hub Image] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// GET: ストック状態を取得
export async function GET() {
  try {
    let stock: any[] = [];
    try {
      const data = await fs.readFile(IMAGE_STOCK_PATH, 'utf-8');
      stock = JSON.parse(data);
    } catch {}

    const unused = stock.filter(s => !s.used);
    const byTheme = IMAGE_THEMES.reduce((acc, theme) => {
      acc[theme.id] = unused.filter(s => s.theme === theme.id).length;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      total: stock.length,
      unused: unused.length,
      byTheme,
      themes: IMAGE_THEMES.map(t => ({ id: t.id, prompt: t.prompt })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

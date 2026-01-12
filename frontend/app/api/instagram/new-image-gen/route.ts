import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ナレッジを読み込む
function loadKnowledge(filename: string) {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

// 現在の季節を取得
function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// 季節に応じたスタイルヒント
function getSeasonalStyle(): string {
  const season = getCurrentSeason();
  const styles: Record<string, string> = {
    spring: 'cherry blossom pink, soft pastels, floral patterns, fresh green accents',
    summer: 'vibrant colors, ocean blue, tropical motifs, bright neon, holographic',
    autumn: 'burgundy, amber, gold leaf, tortoiseshell, warm earth tones',
    winter: 'snowflake designs, silver glitter, deep red, white and gold, festive sparkle'
  };
  return styles[season] || styles.spring;
}

// Imagen 3 - 画像生成機能
export async function POST(request: NextRequest) {
  try {
    const { designDescription, referenceImage } = await request.json();

    if (!designDescription) {
      return NextResponse.json(
        { error: 'デザインの説明が必要です' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEYが設定されていません' },
        { status: 500 }
      );
    }

    // ナレッジベースからトレンド情報を取得
    const nailTrends = loadKnowledge('nail_trends.json');
    let trendColors = '';
    if (nailTrends?.colorPalette?.primary) {
      trendColors = nailTrends.colorPalette.primary.slice(0, 3).join(', ');
    }

    const seasonalStyle = getSeasonalStyle();

    // プロ級の画像生成プロンプト
    const prompt = `Generate a stunning professional nail art photograph with the following specifications:

DESIGN: ${designDescription}

STYLE REQUIREMENTS:
- Ultra high-end nail salon quality photograph
- Elegant female hands with perfectly manicured nails
- Close-up macro shot focusing on the nail art details
- ${seasonalStyle}
${trendColors ? `- Trending colors: ${trendColors}` : ''}

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
- Optional subtle props (flowers, jewelry, fabric)
- Instagram-worthy aesthetic

Create an image that would make viewers want to book an appointment immediately.`;

    console.log('Image prompt:', prompt);

    // Imagen 3.0 Generate 001 で画像生成
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1" // Instagram用スクエア
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Imagen API error:', errorData);

      // レート制限の場合
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'APIのレート制限に達しました。少し待ってから再試行してください。', detail: errorData.error?.message },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: '画像生成に失敗しました', detail: errorData.error?.message || '不明なエラー' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Imagen response received');

    // 生成された画像を取得 (Imagen 3の形式)
    if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
      const base64Image = data.predictions[0].bytesBase64Encoded;
      // mimeTypeは通常JPEGかPNG。JPEGとして返すのが無難。
      const imageUrl = `data:image/jpeg;base64,${base64Image}`;
      return NextResponse.json({ imageUrl });
    }

    // 古い形式(Gemini)か他の形式の場合のフォールバック (念のため残すが、基本はpredictions)
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          return NextResponse.json({ imageUrl });
        }
      }
    }

    return NextResponse.json(
      { error: '画像データが取得できませんでした', detail: 'APIレスポンスの形式が不明です' },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('Image generation failed:', error);
    return NextResponse.json(
      { error: '画像生成に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

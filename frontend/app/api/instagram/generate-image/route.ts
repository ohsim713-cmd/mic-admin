import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';
const ALGORITHM = 'aes-256-cbc';

function decrypt(text: string): string {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

function loadGeminiApiKey(): string {
  try {
    const settingsFile = path.join(process.cwd(), '..', 'settings', 'gemini.json');
    if (!fs.existsSync(settingsFile)) {
      return "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
    }

    const data = fs.readFileSync(settingsFile, 'utf-8');
    const parsed = JSON.parse(data);
    const apiKey = parsed.apiKey ? decrypt(parsed.apiKey) : '';

    if (!apiKey) {
      return "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
    }

    return apiKey;
  } catch (error) {
    console.error('Failed to load Gemini API key:', error);
    return "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
  }
}

const KNOWLEDGE_DIR = path.join(process.cwd(), '..', 'knowledge');

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

// Gemini 2.0 Flash - 画像生成機能（強化版）
export async function POST(request: NextRequest) {
  try {
    const { designDescription } = await request.json();

    if (!designDescription) {
      return NextResponse.json(
        { error: 'デザインの説明が必要です' },
        { status: 400 }
      );
    }

    const apiKey = loadGeminiApiKey();

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

    // Gemini 2.0 Flash で画像生成
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: '画像生成に失敗しました', detail: errorData.error?.message || '不明なエラー' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data, null, 2));

    // 生成された画像を探す
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
      { error: '画像データが取得できませんでした', detail: 'テキストのみが生成されました' },
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

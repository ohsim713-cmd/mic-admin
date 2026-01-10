import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  if (month >= 3 && month <= 5) return '春';
  if (month >= 6 && month <= 8) return '夏';
  if (month >= 9 && month <= 11) return '秋';
  return '冬';
}

export async function POST(request: NextRequest) {
  try {
    const { designDescription, targetAudience, additionalInfo, businessType } = await request.json();

    if (!designDescription) {
      return NextResponse.json(
        { error: 'デザインの説明が必要です' },
        { status: 400 }
      );
    }

    const apiKey = loadGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // ナレッジベースを読み込む
    const nailTrends = loadKnowledge('nail_trends.json');
    const instagramTips = loadKnowledge('instagram_tips.json');
    const season = getCurrentSeason();

    // トレンド情報をコンテキストに追加
    let trendContext = '';
    if (nailTrends) {
      const currentTrends = nailTrends.trends?.slice(0, 3).map((t: any) => t.name).join('、') || '';
      const popularColors = nailTrends.colorPalette?.primary?.join('、') || '';
      trendContext = `
【最新トレンド情報】
- 今季のトレンド: ${currentTrends}
- 人気カラー: ${popularColors}
- 季節: ${season}`;
    }

    // Instagram運用ノウハウをコンテキストに追加
    let tipsContext = '';
    if (instagramTips) {
      const captionTips = instagramTips.instagramTips?.captionTips?.slice(0, 3).join('、') || '';
      const hookExamples = instagramTips.captionStrategies?.[0]?.examples?.slice(0, 2).join(' / ') || '';
      tipsContext = `
【キャプション作成のコツ】
- ${captionTips}
- フックの例: ${hookExamples}`;
    }

    // ビジネスタイプに応じたコンテキスト
    let businessContext = '';
    if (businessType === 'nail-salon') {
      businessContext = 'あなたはプロのネイルサロンのSNSマーケティング担当者です。最新のトレンドを熟知し、エンゲージメントを高めるキャプションを作成できます。';
    } else {
      businessContext = 'あなたはプロのSNSマーケティング担当者です。';
    }

    const prompt = `${businessContext}
${trendContext}
${tipsContext}

以下の情報を元に、Instagramの投稿用キャプションを作成してください。

【デザイン情報】
${designDescription}

${targetAudience ? `【ターゲット層】\n${targetAudience}\n` : ''}
${additionalInfo ? `【追加情報】\n${additionalInfo}\n` : ''}

【要件】
- 魅力的で読みやすい日本語で書く
- 絵文字を適度に使用して親しみやすく（✨💅🌸など）
- デザインの特徴や魅力を具体的に説明
- 最初の一文は読者の興味を引くフックにする（質問形式や驚きの事実など）
- 行間を適度に空けて読みやすくする
- トレンド情報があれば自然に織り交ぜる
- 季節感を取り入れる
- ハッシュタグは最後に10個程度追加する（#ネイル #ネイルデザイン #${season}ネイル など関連性の高いもの）
- 300〜400文字程度

キャプションとハッシュタグを出力してください。余計な説明は不要です。`;

    const result = await model.generateContent(prompt);
    const caption = result.response.text();

    return NextResponse.json({ caption });
  } catch (error: any) {
    console.error('Instagram caption generation failed:', error);
    return NextResponse.json(
      { error: 'キャプションの生成に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

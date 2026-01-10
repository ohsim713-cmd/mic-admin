import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';
const ALGORITHM = 'aes-256-cbc';
const KNOWLEDGE_DIR = path.join(process.cwd(), '..', 'knowledge');

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
    return apiKey || "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
  } catch (error) {
    return "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
  }
}

function saveKnowledge(filename: string, data: any) {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadKnowledge(filename: string) {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

// Instagram運用ノウハウを生成・更新
export async function POST(request: NextRequest) {
  try {
    const apiKey = loadGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const instagramPrompt = `あなたはネイルサロンのInstagramマーケティング専門家です。
ネイルサロンがInstagramで成功するための最新の運用ノウハウを詳細に分析してください。

以下の形式でJSON形式で出力してください：
{
  "captionStrategies": [
    {
      "type": "フック型",
      "description": "最初の一文で興味を引く書き方",
      "examples": ["例文1", "例文2", "例文3"],
      "templates": ["テンプレート1", "テンプレート2"]
    }
  ],
  "hashtagStrategy": {
    "categories": {
      "highVolume": ["#ネイル", "#nail"],
      "mediumVolume": ["#ネイルデザイン", "#ジェルネイル"],
      "niche": ["#春ネイル2024", "#グラデーションネイル"],
      "location": ["#東京ネイル", "#渋谷ネイル"]
    },
    "optimalCount": 15,
    "placement": "コメント欄推奨",
    "rotationTips": "ハッシュタグの使い分け方"
  },
  "postingSchedule": {
    "bestDays": ["水曜日", "土曜日"],
    "bestTimes": ["12:00-13:00", "19:00-21:00"],
    "frequency": "週3-5回",
    "reasonings": ["理由の説明"]
  },
  "photoTips": {
    "lighting": ["自然光が最適", "リングライト使用"],
    "angles": ["45度斜め上から", "真上から"],
    "backgrounds": ["白背景", "大理石調"],
    "props": ["花", "アクセサリー"],
    "editing": ["彩度を少し上げる", "明るさ調整"]
  },
  "engagementTips": {
    "callToActions": ["質問を投げかける", "コメント促進"],
    "storyIdeas": ["ビフォーアフター", "施術風景"],
    "reelsTips": ["トレンド音楽使用", "変化を見せる"]
  },
  "captionFormulas": [
    {
      "name": "AIDA型",
      "structure": "Attention → Interest → Desire → Action",
      "example": "具体例"
    }
  ],
  "seasonalContent": {
    "spring": ["桜ネイル", "パステルカラー"],
    "summer": ["海ネイル", "ビビッドカラー"],
    "autumn": ["べっ甲ネイル", "ボルドー"],
    "winter": ["雪の結晶", "ホワイト×ゴールド"]
  },
  "competitorAnalysis": {
    "successPatterns": ["成功しているサロンの特徴"],
    "avoidPatterns": ["避けるべきパターン"]
  }
}

日本のネイルサロン向けの最新情報を含めてください。
各カテゴリに最低3つ以上の具体例を含めてください。`;

    const result = await model.generateContent(instagramPrompt);
    let resultText = result.response.text();

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'ノウハウの解析に失敗しました' }, { status: 500 });
    }

    const instagramData = JSON.parse(jsonMatch[0]);
    instagramData.updatedAt = new Date().toISOString();

    saveKnowledge('instagram_tips.json', instagramData);

    return NextResponse.json({
      success: true,
      message: 'Instagram運用ノウハウを更新しました',
      data: instagramData
    });

  } catch (error: any) {
    console.error('Failed to update Instagram tips:', error);
    return NextResponse.json(
      { error: 'ノウハウの更新に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const knowledge = loadKnowledge('instagram_tips.json');

    if (!knowledge) {
      return NextResponse.json({
        success: false,
        message: 'ノウハウ情報がありません。更新してください。'
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: knowledge });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'ノウハウの取得に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

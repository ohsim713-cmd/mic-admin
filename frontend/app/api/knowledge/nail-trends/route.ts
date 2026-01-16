import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ナレッジファイルを保存
function saveKnowledge(filename: string, data: any) {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ナレッジファイルを読み込み
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

// ネイルトレンド情報を生成・更新
export async function POST(request: NextRequest) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const season = getCurrentSeason();
    const year = new Date().getFullYear();

    // 最新のネイルトレンド情報を生成
    const trendPrompt = `あなたはネイル業界のトレンドアナリストです。
${year}年${season}の最新ネイルトレンド情報を詳細に分析してください。

以下の形式でJSON形式で出力してください：
{
  "season": "${season}",
  "year": ${year},
  "trends": [
    {
      "name": "トレンド名",
      "description": "トレンドの詳細説明",
      "colors": ["人気色1", "人気色2"],
      "techniques": ["技法1", "技法2"],
      "targetAge": "ターゲット年齢層",
      "occasions": ["シーン1", "シーン2"],
      "keywords": ["キーワード1", "キーワード2"],
      "instagramHashtags": ["#ハッシュタグ1", "#ハッシュタグ2"]
    }
  ],
  "colorPalette": {
    "primary": ["メインカラー1", "メインカラー2"],
    "accent": ["アクセントカラー1", "アクセントカラー2"],
    "neutral": ["ニュートラルカラー1", "ニュートラルカラー2"]
  },
  "popularDesigns": [
    {
      "name": "デザイン名",
      "description": "デザインの説明",
      "difficulty": "初級/中級/上級",
      "materials": ["材料1", "材料2"]
    }
  ],
  "instagramTips": {
    "bestPostingTimes": ["投稿に最適な時間帯"],
    "effectiveHashtags": ["効果的なハッシュタグ"],
    "captionTips": ["キャプション作成のコツ"],
    "photoTips": ["写真撮影のコツ"]
  }
}

最低5つのトレンドと10個以上のデザインを含めてください。
日本のネイルサロン向けの情報にしてください。`;

    const trendResult = await model.generateContent(trendPrompt);
    let trendText = trendResult.response.text();

    // JSONを抽出
    const jsonMatch = trendText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'トレンド情報の解析に失敗しました' }, { status: 500 });
    }

    const trendData = JSON.parse(jsonMatch[0]);
    trendData.updatedAt = new Date().toISOString();

    // ナレッジとして保存
    saveKnowledge('nail_trends.json', trendData);

    return NextResponse.json({
      success: true,
      message: 'ネイルトレンド情報を更新しました',
      data: trendData
    });

  } catch (error: any) {
    console.error('Failed to update nail trends:', error);
    return NextResponse.json(
      { error: 'トレンド情報の更新に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

// トレンド情報を取得
export async function GET(request: NextRequest) {
  try {
    const knowledge = loadKnowledge('nail_trends.json');

    if (!knowledge) {
      return NextResponse.json({
        success: false,
        message: 'トレンド情報がありません。更新してください。'
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: knowledge });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'トレンド情報の取得に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

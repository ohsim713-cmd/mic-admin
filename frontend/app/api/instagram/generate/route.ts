import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEYが設定されていません。.env.localを確認してください。' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // ナレッジベースを読み込む (エラーハンドリング付き)
    let trendContext = '';
    let tipsContext = '';
    const season = getCurrentSeason();

    try {
      const knowledgeDir = path.join(process.cwd(), 'knowledge');
      const loadK = (f: string) => {
        try {
          const p = path.join(knowledgeDir, f);
          if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
        } catch (e) { console.warn(`Knowledge load skipped for ${f}`, e); }
        return null;
      };

      const nailTrends = loadK('nail_trends.json');
      const instagramTips = loadK('instagram_tips.json');

      // トレンド情報をコンテキストに追加
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
      if (instagramTips) {
        const captionTips = instagramTips.instagramTips?.captionTips?.slice(0, 3).join('、') || '';
        const hookExamples = instagramTips.captionStrategies?.[0]?.examples?.slice(0, 2).join(' / ') || '';
        tipsContext = `
    【キャプション作成のコツ】
    - ${captionTips}
    - フックの例: ${hookExamples}`;
      }
    } catch (e) {
      console.error('Error loading knowledge context:', e);
      // Continue without context
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

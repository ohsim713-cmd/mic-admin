import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

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

// チャットレディ業界トレンド・求人ノウハウを生成・更新
export async function POST(request: NextRequest) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const year = new Date().getFullYear();

    const chatladyPrompt = `あなたはチャットレディ（チャトレ）業界の求人マーケティング専門家です。
※ライバー・ライブ配信業界ではなく、アダルトチャットレディ業界です。
${year}年の最新トレンドと効果的な求人コピーライティングのノウハウを分析してください。

目的：高収入を求める女性に刺さる求人投稿を作成し、応募数を増やすこと

以下の形式でJSON形式で出力してください：
{
  "industryTrends": {
    "year": ${year},
    "marketSize": "チャトレ業界の市場規模や成長性",
    "averageIncome": {
      "beginner": "初心者の平均時給/月収（例：時給3,000円〜/月20万円〜）",
      "experienced": "経験者の平均時給/月収（例：時給5,000円〜/月50万円〜）",
      "top": "トップクラスの収入例（例：月100万円以上）"
    },
    "workingConditions": {
      "flexibility": ["柔軟な働き方のポイント"],
      "locations": ["完全在宅", "通勤チャットルーム", "選択可能"],
      "equipment": ["PC/スマホ", "Webカメラ", "照明", "ネット環境"]
    },
    "growthOpportunities": ["報酬率アップ", "常連客獲得", "複数サイト掛け持ち"]
  },
  "platformAnalysis": {
    "DXLIVE": {
      "type": "海外サイト（アダルト）",
      "features": ["高単価", "海外ユーザー中心", "英語不要でもOK"],
      "paymentSystem": "報酬体系の特徴",
      "userBase": "ユーザー層の特徴",
      "pros": ["メリット1", "メリット2"],
      "cons": ["デメリット1"],
      "bestFor": "どんな人に向いているか",
      "tips": ["稼ぐコツ"]
    },
    "STRIPCHAT": {
      "type": "海外サイト（アダルト）",
      "features": ["世界最大級", "チップ制", "多機能"],
      "paymentSystem": "報酬体系の特徴",
      "userBase": "ユーザー層の特徴",
      "pros": ["メリット1", "メリット2"],
      "cons": ["デメリット1"],
      "bestFor": "どんな人に向いているか",
      "tips": ["稼ぐコツ"]
    },
    "FC2ライブ": {
      "type": "国内サイト",
      "features": ["日本人ユーザー中心", "知名度高い"],
      "paymentSystem": "報酬体系の特徴",
      "userBase": "ユーザー層の特徴",
      "pros": ["メリット1", "メリット2"],
      "cons": ["デメリット1"],
      "bestFor": "どんな人に向いているか",
      "tips": ["稼ぐコツ"]
    },
    "FC2_LOVETIP": {
      "type": "国内サイト（FC2系列・投げ銭型）",
      "features": ["投げ銭メイン", "ノンアダルトも可"],
      "paymentSystem": "報酬体系の特徴",
      "userBase": "ユーザー層の特徴",
      "pros": ["メリット1", "メリット2"],
      "cons": ["デメリット1"],
      "bestFor": "どんな人に向いているか",
      "tips": ["稼ぐコツ"]
    }
  },
  "targetAudienceAnalysis": {
    "primaryTargets": [
      {
        "persona": "ペルソナ名（例：副業を探す会社員女性）",
        "age": "年齢層",
        "currentSituation": "現在の状況",
        "motivations": ["応募動機"],
        "concerns": ["不安・懸念点"],
        "effectiveMessages": ["刺さるメッセージ例"]
      }
    ],
    "psychologicalTriggers": {
      "desires": ["求めているもの（高収入、自由、承認欲求など）"],
      "fears": ["避けたいこと"],
      "barriers": ["応募を躊躇する理由"]
    }
  },
  "copywritingFormulas": {
    "headlines": {
      "patterns": [
        {
          "name": "パターン名",
          "template": "テンプレート文",
          "example": "具体例",
          "psychology": "なぜ効果的か"
        }
      ],
      "powerWords": ["高収入", "自由", "在宅", "未経験OK", "日払い可能"]
    },
    "bodyStructures": [
      {
        "name": "PASONA型",
        "structure": "Problem→Affinity→Solution→Offer→Narrow→Action",
        "example": "具体的な本文例"
      }
    ],
    "callToActions": {
      "effective": ["効果的なCTA例"],
      "urgency": ["緊急性を出す表現"],
      "lowBarrier": ["ハードルを下げる表現"]
    }
  },
  "contentStrategies": {
    "postTypes": [
      {
        "type": "収入訴求型",
        "description": "高収入をメインに訴求",
        "template": "投稿テンプレート",
        "bestFor": "どんなターゲットに効果的か"
      }
    ],
    "hashtagStrategy": {
      "recruitment": ["#チャットレディ求人", "#チャトレ求人", "#高収入バイト"],
      "lifestyle": ["#副業", "#在宅ワーク", "#完全在宅"],
      "emotional": ["#自由な働き方", "#高収入"]
    },
    "visualTips": {
      "imageStyles": ["効果的な画像スタイル"],
      "colors": ["訴求力のある色使い"],
      "elements": ["含めるべき要素"]
    }
  },
  "platformComparison": {
    "summary": "サイト選びのポイントまとめ",
    "forBeginners": "初心者におすすめのサイトと理由",
    "forExperienced": "経験者におすすめのサイトと理由",
    "multiPlatformStrategy": "複数サイト掛け持ちのコツ"
  },
  "complianceNotes": {
    "avoidExpressions": ["使用を避けるべき表現"],
    "requiredDisclosures": ["必要な開示事項"],
    "snsRules": ["SNS投稿時の注意点"]
  },
  "successPatterns": {
    "highPerformingPosts": [
      {
        "type": "投稿タイプ",
        "structure": "構成",
        "keyElements": ["成功要因"],
        "exampleCaption": "実際の投稿例"
      }
    ],
    "conversionTips": ["応募率を上げるコツ"],
    "followUpStrategies": ["問い合わせ後のフォロー方法"]
  }
}

日本市場向けの具体的で実践的な情報を含めてください。
各カテゴリに最低3つ以上の具体例を含めてください。
求職者の心理を深く理解した、応募につながる内容にしてください。
※重要：ライバー・一般的なライブ配信ではなく、チャットレディ（チャトレ）業界に特化した情報を提供してください。
DXLIVE、STRIPCHAT、FC2ライブ、FC2(LOVETIP)の4サイトについて、それぞれの特徴を詳しく分析してください。`;

    const result = await model.generateContent(chatladyPrompt);
    let resultText = result.response.text();

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'トレンド情報の解析に失敗しました' }, { status: 500 });
    }

    const chatladyData = JSON.parse(jsonMatch[0]);
    chatladyData.updatedAt = new Date().toISOString();

    saveKnowledge('chatlady_trends.json', chatladyData);

    return NextResponse.json({
      success: true,
      message: 'チャットレディ業界トレンド・求人ノウハウを更新しました',
      data: chatladyData
    });

  } catch (error: any) {
    console.error('Failed to update chatlady trends:', error);
    return NextResponse.json(
      { error: 'トレンド情報の更新に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const knowledge = loadKnowledge('chatlady_trends.json');

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

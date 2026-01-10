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

// 求人コピーライティング専門ノウハウを生成・更新
export async function POST(request: NextRequest) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const copywritingPrompt = `あなたは求人広告のコピーライティング専門家です。
特に女性向け高収入求人（チャットレディ、ライバー等）の効果的なコピーライティングノウハウを提供してください。

目的：応募率を最大化する、心理学に基づいたコピーライティング技術

以下の形式でJSON形式で出力してください：
{
  "headlineFormulas": {
    "attention": [
      {
        "pattern": "数字訴求型",
        "template": "【時給○○円〜】○○するだけで...",
        "examples": ["具体例1", "具体例2", "具体例3"],
        "psychology": "具体的な数字は信頼性と期待感を高める"
      }
    ],
    "curiosity": [
      {
        "pattern": "秘密暴露型",
        "template": "○○業界の人が絶対教えない...",
        "examples": ["具体例"],
        "psychology": "好奇心を刺激"
      }
    ],
    "benefit": [
      {
        "pattern": "変化約束型",
        "template": "○○から○○に変わる...",
        "examples": ["具体例"],
        "psychology": "ビフォーアフターで変化をイメージさせる"
      }
    ]
  },
  "emotionalTriggers": {
    "desire": {
      "financialFreedom": {
        "keywords": ["借金返済", "貯金", "好きなもの買える"],
        "phrases": ["効果的なフレーズ"],
        "examples": ["投稿例"]
      },
      "timeFlexibility": {
        "keywords": ["好きな時間", "週1OK", "スキマ時間"],
        "phrases": ["効果的なフレーズ"],
        "examples": ["投稿例"]
      },
      "recognition": {
        "keywords": ["褒められる", "人気者", "ファン"],
        "phrases": ["効果的なフレーズ"],
        "examples": ["投稿例"]
      }
    },
    "fear": {
      "missingOut": {
        "keywords": ["今だけ", "限定", "締切"],
        "phrases": ["効果的なフレーズ"],
        "examples": ["投稿例"]
      },
      "currentPain": {
        "keywords": ["給料日前", "我慢", "諦める"],
        "phrases": ["共感フレーズ"],
        "examples": ["投稿例"]
      }
    }
  },
  "persuasionTechniques": {
    "socialProof": {
      "description": "他者の成功事例で安心感",
      "templates": ["○○さん（20代）が月○○万円達成！"],
      "examples": ["投稿例"]
    },
    "authority": {
      "description": "専門性・実績で信頼獲得",
      "templates": ["業界○年のサポート体制"],
      "examples": ["投稿例"]
    },
    "scarcity": {
      "description": "限定感で行動促進",
      "templates": ["今月あと○名まで"],
      "examples": ["投稿例"]
    },
    "reciprocity": {
      "description": "先に価値提供",
      "templates": ["無料体験", "お祝い金"],
      "examples": ["投稿例"]
    }
  },
  "objectionHandling": {
    "common": [
      {
        "objection": "顔出ししたくない",
        "response": "顔出し不要！マスクOK、声だけもOK",
        "copyTemplate": "コピーに組み込む例"
      },
      {
        "objection": "身バレが心配",
        "response": "完全匿名OK！身分証確認は社内のみ",
        "copyTemplate": "コピーに組み込む例"
      },
      {
        "objection": "経験がない",
        "response": "未経験者90%！充実研修あり",
        "copyTemplate": "コピーに組み込む例"
      }
    ]
  },
  "captionStructures": {
    "short": {
      "name": "ショート型（100字以内）",
      "structure": "フック→ベネフィット→CTA",
      "templates": ["テンプレート"],
      "examples": ["実際の投稿例"]
    },
    "medium": {
      "name": "ミディアム型（200字程度）",
      "structure": "フック→共感→解決策→証拠→CTA",
      "templates": ["テンプレート"],
      "examples": ["実際の投稿例"]
    },
    "long": {
      "name": "ロング型（300字以上）",
      "structure": "フック→問題提起→共感→解決策→ベネフィット→証拠→CTA→PS",
      "templates": ["テンプレート"],
      "examples": ["実際の投稿例"]
    }
  },
  "ctaPatterns": {
    "lowBarrier": [
      {
        "text": "まずは話だけ聞いてみませんか？",
        "psychology": "コミットメント低く始められる"
      }
    ],
    "urgency": [
      {
        "text": "今週中の応募で入店祝い金2倍！",
        "psychology": "即行動の理由を与える"
      }
    ],
    "specific": [
      {
        "text": "プロフィールのリンクから30秒で応募完了",
        "psychology": "具体的な行動ステップを明示"
      }
    ]
  },
  "abTestIdeas": [
    {
      "element": "見出し",
      "variationA": "時給訴求",
      "variationB": "ライフスタイル訴求",
      "hypothesis": "若年層はライフスタイル、30代は時給に反応しやすい"
    }
  ],
  "platformSpecific": {
    "instagram": {
      "captionTips": ["最初の一文が重要", "改行を効果的に"],
      "hashtagStrategy": ["ターゲット層が見るハッシュタグ"],
      "visualTips": ["画像のポイント"]
    },
    "twitter": {
      "captionTips": ["140字で完結", "リプで詳細"],
      "hashtagStrategy": ["2-3個に厳選"],
      "threadStrategy": ["スレッドの使い方"]
    },
    "tiktok": {
      "captionTips": ["短く衝撃的に"],
      "soundTips": ["トレンド音源活用"],
      "hookPatterns": ["最初の3秒"]
    }
  }
}

実践的で即使える内容にしてください。
各カテゴリに最低3つ以上の具体例を含めてください。`;

    const result = await model.generateContent(copywritingPrompt);
    let resultText = result.response.text();

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'コピーライティングノウハウの解析に失敗しました' }, { status: 500 });
    }

    const copyData = JSON.parse(jsonMatch[0]);
    copyData.updatedAt = new Date().toISOString();

    saveKnowledge('recruitment_copy.json', copyData);

    return NextResponse.json({
      success: true,
      message: '求人コピーライティングノウハウを更新しました',
      data: copyData
    });

  } catch (error: any) {
    console.error('Failed to update recruitment copy:', error);
    return NextResponse.json(
      { error: 'コピーライティングノウハウの更新に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const knowledge = loadKnowledge('recruitment_copy.json');

    if (!knowledge) {
      return NextResponse.json({
        success: false,
        message: 'コピーライティングノウハウがありません。更新してください。'
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: knowledge });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'コピーライティングノウハウの取得に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

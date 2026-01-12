import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const FEEDBACK_FILE = path.join(KNOWLEDGE_DIR, 'feedback_rules.json');

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FeedbackRule {
  id: string;
  businessType: string;
  targetAudience?: string;
  rule: string;
  reason?: string;
  createdAt: string;
}

function loadFeedbackRules(): FeedbackRule[] {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load feedback rules:', e);
  }
  return [];
}

function saveFeedbackRules(rules: FeedbackRule[]): void {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(rules, null, 2), 'utf-8');
}

// 壁打ちの会話からルールを自動抽出
export async function POST(request: NextRequest) {
  try {
    const { chatHistory, originalPost, finalPost, businessType, targetAudience } = await request.json();

    if (!chatHistory || chatHistory.length === 0) {
      return NextResponse.json({ extracted: [] });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

    const userFeedbacks = (chatHistory as ChatMessage[])
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n');

    const prompt = `以下はSNS投稿文の編集における、ユーザーからのフィードバック履歴です。
この会話から、今後の投稿生成に活かせる「ルール」を抽出してください。

【元の投稿】
${originalPost}

【最終的な投稿】
${finalPost}

【ユーザーのフィードバック】
${userFeedbacks}

【抽出ルール】
- 具体的で再利用可能なルールのみ抽出
- 一般的すぎるもの（「良くして」など）は除外
- 文体・用語・トーン・表現に関するルールを優先
- 最大3つまで

以下のJSON形式で返してください（JSON以外は出力しない）:
{
  "rules": [
    {
      "rule": "〇〇は避ける" または "〇〇を使う",
      "reason": "なぜそのルールが必要か"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text() || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ extracted: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const extractedRules = parsed.rules || [];

    if (extractedRules.length === 0) {
      return NextResponse.json({ extracted: [] });
    }

    const existingRules = loadFeedbackRules();
    const newRules: FeedbackRule[] = [];

    for (const rule of extractedRules) {
      const isDuplicate = existingRules.some(
        existing => existing.rule.includes(rule.rule) || rule.rule.includes(existing.rule)
      );

      if (!isDuplicate) {
        const newRule: FeedbackRule = {
          id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          businessType: businessType || 'all',
          targetAudience: targetAudience,
          rule: rule.rule,
          reason: rule.reason,
          createdAt: new Date().toISOString()
        };
        existingRules.push(newRule);
        newRules.push(newRule);
      }
    }

    if (newRules.length > 0) {
      saveFeedbackRules(existingRules);
    }

    return NextResponse.json({
      extracted: newRules,
      message: newRules.length > 0
        ? `${newRules.length}件の新しいルールを学習しました`
        : '新しいルールはありませんでした'
    });

  } catch (error: any) {
    console.error('Extract feedback error:', error);
    return NextResponse.json({ error: error.message, extracted: [] }, { status: 500 });
  }
}

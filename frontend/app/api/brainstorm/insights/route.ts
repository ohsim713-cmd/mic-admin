/**
 * 気づき保存API
 * 壁打ちから得た気づきを保存し、投稿生成時に参照できるようにする
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

const INSIGHTS_PATH = path.join(process.cwd(), 'knowledge', 'user_insights.json');

// Gemini初期化（気づき抽出用）
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface Insight {
  id: string;
  timestamp: string;
  category: 'competitor' | 'marketing' | 'product' | 'trend' | 'idea' | 'other';
  title: string;
  content: string;
  source: 'brainstorm' | 'manual';
  tags: string[];
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
  applied: boolean; // 投稿に反映済みか
}

interface InsightsDB {
  insights: Insight[];
  lastUpdated: string;
}

async function loadInsights(): Promise<InsightsDB> {
  try {
    const data = await fs.readFile(INSIGHTS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      insights: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function saveInsights(db: InsightsDB): Promise<void> {
  const dir = path.dirname(INSIGHTS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(INSIGHTS_PATH, JSON.stringify(db, null, 2));
}

/**
 * 会話から気づきを抽出
 */
async function extractInsights(conversation: string): Promise<Partial<Insight>[]> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `以下の壁打ち会話から、ビジネスに活用できる気づきを抽出してください。

会話:
${conversation}

以下のJSON形式で返してください:
{
  "insights": [
    {
      "category": "competitor" | "marketing" | "product" | "trend" | "idea" | "other",
      "title": "短いタイトル（20文字以内）",
      "content": "具体的な気づきの内容",
      "tags": ["関連タグ"],
      "actionable": true/false（すぐに行動に移せるか）,
      "priority": "high" | "medium" | "low"
    }
  ]
}

気づきがない場合は空配列を返してください。
採用マーケティング、ライバー事務所、チャットレディ事務所に関連する気づきを優先してください。`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return parsed.insights || [];
  } catch (e) {
    console.error('[Insights] Failed to extract:', e);
    return [];
  }
}

// GET: 気づき一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const unapplied = searchParams.get('unapplied') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = await loadInsights();
    let insights = db.insights;

    // フィルタリング
    if (category) {
      insights = insights.filter(i => i.category === category);
    }
    if (unapplied) {
      insights = insights.filter(i => !i.applied);
    }

    // 最新順でソート
    insights = insights
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    // カテゴリ別集計
    const byCategory = db.insights.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      insights,
      total: db.insights.length,
      unappliedCount: db.insights.filter(i => !i.applied).length,
      byCategory,
    });
  } catch (error) {
    console.error('[Insights] GET error:', error);
    return NextResponse.json({ error: 'Failed to load insights' }, { status: 500 });
  }
}

// POST: 気づきを保存または会話から抽出
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const db = await loadInsights();

    if (action === 'extract') {
      // 会話から気づきを抽出して保存
      const { conversation } = body;
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation required' }, { status: 400 });
      }

      const extracted = await extractInsights(conversation);

      const newInsights: Insight[] = extracted.map(e => ({
        id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        category: e.category || 'other',
        title: e.title || '気づき',
        content: e.content || '',
        source: 'brainstorm',
        tags: e.tags || [],
        actionable: e.actionable || false,
        priority: e.priority || 'medium',
        applied: false,
      }));

      db.insights.push(...newInsights);
      db.lastUpdated = new Date().toISOString();
      await saveInsights(db);

      return NextResponse.json({
        success: true,
        extracted: newInsights.length,
        insights: newInsights,
      });
    } else if (action === 'save') {
      // 手動で気づきを保存
      const { title, content, category, tags, priority } = body;

      if (!content) {
        return NextResponse.json({ error: 'Content required' }, { status: 400 });
      }

      const newInsight: Insight = {
        id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        category: category || 'other',
        title: title || content.substring(0, 20),
        content,
        source: 'manual',
        tags: tags || [],
        actionable: true,
        priority: priority || 'medium',
        applied: false,
      };

      db.insights.push(newInsight);
      db.lastUpdated = new Date().toISOString();
      await saveInsights(db);

      return NextResponse.json({
        success: true,
        insight: newInsight,
      });
    } else if (action === 'mark_applied') {
      // 気づきを適用済みにマーク
      const { insightIds } = body;
      if (!insightIds || !Array.isArray(insightIds)) {
        return NextResponse.json({ error: 'insightIds array required' }, { status: 400 });
      }

      let marked = 0;
      for (const id of insightIds) {
        const insight = db.insights.find(i => i.id === id);
        if (insight) {
          insight.applied = true;
          marked++;
        }
      }

      db.lastUpdated = new Date().toISOString();
      await saveInsights(db);

      return NextResponse.json({
        success: true,
        marked,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Insights] POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// DELETE: 気づきを削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const db = await loadInsights();
    const index = db.insights.findIndex(i => i.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    db.insights.splice(index, 1);
    db.lastUpdated = new Date().toISOString();
    await saveInsights(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Insights] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

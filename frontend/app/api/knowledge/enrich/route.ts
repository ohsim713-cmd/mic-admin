/**
 * ナレッジ充実API
 *
 * POST: 不足領域を検索して知識を補充
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import * as fs from 'fs/promises';
import * as path from 'path';

export const maxDuration = 120;

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  temperature: 0.3,
  apiKey: process.env.GEMINI_API_KEY,
});

// 検索クエリからナレッジを生成
async function generateKnowledge(
  category: string,
  accountType: string,
  existingKeywords: string[]
): Promise<{
  facts: string[];
  statistics: string[];
  tips: string[];
  sources: string[];
}> {
  const accountName = accountType === 'liver' ? 'ライバー' : 'チャットレディ';

  const prompt = `あなたは${accountName}業界の専門家です。

【カテゴリ】${category}
【既存の知識】${existingKeywords.join(', ') || 'なし'}

このカテゴリについて、SNS投稿の募集文に使える**具体的で実用的な情報**を収集してください。

【収集する情報】
1. 具体的な数字・統計（facts）
2. 業界の最新統計（statistics）
3. 実践的なアドバイス（tips）
4. 情報源・根拠（sources）

【重要】
- 2024-2025年の最新情報を優先
- 具体的な数字を含める（「月収○万円」「○%が成功」など）
- 投稿文で使える表現にする
- 信憑性のある情報のみ

以下のJSON形式で出力してください:
{
  "facts": ["具体的な事実1", "具体的な事実2", ...],
  "statistics": ["統計1", "統計2", ...],
  "tips": ["アドバイス1", "アドバイス2", ...],
  "sources": ["情報源1", "情報源2", ...]
}`;

  try {
    const response = await model.invoke(prompt);
    const content = response.content as string;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Enrich] Generation error:', error);
  }

  return { facts: [], statistics: [], tips: [], sources: [] };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, accountType, autoFill = false } = body;

    // カバレッジAPIから不足領域を取得
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const coverageResponse = await fetch(`${baseUrl}/api/knowledge/coverage`);
    const coverageData = await coverageResponse.json();

    let targetGaps: Array<{ category: string; accountType: string; priority: string }> = [];

    if (category && accountType) {
      // 特定カテゴリを指定
      targetGaps = [{ category, accountType, priority: 'HIGH' }];
    } else if (autoFill) {
      // 自動で優先度の高い不足領域を選択
      for (const [accType, data] of Object.entries(coverageData.coverage || {})) {
        const typedData = data as { gaps: Array<{ category: string; priority: string }> };
        for (const gap of typedData.gaps?.slice(0, 2) || []) {
          targetGaps.push({
            category: gap.category,
            accountType: accType,
            priority: gap.priority,
          });
        }
      }
    }

    if (targetGaps.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No gaps to fill. Knowledge is sufficient.',
      });
    }

    // 各不足領域の知識を生成
    const results: Array<{
      category: string;
      accountType: string;
      knowledge: any;
      saved: boolean;
    }> = [];

    for (const gap of targetGaps) {
      console.log(`[Enrich] Generating knowledge for ${gap.accountType}/${gap.category}`);

      const existingKeywords = coverageData.coverage?.[gap.accountType]?.categories?.[gap.category]?.missingKeywords || [];

      const knowledge = await generateKnowledge(gap.category, gap.accountType, existingKeywords);

      // ナレッジファイルに保存
      const fileName = `${gap.accountType}_${gap.category.replace(/[・\s]/g, '_')}_enriched.json`;
      const filePath = path.join(process.cwd(), 'knowledge', fileName);

      const enrichedData = {
        category: gap.category,
        accountType: gap.accountType,
        generatedAt: new Date().toISOString(),
        ...knowledge,
      };

      await fs.writeFile(filePath, JSON.stringify(enrichedData, null, 2), 'utf-8');

      results.push({
        category: gap.category,
        accountType: gap.accountType,
        knowledge,
        saved: true,
      });
    }

    return NextResponse.json({
      success: true,
      enriched: results,
      totalCategories: results.length,
      message: `${results.length}カテゴリの知識を補充しました`,
    });
  } catch (error: any) {
    console.error('[Enrich] Error:', error);
    return NextResponse.json(
      { error: 'Failed to enrich knowledge', details: error.message },
      { status: 500 }
    );
  }
}

// GET: 補充可能な領域を確認
export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const coverageResponse = await fetch(`${baseUrl}/api/knowledge/coverage`);
    const coverageData = await coverageResponse.json();

    const enrichableGaps: Array<{
      accountType: string;
      category: string;
      priority: string;
      currentCoverage: number;
      searchQueries: string[];
    }> = [];

    for (const [accType, data] of Object.entries(coverageData.coverage || {})) {
      const typedData = data as { gaps: Array<{ category: string; priority: string; coverage: number; searchQueries: string[] }> };
      for (const gap of typedData.gaps || []) {
        enrichableGaps.push({
          accountType: accType,
          category: gap.category,
          priority: gap.priority,
          currentCoverage: gap.coverage,
          searchQueries: gap.searchQueries,
        });
      }
    }

    return NextResponse.json({
      enrichableGaps,
      summary: coverageData.summary,
      recommendation: enrichableGaps.length > 0
        ? `${enrichableGaps[0].category}（${enrichableGaps[0].accountType}）の知識補充を推奨`
        : '知識は十分にカバーされています',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get enrichable gaps', details: error.message },
      { status: 500 }
    );
  }
}

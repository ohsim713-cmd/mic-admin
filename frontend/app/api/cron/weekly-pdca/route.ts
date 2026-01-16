/**
 * 週次PDCA Cron ジョブ
 *
 * Vercel Cron: 毎週日曜 UTC 12:00 (JST 21:00)
 * 週間パフォーマンスを分析し、改善提案を生成
 * 学習結果を自動的にナレッジベースに反映
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { getWeeklyStats } from '@/lib/database/schedule-db';
import { getSuccessPatterns, getPatternDetails, addSuccessPattern } from '@/lib/database/success-patterns-db';
import * as fs from 'fs/promises';
import * as path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 120;

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-3-flash-preview',
  temperature: 0.5,
  apiKey: process.env.GEMINI_API_KEY,
});

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // 1. 週間統計を取得
    const weeklyStats = await getWeeklyStats();

    // 2. 成功パターンを取得
    let successPatterns: string[] = [];
    try {
      successPatterns = await getSuccessPatterns();
    } catch {
      successPatterns = [];
    }

    // 3. AIでPDCA分析
    const analysisPrompt = `あなたはSNSマーケティングのPDCAアナリストです。

【週間実績】
- 投稿数: ${weeklyStats.posts || 0}件
- 成功パターン数: ${successPatterns.length}件
- 平均インプレッション: ${weeklyStats.avgImpressions || 'N/A'}

【成功パターン例】
${successPatterns.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n') || 'なし'}

【分析タスク】
1. Check（確認）: 今週の実績を評価
2. Act（改善）: 来週への具体的な改善提案を3つ

以下の形式でJSONで出力してください:
{
  "check": {
    "summary": "今週の総評（1-2文）",
    "good_points": ["良かった点1", "良かった点2"],
    "issues": ["課題1", "課題2"]
  },
  "act": {
    "improvements": [
      {"title": "改善1", "action": "具体的なアクション"},
      {"title": "改善2", "action": "具体的なアクション"},
      {"title": "改善3", "action": "具体的なアクション"}
    ],
    "next_week_focus": "来週のフォーカスポイント"
  }
}`;

    const response = await model.invoke(analysisPrompt);
    const content = response.content as string;

    // JSON抽出
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let analysis = null;
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch {
        analysis = { raw: content };
      }
    }

    // 4. 分析結果から新しいパターンを自動学習
    let learnedPatterns = 0;
    if (analysis?.act?.improvements) {
      for (const improvement of analysis.act.improvements) {
        // 改善提案からパターンを抽出
        if (improvement.action && improvement.action.includes('「') && improvement.action.includes('」')) {
          const match = improvement.action.match(/「([^」]+)」/g);
          if (match) {
            for (const m of match) {
              const pattern = m.replace(/[「」]/g, '');
              if (pattern.length > 5 && pattern.length < 30) {
                // 短すぎず長すぎないパターンを学習
                const category = pattern.includes('DM') || pattern.includes('気軽') ? 'cta' :
                                pattern.includes('万') || pattern.includes('稼') ? 'benefit' : 'hook';
                await addSuccessPattern(pattern, category, 8.0);
                learnedPatterns++;
              }
            }
          }
        }
      }
    }

    // 5. 高スコアパターンの強化（使用頻度が高く効果的なパターンを優先）
    const patternDetails = await getPatternDetails();
    const topPatterns = patternDetails
      .filter(p => p.score >= 8.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // 6. レポートを保存
    const report = {
      timestamp: new Date().toISOString(),
      weeklyStats,
      successPatternsCount: successPatterns.length,
      analysis,
      autoLearning: {
        learnedPatterns,
        topPatterns: topPatterns.map(p => ({
          pattern: p.pattern,
          category: p.category,
          score: p.score,
        })),
      },
    };

    const reportsDir = path.join(process.cwd(), 'data', 'pdca_reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const reportFile = path.join(
      reportsDir,
      `report_${new Date().toISOString().split('T')[0]}.json`
    );
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    console.log('[CRON] Weekly PDCA report:', report);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report,
      autoLearning: {
        learnedPatterns,
        topPatternsCount: topPatterns.length,
      },
    });
  } catch (error) {
    console.error('[CRON] Weekly PDCA error:', error);
    return NextResponse.json(
      { error: 'Failed to run weekly PDCA', details: String(error) },
      { status: 500 }
    );
  }
}

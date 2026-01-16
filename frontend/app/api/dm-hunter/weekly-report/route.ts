import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReport, analyzePerformance } from '@/lib/dm-hunter/performance-analyzer';
import { getHistoricalStats } from '@/lib/dm-hunter/dm-tracker';
import { getTestSummary } from '@/lib/dm-hunter/ab-tester';
import { createAlert } from '@/lib/dm-hunter/alert-system';
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey });

// GET: 週次レポートを取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const report = await generateFullWeeklyReport();

    if (format === 'markdown') {
      const markdown = formatAsMarkdown(report);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
        },
      });
    }

    return NextResponse.json(report);

  } catch (error: any) {
    console.error('[Weekly Report] GET error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// POST: 週次レポートを生成して通知
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { notify = true } = body;

    const report = await generateFullWeeklyReport();

    // アラートとして通知
    if (notify) {
      await createAlert({
        type: 'weekly_report',
        priority: 'low',
        title: '週次レポート',
        message: report.summary,
        data: report,
      });
    }

    return NextResponse.json({
      success: true,
      report,
    });

  } catch (error: any) {
    console.error('[Weekly Report] POST error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * フル週次レポートを生成
 */
async function generateFullWeeklyReport() {
  const [baseReport, history, analysis, testSummary] = await Promise.all([
    generateWeeklyReport(),
    getHistoricalStats(7),
    analyzePerformance(7).catch(() => null),
    getTestSummary().catch(() => null),
  ]);

  // AIでエグゼクティブサマリーを生成
  let executiveSummary = baseReport.summary;
  try {
    const prompt = `以下のデータを元に、簡潔なエグゼクティブサマリー（2-3文）を日本語で作成してください。

【週間データ】
- 総投稿数: ${baseReport.metrics.totalPosts}
- 総DM数: ${baseReport.metrics.totalDMs}
- コンバージョン率: ${baseReport.metrics.conversionRate}%
- 目標達成日数: ${history.dailyStats.filter(d => d.goalAchieved).length}/7日
- トレンド: ${history.trend === 'up' ? '上昇' : history.trend === 'down' ? '下降' : '横ばい'}

【ベストパフォーマンス】
${analysis?.insights?.bestTargets?.slice(0, 2).map(t => `- ${t.target}: 平均${t.avgDMs.toFixed(1)}DM/投稿`).join('\n') || 'データ不足'}

【改善提案】
${baseReport.improvements?.slice(0, 2).join('\n') || 'なし'}

サマリー:`;

    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    executiveSummary = result.text?.trim() || baseReport.summary;
  } catch (error) {
    console.error('[Weekly Report] AI summary error:', error);
  }

  return {
    generatedAt: new Date().toISOString(),
    period: {
      start: history.dailyStats[0]?.date || '',
      end: history.dailyStats[history.dailyStats.length - 1]?.date || '',
    },
    summary: executiveSummary,
    metrics: {
      ...baseReport.metrics,
      goalAchievementDays: history.dailyStats.filter(d => d.goalAchieved).length,
      totalDays: history.dailyStats.length,
      avgDMsPerDay: history.avgDMsPerDay,
      trend: history.trend,
    },
    dailyBreakdown: history.dailyStats.map(d => ({
      date: d.date,
      dms: d.totalDMs,
      goalAchieved: d.goalAchieved,
    })),
    insights: analysis?.insights || null,
    recommendations: analysis?.recommendations || baseReport.improvements,
    abTests: testSummary ? {
      completedThisWeek: testSummary.recentCompleted.length,
      bestCombinations: testSummary.bestCombinations.slice(0, 3),
    } : null,
    highlights: baseReport.highlights,
    improvements: baseReport.improvements,
  };
}

/**
 * Markdownフォーマットに変換
 */
function formatAsMarkdown(report: any): string {
  const lines = [
    `# 週次レポート`,
    ``,
    `**期間:** ${report.period.start} 〜 ${report.period.end}`,
    `**生成日時:** ${new Date(report.generatedAt).toLocaleString('ja-JP')}`,
    ``,
    `## エグゼクティブサマリー`,
    ``,
    report.summary,
    ``,
    `## 主要KPI`,
    ``,
    `| 指標 | 値 |`,
    `|------|-----|`,
    `| 総投稿数 | ${report.metrics.totalPosts} |`,
    `| 総DM数 | ${report.metrics.totalDMs} |`,
    `| コンバージョン率 | ${report.metrics.conversionRate}% |`,
    `| 目標達成日数 | ${report.metrics.goalAchievementDays}/${report.metrics.totalDays}日 |`,
    `| 平均DM/日 | ${report.metrics.avgDMsPerDay} |`,
    `| トレンド | ${report.metrics.trend === 'up' ? '↑ 上昇' : report.metrics.trend === 'down' ? '↓ 下降' : '→ 横ばい'} |`,
    ``,
    `## 日別実績`,
    ``,
    `| 日付 | DM数 | 目標 |`,
    `|------|------|------|`,
    ...report.dailyBreakdown.map((d: any) =>
      `| ${d.date} | ${d.dms} | ${d.goalAchieved ? '✓' : '✗'} |`
    ),
    ``,
  ];

  if (report.insights?.bestTargets?.length > 0) {
    lines.push(
      `## 効果的なターゲット`,
      ``,
      ...report.insights.bestTargets.slice(0, 5).map((t: any) =>
        `- **${t.target}**: 平均 ${t.avgDMs.toFixed(2)} DM/投稿 (${t.count}投稿)`
      ),
      ``,
    );
  }

  if (report.insights?.bestBenefits?.length > 0) {
    lines.push(
      `## 効果的なベネフィット`,
      ``,
      ...report.insights.bestBenefits.slice(0, 5).map((b: any) =>
        `- **${b.benefit}**: 平均 ${b.avgDMs.toFixed(2)} DM/投稿 (${b.count}投稿)`
      ),
      ``,
    );
  }

  if (report.recommendations?.length > 0) {
    lines.push(
      `## 改善提案`,
      ``,
      ...report.recommendations.map((r: string) => `- ${r}`),
      ``,
    );
  }

  if (report.abTests) {
    lines.push(
      `## A/Bテスト結果`,
      ``,
      `今週完了したテスト: ${report.abTests.completedThisWeek}件`,
      ``,
      `### ベストコンビネーション`,
      ``,
      ...report.abTests.bestCombinations.map((c: any) =>
        `- ${c.target} × ${c.benefit}: 成功率 ${(c.successRate * 100).toFixed(1)}%`
      ),
      ``,
    );
  }

  lines.push(
    `---`,
    `*このレポートはDM Hunterによって自動生成されました*`,
  );

  return lines.join('\n');
}

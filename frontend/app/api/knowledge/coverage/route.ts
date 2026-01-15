/**
 * ナレッジカバレッジAPI
 *
 * GET: 知識の分布図と不足領域を分析
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

// 必要な知識カテゴリと期待されるファイル
const KNOWLEDGE_REQUIREMENTS = {
  liver: {
    name: 'ライバー',
    categories: {
      '市場情報': {
        priority: 'HIGH',
        expectedFiles: ['liver_market_master.json', 'liver_trends.json'],
        keywords: ['市場規模', 'プラットフォーム', 'トレンド', '業界動向'],
      },
      'ターゲット別戦略': {
        priority: 'HIGH',
        expectedFiles: ['liver_age_strategies.json'],
        keywords: ['20代', '30代', '40代', '主婦', '副業', '学生'],
      },
      '収入情報': {
        priority: 'HIGH',
        expectedFiles: ['liver_income_simulation.json'],
        keywords: ['収入', '時給', '月収', '還元率'],
      },
      '成功事例': {
        priority: 'HIGH',
        expectedFiles: ['liver_success_stories.json'],
        keywords: ['成功', '実績', '体験談', '事例'],
      },
      '募集コピー': {
        priority: 'HIGH',
        expectedFiles: ['liver_recruitment_copy.json', 'liver_viral_templates.json'],
        keywords: ['フック', 'CTA', 'コピー', 'テンプレート'],
      },
      'プラットフォーム詳細': {
        priority: 'MEDIUM',
        expectedFiles: ['liver_streaming_genres.json'],
        keywords: ['Pococha', '17LIVE', 'IRIAM', 'TikTok'],
      },
      '不安解消': {
        priority: 'HIGH',
        expectedFiles: ['liver_anxiety_relief_enriched.json'],
        keywords: ['身バレ', '顔出し', '未経験', 'サポート', '安全'],
      },
      '技術・機材': {
        priority: 'MEDIUM',
        expectedFiles: ['liver_equipment_enriched.json'],
        keywords: ['機材', 'スマホ', 'マイク', '照明', '環境'],
      },
      'コンプライアンス': {
        priority: 'LOW',
        expectedFiles: ['liver_compliance_master.json'],
        keywords: ['確定申告', '税金', '契約', '法律'],
      },
    },
  },
  chatlady: {
    name: 'チャットレディ',
    categories: {
      '市場情報': {
        priority: 'HIGH',
        expectedFiles: ['chatlady_trends.json'],
        keywords: ['市場', 'トレンド', '業界'],
      },
      'ターゲット別戦略': {
        priority: 'HIGH',
        expectedFiles: ['chatlady_age_strategies.json'],
        keywords: ['20代', '30代', '40代', '50代', '主婦'],
      },
      '収入情報': {
        priority: 'HIGH',
        expectedFiles: ['chatlady_income_simulation.json'],
        keywords: ['収入', '時給', '報酬'],
      },
      '成功事例': {
        priority: 'HIGH',
        expectedFiles: ['chatlady_success_stories.json'],
        keywords: ['成功', '体験談'],
      },
      '募集コピー': {
        priority: 'HIGH',
        expectedFiles: ['chatlady_recruitment_copy.json'],
        keywords: ['フック', 'CTA', 'コピー'],
      },
      '働き方': {
        priority: 'MEDIUM',
        expectedFiles: ['chatlady_workstyle_enriched.json'],
        keywords: ['通勤', '在宅', 'アプリ', 'バーチャル'],
      },
      '不安解消': {
        priority: 'HIGH',
        expectedFiles: ['chatlady_anxiety_relief_enriched.json'],
        keywords: ['身バレ', '安全', '匿名'],
      },
    },
  },
};

// 検索推奨クエリ
const SEARCH_QUERIES: Record<string, string[]> = {
  '市場情報': [
    'ライブ配信 市場規模 2025',
    'Pococha 17LIVE ユーザー数 最新',
    'ライバー 業界 トレンド',
  ],
  'ターゲット別戦略': [
    '30代 ライバー 成功 コツ',
    '主婦 副業 ライブ配信',
    '40代 ライバー 始め方',
  ],
  '収入情報': [
    'ライバー 平均収入 2025',
    'Pococha 時給 ランク別',
    '17LIVE 還元率 最新',
  ],
  '成功事例': [
    'ライバー 成功事例 インタビュー',
    '未経験 ライバー 月収',
  ],
  '不安解消': [
    'ライバー 身バレ対策',
    '顔出しなし Vライバー 収入',
    'ライブ配信 安全 始め方',
  ],
  '技術・機材': [
    'ライブ配信 おすすめ機材 2025',
    '配信用マイク 初心者',
    'リングライト おすすめ',
  ],
  'コンプライアンス': [
    'ライバー 確定申告 やり方',
    '配信 収入 税金',
    'ライバー事務所 契約 注意点',
  ],
};

export async function GET() {
  try {
    const knowledgeDir = path.join(process.cwd(), 'knowledge');

    // 全JSONファイルを読み込み
    const files = await fs.readdir(knowledgeDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // 各ファイルの内容を解析
    const fileContents: Record<string, { size: number; content: string; keywords: string[] }> = {};

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(knowledgeDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const contentStr = content.toLowerCase();

        // キーワード抽出（簡易版）
        const keywords: string[] = [];
        const allKeywords = Object.values(KNOWLEDGE_REQUIREMENTS)
          .flatMap(r => Object.values(r.categories))
          .flatMap(c => c.keywords);

        for (const keyword of allKeywords) {
          if (contentStr.includes(keyword.toLowerCase())) {
            keywords.push(keyword);
          }
        }

        fileContents[file] = {
          size: content.length,
          content: contentStr,
          keywords,
        };
      } catch {
        // ファイル読み込みエラーは無視
      }
    }

    // カバレッジ計算
    const coverage: Record<string, {
      name: string;
      categories: Record<string, {
        coverage: number;
        priority: string;
        foundFiles: string[];
        missingKeywords: string[];
        searchQueries: string[];
      }>;
      totalCoverage: number;
      gaps: Array<{ category: string; priority: string; coverage: number; searchQueries: string[] }>;
    }> = {};

    for (const [accountType, requirements] of Object.entries(KNOWLEDGE_REQUIREMENTS)) {
      const categoryResults: Record<string, any> = {};
      let totalScore = 0;
      let totalWeight = 0;
      const gaps: any[] = [];

      for (const [categoryName, categoryReq] of Object.entries(requirements.categories)) {
        const weight = categoryReq.priority === 'HIGH' ? 3 : categoryReq.priority === 'MEDIUM' ? 2 : 1;

        // ファイル存在チェック
        const foundFiles = categoryReq.expectedFiles.filter(f => jsonFiles.includes(f));
        const fileScore = categoryReq.expectedFiles.length > 0
          ? (foundFiles.length / categoryReq.expectedFiles.length) * 50
          : 0;

        // キーワードカバレッジ
        let keywordScore = 0;
        const foundKeywords: string[] = [];
        const missingKeywords: string[] = [];

        for (const keyword of categoryReq.keywords) {
          const found = Object.values(fileContents).some(f =>
            f.content.includes(keyword.toLowerCase())
          );
          if (found) {
            foundKeywords.push(keyword);
            keywordScore += 50 / categoryReq.keywords.length;
          } else {
            missingKeywords.push(keyword);
          }
        }

        const categoryCoverage = Math.min(100, Math.round(fileScore + keywordScore));

        categoryResults[categoryName] = {
          coverage: categoryCoverage,
          priority: categoryReq.priority,
          foundFiles,
          missingKeywords,
          searchQueries: SEARCH_QUERIES[categoryName] || [],
        };

        totalScore += categoryCoverage * weight;
        totalWeight += 100 * weight;

        // 不足領域を記録
        if (categoryCoverage < 70) {
          gaps.push({
            category: categoryName,
            priority: categoryReq.priority,
            coverage: categoryCoverage,
            searchQueries: SEARCH_QUERIES[categoryName] || [],
          });
        }
      }

      // 優先度でソート
      gaps.sort((a, b) => {
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        if (priorityOrder[a.priority as keyof typeof priorityOrder] !== priorityOrder[b.priority as keyof typeof priorityOrder]) {
          return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
        }
        return a.coverage - b.coverage;
      });

      coverage[accountType] = {
        name: requirements.name,
        categories: categoryResults,
        totalCoverage: Math.round(totalScore / totalWeight * 100),
        gaps,
      };
    }

    // 優先的に検索すべきクエリを抽出
    const prioritySearches: Array<{
      accountType: string;
      category: string;
      priority: string;
      queries: string[];
    }> = [];

    for (const [accountType, data] of Object.entries(coverage)) {
      for (const gap of data.gaps.slice(0, 3)) { // 上位3つの不足領域
        prioritySearches.push({
          accountType,
          category: gap.category,
          priority: gap.priority,
          queries: gap.searchQueries,
        });
      }
    }

    return NextResponse.json({
      coverage,
      prioritySearches,
      summary: {
        liver: coverage.liver?.totalCoverage || 0,
        chatlady: coverage.chatlady?.totalCoverage || 0,
        totalFiles: jsonFiles.length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Knowledge Coverage] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze knowledge coverage', details: error.message },
      { status: 500 }
    );
  }
}

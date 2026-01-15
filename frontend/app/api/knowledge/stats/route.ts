/**
 * ナレッジ統計API
 * アカウント別のナレッジ分布・カバレッジを返す
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ナレッジカテゴリの定義
const KNOWLEDGE_CATEGORIES = {
  liver: {
    name: 'ライバー',
    files: [
      { key: 'trends', file: 'liver_trends.json', label: '業界トレンド', importance: 'high' },
      { key: 'recruitment', file: 'liver_recruitment_copy.json', label: '募集コピー', importance: 'high' },
      { key: 'success_stories', file: 'liver_success_stories.json', label: '成功事例', importance: 'high' },
      { key: 'income', file: 'liver_income_simulation.json', label: '収入シミュレーション', importance: 'medium' },
      { key: 'age_strategies', file: 'liver_age_strategies.json', label: '年齢別戦略', importance: 'medium' },
      { key: 'viral_templates', file: 'liver_viral_templates.json', label: 'バズテンプレ', importance: 'medium' },
      { key: 'streaming_genres', file: 'liver_streaming_genres.json', label: '配信ジャンル', importance: 'low' },
      { key: 'market_master', file: 'liver_market_master.json', label: 'マーケット情報', importance: 'low' },
      { key: 'article_topics', file: 'liver_article_topics.json', label: '記事トピック', importance: 'low' },
    ]
  },
  chatre: {
    name: 'チャトレ',
    files: [
      { key: 'trends', file: 'chatlady_trends.json', label: '業界トレンド', importance: 'high' },
      { key: 'recruitment', file: 'chatlady_recruitment_copy.json', label: '募集コピー', importance: 'high' },
      { key: 'success_stories', file: 'chatlady_success_stories.json', label: '成功事例', importance: 'high' },
      { key: 'income', file: 'chatlady_income_simulation.json', label: '収入シミュレーション', importance: 'medium' },
      { key: 'age_strategies', file: 'chatlady_age_strategies.json', label: '年齢別戦略', importance: 'medium' },
    ]
  },
  shared: {
    name: '共通',
    files: [
      { key: 'success_patterns', file: 'success_patterns.json', label: '成功パターン', importance: 'high' },
      { key: 'faq', file: 'faq.json', label: 'FAQ', importance: 'medium' },
      { key: 'privacy', file: 'privacy_protection.json', label: 'プライバシー対策', importance: 'medium' },
    ]
  }
};

// 必要なナレッジカテゴリ（チェックリスト）
const REQUIRED_KNOWLEDGE = {
  liver: [
    { category: '市場情報', items: ['市場規模', 'プラットフォーム情報', '最新トレンド'] },
    { category: 'ターゲット別', items: ['20代向け', '30代向け', '40代向け', '主婦向け', '副業希望者向け'] },
    { category: '訴求ポイント', items: ['収入メリット', '時間の自由', 'サポート体制', '成功事例'] },
    { category: 'プラットフォーム', items: ['Pococha', '17LIVE', 'IRIAM', 'TikTok LIVE'] },
    { category: '不安解消', items: ['身バレ対策', '顔出しなし', '未経験OK', '機材サポート'] },
  ],
  chatre: [
    { category: '市場情報', items: ['市場規模', 'サイト情報', '最新トレンド'] },
    { category: 'ターゲット別', items: ['20代向け', '30代向け', '40代向け', '主婦向け', '副業希望者向け'] },
    { category: '訴求ポイント', items: ['収入メリット', '時間の自由', '在宅ワーク', '成功事例'] },
    { category: '働き方', items: ['通勤', '在宅', 'アプリ配信', 'バーチャル'] },
    { category: '不安解消', items: ['身バレ対策', '顔出しなし', '未経験OK', 'サポート体制'] },
  ]
};

interface KnowledgeFile {
  key: string;
  file: string;
  label: string;
  importance: string;
}

interface FileStats {
  key: string;
  label: string;
  importance: string;
  exists: boolean;
  size: number;
  itemCount: number;
  lastUpdated: string | null;
  coverage: number; // 0-100
  sample: string[]; // サンプルデータ
}

interface CategoryStats {
  name: string;
  files: FileStats[];
  totalCoverage: number;
  missingHighPriority: string[];
}

async function analyzeKnowledgeFile(
  knowledgeDir: string,
  fileInfo: KnowledgeFile
): Promise<FileStats> {
  const filePath = path.join(knowledgeDir, fileInfo.file);

  try {
    const stat = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // アイテム数をカウント（構造によって異なる）
    let itemCount = 0;
    let sample: string[] = [];

    if (Array.isArray(data)) {
      itemCount = data.length;
      sample = data.slice(0, 3).map((item: unknown) =>
        typeof item === 'string' ? item : JSON.stringify(item).slice(0, 50)
      );
    } else if (typeof data === 'object') {
      itemCount = Object.keys(data).length;
      sample = Object.keys(data).slice(0, 3);
    }

    // カバレッジを計算（アイテム数ベース）
    const coverage = Math.min(100, itemCount * 10); // 10個で100%

    return {
      key: fileInfo.key,
      label: fileInfo.label,
      importance: fileInfo.importance,
      exists: true,
      size: stat.size,
      itemCount,
      lastUpdated: stat.mtime.toISOString(),
      coverage,
      sample,
    };
  } catch {
    return {
      key: fileInfo.key,
      label: fileInfo.label,
      importance: fileInfo.importance,
      exists: false,
      size: 0,
      itemCount: 0,
      lastUpdated: null,
      coverage: 0,
      sample: [],
    };
  }
}

async function getSuccessPatternsStats(dataDir: string) {
  const filePath = path.join(dataDir, 'success_patterns.json');

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const patterns = data.patterns || [];
    const byCategory: Record<string, number> = {};
    const byScore: Record<string, number> = { high: 0, medium: 0, low: 0 };

    for (const pattern of patterns) {
      byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1;

      if (pattern.score >= 8.5) byScore.high++;
      else if (pattern.score >= 7.5) byScore.medium++;
      else byScore.low++;
    }

    return {
      total: patterns.length,
      byCategory,
      byScore,
      recentPatterns: patterns.slice(-5).reverse(),
    };
  } catch {
    return {
      total: 0,
      byCategory: {},
      byScore: { high: 0, medium: 0, low: 0 },
      recentPatterns: [],
    };
  }
}

export async function GET() {
  const knowledgeDir = path.join(process.cwd(), 'knowledge');
  const dataDir = path.join(process.cwd(), 'data');

  const stats: Record<string, CategoryStats> = {};

  // 各アカウントタイプのナレッジを分析
  for (const [accountType, config] of Object.entries(KNOWLEDGE_CATEGORIES)) {
    const fileStats: FileStats[] = [];
    const missingHighPriority: string[] = [];

    for (const fileInfo of config.files) {
      const fileStat = await analyzeKnowledgeFile(knowledgeDir, fileInfo);
      fileStats.push(fileStat);

      if (!fileStat.exists && fileInfo.importance === 'high') {
        missingHighPriority.push(fileInfo.label);
      }
    }

    // 総合カバレッジを計算（重要度で重み付け）
    let weightedSum = 0;
    let weightTotal = 0;

    for (const fileStat of fileStats) {
      const weight = fileStat.importance === 'high' ? 3 : fileStat.importance === 'medium' ? 2 : 1;
      weightedSum += fileStat.coverage * weight;
      weightTotal += 100 * weight;
    }

    const totalCoverage = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : 0;

    stats[accountType] = {
      name: config.name,
      files: fileStats,
      totalCoverage,
      missingHighPriority,
    };
  }

  // 成功パターンの統計
  const successPatterns = await getSuccessPatternsStats(dataDir);

  // 必要なナレッジのチェックリスト
  const checklist = REQUIRED_KNOWLEDGE;

  // 推奨アクション
  const recommendations: string[] = [];

  for (const [accountType, categoryStats] of Object.entries(stats)) {
    if (categoryStats.missingHighPriority.length > 0) {
      recommendations.push(
        `[${categoryStats.name}] 重要なナレッジが不足: ${categoryStats.missingHighPriority.join(', ')}`
      );
    }

    if (categoryStats.totalCoverage < 50) {
      recommendations.push(
        `[${categoryStats.name}] カバレッジが低い (${categoryStats.totalCoverage}%) - ナレッジの追加を推奨`
      );
    }
  }

  if (successPatterns.total < 10) {
    recommendations.push(
      `成功パターンが少ない (${successPatterns.total}件) - 高スコア投稿を増やしてパターン学習を強化`
    );
  }

  return NextResponse.json({
    stats,
    successPatterns,
    checklist,
    recommendations,
    generatedAt: new Date().toISOString(),
  });
}

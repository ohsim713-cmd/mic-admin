'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from 'lucide-react';

interface FileStats {
  key: string;
  label: string;
  importance: string;
  exists: boolean;
  size: number;
  itemCount: number;
  lastUpdated: string | null;
  coverage: number;
  sample: string[];
}

interface CategoryStats {
  name: string;
  files: FileStats[];
  totalCoverage: number;
  missingHighPriority: string[];
}

interface SuccessPatterns {
  total: number;
  byCategory: Record<string, number>;
  byScore: { high: number; medium: number; low: number };
  recentPatterns: Array<{
    pattern: string;
    category: string;
    score: number;
  }>;
}

interface KnowledgeStats {
  stats: Record<string, CategoryStats>;
  successPatterns: SuccessPatterns;
  checklist: Record<string, Array<{ category: string; items: string[] }>>;
  recommendations: string[];
  generatedAt: string;
}

export default function KnowledgeDashboard() {
  const [data, setData] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['liver', 'chatre']));

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge/stats');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch knowledge stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'bg-green-500';
    if (coverage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case 'high':
        return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">重要</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">中</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">低</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-gray-600">ナレッジを分析中...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">データの取得に失敗しました</div>
      </div>
    );
  }

  const filteredStats = selectedAccount === 'all'
    ? data.stats
    : { [selectedAccount]: data.stats[selectedAccount] };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">ナレッジダッシュボード</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* 投稿分析へのリンク */}
            <Link
              href="/analytics/accounts"
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <BarChart3 className="w-4 h-4" />
              投稿分析
            </Link>

            {/* アカウントフィルター */}
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white text-gray-700"
            >
              <option value="all">すべて</option>
              <option value="liver">ライバー</option>
              <option value="chatre">チャトレ</option>
              <option value="shared">共通</option>
            </select>

            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              更新
            </button>
          </div>
        </div>

        {/* 推奨アクション */}
        {data.recommendations.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5" />
              推奨アクション
            </h3>
            <ul className="space-y-1">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="text-amber-700 text-sm">
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(data.stats).map(([key, stats]) => (
            <div key={key} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">{stats.name}</span>
                <span className={`text-2xl font-bold ${
                  stats.totalCoverage >= 80 ? 'text-green-600' :
                  stats.totalCoverage >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {stats.totalCoverage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getCoverageColor(stats.totalCoverage)}`}
                  style={{ width: `${stats.totalCoverage}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {stats.files.filter(f => f.exists).length} / {stats.files.length} ファイル
              </div>
            </div>
          ))}

          {/* 成功パターン */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-700">成功パターン</span>
              <span className="text-2xl font-bold text-blue-600">
                {data.successPatterns.total}
              </span>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="text-green-600">高: {data.successPatterns.byScore.high}</span>
              <span className="text-yellow-600">中: {data.successPatterns.byScore.medium}</span>
              <span className="text-gray-600">低: {data.successPatterns.byScore.low}</span>
            </div>
          </div>
        </div>

        {/* ナレッジ詳細 */}
        <div className="space-y-4">
          {Object.entries(filteredStats).map(([key, stats]) => (
            <div key={key} className="bg-white rounded-lg shadow">
              {/* カテゴリヘッダー */}
              <button
                onClick={() => toggleCategory(key)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {expandedCategories.has(key) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-semibold text-gray-800">{stats.name}</span>
                  <span className="text-sm text-gray-500">
                    ({stats.files.length} ファイル)
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {stats.missingHighPriority.length > 0 && (
                    <span className="text-red-600 text-sm flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {stats.missingHighPriority.length} 不足
                    </span>
                  )}
                  <span className={`font-bold ${
                    stats.totalCoverage >= 80 ? 'text-green-600' :
                    stats.totalCoverage >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {stats.totalCoverage}%
                  </span>
                </div>
              </button>

              {/* ファイル一覧 */}
              {expandedCategories.has(key) && (
                <div className="border-t">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          ステータス
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          ナレッジ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          重要度
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          アイテム数
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          カバレッジ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          サンプル
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {stats.files.map((file) => (
                        <tr key={file.key} className={!file.exists ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4">
                            {file.exists ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-700">{file.label}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getImportanceBadge(file.importance)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {file.itemCount}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${getCoverageColor(file.coverage)}`}
                                  style={{ width: `${file.coverage}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{file.coverage}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {file.sample.join(', ') || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 成功パターン詳細 */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              成功パターン分布
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* カテゴリ別 */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">カテゴリ別</h3>
                <div className="space-y-2">
                  {Object.entries(data.successPatterns.byCategory).map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-gray-700 capitalize">{cat}</span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 最近のパターン */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">最近追加されたパターン</h3>
                <div className="space-y-2">
                  {data.successPatterns.recentPatterns.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate max-w-[200px]">{p.pattern}</span>
                      <span className={`font-medium ${
                        p.score >= 8.5 ? 'text-green-600' :
                        p.score >= 7.5 ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {p.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="mt-6 text-center text-sm text-gray-500">
          最終更新: {new Date(data.generatedAt).toLocaleString('ja-JP')}
        </div>
      </div>
    </div>
  );
}

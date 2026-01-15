'use client';

import { useState, useEffect } from 'react';

interface CategoryCoverage {
  coverage: number;
  priority: string;
  foundFiles: string[];
  missingKeywords: string[];
  searchQueries: string[];
}

interface AccountCoverage {
  name: string;
  categories: Record<string, CategoryCoverage>;
  totalCoverage: number;
  gaps: Array<{
    category: string;
    priority: string;
    coverage: number;
    searchQueries: string[];
  }>;
}

interface CoverageData {
  coverage: Record<string, AccountCoverage>;
  prioritySearches: Array<{
    accountType: string;
    category: string;
    priority: string;
    queries: string[];
  }>;
  summary: {
    liver: number;
    chatlady: number;
    totalFiles: number;
  };
}

export default function KnowledgeCoverage() {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<'liver' | 'chatlady'>('liver');

  const loadCoverage = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge/coverage');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to load coverage:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCoverage();
  }, []);

  const handleEnrich = async (category?: string) => {
    setEnriching(true);
    try {
      const res = await fetch('/api/knowledge/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          category
            ? { category, accountType: selectedAccount }
            : { autoFill: true }
        ),
      });
      const result = await res.json();
      if (result.success) {
        // リロード
        await loadCoverage();
      }
    } catch (error) {
      console.error('Failed to enrich:', error);
    }
    setEnriching(false);
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'bg-green-500';
    if (coverage >= 60) return 'bg-yellow-500';
    if (coverage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">MED</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] bg-gray-500/20 text-gray-400 rounded">LOW</span>;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const accountData = data.coverage[selectedAccount];
  const categories = Object.entries(accountData?.categories || {});

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-medium text-white">知識カバレッジ</span>
        </div>
        <div className="flex items-center gap-2">
          {/* アカウント切替 */}
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setSelectedAccount('liver')}
              className={`px-2 py-1 text-xs rounded transition ${
                selectedAccount === 'liver'
                  ? 'bg-pink-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ライバー
            </button>
            <button
              onClick={() => setSelectedAccount('chatlady')}
              className={`px-2 py-1 text-xs rounded transition ${
                selectedAccount === 'chatlady'
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              チャトレ
            </button>
          </div>
          {/* 自動補充ボタン */}
          <button
            onClick={() => handleEnrich()}
            disabled={enriching}
            className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition disabled:opacity-50"
          >
            {enriching ? '補充中...' : '⚡ 自動補充'}
          </button>
        </div>
      </div>

      {/* 総合スコア */}
      <div className="p-3 border-b border-gray-800 bg-gray-800/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">総合カバレッジ</span>
          <span className="text-2xl font-bold text-white">
            {accountData?.totalCoverage || 0}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getCoverageColor(accountData?.totalCoverage || 0)}`}
            style={{ width: `${accountData?.totalCoverage || 0}%` }}
          />
        </div>
      </div>

      {/* カテゴリ別分布 */}
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {categories.map(([name, cat]) => (
          <div key={name} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">{name}</span>
                {getPriorityBadge(cat.priority)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{cat.coverage}%</span>
                {cat.coverage < 70 && (
                  <button
                    onClick={() => handleEnrich(name)}
                    disabled={enriching}
                    className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition"
                  >
                    補充
                  </button>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${getCoverageColor(cat.coverage)}`}
                style={{ width: `${cat.coverage}%` }}
              />
            </div>
            {/* 不足キーワード */}
            {cat.missingKeywords.length > 0 && cat.coverage < 70 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {cat.missingKeywords.slice(0, 3).map((kw, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-400 rounded"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 不足領域（優先度高） */}
      {accountData?.gaps && accountData.gaps.length > 0 && (
        <div className="p-3 border-t border-gray-800 bg-red-500/5">
          <div className="text-xs text-red-400 mb-2">⚠️ 優先的に補充が必要</div>
          <div className="space-y-1">
            {accountData.gaps.slice(0, 3).map((gap, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{gap.category}</span>
                <button
                  onClick={() => handleEnrich(gap.category)}
                  disabled={enriching}
                  className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
                >
                  検索して補充
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ファイル数 */}
      <div className="p-2 border-t border-gray-800 text-center">
        <span className="text-[10px] text-gray-500">
          {data.summary.totalFiles}個のナレッジファイル
        </span>
      </div>
    </div>
  );
}

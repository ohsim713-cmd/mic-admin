'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';

interface AccountStats {
  info: {
    name: string;
    type: string;
    twitter: string;
  };
  posts: {
    total: number;
    pending: number;
    approved: number;
    posted: number;
  };
  stock: {
    total: number;
    unused: number;
    used: number;
  };
  scoreAnalysis: {
    avg: number;
    min: number;
    max: number;
    distribution: {
      excellent: number;
      good: number;
      average: number;
      poor: number;
    };
    byMetric: Record<string, number>;
  };
  targetPerformance: Array<{ target: string; count: number; avgScore: number }>;
  benefitPerformance: Array<{ benefit: string; count: number; avgScore: number }>;
  weaknesses: Array<{ point: string; count: number }>;
  timeTrend: Array<{ date: string; count: number; avgScore: number }>;
  topPosts: Array<{
    id: string;
    text: string;
    score?: { total: number };
    target?: string;
  }>;
  recentPosts: Array<{
    id: string;
    text: string;
    createdAt: string;
    score?: { total: number };
  }>;
}

interface AnalyticsData {
  summary: {
    totalPosts: number;
    totalStock: number;
    totalPatterns: number;
    accountBreakdown: Array<{
      key: string;
      name: string;
      posts: number;
      stock: number;
    }>;
  };
  accounts: Record<string, AccountStats>;
  generatedAt: string;
}

export default function AccountAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedAccount]);

  async function fetchData() {
    setLoading(true);
    try {
      const param = selectedAccount !== 'all' ? `?account=${selectedAccount}` : '';
      const res = await fetch(`/api/analytics/account${param}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 12) return 'text-green-600';
    if (score >= 10) return 'text-blue-600';
    if (score >= 8) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getDistributionBar(value: number, total: number, color: string): ReactNode {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm w-12 text-right">{value}件</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center text-red-600">データの読み込みに失敗しました</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">アカウント別分析</h1>
            <p className="text-gray-600 mt-1">投稿パフォーマンス・スコア分布・トレンド</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/knowledge-dashboard"
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              ナレッジ →
            </Link>
            <Link
              href="/analytics"
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              旧分析 →
            </Link>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="all">全アカウント</option>
              <option value="liver">ライバー事務所</option>
              <option value="chatre1">チャトレ事務所①</option>
              <option value="chatre2">チャトレ事務所②</option>
            </select>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <p className="text-sm text-gray-500">総投稿数</p>
            <p className="text-3xl font-bold text-gray-900">{data.summary.totalPosts}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <p className="text-sm text-gray-500">ストック</p>
            <p className="text-3xl font-bold text-blue-600">{data.summary.totalStock}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <p className="text-sm text-gray-500">成功パターン</p>
            <p className="text-3xl font-bold text-green-600">{data.summary.totalPatterns}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <p className="text-sm text-gray-500">更新日時</p>
            <p className="text-lg font-medium text-gray-700">
              {new Date(data.generatedAt).toLocaleString('ja-JP')}
            </p>
          </div>
        </div>

        {/* アカウント別詳細 */}
        {Object.entries(data.accounts).map(([key, account]) => (
          <div key={key} className="mb-8">
            <div className="bg-white rounded-xl shadow overflow-hidden">
              {/* アカウントヘッダー */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{account.info.name}</h2>
                    <p className="text-blue-100">{account.info.twitter}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-100">平均スコア</p>
                    <p className="text-4xl font-bold">{account.scoreAnalysis.avg}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* 投稿・ストック状況 */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{account.posts.total}</p>
                    <p className="text-sm text-gray-500">総投稿</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{account.posts.pending}</p>
                    <p className="text-sm text-gray-500">承認待ち</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{account.posts.approved}</p>
                    <p className="text-sm text-gray-500">承認済み</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{account.posts.posted}</p>
                    <p className="text-sm text-gray-500">投稿済み</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{account.stock.unused}</p>
                    <p className="text-sm text-gray-500">未使用ストック</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">{account.stock.used}</p>
                    <p className="text-sm text-gray-500">使用済み</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* スコア分布 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">スコア分布</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-green-600 font-medium">優秀（12点以上）</span>
                        </div>
                        {getDistributionBar(
                          account.scoreAnalysis.distribution.excellent,
                          account.posts.total,
                          'bg-green-500'
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-blue-600 font-medium">良好（10-11点）</span>
                        </div>
                        {getDistributionBar(
                          account.scoreAnalysis.distribution.good,
                          account.posts.total,
                          'bg-blue-500'
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-yellow-600 font-medium">普通（8-9点）</span>
                        </div>
                        {getDistributionBar(
                          account.scoreAnalysis.distribution.average,
                          account.posts.total,
                          'bg-yellow-500'
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-red-600 font-medium">要改善（8点未満）</span>
                        </div>
                        {getDistributionBar(
                          account.scoreAnalysis.distribution.poor,
                          account.posts.total,
                          'bg-red-500'
                        )}
                      </div>
                    </div>

                    {/* 評価軸別スコア */}
                    {Object.keys(account.scoreAnalysis.byMetric).length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">評価軸別平均</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(account.scoreAnalysis.byMetric).map(([metric, value]) => (
                            <div key={metric} className="text-center p-2 bg-gray-50 rounded">
                              <p className="text-lg font-bold text-gray-900">{value}</p>
                              <p className="text-xs text-gray-500">{getMetricLabel(metric)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 弱点分析 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">改善ポイント</h3>
                    {account.weaknesses.length > 0 ? (
                      <div className="space-y-2">
                        {account.weaknesses.slice(0, 5).map((weakness, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                          >
                            <span className="text-red-800">{weakness.point}</span>
                            <span className="text-sm text-red-600 font-medium">
                              {weakness.count}件で低スコア
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">改善ポイントなし</p>
                    )}

                    {/* ターゲット別パフォーマンス */}
                    {account.targetPerformance.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">ターゲット別</h4>
                        <div className="space-y-2">
                          {account.targetPerformance.slice(0, 4).map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded"
                            >
                              <span className="text-gray-700">{item.target}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500">{item.count}件</span>
                                <span className={`font-bold ${getScoreColor(item.avgScore)}`}>
                                  {item.avgScore}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 時系列トレンド */}
                {account.timeTrend.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">直近14日間のトレンド</h3>
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 min-w-max">
                        {account.timeTrend.map((day, i) => (
                          <div
                            key={i}
                            className="text-center p-3 bg-gray-50 rounded-lg min-w-[80px]"
                          >
                            <p className="text-xs text-gray-500">
                              {new Date(day.date).toLocaleDateString('ja-JP', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                            <p className="text-lg font-bold text-gray-900">{day.count}</p>
                            <p className={`text-sm font-medium ${getScoreColor(day.avgScore)}`}>
                              {day.avgScore > 0 ? day.avgScore : '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* トップ投稿 */}
                {account.topPosts.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">高スコア投稿 TOP5</h3>
                    <div className="space-y-3">
                      {account.topPosts.map((post, i) => (
                        <div
                          key={post.id}
                          className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg font-bold text-yellow-600">#{i + 1}</span>
                                {post.target && (
                                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                                    {post.target}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-700 text-sm whitespace-pre-wrap line-clamp-3">
                                {post.text}
                              </p>
                            </div>
                            <div className="ml-4 text-right">
                              <p className="text-2xl font-bold text-green-600">
                                {post.score?.total || 0}
                              </p>
                              <p className="text-xs text-gray-500">スコア</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    empathy: '共感',
    benefit: 'メリット',
    cta: 'CTA',
    credibility: '信頼性',
    urgency: '緊急性',
    originality: '独自性',
    engagement: 'エンゲージ',
    scrollStop: '停止力',
  };
  return labels[metric] || metric;
}

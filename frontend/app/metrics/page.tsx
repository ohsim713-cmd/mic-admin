'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Heart,
  Repeat2,
  MessageCircle,
  Eye,
  RefreshCw,
  TrendingUp,
  Target,
  Award,
  Clock,
} from 'lucide-react';

interface PostWithMetrics {
  postedAt: string;
  success: boolean;
  tweetId?: string;
  slot: number;
  type: string;
  postText?: string;
  qualityScore?: number;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    lastUpdated: string;
  };
}

interface Summary {
  totalPosts: number;
  postsWithMetrics: number;
  totals: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
  averages: {
    likes: string;
    retweets: string;
    replies: string;
    impressions: string;
  };
  engagementRate: string;
}

interface TypeStats {
  type: string;
  count: number;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  avgLikes: string;
  avgRetweets: string;
  engagementRate: string;
}

export default function MetricsPage() {
  const [posts, setPosts] = useState<PostWithMetrics[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byType, setByType] = useState<TypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'types'>('overview');

  const fetchData = async () => {
    try {
      const [listRes, summaryRes, typeRes] = await Promise.all([
        fetch('/api/metrics?view=list'),
        fetch('/api/metrics?view=summary'),
        fetch('/api/metrics?view=by-type'),
      ]);

      const listData = await listRes.json();
      const summaryData = await summaryRes.json();
      const typeData = await typeRes.json();

      setPosts(listData.posts || []);
      setLastRefreshed(listData.lastRefreshed);
      setSummary(summaryData);
      setByType(typeData.byType || []);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/metrics', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastRefreshed(data.lastRefreshed);
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/auto-post" style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '16px' }}>
            <ArrowLeft size={16} /> 自動投稿に戻る
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 color="#3b82f6" /> 投稿効果測定
              </h1>
              <p style={{ color: '#888', marginTop: '4px' }}>
                投稿のエンゲージメントを分析
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                color: '#3b82f6',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                opacity: refreshing ? 0.5 : 1,
              }}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? '更新中...' : 'メトリクス更新'}
            </button>
          </div>
          {lastRefreshed && (
            <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
              最終更新: {new Date(lastRefreshed).toLocaleString('ja-JP')}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {(['overview', 'posts', 'types'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === tab ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab ? '#3b82f6' : '#888',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
              }}
            >
              {tab === 'overview' && 'サマリー'}
              {tab === 'posts' && '投稿一覧'}
              {tab === 'types' && 'タイプ別'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && summary && (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Heart size={20} color="#ef4444" />
                  <span style={{ color: '#888' }}>いいね合計</span>
                </div>
                <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>
                  {summary.totals.likes.toLocaleString()}
                </div>
                <div style={{ color: '#888', fontSize: '14px' }}>
                  平均 {summary.averages.likes}/投稿
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Repeat2 size={20} color="#22c55e" />
                  <span style={{ color: '#888' }}>RT合計</span>
                </div>
                <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>
                  {summary.totals.retweets.toLocaleString()}
                </div>
                <div style={{ color: '#888', fontSize: '14px' }}>
                  平均 {summary.averages.retweets}/投稿
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <MessageCircle size={20} color="#3b82f6" />
                  <span style={{ color: '#888' }}>返信合計</span>
                </div>
                <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>
                  {summary.totals.replies.toLocaleString()}
                </div>
                <div style={{ color: '#888', fontSize: '14px' }}>
                  平均 {summary.averages.replies}/投稿
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Eye size={20} color="#f59e0b" />
                  <span style={{ color: '#888' }}>インプレッション</span>
                </div>
                <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>
                  {summary.totals.impressions.toLocaleString()}
                </div>
                <div style={{ color: '#888', fontSize: '14px' }}>
                  平均 {summary.averages.impressions}/投稿
                </div>
              </div>
            </div>

            {/* Engagement Rate */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              borderRadius: '16px',
              padding: '32px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              textAlign: 'center',
              marginBottom: '32px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
                <TrendingUp size={28} color="#3b82f6" />
                <span style={{ color: '#888', fontSize: '18px' }}>エンゲージメント率</span>
              </div>
              <div style={{ color: '#3b82f6', fontSize: '48px', fontWeight: 'bold' }}>
                {summary.engagementRate}
              </div>
              <p style={{ color: '#888', marginTop: '8px' }}>
                (いいね + RT + 返信) / インプレッション
              </p>
            </div>

            {/* Stats */}
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <h3 style={{ color: 'white', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={20} color="#f59e0b" /> 投稿統計
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ color: '#888' }}>総投稿数</span>
                  <div style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>{summary.totalPosts}</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ color: '#888' }}>メトリクス取得済み</span>
                  <div style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>{summary.postsWithMetrics}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <h3 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} /> 最近の投稿パフォーマンス
            </h3>
            {posts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {posts.map((post, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#888', fontSize: '13px' }}>
                          {new Date(post.postedAt).toLocaleString('ja-JP')}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(139, 92, 246, 0.2)',
                          color: '#a78bfa',
                          fontSize: '11px'
                        }}>
                          {post.type}
                        </span>
                        {post.qualityScore && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: post.qualityScore >= 7 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: post.qualityScore >= 7 ? '#22c55e' : '#f59e0b',
                            fontSize: '11px'
                          }}>
                            品質: {post.qualityScore}/10
                          </span>
                        )}
                      </div>
                      {post.tweetId && (
                        <a
                          href={`https://twitter.com/i/web/status/${post.tweetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#3b82f6', fontSize: '12px' }}
                        >
                          投稿を見る
                        </a>
                      )}
                    </div>

                    {post.postText && (
                      <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '12px' }}>{post.postText}</div>
                    )}

                    {/* Metrics */}
                    {post.metrics ? (
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Heart size={14} color="#ef4444" />
                          <span style={{ color: '#ef4444' }}>{post.metrics.likes}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Repeat2 size={14} color="#22c55e" />
                          <span style={{ color: '#22c55e' }}>{post.metrics.retweets}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MessageCircle size={14} color="#3b82f6" />
                          <span style={{ color: '#3b82f6' }}>{post.metrics.replies}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Eye size={14} color="#f59e0b" />
                          <span style={{ color: '#f59e0b' }}>{post.metrics.impressions.toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        メトリクス未取得 - 「メトリクス更新」をクリックして取得
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
                投稿データがありません
              </div>
            )}
          </div>
        )}

        {/* Types Tab */}
        {activeTab === 'types' && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <h3 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} /> 投稿タイプ別パフォーマンス
            </h3>
            {byType.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#888' }}>タイプ</th>
                      <th style={{ padding: '12px', textAlign: 'right', color: '#888' }}>投稿数</th>
                      <th style={{ padding: '12px', textAlign: 'right', color: '#888' }}>いいね</th>
                      <th style={{ padding: '12px', textAlign: 'right', color: '#888' }}>RT</th>
                      <th style={{ padding: '12px', textAlign: 'right', color: '#888' }}>返信</th>
                      <th style={{ padding: '12px', textAlign: 'right', color: '#888' }}>平均いいね</th>
                      <th style={{ padding: '12px', textAlign: 'right', color: '#888' }}>ER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byType.sort((a, b) => b.likes - a.likes).map((stat) => (
                      <tr key={stat.type} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: 'white' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            background: 'rgba(139, 92, 246, 0.2)',
                            color: '#a78bfa',
                            fontSize: '13px'
                          }}>
                            {stat.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#888' }}>{stat.count}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>{stat.likes}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#22c55e' }}>{stat.retweets}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#3b82f6' }}>{stat.replies}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: 'white', fontWeight: 'bold' }}>{stat.avgLikes}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#f59e0b' }}>{stat.engagementRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
                タイプ別データがありません
              </div>
            )}
          </div>
        )}

        {/* Goal Reminder */}
        <div style={{
          marginTop: '32px',
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(234, 88, 12, 0.1) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Target size={24} color="#f59e0b" />
            <h3 style={{ color: '#f59e0b', margin: 0 }}>目標: 1日3件の問い合わせ</h3>
          </div>
          <p style={{ color: '#888', margin: 0 }}>
            エンゲージメント率の高い投稿タイプを分析して、DM問い合わせにつなげましょう
          </p>
        </div>
      </div>
    </div>
  );
}

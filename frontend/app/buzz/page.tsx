'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Video,
  TrendingUp,
  RefreshCw,
  Play,
  FileText,
  Clock,
  Zap,
  Eye,
  Heart,
  CheckCircle,
  AlertCircle,
  Globe,
  PenTool,
  ExternalLink,
} from 'lucide-react';

interface BuzzPost {
  id: string;
  text: string;
  account: string;
  platform: string;
  impressions: number;
  engagementRate: number;
  buzzScore: number;
  status: 'detected' | 'scripted' | 'video_created' | 'published';
  detectedAt: string;
}

interface VideoScript {
  id: string;
  buzzPostId: string;
  script: string;
  duration: number;
  status: 'draft' | 'approved' | 'video_created';
  createdAt: string;
}

interface Stats {
  buzz: {
    totalDetected: number;
    totalVideoized: number;
    pendingScript: number;
    pendingVideo: number;
    avgBuzzScore: number;
  };
  video: {
    totalScripts: number;
    pendingApproval: number;
    videoCreated: number;
    imagesGenerated: number;
  };
  heygen: {
    remaining: number;
    used: number;
    limit: number;
    canGenerate: boolean;
  };
}

interface WordPressSchedule {
  id: string;
  enabled: boolean;
  intervalHours: number;
  keywords: string;
  businessType: string;
  publishStatus: string;
  lastRun?: string;
  nextRun?: string;
  lastPostTitle?: string;
}

interface WordPressPost {
  id: string;
  postId: number;
  title: string;
  link: string;
  businessType: string;
  createdAt: string;
}

export default function BuzzDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [buzzQueue, setBuzzQueue] = useState<BuzzPost[]>([]);
  const [scripts, setScripts] = useState<VideoScript[]>([]);
  const [wpSchedules, setWpSchedules] = useState<WordPressSchedule[]>([]);
  const [wpPosts, setWpPosts] = useState<WordPressPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, queueRes, scriptsRes, wpSchedulesRes, wpPostsRes] = await Promise.all([
        fetch('/api/agent/video?action=stats'),
        fetch('/api/agent/video?action=queue'),
        fetch('/api/agent/video?action=scripts'),
        fetch('/api/wordpress/scheduler'),
        fetch('/api/wordpress/posts-log').catch(() => ({ json: () => ({ posts: [] }) })),
      ]);

      const statsData = await statsRes.json();
      const queueData = await queueRes.json();
      const scriptsData = await scriptsRes.json();
      const wpSchedulesData = await wpSchedulesRes.json();
      const wpPostsData = await wpPostsRes.json();

      if (statsData.success) {
        setStats({
          buzz: statsData.buzz,
          video: statsData.video,
          heygen: statsData.heygen,
        });
      }

      if (queueData.success) {
        setBuzzQueue(queueData.queue || []);
      }

      if (scriptsData.success) {
        setScripts(scriptsData.scripts || []);
      }

      setWpSchedules(wpSchedulesData.schedules || []);
      setWpPosts(wpPostsData.posts || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runBuzzCheck = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/cron/buzz-check');
      const result = await res.json();
      console.log('Buzz check result:', result);
      await fetchAll();
    } catch (error) {
      console.error('Buzz check failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const generateScript = async (buzzPostId?: string) => {
    setActionLoading('script');
    try {
      const res = await fetch('/api/agent/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'script',
          buzzPostId,
          duration: 30,
        }),
      });
      const result = await res.json();
      if (result.success) {
        await fetchAll();
      } else {
        alert(result.error || '台本生成に失敗しました');
      }
    } catch (error) {
      console.error('Script generation failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const generateVideo = async (scriptId: string) => {
    setActionLoading(scriptId);
    try {
      const res = await fetch('/api/agent/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          scriptId,
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`動画生成開始！ Video ID: ${result.videoId}`);
        await fetchAll();
      } else {
        alert(result.error || '動画生成に失敗しました');
      }
    } catch (error) {
      console.error('Video generation failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'detected':
        return '#f59e0b';
      case 'scripted':
        return '#3b82f6';
      case 'video_created':
        return '#10b981';
      case 'published':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'detected':
        return '検出済';
      case 'scripted':
        return '台本作成';
      case 'video_created':
        return '動画完成';
      case 'published':
        return '公開済';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw className="spin" size={32} />
        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '1.5rem', maxWidth: '1400px' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flame size={28} color="#f97316" />
            バズ検知ダッシュボード
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            バズ投稿を検出して動画化するパイプライン
          </p>
        </div>
        <button
          onClick={runBuzzCheck}
          disabled={refreshing}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
          }}
        >
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          バズチェック実行
        </button>
      </div>

      {/* 統計カード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard
          icon={Flame}
          label="検出済バズ"
          value={stats?.buzz.totalDetected || 0}
          color="#f97316"
        />
        <StatCard
          icon={FileText}
          label="台本待ち"
          value={stats?.buzz.pendingScript || 0}
          color="#f59e0b"
        />
        <StatCard
          icon={Video}
          label="動画化済"
          value={stats?.buzz.totalVideoized || 0}
          color="#10b981"
        />
        <StatCard
          icon={Zap}
          label="平均スコア"
          value={stats?.buzz.avgBuzzScore || 0}
          suffix="点"
          color="#8b5cf6"
        />
        <StatCard
          icon={Play}
          label="HeyGen残り"
          value={stats?.heygen.remaining || 0}
          suffix={`/${stats?.heygen.limit || 10}`}
          color={stats?.heygen.canGenerate ? '#3b82f6' : '#ef4444'}
        />
      </div>

      {/* メインコンテンツ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* バズ投稿キュー */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={20} />
              バズ投稿キュー
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {buzzQueue.length}件
            </span>
          </div>

          {buzzQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 0.5rem' }} />
              <p>バズ投稿がまだありません</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                「バズチェック実行」でXの投稿を分析します
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
              {buzzQueue
                .sort((a, b) => b.buzzScore - a.buzzScore)
                .slice(0, 10)
                .map((post) => (
                  <div
                    key={post.id}
                    style={{
                      padding: '1rem',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '8px',
                      borderLeft: `3px solid ${getStatusColor(post.status)}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          padding: '0.125rem 0.5rem',
                          background: getStatusColor(post.status) + '20',
                          color: getStatusColor(post.status),
                          borderRadius: '9999px',
                        }}
                      >
                        {getStatusLabel(post.status)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {post.account}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                      {post.text.slice(0, 80)}...
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Eye size={12} />
                        {formatNumber(post.impressions)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Heart size={12} />
                        {post.engagementRate.toFixed(1)}%
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Zap size={12} />
                        {post.buzzScore}点
                      </span>
                    </div>
                    {post.status === 'detected' && (
                      <button
                        onClick={() => generateScript(post.id)}
                        disabled={actionLoading === 'script'}
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.5rem 1rem',
                          fontSize: '0.75rem',
                          background: '#3b82f6',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <FileText size={14} />
                        台本生成
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}

          {buzzQueue.filter(p => p.status === 'detected').length > 0 && (
            <button
              onClick={() => generateScript()}
              disabled={actionLoading === 'script'}
              className="btn-primary"
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {actionLoading === 'script' ? (
                <RefreshCw size={16} className="spin" />
              ) : (
                <FileText size={16} />
              )}
              トップスコアの台本を生成
            </button>
          )}
        </div>

        {/* 台本リスト */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Video size={20} />
              台本 & 動画
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {scripts.length}件
            </span>
          </div>

          {scripts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <Video size={32} style={{ margin: '0 auto 0.5rem' }} />
              <p>台本がまだありません</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                バズ投稿から台本を生成してください
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
              {scripts
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
                .map((script) => (
                  <div
                    key={script.id}
                    style={{
                      padding: '1rem',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '8px',
                      borderLeft: `3px solid ${
                        script.status === 'video_created' ? '#10b981' :
                        script.status === 'approved' ? '#3b82f6' : '#f59e0b'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                        {script.id.slice(0, 20)}...
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <Clock size={12} />
                        {script.duration}秒
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                      {script.script.slice(0, 100)}...
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.625rem', color: '#64748b' }}>
                        {new Date(script.createdAt).toLocaleString('ja-JP')}
                      </span>
                      {script.status === 'draft' && stats?.heygen.canGenerate && (
                        <button
                          onClick={() => generateVideo(script.id)}
                          disabled={actionLoading === script.id}
                          style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.75rem',
                            background: '#10b981',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {actionLoading === script.id ? (
                            <RefreshCw size={14} className="spin" />
                          ) : (
                            <Play size={14} />
                          )}
                          HeyGen動画化
                        </button>
                      )}
                      {script.status === 'video_created' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#10b981' }}>
                          <CheckCircle size={14} />
                          動画完成
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* HeyGen使用状況 */}
      {stats?.heygen && (
        <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Play size={18} />
            HeyGen月間使用状況
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(stats.heygen.used / stats.heygen.limit) * 100}%`,
                  height: '100%',
                  background: stats.heygen.canGenerate ? '#3b82f6' : '#ef4444',
                  borderRadius: '4px',
                }}
              />
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {stats.heygen.used} / {stats.heygen.limit}本
            </span>
          </div>
          {!stats.heygen.canGenerate && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>
              今月の無料枠を使い切りました。来月までお待ちください。
            </p>
          )}
        </div>
      )}

      {/* WordPress自動投稿 */}
      <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={18} color="#22c55e" />
            WordPress自動投稿
          </h3>
          <a
            href="/wordpress/scheduler"
            style={{
              fontSize: '0.75rem',
              color: '#3b82f6',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            設定 <ExternalLink size={12} />
          </a>
        </div>

        {wpSchedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
            <PenTool size={28} style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.875rem' }}>スケジュールが未設定です</p>
            <a
              href="/wordpress/scheduler"
              style={{
                display: 'inline-block',
                marginTop: '0.75rem',
                padding: '0.5rem 1rem',
                background: '#22c55e',
                color: 'white',
                borderRadius: '6px',
                fontSize: '0.75rem',
                textDecoration: 'none',
              }}
            >
              スケジュールを作成
            </a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* スケジュール一覧 */}
            <div>
              <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                有効なスケジュール
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {wpSchedules.filter(s => s.enabled).map((schedule) => (
                  <div
                    key={schedule.id}
                    style={{
                      padding: '0.75rem',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '6px',
                      borderLeft: '3px solid #22c55e',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                        {schedule.businessType === 'liver-agency' ? 'ライバー' : 'チャトレ'}
                      </span>
                      <span style={{ fontSize: '0.625rem', color: '#94a3b8' }}>
                        {schedule.intervalHours}時間ごと
                      </span>
                    </div>
                    {schedule.nextRun && (
                      <div style={{ fontSize: '0.625rem', color: '#64748b' }}>
                        次回: {new Date(schedule.nextRun).toLocaleString('ja-JP')}
                      </div>
                    )}
                    {schedule.lastPostTitle && (
                      <div style={{ fontSize: '0.625rem', color: '#22c55e', marginTop: '0.25rem' }}>
                        最新: {schedule.lastPostTitle.slice(0, 30)}...
                      </div>
                    )}
                  </div>
                ))}
                {wpSchedules.filter(s => s.enabled).length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    有効なスケジュールがありません
                  </p>
                )}
              </div>
            </div>

            {/* 最近の投稿 */}
            <div>
              <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                最近の投稿
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {wpPosts.slice(0, 5).map((post) => (
                  <a
                    key={post.id}
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '0.75rem',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                      {post.title.slice(0, 40)}...
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#64748b' }}>
                      <span>{post.businessType === 'liver-agency' ? 'ライバー' : 'チャトレ'}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </a>
                ))}
                {wpPosts.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    まだ投稿がありません
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .glass {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }
      `}</style>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix = '',
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  suffix?: string;
  color: string;
}) {
  return (
    <div
      className="glass"
      style={{
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={24} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {value}
          {suffix && <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#94a3b8' }}>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

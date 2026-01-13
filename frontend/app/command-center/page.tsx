'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Target,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Users,
  Zap,
  Activity,
  Brain,
  Send,
  ChevronRight,
  Plus,
  Bell,
  BarChart3,
} from 'lucide-react';

// CSSアニメーション
const animationStyles = `
@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.6); }
}

@keyframes progress-wave {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes number-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
.glow { animation: glow 2s ease-in-out infinite; }
.slide-up { animation: slide-up 0.5s ease-out; }
.number-pop { animation: number-pop 0.3s ease-out; }

.progress-wave {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  background-size: 200% 100%;
  animation: progress-wave 2s linear infinite;
}
`;

const ACCOUNT_COLORS: Record<string, string> = {
  liver: '#f59e0b',
  chatre1: '#ec4899',
  chatre2: '#8b5cf6',
};

const ACCOUNT_LABELS: Record<string, string> = {
  liver: 'ライバー',
  chatre1: 'チャトレ①',
  chatre2: 'チャトレ②',
};

interface DMStats {
  total: number;
  goal: number;
  progress: number;
  byAccount: Record<string, number>;
  byStatus: Record<string, number>;
  goalAchieved: boolean;
  remaining: number;
  alert?: {
    shouldAlert: boolean;
    type: 'achieved' | 'behind' | 'critical' | null;
    message: string;
  };
}

interface PostStats {
  todayPosts: number;
  todaySuccess: number;
  totalPosts: number;
}

interface LearningStats {
  total: number;
  avgScore: number;
  byAccount: Record<string, number>;
}

interface HistoricalStats {
  dailyStats: Array<{
    date: string;
    totalDMs: number;
    goalAchieved: boolean;
  }>;
  totalDMs: number;
  avgDMsPerDay: number;
  goalAchievementRate: number;
  trend: 'up' | 'down' | 'stable';
}

interface AccountStatus {
  account: string;
  name: string;
  handle: string;
  connected: boolean;
}

export default function CommandCenterPage() {
  const [dmStats, setDmStats] = useState<DMStats | null>(null);
  const [postStats, setPostStats] = useState<PostStats | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [historicalStats, setHistoricalStats] = useState<HistoricalStats | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [recordingDM, setRecordingDM] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showDMModal, setShowDMModal] = useState(false);

  // 自動更新間隔（30秒）
  const AUTO_REFRESH_INTERVAL = 30000;

  const fetchAllData = useCallback(async () => {
    try {
      const [dmRes, postsRes, learningRes, historyRes, statusRes] = await Promise.all([
        fetch('/api/dm-hunter/dm-tracking?view=today'),
        fetch('/api/dm-hunter/logs?today=true'),
        fetch('/api/dm-hunter/learning-stats').catch(() => null),
        fetch('/api/dm-hunter/dm-tracking?view=history&days=7'),
        fetch('/api/dm-hunter/auto-run'),
      ]);

      if (dmRes.ok) {
        setDmStats(await dmRes.json());
      }

      if (postsRes.ok) {
        const data = await postsRes.json();
        setPostStats(data.stats);
      }

      if (learningRes?.ok) {
        setLearningStats(await learningRes.json());
      }

      if (historyRes.ok) {
        setHistoricalStats(await historyRes.json());
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        setAccountStatus(data.accounts || []);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回読み込みと自動更新
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // DM記録
  const recordDM = async (account: string) => {
    setRecordingDM(true);
    try {
      await fetch('/api/dm-hunter/dm-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      });
      await fetchAllData();
      setShowDMModal(false);
    } catch (error) {
      console.error('Record DM error:', error);
    } finally {
      setRecordingDM(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <style>{animationStyles}</style>
        <RefreshCw className="animate-spin" size={32} color="#f59e0b" />
        <p style={{ marginTop: '16px', color: '#888' }}>コマンドセンター起動中...</p>
      </div>
    );
  }

  const dmProgress = dmStats ? (dmStats.total / dmStats.goal) * 100 : 0;
  const postProgress = postStats ? (postStats.todayPosts / 18) * 100 : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <style>{animationStyles}</style>

      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={32} color="#f59e0b" className="pulse-dot" />
            コマンドセンター
          </h1>
          <p style={{ color: '#888', marginTop: '4px' }}>
            リアルタイム監視 • 自動更新 30秒
            {lastUpdate && (
              <span style={{ marginLeft: '12px' }}>
                最終更新: {lastUpdate.toLocaleTimeString('ja-JP')}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowDMModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            <Plus size={18} />
            DM記録
          </button>
          <button
            onClick={fetchAllData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              background: 'transparent',
              border: '1px solid #333',
              borderRadius: '10px',
              color: '#888',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* アラート */}
      {dmStats?.alert?.shouldAlert && (
        <div
          className="slide-up"
          style={{
            padding: '16px 20px',
            marginBottom: '24px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background:
              dmStats.alert.type === 'achieved' ? 'rgba(34, 197, 94, 0.15)' :
              dmStats.alert.type === 'critical' ? 'rgba(239, 68, 68, 0.15)' :
              'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${
              dmStats.alert.type === 'achieved' ? 'rgba(34, 197, 94, 0.3)' :
              dmStats.alert.type === 'critical' ? 'rgba(239, 68, 68, 0.3)' :
              'rgba(245, 158, 11, 0.3)'
            }`,
          }}
        >
          {dmStats.alert.type === 'achieved' ? (
            <CheckCircle size={24} color="#22c55e" />
          ) : dmStats.alert.type === 'critical' ? (
            <AlertCircle size={24} color="#ef4444" />
          ) : (
            <AlertTriangle size={24} color="#f59e0b" />
          )}
          <span style={{
            fontWeight: 'bold',
            color:
              dmStats.alert.type === 'achieved' ? '#22c55e' :
              dmStats.alert.type === 'critical' ? '#ef4444' :
              '#f59e0b',
          }}>
            {dmStats.alert.message}
          </span>
        </div>
      )}

      {/* メインKPI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        {/* DM目標 */}
        <div
          className={dmStats?.goalAchieved ? 'glow' : ''}
          style={{
            padding: '24px',
            borderRadius: '16px',
            background: dmStats?.goalAchieved
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
            border: dmStats?.goalAchieved
              ? '1px solid rgba(34, 197, 94, 0.4)'
              : '1px solid rgba(245, 158, 11, 0.3)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: dmStats?.goalAchieved
              ? '#22c55e'
              : `linear-gradient(90deg, transparent, #f59e0b, transparent)`,
            backgroundSize: '200% 100%',
          }} className={dmStats?.goalAchieved ? '' : 'progress-wave'} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Target size={24} color={dmStats?.goalAchieved ? '#22c55e' : '#f59e0b'} />
            <span style={{ color: '#888', fontSize: '14px' }}>今日のDM問い合わせ</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: dmStats?.goalAchieved ? '#22c55e' : '#f59e0b',
            }}>
              {dmStats?.total || 0}
            </span>
            <span style={{ color: '#888', fontSize: '20px' }}>/ {dmStats?.goal || 3}</span>
          </div>

          <div style={{
            height: '8px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '12px',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(dmProgress, 100)}%`,
              background: dmStats?.goalAchieved
                ? '#22c55e'
                : 'linear-gradient(90deg, #f59e0b, #ea580c)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['liver', 'chatre1', 'chatre2'].map(acc => (
              <div
                key={acc}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '11px', color: ACCOUNT_COLORS[acc], marginBottom: '4px' }}>
                  {ACCOUNT_LABELS[acc]}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                  {dmStats?.byAccount?.[acc] || 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 投稿状況 */}
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, transparent, #3b82f6, transparent)`,
            backgroundSize: '200% 100%',
          }} className="progress-wave" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Send size={24} color="#3b82f6" />
            <span style={{ color: '#888', fontSize: '14px' }}>今日の投稿</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '48px', fontWeight: 'bold', color: '#3b82f6' }}>
              {postStats?.todayPosts || 0}
            </span>
            <span style={{ color: '#888', fontSize: '20px' }}>/ 18</span>
          </div>

          <div style={{
            height: '8px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '12px',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(postProgress, 100)}%`,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '13px' }}>
            <span>成功: {postStats?.todaySuccess || 0}</span>
            <span>累計: {postStats?.totalPosts || 0}</span>
          </div>
        </div>

        {/* AI学習 */}
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Brain size={24} color="#8b5cf6" className="pulse-dot" />
            <span style={{ color: '#888', fontSize: '14px' }}>AI自動学習</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '48px', fontWeight: 'bold', color: '#8b5cf6' }}>
              {learningStats?.total || 0}
            </span>
            <span style={{ color: '#888', fontSize: '16px' }}>パターン</span>
          </div>

          <div style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
            平均スコア: {learningStats?.avgScore?.toFixed(1) || '-'}点
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['liver', 'chatre1', 'chatre2'].map(acc => (
              <div
                key={acc}
                style={{
                  flex: 1,
                  padding: '6px',
                  background: ACCOUNT_COLORS[acc] + '33',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: ACCOUNT_COLORS[acc],
                }}
              >
                {learningStats?.byAccount?.[acc] || 0}件
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 週間トレンド */}
      <div style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid #222',
        marginBottom: '32px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={20} color="#f59e0b" />
            <span style={{ fontWeight: 'bold' }}>週間トレンド</span>
          </div>

          {historicalStats && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: historicalStats.trend === 'up'
                ? 'rgba(34, 197, 94, 0.2)'
                : historicalStats.trend === 'down'
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(156, 163, 175, 0.2)',
            }}>
              {historicalStats.trend === 'up' ? (
                <TrendingUp size={16} color="#22c55e" />
              ) : historicalStats.trend === 'down' ? (
                <TrendingDown size={16} color="#ef4444" />
              ) : (
                <Activity size={16} color="#9ca3af" />
              )}
              <span style={{
                fontSize: '13px',
                color: historicalStats.trend === 'up'
                  ? '#22c55e'
                  : historicalStats.trend === 'down'
                  ? '#ef4444'
                  : '#9ca3af',
              }}>
                {historicalStats.trend === 'up' ? '上昇傾向'
                  : historicalStats.trend === 'down' ? '下降傾向'
                  : '横ばい'}
              </span>
            </div>
          )}
        </div>

        {/* グラフ */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          height: '120px',
          marginBottom: '16px',
        }}>
          {historicalStats?.dailyStats?.map((day, i) => {
            const maxDMs = Math.max(...historicalStats.dailyStats.map(d => d.totalDMs), 3);
            const height = (day.totalDMs / maxDMs) * 100;

            return (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${height}%`,
                    minHeight: '4px',
                    background: day.goalAchieved
                      ? 'linear-gradient(180deg, #22c55e, #16a34a)'
                      : 'linear-gradient(180deg, #f59e0b, #ea580c)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease',
                  }}
                />
                <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                  {new Date(day.date).toLocaleDateString('ja-JP', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: day.goalAchieved ? '#22c55e' : '#f59e0b' }}>
                  {day.totalDMs}
                </div>
              </div>
            );
          })}
        </div>

        {/* サマリー */}
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
              {historicalStats?.avgDMsPerDay || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>平均DM/日</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
              {historicalStats?.goalAchievementRate || 0}%
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>目標達成率</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
              {historicalStats?.totalDMs || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>週間合計</div>
          </div>
        </div>
      </div>

      {/* アカウント状態 + クイックアクション */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        {/* アカウント状態 */}
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid #222',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Users size={20} />
            <span style={{ fontWeight: 'bold' }}>アカウント状態</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {accountStatus.map(acc => (
              <div
                key={acc.account}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${ACCOUNT_COLORS[acc.account] || '#888'}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{acc.name}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{acc.handle}</div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: acc.connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: acc.connected ? '#22c55e' : '#ef4444',
                  fontSize: '12px',
                }}>
                  {acc.connected && <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />}
                  {acc.connected ? '稼働中' : '未接続'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* クイックアクション */}
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid #222',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Zap size={20} color="#f59e0b" />
            <span style={{ fontWeight: 'bold' }}>クイックアクション</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link
              href="/dm-hunter"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
                borderRadius: '10px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Target size={20} color="#f59e0b" />
                <span>DM Hunterを開く</span>
              </div>
              <ChevronRight size={18} color="#888" />
            </Link>

            <button
              onClick={() => setShowDMModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MessageCircle size={20} color="#22c55e" />
                <span>DM問い合わせを記録</span>
              </div>
              <ChevronRight size={18} color="#888" />
            </button>

            <Link
              href="/analytics"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
                borderRadius: '10px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 size={20} color="#3b82f6" />
                <span>詳細分析を見る</span>
              </div>
              <ChevronRight size={18} color="#888" />
            </Link>
          </div>
        </div>
      </div>

      {/* 自動スケジュール */}
      <div style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid #222',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={20} className="pulse-dot" />
          <span style={{ fontWeight: 'bold' }}>自動投稿スケジュール</span>
          <span style={{
            marginLeft: 'auto',
            fontSize: '12px',
            color: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
            自動実行中
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['07:00', '12:00', '18:00', '20:00', '22:00', '24:00'].map((time) => {
            const now = new Date();
            const [h] = time.split(':').map(Number);
            const isPast = h <= now.getHours();

            return (
              <div
                key={time}
                style={{
                  padding: '12px 24px',
                  background: isPast ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)',
                  border: isPast ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #333',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '18px', color: isPast ? '#22c55e' : 'inherit' }}>
                  {time}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  {isPast ? '完了' : '予定'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DM記録モーダル */}
      {showDMModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDMModal(false)}
        >
          <div
            className="slide-up"
            style={{
              background: '#1a1a1a',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '24px' }}>
              DM問い合わせを記録
            </h2>

            <p style={{ color: '#888', marginBottom: '20px' }}>
              どのアカウントにDMが来ましたか？
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['liver', 'chatre1', 'chatre2'].map(acc => (
                <button
                  key={acc}
                  onClick={() => recordDM(acc)}
                  disabled={recordingDM}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: ACCOUNT_COLORS[acc] + '22',
                    border: `1px solid ${ACCOUNT_COLORS[acc]}44`,
                    borderRadius: '10px',
                    cursor: recordingDM ? 'not-allowed' : 'pointer',
                    opacity: recordingDM ? 0.5 : 1,
                  }}
                >
                  <MessageCircle size={20} color={ACCOUNT_COLORS[acc]} />
                  <span style={{ color: ACCOUNT_COLORS[acc], fontWeight: 'bold' }}>
                    {ACCOUNT_LABELS[acc]}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowDMModal(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px',
                background: 'transparent',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#888',
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

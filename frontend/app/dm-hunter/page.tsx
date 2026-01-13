'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Target,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Clock,
  TrendingUp,
  MessageCircle,
  ArrowLeft,
  Users,
  Eye,
  RotateCcw,
  Send,
  Edit3,
  Brain,
  Activity,
  Sparkles,
} from 'lucide-react';

// CSSアニメーション定義 + モバイル対応
const animationStyles = `
@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

@keyframes wave {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}

@keyframes ticker {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.6); }
}

@keyframes progress-wave {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes count-up {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes brain-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

.pulse-ring {
  animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.pulse-dot {
  animation: pulse-dot 2s ease-in-out infinite;
}

.wave-bg {
  background: linear-gradient(90deg, rgba(245,158,11,0.1), rgba(139,92,246,0.1), rgba(245,158,11,0.1));
  background-size: 200% 100%;
  animation: wave 8s ease-in-out infinite;
}

.float {
  animation: float 3s ease-in-out infinite;
}

.glow {
  animation: glow 2s ease-in-out infinite;
}

.progress-wave {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  background-size: 200% 100%;
  animation: progress-wave 2s linear infinite;
}

.spin-slow {
  animation: spin-slow 8s linear infinite;
}

.brain-pulse {
  animation: brain-pulse 2s ease-in-out infinite;
}

/* モバイル対応 */
.dm-hunter-container {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .dm-hunter-container {
    padding: 24px;
  }
}

.mobile-header {
  font-size: 22px !important;
}

@media (min-width: 768px) {
  .mobile-header {
    font-size: 28px !important;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
}

.account-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 640px) {
  .account-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

@media (min-width: 768px) {
  .schedule-grid {
    display: flex;
    gap: 12px;
  }
}

.filter-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.filter-scroll::-webkit-scrollbar {
  display: none;
}

.preview-header {
  flex-direction: column;
  gap: 12px;
  align-items: stretch !important;
}

@media (min-width: 640px) {
  .preview-header {
    flex-direction: row;
    align-items: center !important;
  }
}

.preview-actions {
  flex-direction: column;
  gap: 8px;
}

@media (min-width: 480px) {
  .preview-actions {
    flex-direction: row;
  }
}

.tag-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.tag-scroll::-webkit-scrollbar {
  display: none;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 480px) {
  .action-buttons {
    flex-direction: row;
  }
}

.live-bar-mobile {
  flex-wrap: wrap;
  gap: 8px;
}

@media (min-width: 640px) {
  .live-bar-mobile {
    flex-wrap: nowrap;
  }
}

.hide-mobile {
  display: none;
}

@media (min-width: 640px) {
  .hide-mobile {
    display: flex;
  }
}

.stats-card {
  padding: 16px;
}

@media (min-width: 768px) {
  .stats-card {
    padding: 24px;
  }
}

.stats-number {
  font-size: 28px;
}

@media (min-width: 768px) {
  .stats-number {
    font-size: 36px;
  }
}
`;

// アニメーション付き数値カウンター
function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(0);

  useEffect(() => {
    startValue.current = displayValue;
    startTime.current = null;

    const animate = (currentTime: number) => {
      if (startTime.current === null) startTime.current = currentTime;
      const elapsed = currentTime - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue.current + (value - startValue.current) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

interface AccountStatus {
  account: string;
  name: string;
  handle: string;
  connected: boolean;
  username?: string;
  error?: string;
}

interface PostLog {
  id: string;
  timestamp: string;
  text: string;
  target: string;
  benefit: string;
  account?: string;
  score: number;
  results: {
    platform: string;
    account?: string;
    success: boolean;
    id?: string;
    error?: string;
  }[];
}

interface Stats {
  todayPosts: number;
  todaySuccess: number;
  totalPosts: number;
}

interface AutoRunStatus {
  status: string;
  accounts: AccountStatus[];
  todayPosts: number;
  todaySuccess: number;
  scheduledTimes: string[];
}

interface PreviewPost {
  account: string;
  text: string;
  target: string;
  benefit: string;
  score: number;
  passed: boolean;
}

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

export default function DMHunterPage() {
  const [status, setStatus] = useState<AutoRunStatus | null>(null);
  const [logs, setLogs] = useState<PostLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PreviewPost[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [regeneratingAccount, setRegeneratingAccount] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [learningStats, setLearningStats] = useState<{ total: number; avgScore: number; byAccount: Record<string, number> } | null>(null);
  const [activityDots, setActivityDots] = useState<{ id: number; color: string }[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 時計を毎秒更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // アクティビティドットをランダムに追加
  useEffect(() => {
    const addDot = () => {
      const colors = ['#f59e0b', '#ec4899', '#8b5cf6', '#22c55e', '#3b82f6'];
      setActivityDots(prev => {
        const newDot = { id: Date.now(), color: colors[Math.floor(Math.random() * colors.length)] };
        const updated = [...prev, newDot].slice(-8);
        return updated;
      });
    };
    const interval = setInterval(addDot, 2000);
    addDot(); // 初回
    return () => clearInterval(interval);
  }, []);

  // データ取得
  const fetchData = async () => {
    try {
      const [statusRes, logsRes, learningRes] = await Promise.all([
        fetch('/api/dm-hunter/auto-run'),
        fetch('/api/dm-hunter/logs?limit=15'),
        fetch('/api/dm-hunter/learning-stats').catch(() => null),
      ]);

      const statusData = await statusRes.json();
      const logsData = await logsRes.json();

      setStatus(statusData);
      setLogs(logsData.logs || []);
      setStats(logsData.stats || null);

      if (learningRes && learningRes.ok) {
        const learningData = await learningRes.json();
        setLearningStats(learningData);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // ページ読み込み時に自動でプレビュー生成
    generatePreviews();
  }, []);

  // プレビュー生成（3アカウント分）
  const generatePreviews = async () => {
    setPreviewLoading(true);
    setPreviews([]);
    try {
      const res = await fetch('/api/dm-hunter/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      console.log('API response:', data);
      if (data.error) {
        setLastResult({ success: false, error: data.error });
      } else if (data.posts) {
        setPreviews(data.posts.map((p: any) => ({
          account: p.account,
          text: p.text,
          target: p.target,
          benefit: p.benefit,
          score: p.score?.total ?? p.score,
          passed: p.score?.passed ?? p.score >= 7,
        })));
      } else {
        setLastResult({ success: false, error: 'プレビュー生成に失敗しました' });
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      setLastResult({ success: false, error: error.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  // 単一アカウント再生成
  const regenerateForAccount = async (account: string) => {
    setRegeneratingAccount(account);
    try {
      const res = await fetch('/api/dm-hunter/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true, account }),
      });
      const data = await res.json();
      if (data.post) {
        setPreviews(prev => prev.map(p =>
          p.account === account
            ? {
                account,
                text: data.post.text,
                target: data.post.target,
                benefit: data.post.benefit,
                score: data.score?.total ?? data.score,
                passed: data.score?.passed ?? data.score >= 7,
              }
            : p
        ));
      }
    } catch (error) {
      console.error('Regenerate error:', error);
    } finally {
      setRegeneratingAccount(null);
    }
  };

  // 編集確定
  const confirmEdit = (account: string) => {
    setPreviews(prev => prev.map(p =>
      p.account === account ? { ...p, text: editText } : p
    ));
    setEditingAccount(null);
    setEditText('');
  };

  // プレビューから投稿実行
  const postFromPreviews = async () => {
    if (previews.length === 0) return;
    setRunning(true);
    setLastResult(null);
    try {
      // 各アカウントに個別投稿
      const results = [];
      for (const preview of previews) {
        const res = await fetch('/api/dm-hunter/post-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: preview.text,
            account: preview.account,
            target: preview.target,
            benefit: preview.benefit,
            score: preview.score,
          }),
        });
        const data = await res.json();
        results.push({ ...data, account: preview.account });
      }
      setLastResult({
        success: results.some(r => r.success),
        results: results.map(r => ({
          account: ACCOUNT_LABELS[r.account] || r.account,
          success: r.success,
          error: r.error,
        })),
      });
      await fetchData();
      setPreviews([]);
    } catch (error: any) {
      setLastResult({ success: false, error: error.message });
    } finally {
      setRunning(false);
    }
  };

  // 手動実行
  const runManually = async (dryRun: boolean = false, account?: string) => {
    setRunning(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/dm-hunter/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, account }),
      });

      const data = await res.json();
      setLastResult(data);

      if (!dryRun) {
        await fetchData();
      }
    } catch (error: any) {
      setLastResult({ success: false, error: error.message });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <style>{animationStyles}</style>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div style={{
            position: 'absolute',
            inset: '-8px',
            borderRadius: '50%',
            border: '2px solid #f59e0b',
            opacity: 0.3,
          }} className="pulse-ring" />
          <RefreshCw className="animate-spin" size={32} color="#f59e0b" />
        </div>
        <p style={{ marginTop: '16px', color: '#888' }}>AIシステム起動中...</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#f59e0b',
                animation: `pulse-dot 1s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dm-hunter-container">
      <style>{animationStyles}</style>

      {/* ライブステータスバー */}
      <div className="live-bar-mobile" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '8px',
        marginBottom: '12px',
        fontSize: '11px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#22c55e',
            }} className="pulse-dot" />
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>LIVE</span>
          </div>
          <span style={{ color: '#555' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Activity size={12} color="#f59e0b" className="pulse-dot" />
            <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>
              {currentTime.toLocaleTimeString('ja-JP')}
            </span>
          </div>
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#555' }}>|</span>
            <div style={{ display: 'flex', gap: '3px' }}>
              {activityDots.map(dot => (
                <div
                  key={dot.id}
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: dot.color,
                    opacity: 0.8,
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888' }}>
          <Sparkles size={12} className="spin-slow" style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '10px' }}>AI運用中</span>
        </div>
      </div>

      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link href="/" style={{ color: '#888', padding: '8px' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="mobile-header" style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="float">
              <Target size={24} color="#f59e0b" />
            </div>
            <span>DM Hunter</span>
            <div style={{
              padding: '3px 8px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 'normal',
            }} className="glow">
              v2.0 AI
            </div>
          </h1>
          <p style={{ color: '#888', marginTop: '2px', fontSize: '12px' }}>3アカウント同時運用</p>
        </div>
      </div>

      {/* アカウント状態 */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} />
          アカウント
        </h2>
        <div className="account-grid">
          {status?.accounts?.map((acc) => (
            <div
              key={acc.account}
              style={{
                padding: '14px',
                background: `linear-gradient(135deg, ${ACCOUNT_COLORS[acc.account]}22 0%, ${ACCOUNT_COLORS[acc.account]}11 100%)`,
                border: `1px solid ${ACCOUNT_COLORS[acc.account]}44`,
                borderRadius: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{acc.name}</div>
                  <div style={{ color: '#888', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.handle}</div>
                </div>
                <div style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  background: acc.connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: acc.connected ? '#22c55e' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                }}>
                  {acc.connected && (
                    <div style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: '#22c55e',
                    }} className="pulse-dot" />
                  )}
                  {acc.connected ? '稼働中' : '未接続'}
                </div>
              </div>
              {acc.connected && (
                <button
                  onClick={() => runManually(true, acc.account)}
                  disabled={running}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: ACCOUNT_COLORS[acc.account],
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: running ? 'not-allowed' : 'pointer',
                    opacity: running ? 0.5 : 1,
                  }}
                >
                  テスト
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ステータスカード */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stats-card" style={{
          background: 'linear-gradient(135deg, #f59e0b22 0%, #f59e0b11 100%)',
          border: '1px solid #f59e0b44',
          borderRadius: '12px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent, #f59e0b, transparent)`,
            backgroundSize: '200% 100%',
          }} className="progress-wave" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <MessageCircle size={16} color="#f59e0b" className="pulse-dot" />
            <span style={{ color: '#888', fontSize: '11px' }}>今日</span>
          </div>
          <div className="stats-number" style={{ fontWeight: 'bold', color: '#f59e0b' }}>
            <AnimatedCounter value={stats?.todayPosts || 0} />
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>/ 18 目標</div>
          <div style={{
            marginTop: '6px',
            height: '3px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(((stats?.todayPosts || 0) / 18) * 100, 100)}%`,
              background: '#f59e0b',
              borderRadius: '2px',
              transition: 'width 1s ease',
            }} />
          </div>
        </div>

        <div className="stats-card" style={{
          background: 'linear-gradient(135deg, #22c55e22 0%, #22c55e11 100%)',
          border: '1px solid #22c55e44',
          borderRadius: '12px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent, #22c55e, transparent)`,
            backgroundSize: '200% 100%',
          }} className="progress-wave" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <CheckCircle size={16} color="#22c55e" />
            <span style={{ color: '#888', fontSize: '11px' }}>成功</span>
          </div>
          <div className="stats-number" style={{ fontWeight: 'bold', color: '#22c55e' }}>
            <AnimatedCounter value={stats?.todaySuccess || 0} />
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>投稿OK</div>
        </div>

        <div className="stats-card" style={{
          background: 'linear-gradient(135deg, #3b82f622 0%, #3b82f611 100%)',
          border: '1px solid #3b82f644',
          borderRadius: '12px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent, #3b82f6, transparent)`,
            backgroundSize: '200% 100%',
          }} className="progress-wave" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <TrendingUp size={16} color="#3b82f6" />
            <span style={{ color: '#888', fontSize: '11px' }}>累計</span>
          </div>
          <div className="stats-number" style={{ fontWeight: 'bold', color: '#3b82f6' }}>
            <AnimatedCounter value={stats?.totalPosts || 0} />
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>総投稿</div>
        </div>

        {/* AI学習カード */}
        <div className="stats-card" style={{
          background: 'linear-gradient(135deg, #8b5cf622 0%, #8b5cf611 100%)',
          border: '1px solid #8b5cf644',
          borderRadius: '12px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent, #8b5cf6, transparent)`,
            backgroundSize: '200% 100%',
          }} className="progress-wave" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Brain size={16} color="#8b5cf6" className="brain-pulse" />
            <span style={{ color: '#888', fontSize: '11px' }}>AI学習</span>
          </div>
          <div className="stats-number" style={{ fontWeight: 'bold', color: '#8b5cf6' }}>
            <AnimatedCounter value={learningStats?.total || 0} />
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            {learningStats?.avgScore ? `平均${learningStats.avgScore.toFixed(1)}点` : 'パターン蓄積中'}
          </div>
        </div>
      </div>

      {/* 投稿プレビュー */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
      }}>
        <div className="preview-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={18} color="#8b5cf6" />
            プレビュー
          </h2>
          <button
            onClick={generatePreviews}
            disabled={previewLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: previewLoading ? '#333' : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: previewLoading ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {previewLoading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
            {previewLoading ? '生成中...' : '3アカウント生成'}
          </button>
        </div>

        {previews.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: '#666',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '10px',
          }}>
            <Eye size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ fontSize: '13px' }}>ボタンを押して投稿をプレビュー</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {previews.map((preview) => (
                <div
                  key={preview.account}
                  style={{
                    padding: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    borderLeft: `3px solid ${ACCOUNT_COLORS[preview.account] || '#888'}`,
                  }}
                >
                  {/* ヘッダー: アカウント名とボタン */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        padding: '3px 8px',
                        background: ACCOUNT_COLORS[preview.account] + '44',
                        color: ACCOUNT_COLORS[preview.account],
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                      }}>
                        {ACCOUNT_LABELS[preview.account]}
                      </span>
                      <span style={{
                        padding: '2px 6px',
                        background: preview.passed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: preview.passed ? '#22c55e' : '#ef4444',
                        borderRadius: '4px',
                        fontSize: '10px',
                      }}>
                        {preview.score}点
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          setEditingAccount(preview.account);
                          setEditText(preview.text);
                        }}
                        disabled={regeneratingAccount === preview.account}
                        style={{
                          padding: '5px 10px',
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          borderRadius: '5px',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11px',
                        }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => regenerateForAccount(preview.account)}
                        disabled={regeneratingAccount === preview.account}
                        style={{
                          padding: '5px 10px',
                          background: 'rgba(245, 158, 11, 0.2)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          borderRadius: '5px',
                          color: '#f59e0b',
                          cursor: regeneratingAccount === preview.account ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11px',
                        }}
                      >
                        {regeneratingAccount === preview.account ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <RotateCcw size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                  {/* タグ行 */}
                  <div className="tag-scroll" style={{ marginBottom: '8px' }}>
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      borderRadius: '4px',
                      fontSize: '10px',
                      whiteSpace: 'nowrap',
                    }}>
                      {preview.target}
                    </span>
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#3b82f6',
                      borderRadius: '4px',
                      fontSize: '10px',
                      whiteSpace: 'nowrap',
                    }}>
                      {preview.benefit}
                    </span>
                    <span style={{ color: '#555', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      {preview.text.length}文字
                    </span>
                  </div>

                  {editingAccount === preview.account ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '10px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <span style={{ color: '#888', fontSize: '11px', marginRight: 'auto' }}>
                          {editText.length}文字
                          {editText.length > 280 && <span style={{ color: '#ef4444' }}> (超過)</span>}
                        </span>
                        <button
                          onClick={() => {
                            setEditingAccount(null);
                            setEditText('');
                          }}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid #444',
                            borderRadius: '5px',
                            color: '#888',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          戻る
                        </button>
                        <button
                          onClick={() => confirmEdit(preview.account)}
                          style={{
                            padding: '6px 12px',
                            background: '#22c55e',
                            border: 'none',
                            borderRadius: '5px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                          }}
                        >
                          確定
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6',
                      fontSize: '13px',
                      padding: '10px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '6px',
                    }}>
                      {preview.text}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="preview-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setPreviews([])}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid #444',
                  borderRadius: '8px',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '13px',
                  flex: 1,
                  maxWidth: '120px',
                }}
              >
                クリア
              </button>
              <button
                onClick={postFromPreviews}
                disabled={running || previews.some(p => !p.passed)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  background: running ? '#333' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: previews.some(p => !p.passed) ? 0.5 : 1,
                  fontSize: '13px',
                  flex: 2,
                }}
              >
                {running ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                {running ? '投稿中...' : '投稿する'}
              </button>
            </div>
            {previews.some(p => !p.passed) && (
              <p style={{ textAlign: 'center', color: '#f59e0b', fontSize: '11px', marginTop: '10px' }}>
                7点未満あり。再生成してください
              </p>
            )}
          </>
        )}
      </div>

      {/* アクションボタン */}
      <div className="action-buttons" style={{ marginBottom: '24px' }}>
        <button
          onClick={() => runManually(false)}
          disabled={running}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '12px 20px',
            background: running ? '#333' : 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: running ? 'not-allowed' : 'pointer',
            flex: 1,
          }}
        >
          {running ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
          {running ? '実行中...' : '即時投稿'}
        </button>

        <button
          onClick={fetchData}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '12px 20px',
            background: 'transparent',
            border: '1px solid #333',
            borderRadius: '10px',
            color: '#666',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* 実行結果 */}
      {lastResult && (
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          background: lastResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${lastResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            {lastResult.success ? (
              <CheckCircle size={24} color="#22c55e" />
            ) : (
              <XCircle size={24} color="#ef4444" />
            )}
            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>
              {lastResult.dryRun ? 'テスト結果' : lastResult.success ? '投稿成功' : '投稿失敗'}
            </span>
            {lastResult.processingTime && (
              <span style={{ color: '#888', fontSize: '14px' }}>
                ({lastResult.processingTime}ms)
              </span>
            )}
          </div>

          {/* 複数アカウントの結果 */}
          {lastResult.posts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {lastResult.posts.map((p: any, i: number) => (
                <div key={i} style={{
                  padding: '16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '12px',
                  borderLeft: `4px solid ${ACCOUNT_COLORS[p.account] || '#888'}`,
                }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: ACCOUNT_COLORS[p.account] + '33',
                      color: ACCOUNT_COLORS[p.account],
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}>
                      {p.accountName || ACCOUNT_LABELS[p.account]}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}>
                      {p.target}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#3b82f6',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}>
                      {p.benefit}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: (p.score?.passed ?? p.score >= 7) ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: (p.score?.passed ?? p.score >= 7) ? '#22c55e' : '#f59e0b',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}>
                      スコア: {p.score?.total ?? p.score}/10
                    </span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '14px' }}>
                    {p.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 単一アカウントの結果 */}
          {lastResult.post && !lastResult.posts && (
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
            }}>
              {lastResult.post.text || lastResult.post}
            </div>
          )}

          {lastResult.results && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              {lastResult.results.map((r: any, i: number) => (
                <span
                  key={i}
                  style={{
                    padding: '4px 12px',
                    background: r.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: r.success ? '#22c55e' : '#ef4444',
                    borderRadius: '20px',
                    fontSize: '14px',
                  }}
                >
                  {r.account || r.platform}: {r.success ? 'OK' : r.error?.substring(0, 30) || 'NG'}
                </span>
              ))}
            </div>
          )}

          {lastResult.error && (
            <div style={{ color: '#ef4444', marginTop: '8px' }}>
              Error: {lastResult.error}
            </div>
          )}
        </div>
      )}

      {/* スケジュール */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={16} className="pulse-dot" />
          スケジュール
          <span style={{
            marginLeft: 'auto',
            fontSize: '10px',
            fontWeight: 'normal',
            color: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            <div style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#22c55e',
            }} className="pulse-dot" />
            自動実行中
          </span>
        </h2>
        <div className="schedule-grid">
          {['07:00', '12:00', '18:00', '20:00', '22:00', '24:00'].map((time, i) => {
            const now = new Date();
            const [h, m] = time.split(':').map(Number);
            const scheduleTime = new Date();
            scheduleTime.setHours(h === 24 ? 0 : h, m, 0, 0);
            if (h === 24) scheduleTime.setDate(scheduleTime.getDate() + 1);

            const isNext = scheduleTime > now &&
              !['07:00', '12:00', '18:00', '20:00', '22:00', '24:00']
                .slice(0, i)
                .some(t => {
                  const [th] = t.split(':').map(Number);
                  const checkTime = new Date();
                  checkTime.setHours(th === 24 ? 0 : th, 0, 0, 0);
                  return checkTime > now;
                });

            return (
              <div
                key={time}
                style={{
                  padding: '8px 12px',
                  background: isNext ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: isNext ? '1px solid #f59e0b' : '1px solid #333',
                  borderRadius: '6px',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                className={isNext ? 'glow' : ''}
              >
                {isNext && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, #f59e0b, transparent)`,
                    backgroundSize: '200% 100%',
                  }} className="progress-wave" />
                )}
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: isNext ? '#f59e0b' : 'inherit' }}>
                  {time}
                </div>
                <div style={{ fontSize: '9px', color: isNext ? '#f59e0b' : '#666' }}>
                  {isNext ? '次回' : '×3'}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ color: '#555', fontSize: '11px', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={12} className="spin-slow" style={{ color: '#8b5cf6' }} />
          1日18投稿を自動実行
        </p>
      </div>

      {/* ログ */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
          投稿ログ
        </h2>

        {/* アカウントフィルター */}
        <div className="filter-scroll" style={{ marginBottom: '12px' }}>
          <button
            onClick={() => setSelectedAccount(null)}
            style={{
              padding: '6px 12px',
              background: selectedAccount === null ? '#f59e0b' : 'transparent',
              border: '1px solid #444',
              borderRadius: '6px',
              color: selectedAccount === null ? 'white' : '#888',
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            全て
          </button>
          {Object.entries(ACCOUNT_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedAccount(key)}
              style={{
                padding: '6px 12px',
                background: selectedAccount === key ? ACCOUNT_COLORS[key] : 'transparent',
                border: `1px solid ${ACCOUNT_COLORS[key]}`,
                borderRadius: '6px',
                color: selectedAccount === key ? 'white' : ACCOUNT_COLORS[key],
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {logs.length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: '#666',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '10px',
            fontSize: '13px',
          }}>
            まだ投稿ログがありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {logs
              .filter(log => !selectedAccount || log.account === selectedAccount)
              .map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #222',
                  borderRadius: '10px',
                  borderLeft: `3px solid ${ACCOUNT_COLORS[log.account || ''] || '#888'}`,
                }}
              >
                {/* ヘッダー */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {log.account && (
                      <span style={{
                        padding: '2px 6px',
                        background: ACCOUNT_COLORS[log.account] + '33',
                        color: ACCOUNT_COLORS[log.account],
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                      }}>
                        {ACCOUNT_LABELS[log.account]}
                      </span>
                    )}
                    <span style={{
                      padding: '2px 5px',
                      background: log.score >= 7 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: log.score >= 7 ? '#22c55e' : '#f59e0b',
                      borderRadius: '4px',
                      fontSize: '9px',
                    }}>
                      {log.score}点
                    </span>
                  </div>
                  <span style={{ color: '#666', fontSize: '10px' }}>
                    {new Date(log.timestamp).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* タグ */}
                <div className="tag-scroll" style={{ marginBottom: '8px' }}>
                  <span style={{
                    padding: '2px 5px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    color: '#a78bfa',
                    borderRadius: '3px',
                    fontSize: '9px',
                    whiteSpace: 'nowrap',
                  }}>
                    {log.target}
                  </span>
                  <span style={{
                    padding: '2px 5px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#3b82f6',
                    borderRadius: '3px',
                    fontSize: '9px',
                    whiteSpace: 'nowrap',
                  }}>
                    {log.benefit}
                  </span>
                </div>

                {/* テキスト */}
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  padding: '10px',
                  borderRadius: '6px',
                  whiteSpace: 'pre-wrap',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  marginBottom: '8px',
                  maxHeight: '120px',
                  overflow: 'hidden',
                }}>
                  {log.text}
                </div>

                {/* 結果 */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {log.results.map((r, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '3px 6px',
                        background: r.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: r.success ? '#22c55e' : '#ef4444',
                        borderRadius: '4px',
                        fontSize: '10px',
                      }}
                    >
                      {r.success ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

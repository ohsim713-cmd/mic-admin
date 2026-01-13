'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Zap,
  MessageCircle,
  Image,
  Video,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Brain,
  Activity,
  Sparkles,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Database,
  Cpu,
  Package,
  Trash2,
  Twitter,
  Link2,
  AlertTriangle,
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

@keyframes wave {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.3); }
  50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.6); }
}

@keyframes progress-wave {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes data-flow {
  0% { opacity: 0; transform: translateX(-10px); }
  50% { opacity: 1; }
  100% { opacity: 0; transform: translateX(10px); }
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
.float { animation: float 3s ease-in-out infinite; }
.glow { animation: glow 2s ease-in-out infinite; }
.spin-slow { animation: spin-slow 8s linear infinite; }
.progress-wave {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  background-size: 200% 100%;
  animation: progress-wave 2s linear infinite;
}
.gradient-shift {
  background: linear-gradient(135deg, #8b5cf6, #3b82f6, #22c55e, #f59e0b, #8b5cf6);
  background-size: 400% 400%;
  animation: gradient-shift 8s ease infinite;
}

/* モバイル対応 */
.auto-hub-container {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0a0a 0%, #111 100%);
}

@media (min-width: 768px) {
  .auto-hub-container { padding: 24px; }
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .content-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
}
`;

// 数値アニメーション
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
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

const CONTENT_TYPES = {
  text: {
    icon: MessageCircle,
    label: 'テキスト',
    description: 'DM Hunter - Twitter自動投稿',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
  },
  image: {
    icon: Image,
    label: '画像',
    description: 'Instagram - ネイル画像生成',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
  },
  video: {
    icon: Video,
    label: '動画',
    description: 'Shorts - スクリプト生成',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
  },
};

export default function AutoHubPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningType, setRunningType] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [autoMode, setAutoMode] = useState(true);
  const [activityDots, setActivityDots] = useState<{ id: number; color: string }[]>([]);
  const [stockData, setStockData] = useState<any>(null);
  const [stockExpanded, setStockExpanded] = useState(false);
  const [refillLoading, setRefillLoading] = useState(false);
  const [accountsStatus, setAccountsStatus] = useState<any[]>([]);

  // 時計
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // アクティビティドット
  useEffect(() => {
    const addDot = () => {
      const colors = ['#f59e0b', '#ec4899', '#22c55e', '#8b5cf6', '#3b82f6'];
      setActivityDots(prev => {
        const newDot = { id: Date.now(), color: colors[Math.floor(Math.random() * colors.length)] };
        return [...prev, newDot].slice(-12);
      });
    };
    const interval = setInterval(addDot, 1500);
    addDot();
    return () => clearInterval(interval);
  }, []);

  // データ取得
  const fetchData = async () => {
    try {
      const [statusRes, runRes, stockRes, patternsRes, accountsRes] = await Promise.all([
        fetch('/api/auto-hub/status'),
        fetch('/api/auto-hub/run-all'),
        fetch('/api/dm-hunter/stock'),
        fetch('/api/dm-hunter/success-patterns').catch(() => ({ json: () => ({ patterns: [] }) })),
        fetch('/api/dm-hunter/auto-run').catch(() => ({ json: () => ({ accounts: [] }) })),
      ]);

      const statusData = await statusRes.json();
      const runData = await runRes.json();
      const stockDataRes = await stockRes.json();
      const patternsData = await patternsRes.json?.() || { patterns: [] };
      const accountsData = await accountsRes.json?.() || { accounts: [] };

      // ストックをアカウント別に整理
      const stocksByAccount: Record<string, any[]> = {
        liver: [],
        chatre1: [],
        chatre2: [],
      };
      if (stockDataRes.stocks) {
        for (const stock of stockDataRes.stocks) {
          if (stocksByAccount[stock.account]) {
            stocksByAccount[stock.account].push(stock);
          }
        }
      }

      setStatus({ ...statusData, recentLogs: runData.recentLogs, patternCount: patternsData.patterns?.length || 0 });
      setStockData({ ...stockDataRes, stocks: stocksByAccount });
      setAccountsStatus(accountsData.accounts || []);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ストック補充
  const refillStock = async () => {
    setRefillLoading(true);
    try {
      const res = await fetch('/api/dm-hunter/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refill-all' }),
      });
      const data = await res.json();
      if (data.success) {
        // ストックデータを再取得
        const stockRes = await fetch('/api/dm-hunter/stock');
        const stockDataRes = await stockRes.json();

        // アカウント別に整理
        const stocksByAccount: Record<string, any[]> = {
          liver: [],
          chatre1: [],
          chatre2: [],
        };
        if (stockDataRes.stocks) {
          for (const stock of stockDataRes.stocks) {
            if (stocksByAccount[stock.account]) {
              stocksByAccount[stock.account].push(stock);
            }
          }
        }
        setStockData({ ...stockDataRes, stocks: stocksByAccount });
      }
    } catch (error) {
      console.error('Refill error:', error);
    } finally {
      setRefillLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 全自動実行
  const runAll = async (dryRun = false) => {
    setRunning(true);
    setRunningType('all');
    setLastResult(null);

    try {
      const res = await fetch('/api/auto-hub/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      setLastResult(data);
      if (!dryRun) await fetchData();
    } catch (error: any) {
      setLastResult({ success: false, error: error.message });
    } finally {
      setRunning(false);
      setRunningType(null);
    }
  };

  // 個別実行
  const runSingle = async (type: 'text' | 'image' | 'video', dryRun = false) => {
    setRunning(true);
    setRunningType(type);
    setLastResult(null);

    try {
      const endpoints: Record<string, string> = {
        text: '/api/dm-hunter/auto-run',
        image: '/api/auto-hub/generate-image',
        video: '/api/auto-hub/generate-video',
      };

      const res = await fetch(endpoints[type], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      setLastResult({ results: [{ type, ...data }], success: data.success });
      if (!dryRun) await fetchData();
    } catch (error: any) {
      setLastResult({ success: false, error: error.message });
    } finally {
      setRunning(false);
      setRunningType(null);
    }
  };

  if (loading) {
    return (
      <div className="auto-hub-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{animationStyles}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '24px' }}>
            <div className="gradient-shift" style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Cpu size={40} color="white" className="pulse-dot" />
            </div>
          </div>
          <p style={{ color: '#888', fontSize: '14px' }}>AIシステム起動中...</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: Object.values(CONTENT_TYPES)[i % 3].color,
                  animation: `pulse-dot 1s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalToday = (status?.text?.stats?.today || 0) + (status?.image?.stats?.today || 0) + (status?.video?.stats?.today || 0);
  const totalSuccess = (status?.text?.stats?.success || 0) + (status?.image?.stats?.success || 0) + (status?.video?.stats?.success || 0);

  return (
    <div className="auto-hub-container">
      <style>{animationStyles}</style>

      {/* ライブステータスバー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1), rgba(34, 197, 94, 0.1))',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: autoMode ? '#22c55e' : '#f59e0b',
            }} className="pulse-dot" />
            <span style={{ color: autoMode ? '#22c55e' : '#f59e0b', fontWeight: 'bold', fontSize: '12px' }}>
              {autoMode ? 'AUTO' : 'MANUAL'}
            </span>
          </div>
          <span style={{ color: '#444' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={14} color="#8b5cf6" className="pulse-dot" />
            <span style={{ color: '#8b5cf6', fontFamily: 'monospace', fontSize: '12px' }}>
              {currentTime.toLocaleTimeString('ja-JP')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {activityDots.map(dot => (
            <div
              key={dot.id}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: dot.color,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      </div>

      {/* ヘッダー */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div className="gradient-shift float" style={{
            padding: '12px',
            borderRadius: '16px',
          }}>
            <Zap size={28} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Auto Hub
              <span style={{
                padding: '4px 10px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'normal',
              }} className="glow">
                全自動 AI
              </span>
            </h1>
            <p style={{ color: '#666', fontSize: '13px' }}>テキスト・画像・動画を一括自動生成</p>
          </div>
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="stats-row" style={{ marginBottom: '24px' }}>
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div className="progress-wave" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #8b5cf6, transparent)', backgroundSize: '200% 100%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TrendingUp size={18} color="#8b5cf6" />
            <span style={{ color: '#888', fontSize: '12px' }}>今日の生成</span>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#8b5cf6' }}>
            <AnimatedCounter value={totalToday} />
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>コンテンツ</div>
        </div>

        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div className="progress-wave" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #22c55e, transparent)', backgroundSize: '200% 100%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle size={18} color="#22c55e" />
            <span style={{ color: '#888', fontSize: '12px' }}>成功</span>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#22c55e' }}>
            <AnimatedCounter value={totalSuccess} />
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>完了</div>
        </div>

        <div
          onClick={() => setStockExpanded(!stockExpanded)}
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
          <div className="progress-wave" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)', backgroundSize: '200% 100%' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} color="#3b82f6" />
              <span style={{ color: '#888', fontSize: '12px' }}>ストック</span>
            </div>
            {stockExpanded ? <ChevronUp size={14} color="#3b82f6" /> : <ChevronDown size={14} color="#3b82f6" />}
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#3b82f6' }}>
            <AnimatedCounter value={
              (stockData?.counts?.liver || 0) +
              (stockData?.counts?.chatre1 || 0) +
              (stockData?.counts?.chatre2 || 0)
            } />
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>準備済み投稿</div>
        </div>

        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div className="progress-wave" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)', backgroundSize: '200% 100%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Brain size={18} color="#f59e0b" className="pulse-dot" />
            <span style={{ color: '#888', fontSize: '12px' }}>AI学習</span>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#f59e0b' }}>
            <AnimatedCounter value={status?.patternCount || 0} />
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>成功パターン</div>
        </div>
      </div>

      {/* ストック詳細セクション */}
      {stockExpanded && stockData && (
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} color="#3b82f6" />
              投稿ストック詳細
            </h3>
            <button
              onClick={refillStock}
              disabled={refillLoading}
              style={{
                padding: '8px 16px',
                background: refillLoading ? '#333' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '12px',
                cursor: refillLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={14} className={refillLoading ? 'animate-spin' : ''} />
              {refillLoading ? '補充中...' : 'ストック補充'}
            </button>
          </div>

          {/* アカウント別ストック */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {['liver', 'chatre1', 'chatre2'].map((accountId) => {
              const accountNames: Record<string, string> = {
                liver: 'ライバー募集',
                chatre1: 'チャトレ募集①',
                chatre2: 'チャトレ募集②',
              };
              const posts = stockData.stocks?.[accountId] || [];
              const count = stockData.counts?.[accountId] || 0;
              const needsRefill = stockData.needsRefill?.includes(accountId);
              const accountStatus = accountsStatus.find((a: any) => a.account === accountId);
              const isConnected = accountStatus?.connected;

              return (
                <div key={accountId} style={{
                  padding: '16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '12px',
                  border: needsRefill ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                  {/* アカウント名 + 連携状態 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{accountNames[accountId]}</span>
                      {isConnected ? (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          background: 'rgba(34, 197, 94, 0.15)',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          borderRadius: '4px',
                          fontSize: '9px',
                          color: '#22c55e',
                        }}>
                          <Twitter size={10} />
                          連携済
                        </span>
                      ) : (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '4px',
                          fontSize: '9px',
                          color: '#ef4444',
                        }}>
                          <AlertTriangle size={10} />
                          未連携
                        </span>
                      )}
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      background: count >= 3 ? 'rgba(34, 197, 94, 0.2)' : count > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: count >= 3 ? '#22c55e' : count > 0 ? '#f59e0b' : '#ef4444',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}>
                      {count} / 3
                    </span>
                  </div>

                  {/* Twitter ハンドル */}
                  {accountStatus && (
                    <div style={{
                      fontSize: '11px',
                      color: '#666',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <Twitter size={12} color="#1da1f2" />
                      {accountStatus.handle}
                      {accountStatus.username && isConnected && (
                        <span style={{ color: '#22c55e' }}>(@{accountStatus.username})</span>
                      )}
                    </div>
                  )}

                  {posts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {posts.map((post: any, index: number) => (
                        <div key={post.id || index} style={{
                          padding: '10px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                          borderLeft: '3px solid #3b82f6',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                padding: '2px 6px',
                                background: 'rgba(139, 92, 246, 0.2)',
                                color: '#a78bfa',
                                borderRadius: '4px',
                                fontSize: '10px',
                              }}>
                                {post.target}
                              </span>
                              <span style={{
                                padding: '2px 6px',
                                background: 'rgba(59, 130, 246, 0.2)',
                                color: '#60a5fa',
                                borderRadius: '4px',
                                fontSize: '10px',
                              }}>
                                {post.benefit}
                              </span>
                            </div>
                            <span style={{
                              padding: '2px 6px',
                              background: post.score >= 8 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: post.score >= 8 ? '#22c55e' : '#f59e0b',
                              borderRadius: '4px',
                              fontSize: '10px',
                            }}>
                              {post.score}点
                            </span>
                          </div>
                          <p style={{
                            fontSize: '12px',
                            color: '#999',
                            lineHeight: '1.5',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {post.text}
                          </p>
                          <div style={{ fontSize: '10px', color: '#555', marginTop: '6px' }}>
                            生成: {new Date(post.createdAt || post.generatedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#666',
                      fontSize: '12px',
                    }}>
                      ストックなし
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '16px', fontSize: '11px', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={12} />
            自動補充: 毎日 06:00, 14:00 JST
          </div>
        </div>
      )}

      {/* コンテンツタイプカード */}
      <div className="content-grid" style={{ marginBottom: '24px' }}>
        {Object.entries(CONTENT_TYPES).map(([key, config]) => {
          const Icon = config.icon;
          const stats = status?.[key]?.stats || { today: 0, success: 0, lastRun: null };
          const isRunning = runningType === key;

          return (
            <div
              key={key}
              style={{
                padding: '20px',
                background: `linear-gradient(135deg, ${config.color}15 0%, ${config.color}08 100%)`,
                border: `1px solid ${config.color}44`,
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {isRunning && (
                <div className="progress-wave" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
                  backgroundSize: '200% 100%',
                }} />
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    padding: '10px',
                    background: config.gradient,
                    borderRadius: '12px',
                  }} className={isRunning ? 'pulse-dot' : 'float'}>
                    <Icon size={24} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 'bold', fontSize: '18px' }}>{config.label}</h3>
                    <p style={{ color: '#666', fontSize: '11px' }}>{config.description}</p>
                  </div>
                </div>
                <div style={{
                  padding: '4px 8px',
                  background: status?.[key]?.enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: status?.[key]?.enabled ? '#22c55e' : '#ef4444',
                  borderRadius: '8px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  {status?.[key]?.enabled && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e' }} className="pulse-dot" />}
                  {status?.[key]?.enabled ? 'ON' : 'OFF'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: config.color }}>
                    <AnimatedCounter value={stats.today} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#666' }}>今日</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e' }}>
                    <AnimatedCounter value={stats.success} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#666' }}>成功</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => runSingle(key as 'text' | 'image' | 'video', true)}
                  disabled={running}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${config.color}44`,
                    borderRadius: '8px',
                    color: config.color,
                    fontSize: '12px',
                    cursor: running ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Eye size={14} />
                  プレビュー
                </button>
                <button
                  onClick={() => runSingle(key as 'text' | 'image' | 'video', false)}
                  disabled={running}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: isRunning ? '#333' : config.gradient,
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: running ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {isRunning ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  {isRunning ? '実行中...' : '実行'}
                </button>
              </div>

              {stats.lastRun && (
                <div style={{ marginTop: '12px', fontSize: '10px', color: '#555', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} />
                  最終: {new Date(stats.lastRun).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 一括実行ボタン */}
      <div style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles size={20} color="#8b5cf6" className="spin-slow" />
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>全自動実行</span>
          </div>
          <button
            onClick={() => setAutoMode(!autoMode)}
            style={{
              padding: '8px 16px',
              background: autoMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              border: `1px solid ${autoMode ? '#22c55e' : '#f59e0b'}`,
              borderRadius: '8px',
              color: autoMode ? '#22c55e' : '#f59e0b',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {autoMode ? <Play size={14} /> : <Pause size={14} />}
            {autoMode ? 'AUTO ON' : 'AUTO OFF'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => runAll(true)}
            disabled={running}
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '14px 20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid #444',
              borderRadius: '12px',
              color: '#888',
              fontSize: '14px',
              cursor: running ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Eye size={18} />
            全てプレビュー
          </button>
          <button
            onClick={() => runAll(false)}
            disabled={running}
            style={{
              flex: 2,
              minWidth: '200px',
              padding: '14px 20px',
              background: running && runningType === 'all'
                ? '#333'
                : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: running ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            className={!running ? 'glow' : ''}
          >
            {running && runningType === 'all' ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Zap size={18} />
            )}
            {running && runningType === 'all' ? '全自動実行中...' : '全て実行'}
          </button>
        </div>
      </div>

      {/* 実行結果 */}
      {lastResult && (
        <div style={{
          padding: '20px',
          background: lastResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${lastResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            {lastResult.success ? (
              <CheckCircle size={24} color="#22c55e" />
            ) : (
              <XCircle size={24} color="#ef4444" />
            )}
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
              {lastResult.dryRun ? 'プレビュー結果' : lastResult.success ? '実行完了' : '実行失敗'}
            </span>
            {lastResult.processingTime && (
              <span style={{ color: '#666', fontSize: '12px' }}>({lastResult.processingTime}ms)</span>
            )}
          </div>

          {lastResult.results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {lastResult.results.map((r: any, i: number) => {
                const config = CONTENT_TYPES[r.type as keyof typeof CONTENT_TYPES];
                return (
                  <div key={i} style={{
                    padding: '12px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '10px',
                    borderLeft: `3px solid ${config?.color || '#666'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{
                        padding: '3px 8px',
                        background: `${config?.color}33`,
                        color: config?.color,
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                      }}>
                        {config?.label || r.type}
                      </span>
                      <span style={{
                        padding: '2px 6px',
                        background: r.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: r.success ? '#22c55e' : '#ef4444',
                        borderRadius: '4px',
                        fontSize: '10px',
                      }}>
                        {r.success ? 'OK' : 'NG'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {r.message || (r.success ? '完了' : r.error)}
                    </div>
                    {r.data?.script && (
                      <div style={{
                        marginTop: '8px',
                        padding: '10px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        maxHeight: '100px',
                        overflow: 'hidden',
                      }}>
                        {r.data.script}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {lastResult.error && !lastResult.results && (
            <div style={{ color: '#ef4444', fontSize: '13px' }}>
              Error: {lastResult.error}
            </div>
          )}
        </div>
      )}

      {/* スケジュール */}
      <div style={{
        padding: '20px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid #222',
        borderRadius: '16px',
        marginBottom: '24px',
      }}>
        <h3 style={{ fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} className="pulse-dot" />
          自動スケジュール
        </h3>

        {Object.entries(CONTENT_TYPES).map(([key, config]) => {
          const schedules = status?.schedules?.[key] || [];
          return (
            <div key={key} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: config.color }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{config.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {schedules.map((time: string, i: number) => (
                  <span key={i} style={{
                    padding: '4px 10px',
                    background: `${config.color}22`,
                    border: `1px solid ${config.color}44`,
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: config.color,
                  }}>
                    {time}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        <p style={{ fontSize: '11px', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={12} className="spin-slow" style={{ color: '#8b5cf6' }} />
          1日合計: テキスト18 + 画像3 + 動画2 = 23コンテンツ自動生成
        </p>
      </div>

      {/* クイックリンク */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Link href="/dm-hunter" style={{
          flex: 1,
          minWidth: '150px',
          padding: '12px 16px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          color: '#f59e0b',
          textDecoration: 'none',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageCircle size={16} />
            DM Hunter
          </span>
          <ChevronRight size={16} />
        </Link>
        <Link href="/settings" style={{
          flex: 1,
          minWidth: '150px',
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid #333',
          borderRadius: '12px',
          color: '#666',
          textDecoration: 'none',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={16} />
            設定
          </span>
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}

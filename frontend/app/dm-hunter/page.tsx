'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Target, CheckCircle, RefreshCw, Clock, TrendingUp, MessageCircle, Users, Eye,
  Send, Brain, Activity, Sparkles, MessageSquare, ChevronRight, BarChart3, Zap,
} from 'lucide-react';

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

const ACCOUNTS = [
  { id: 'liver', name: 'ライバー', handle: '@tt_liver', color: '#f59e0b' },
  { id: 'chatre1', name: 'チャトレ①', handle: '@mic_chat_', color: '#ec4899' },
  { id: 'chatre2', name: 'チャトレ②', handle: '@ms_stripchat', color: '#8b5cf6' },
];

interface AccountData {
  account: string;
  connected: boolean;
  username?: string;
  todayPosts: number;
  pendingPosts: number;
  successPosts: number;
  avgScore: number;
  stockCount: number;
}

interface MetricsData {
  totalImpressions: number;
  totalEngagement: number;
  dmCount: number;
  dmGoal: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [metrics, setMetrics] = useState<MetricsData>({ totalImpressions: 0, totalEngagement: 0, dmCount: 0, dmGoal: 3 });
  const [autoCollect, setAutoCollect] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [learningPatterns, setLearningPatterns] = useState(0);
  const [activityDots, setActivityDots] = useState<{ id: number; color: string }[]>([]);

  // 時計
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // アクティビティドット
  useEffect(() => {
    const addDot = () => {
      const colors = ['bg-amber-500', 'bg-pink-500', 'bg-violet-500', 'bg-green-500', 'bg-blue-500'];
      setActivityDots(prev => [...prev, { id: Date.now(), color: colors[Math.floor(Math.random() * colors.length)] }].slice(-8));
    };
    const interval = setInterval(addDot, 2000);
    addDot();
    return () => clearInterval(interval);
  }, []);

  // データ取得
  const fetchData = async () => {
    try {
      const [statusRes, stockRes, statsRes, patternsRes] = await Promise.all([
        fetch('/api/dm-hunter/auto-run'),
        fetch('/api/dm-hunter/stock'),
        fetch('/api/db/stats').catch(() => ({ json: () => ({}) })),
        fetch('/api/dm-hunter/success-patterns').catch(() => ({ json: () => ({ patterns: [] }) })),
      ]);

      const statusData = await statusRes.json();
      const stockData = await stockRes.json();
      const statsData = await statsRes.json() as { impressions?: { total?: number }, engagement?: { total?: number }, dm?: { todayDMs?: number, dailyGoal?: number } };
      const patternsData = await patternsRes.json?.() || { patterns: [] };

      // アカウントデータを整理
      const accountsData: AccountData[] = ACCOUNTS.map(acc => {
        const status = statusData.accounts?.find((a: any) => a.account === acc.id);
        const stockCount = stockData.counts?.[acc.id] || 0;
        return {
          account: acc.id,
          connected: status?.connected || false,
          username: status?.username,
          todayPosts: statusData.todayPosts || 0,
          pendingPosts: stockData.stocks?.filter((s: any) => s.account === acc.id && s.status === 'pending')?.length || 0,
          successPosts: statusData.todaySuccess || 0,
          avgScore: 7.5, // TODO: 実際の平均スコアを取得
          stockCount,
        };
      });

      setAccounts(accountsData);
      setMetrics({
        totalImpressions: statsData.impressions?.total || 0,
        totalEngagement: statsData.engagement?.total || 0,
        dmCount: statsData.dm?.todayDMs || 0,
        dmGoal: statsData.dm?.dailyGoal || 3,
      });
      setLearningPatterns(patternsData.patterns?.length || 0);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 自動収集トグル時にリフレッシュ
  const toggleAutoCollect = () => {
    setAutoCollect(!autoCollect);
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#111] flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-[-8px] border-2 border-amber-500/30 rounded-full animate-ping" />
            <RefreshCw className="animate-spin text-amber-500" size={32} />
          </div>
          <p className="text-gray-500 text-sm">データ読み込み中...</p>
        </div>
      </div>
    );
  }

  const totalStock = accounts.reduce((sum, a) => sum + a.stockCount, 0);
  const totalToday = accounts[0]?.todayPosts || 0;
  const totalSuccess = accounts[0]?.successPosts || 0;

  return (
    <div className="min-h-screen p-6 md:p-10 md:ml-64 max-w-5xl">
      {/* ヘッダー */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg bg-white/5 text-gray-500 hover:bg-white/10 transition-all md:hidden">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-xl md:text-2xl font-bold">AI</h1>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-500 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </span>
        </div>
        <span className="text-gray-400 font-mono text-lg">{currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
      </header>

      {/* アカウントカード */}
      <section className="mb-6">
        <h2 className="text-gray-400 text-sm font-medium mb-3">アカウント</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ACCOUNTS.map((acc, i) => {
            const data = accounts.find(a => a.account === acc.id);
            return (
              <div
                key={acc.id}
                className="relative p-4 bg-gradient-to-br from-white/[0.03] to-transparent border rounded-2xl transition-all hover:bg-white/[0.05]"
                style={{ borderColor: `${acc.color}40` }}
              >
                {/* 左側カラーバー */}
                <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full" style={{ backgroundColor: acc.color }} />

                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-3 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">手動</span>
                    <div className="relative w-10 h-5 bg-gray-800 rounded-full cursor-pointer">
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-gray-600 rounded-full transition-transform" />
                    </div>
                  </div>
                </div>

                {/* アカウント名 */}
                <div className="pl-3 mb-3">
                  <h3 className="font-bold text-lg">{acc.name}</h3>
                  <p className="text-gray-500 text-xs">{acc.handle}</p>
                </div>

                {/* 接続状態 */}
                <div className="pl-3 mb-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${data?.connected ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    {data?.connected ? '✓' : '✕'}
                  </span>
                </div>

                {/* 統計 */}
                <div className="grid grid-cols-3 gap-2 pl-3 mb-3">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: acc.color }}>
                      <AnimatedCounter value={i === 0 ? 34 : i === 1 ? 1 : 0} />
                    </div>
                    <div className="text-[10px] text-gray-600">投稿</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-500">
                      <AnimatedCounter value={i === 0 ? 34 : i === 1 ? 1 : 0} />
                    </div>
                    <div className="text-[10px] text-gray-600">待機</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-500">
                      <AnimatedCounter value={0} />
                    </div>
                    <div className="text-[10px] text-gray-600">済</div>
                  </div>
                </div>

                {/* スコアとストック */}
                <div className="flex items-center justify-between pl-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">平均スコア</span>
                    <span className="text-amber-500 font-bold">{i === 0 ? '7.7' : i === 1 ? '8.0' : '0.0'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">ストック</span>
                    <span className="font-bold" style={{ color: acc.color }}>{data?.stockCount || (i === 0 ? 5 : 3)}</span>
                  </div>
                </div>

                {/* プログレスバー */}
                <div className="mt-3 pl-3">
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(((data?.stockCount || 0) / 5) * 100, 100)}%`,
                        background: `linear-gradient(90deg, ${acc.color}, ${acc.color}88)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-end mt-1">
                    <div className="flex gap-0.5">
                      {['#f59e0b', '#ec4899', '#8b5cf6', '#22c55e'].map((c, j) => (
                        <div key={j} className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* リアルタイムメトリクス */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-400 text-sm font-medium">リアルタイムメトリクス</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoCollect}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${autoCollect ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-gray-800 text-gray-500'}`}
            >
              自動収集{autoCollect ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-all"
            >
              停止
            </button>
            {lastUpdated && (
              <span className="text-gray-600 text-xs">更新: {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 総インプレッション */}
          <div className="p-5 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] rounded-2xl">
            <div className="flex items-center gap-2 mb-2 text-gray-500">
              <Eye size={18} />
              <span className="text-xs">総インプレッション</span>
            </div>
            <div className="text-3xl font-bold text-white">
              <AnimatedCounter value={metrics.totalImpressions} />
            </div>
          </div>

          {/* 総エンゲージメント */}
          <div className="p-5 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] rounded-2xl">
            <div className="flex items-center gap-2 mb-2 text-gray-500">
              <MessageCircle size={18} />
              <span className="text-xs">総エンゲージメント</span>
            </div>
            <div className="text-3xl font-bold text-white">
              <AnimatedCounter value={metrics.totalEngagement} />
            </div>
          </div>

          {/* DM問い合わせ */}
          <div className="p-5 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl">
            <div className="flex items-center gap-2 mb-2 text-amber-500">
              <Target size={18} />
              <span className="text-xs">DM問い合わせ</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-500">
                <AnimatedCounter value={metrics.dmCount} />
              </span>
              <span className="text-gray-600">/ {metrics.dmGoal}</span>
            </div>
          </div>

          {/* AI学習パターン */}
          <div className="p-5 bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20 rounded-2xl">
            <div className="flex items-center gap-2 mb-2 text-violet-500">
              <Brain size={18} className="animate-pulse" />
              <span className="text-xs">成功パターン</span>
            </div>
            <div className="text-3xl font-bold text-violet-500">
              <AnimatedCounter value={learningPatterns} />
            </div>
          </div>
        </div>
      </section>

      {/* クイックアクション */}
      <section className="mb-6">
        <h2 className="text-gray-400 text-sm font-medium mb-3">クイックアクション</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/" className="flex items-center gap-3 p-4 bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/30 rounded-xl hover:bg-violet-500/20 transition-all">
            <MessageSquare size={20} className="text-violet-400" />
            <div>
              <div className="font-medium text-sm">AIチャット</div>
              <div className="text-[10px] text-gray-500">投稿生成・分析</div>
            </div>
          </Link>
          <Link href="/auto-hub" className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-500/15 to-green-500/5 border border-green-500/30 rounded-xl hover:bg-green-500/20 transition-all">
            <Zap size={20} className="text-green-400" />
            <div>
              <div className="font-medium text-sm">Auto Hub</div>
              <div className="text-[10px] text-gray-500">自動実行</div>
            </div>
          </Link>
          <button
            onClick={fetchData}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-500/30 rounded-xl hover:bg-blue-500/20 transition-all"
          >
            <RefreshCw size={20} className="text-blue-400" />
            <div className="text-left">
              <div className="font-medium text-sm">データ更新</div>
              <div className="text-[10px] text-gray-500">最新に同期</div>
            </div>
          </button>
          <Link href="/approval" className="flex items-center gap-3 p-4 bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-all">
            <CheckCircle size={20} className="text-amber-400" />
            <div>
              <div className="font-medium text-sm">投稿承認</div>
              <div className="text-[10px] text-gray-500">待機中を確認</div>
            </div>
          </Link>
        </div>
      </section>

      {/* 今日のサマリー */}
      <section className="p-5 bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.06] rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold flex items-center gap-2">
            <BarChart3 size={18} className="text-gray-500" />
            今日のサマリー
          </h2>
          <span className="text-xs text-gray-600">{new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-black/20 rounded-xl">
            <div className="text-3xl font-bold text-white"><AnimatedCounter value={totalToday} /></div>
            <div className="text-xs text-gray-500 mt-1">総投稿数</div>
          </div>
          <div className="text-center p-4 bg-black/20 rounded-xl">
            <div className="text-3xl font-bold text-green-500"><AnimatedCounter value={totalSuccess} /></div>
            <div className="text-xs text-gray-500 mt-1">成功</div>
          </div>
          <div className="text-center p-4 bg-black/20 rounded-xl">
            <div className="text-3xl font-bold text-blue-500"><AnimatedCounter value={totalStock} /></div>
            <div className="text-xs text-gray-500 mt-1">ストック</div>
          </div>
          <div className="text-center p-4 bg-black/20 rounded-xl">
            <div className="text-3xl font-bold text-amber-500"><AnimatedCounter value={metrics.dmCount} /></div>
            <div className="text-xs text-gray-500 mt-1">DM獲得</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-violet-500 spin-slow" />
            AIが24時間自動で投稿を最適化中
          </div>
          <div className="flex items-center gap-1">
            {activityDots.map(dot => (
              <div key={dot.id} className={`w-1.5 h-1.5 rounded-full ${dot.color} opacity-70`} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

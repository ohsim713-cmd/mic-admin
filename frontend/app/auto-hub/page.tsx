'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Zap, MessageCircle, MessageSquare, Image, Video, Play, Pause, RefreshCw,
  CheckCircle, XCircle, Clock, TrendingUp, Brain, Activity, Sparkles, Settings,
  ChevronRight, ChevronDown, ChevronUp, Eye, Database, Cpu, Package, Twitter, AlertTriangle,
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

const CONTENT_TYPES = {
  text: {
    icon: MessageCircle,
    label: 'テキスト',
    description: 'DM Hunter - Twitter自動投稿',
    color: 'amber',
    colorHex: '#f59e0b',
  },
  image: {
    icon: Image,
    label: '画像',
    description: 'Instagram - ネイル画像生成',
    color: 'pink',
    colorHex: '#ec4899',
  },
  video: {
    icon: Video,
    label: '動画',
    description: 'Shorts - スクリプト生成',
    color: 'green',
    colorHex: '#22c55e',
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
      const colors = ['bg-amber-500', 'bg-pink-500', 'bg-green-500', 'bg-violet-500', 'bg-blue-500'];
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

      const stocksByAccount: Record<string, any[]> = { liver: [], chatre1: [], chatre2: [] };
      if (stockDataRes.stocks) {
        for (const stock of stockDataRes.stocks) {
          if (stocksByAccount[stock.account]) stocksByAccount[stock.account].push(stock);
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
        const stockRes = await fetch('/api/dm-hunter/stock');
        const stockDataRes = await stockRes.json();
        const stocksByAccount: Record<string, any[]> = { liver: [], chatre1: [], chatre2: [] };
        if (stockDataRes.stocks) {
          for (const stock of stockDataRes.stocks) {
            if (stocksByAccount[stock.account]) stocksByAccount[stock.account].push(stock);
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

  useEffect(() => { fetchData(); }, []);

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
      <div className="min-h-screen p-6 md:p-10 md:ml-64 max-w-5xl flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-green-500 flex items-center justify-center animate-pulse">
              <Cpu size={40} className="text-white" />
            </div>
          </div>
          <p className="text-gray-500 text-sm">AIシステム起動中...</p>
          <div className="flex justify-center gap-2 mt-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  backgroundColor: ['#f59e0b', '#ec4899', '#22c55e', '#8b5cf6', '#3b82f6'][i % 5],
                  animationDelay: `${i * 0.15}s`,
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
    <div className="min-h-screen p-6 md:p-10 md:ml-64 max-w-5xl">
      {/* ライブステータスバー */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-green-500/10 border border-violet-500/20 rounded-xl mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${autoMode ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
            <span className={`font-bold text-xs ${autoMode ? 'text-green-500' : 'text-amber-500'}`}>
              {autoMode ? 'AUTO' : 'MANUAL'}
            </span>
          </div>
          <span className="text-gray-700">|</span>
          <div className="flex items-center gap-1">
            <Activity size={14} className="text-violet-500 animate-pulse" />
            <span className="text-violet-500 font-mono text-xs">{currentTime.toLocaleTimeString('ja-JP')}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {activityDots.map(dot => (
            <div key={dot.id} className={`w-1.5 h-1.5 rounded-full ${dot.color} opacity-70`} />
          ))}
        </div>
      </div>

      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 via-blue-500 to-green-500 animate-float">
            <Zap size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold flex items-center gap-2.5">
              Auto Hub
              <span className="px-2.5 py-1 bg-gradient-to-r from-violet-500 to-blue-500 rounded-xl text-[11px] font-normal glow">
                全自動 AI
              </span>
            </h1>
            <p className="text-gray-500 text-[13px]">テキスト・画像・動画を一括自動生成</p>
          </div>
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {/* 今日の生成 */}
        <div className="relative overflow-hidden p-5 bg-gradient-to-br from-violet-500/15 to-violet-500/5 border border-violet-500/30 rounded-2xl">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-progress-wave" />
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-violet-500" />
            <span className="text-gray-500 text-xs">今日の生成</span>
          </div>
          <div className="text-4xl font-bold text-violet-500"><AnimatedCounter value={totalToday} /></div>
          <div className="text-[11px] text-gray-600">コンテンツ</div>
        </div>

        {/* 成功 */}
        <div className="relative overflow-hidden p-5 bg-gradient-to-br from-green-500/15 to-green-500/5 border border-green-500/30 rounded-2xl">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-progress-wave" />
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-green-500" />
            <span className="text-gray-500 text-xs">成功</span>
          </div>
          <div className="text-4xl font-bold text-green-500"><AnimatedCounter value={totalSuccess} /></div>
          <div className="text-[11px] text-gray-600">完了</div>
        </div>

        {/* ストック */}
        <div
          onClick={() => setStockExpanded(!stockExpanded)}
          className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-500/30 rounded-2xl cursor-pointer hover:bg-blue-500/20 transition-all"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-progress-wave" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-blue-500" />
              <span className="text-gray-500 text-xs">ストック</span>
            </div>
            {stockExpanded ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />}
          </div>
          <div className="text-4xl font-bold text-blue-500">
            <AnimatedCounter value={(stockData?.counts?.liver || 0) + (stockData?.counts?.chatre1 || 0) + (stockData?.counts?.chatre2 || 0)} />
          </div>
          <div className="text-[11px] text-gray-600">準備済み投稿</div>
        </div>

        {/* AI学習 */}
        <div className="relative overflow-hidden p-5 bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/30 rounded-2xl">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-progress-wave" />
          <div className="flex items-center gap-2 mb-2">
            <Brain size={18} className="text-amber-500 animate-pulse" />
            <span className="text-gray-500 text-xs">AI学習</span>
          </div>
          <div className="text-4xl font-bold text-amber-500"><AnimatedCounter value={status?.patternCount || 0} /></div>
          <div className="text-[11px] text-gray-600">成功パターン</div>
        </div>
      </div>

      {/* ストック詳細セクション */}
      {stockExpanded && stockData && (
        <div className="p-5 bg-gradient-to-br from-blue-500/[0.08] to-blue-500/[0.02] border border-blue-500/20 rounded-2xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2">
              <Package size={18} className="text-blue-500" />
              投稿ストック詳細
            </h3>
            <button
              onClick={refillStock}
              disabled={refillLoading}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-violet-500 rounded-lg text-white text-xs flex items-center gap-1.5 disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} className={refillLoading ? 'animate-spin' : ''} />
              {refillLoading ? '補充中...' : 'ストック補充'}
            </button>
          </div>

          {/* アカウント別ストック */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div key={accountId} className={`p-4 bg-black/20 rounded-xl border ${needsRefill ? 'border-amber-500/40' : 'border-white/5'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{accountNames[accountId]}</span>
                      {isConnected ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded text-[9px] text-green-500">
                          <Twitter size={10} /> 連携済
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/15 border border-red-500/30 rounded text-[9px] text-red-500">
                          <AlertTriangle size={10} /> 未連携
                        </span>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${count >= 3 ? 'bg-green-500/20 text-green-500' : count > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'}`}>
                      {count} / 3
                    </span>
                  </div>

                  {accountStatus && (
                    <div className="text-[11px] text-gray-600 mb-2.5 flex items-center gap-1">
                      <Twitter size={12} className="text-[#1da1f2]" />
                      {accountStatus.handle}
                      {accountStatus.username && isConnected && <span className="text-green-500">(@{accountStatus.username})</span>}
                    </div>
                  )}

                  {posts.length > 0 ? (
                    <div className="space-y-2">
                      {posts.map((post: any, index: number) => (
                        <div key={post.id || index} className="p-2.5 bg-white/[0.03] rounded-lg border-l-[3px] border-blue-500">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded text-[10px]">{post.target}</span>
                              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">{post.benefit}</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${post.score >= 8 ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}`}>
                              {post.score}点
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{post.text}</p>
                          <div className="text-[10px] text-gray-600 mt-1.5">
                            生成: {new Date(post.createdAt || post.generatedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-5 text-center text-gray-600 text-xs">ストックなし</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-[11px] text-gray-600 flex items-center gap-1.5">
            <Clock size={12} />
            自動補充: 毎日 06:00, 14:00 JST
          </div>
        </div>
      )}

      {/* コンテンツタイプカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(CONTENT_TYPES).map(([key, config]) => {
          const Icon = config.icon;
          const stats = status?.[key]?.stats || { today: 0, success: 0, lastRun: null };
          const isRunning = runningType === key;
          const colorMap = {
            amber: { bg: 'from-amber-500/15 to-amber-500/[0.08]', border: 'border-amber-500/40', text: 'text-amber-500', btnBg: 'from-amber-500 to-orange-600' },
            pink: { bg: 'from-pink-500/15 to-pink-500/[0.08]', border: 'border-pink-500/40', text: 'text-pink-500', btnBg: 'from-pink-500 to-violet-500' },
            green: { bg: 'from-green-500/15 to-green-500/[0.08]', border: 'border-green-500/40', text: 'text-green-500', btnBg: 'from-green-500 to-blue-500' },
          };
          const colorClasses = colorMap[config.color as keyof typeof colorMap] || colorMap.amber;

          return (
            <div key={key} className={`relative overflow-hidden p-5 bg-gradient-to-br ${colorClasses.bg} border ${colorClasses.border} rounded-2xl`}>
              {isRunning && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent animate-progress-wave" style={{ color: config.colorHex }} />}

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 bg-gradient-to-br ${colorClasses.btnBg} rounded-xl ${isRunning ? 'animate-pulse' : 'animate-float'}`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{config.label}</h3>
                    <p className="text-gray-600 text-[11px]">{config.description}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 ${status?.[key]?.enabled ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {status?.[key]?.enabled && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                  {status?.[key]?.enabled ? 'ON' : 'OFF'}
                </div>
              </div>

              <div className="flex gap-4 mb-4">
                <div>
                  <div className={`text-[28px] font-bold ${colorClasses.text}`}><AnimatedCounter value={stats.today} /></div>
                  <div className="text-[10px] text-gray-600">今日</div>
                </div>
                <div>
                  <div className="text-[28px] font-bold text-green-500"><AnimatedCounter value={stats.success} /></div>
                  <div className="text-[10px] text-gray-600">成功</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => runSingle(key as 'text' | 'image' | 'video', true)}
                  disabled={running}
                  className={`flex-1 py-2.5 bg-white/5 border ${colorClasses.border} rounded-lg ${colorClasses.text} text-xs flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Eye size={14} /> プレビュー
                </button>
                <button
                  onClick={() => runSingle(key as 'text' | 'image' | 'video', false)}
                  disabled={running}
                  className={`flex-1 py-2.5 bg-gradient-to-br ${colorClasses.btnBg} rounded-lg text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:bg-gray-700`}
                >
                  {isRunning ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  {isRunning ? '実行中...' : '実行'}
                </button>
              </div>

              {stats.lastRun && (
                <div className="mt-3 text-[10px] text-gray-600 flex items-center gap-1">
                  <Clock size={10} />
                  最終: {new Date(stats.lastRun).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 一括実行ボタン */}
      <div className="p-6 bg-gradient-to-br from-violet-500/10 to-blue-500/5 border border-violet-500/30 rounded-2xl mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-violet-500 spin-slow" />
            <span className="font-bold text-base">全自動実行</span>
          </div>
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`px-4 py-2 border rounded-lg text-xs flex items-center gap-1.5 ${autoMode ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-amber-500/20 border-amber-500 text-amber-500'}`}
          >
            {autoMode ? <Play size={14} /> : <Pause size={14} />}
            {autoMode ? 'AUTO ON' : 'AUTO OFF'}
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => runAll(true)}
            disabled={running}
            className="flex-1 min-w-[140px] py-3.5 px-5 bg-white/5 border border-gray-700 rounded-xl text-gray-500 text-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            <Eye size={18} /> 全てプレビュー
          </button>
          <button
            onClick={() => runAll(false)}
            disabled={running}
            className={`flex-[2] min-w-[200px] py-3.5 px-5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:cursor-not-allowed ${running && runningType === 'all' ? 'bg-gray-700' : 'bg-gradient-to-r from-violet-500 to-blue-500 glow'}`}
          >
            {running && runningType === 'all' ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
            {running && runningType === 'all' ? '全自動実行中...' : '全て実行'}
          </button>
        </div>
      </div>

      {/* 実行結果 */}
      {lastResult && (
        <div className={`p-5 rounded-2xl mb-6 ${lastResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          <div className="flex items-center gap-2.5 mb-4">
            {lastResult.success ? <CheckCircle size={24} className="text-green-500" /> : <XCircle size={24} className="text-red-500" />}
            <span className="font-bold text-base">
              {lastResult.dryRun ? 'プレビュー結果' : lastResult.success ? '実行完了' : '実行失敗'}
            </span>
            {lastResult.processingTime && <span className="text-gray-600 text-xs">({lastResult.processingTime}ms)</span>}
          </div>

          {lastResult.results && (
            <div className="space-y-3">
              {lastResult.results.map((r: any, i: number) => {
                const config = CONTENT_TYPES[r.type as keyof typeof CONTENT_TYPES];
                return (
                  <div key={i} className="p-3 bg-black/20 rounded-lg border-l-[3px]" style={{ borderColor: config?.colorHex || '#666' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ backgroundColor: `${config?.colorHex}33`, color: config?.colorHex }}>
                        {config?.label || r.type}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.success ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {r.success ? 'OK' : 'NG'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{r.message || (r.success ? '完了' : r.error)}</div>
                    {r.data?.script && (
                      <div className="mt-2 p-2.5 bg-black/30 rounded-md text-xs leading-relaxed max-h-[100px] overflow-hidden">
                        {r.data.script}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {lastResult.error && !lastResult.results && (
            <div className="text-red-500 text-[13px]">Error: {lastResult.error}</div>
          )}
        </div>
      )}

      {/* スケジュール */}
      <div className="p-5 bg-white/[0.02] border border-gray-800 rounded-2xl mb-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Clock size={18} className="animate-pulse" />
          自動スケジュール
        </h3>

        {Object.entries(CONTENT_TYPES).map(([key, config]) => {
          const schedules = status?.schedules?.[key] || [];
          return (
            <div key={key} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.colorHex }} />
                <span className="text-[13px] font-bold">{config.label}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {schedules.map((time: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 rounded-md text-[11px]" style={{ backgroundColor: `${config.colorHex}22`, border: `1px solid ${config.colorHex}44`, color: config.colorHex }}>
                    {time}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        <p className="text-[11px] text-gray-600 flex items-center gap-1.5">
          <Sparkles size={12} className="text-violet-500 spin-slow" />
          1日合計: テキスト18 + 画像3 + 動画2 = 23コンテンツ自動生成
        </p>
      </div>

      {/* クイックリンク */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/" className="flex-1 min-w-[150px] px-4 py-3 bg-gradient-to-r from-violet-500/15 to-blue-500/15 border border-violet-500/40 rounded-xl text-violet-400 text-[13px] flex items-center justify-between hover:bg-violet-500/20 transition-all">
          <span className="flex items-center gap-2">
            <MessageSquare size={16} /> AIチャット
          </span>
          <ChevronRight size={16} />
        </Link>
        <Link href="/dm-hunter" className="flex-1 min-w-[150px] px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-[13px] flex items-center justify-between hover:bg-amber-500/20 transition-all">
          <span className="flex items-center gap-2">
            <MessageCircle size={16} /> DM Hunter
          </span>
          <ChevronRight size={16} />
        </Link>
        <Link href="/settings" className="flex-1 min-w-[150px] px-4 py-3 bg-white/[0.02] border border-gray-700 rounded-xl text-gray-500 text-[13px] flex items-center justify-between hover:bg-white/5 transition-all">
          <span className="flex items-center gap-2">
            <Settings size={16} /> 設定
          </span>
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}

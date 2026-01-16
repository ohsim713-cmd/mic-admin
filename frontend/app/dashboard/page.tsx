'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Network, Radio, Brain, CheckCircle, AlertTriangle,
  Crown, Shield, Megaphone, Sparkles,
  MessageCircle, TrendingUp, Globe,
  PenTool, Lightbulb, Layers,
  RefreshCw, Target, Search,
  Database, Users, Eye,
  Video, Bot, ChevronDown, ChevronUp,
  Mail, Send, BarChart3
} from 'lucide-react';

// Dynamic import to avoid SSR issues with React Flow
const OrganizationFlow = dynamic(() => import('./OrganizationFlow'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">組織図を読み込み中...</p>
      </div>
    </div>
  ),
});

// ========================================
// Mobile Organization View
// ========================================

const CLUSTERS = {
  executive: { name: 'Executive', color: '#8b5cf6', agents: [
    { id: 'ceo', name: '社長', role: 'CEO', icon: Crown },
    { id: 'cmo', name: 'CMO', role: 'マーケティング統括', icon: Megaphone },
    { id: 'coo', name: '番頭', role: '最高執行責任者', icon: Shield },
    { id: 'creative_lead', name: 'Creative', role: 'クリエイティブ統括', icon: Sparkles },
  ]},
  marketing: { name: 'Marketing', color: '#06b6d4', agents: [
    { id: 'dm_responder', name: 'DM対応', role: 'DM自動応答', icon: MessageCircle },
    { id: 'trend_analyst', name: 'トレンド分析', role: 'トレンド検知', icon: TrendingUp },
    { id: 'affiliate', name: 'アフィリエイト', role: 'アフィリエイト', icon: Globe },
  ]},
  creative: { name: 'Creative', color: '#f59e0b', agents: [
    { id: 'copywriter', name: 'コピーライター', role: 'コピー作成', icon: PenTool },
    { id: 'empathizer', name: 'エンパサイザー', role: '共感設計', icon: Lightbulb },
    { id: 'post_pattern', name: 'パターンマスター', role: 'パターン生成', icon: Layers },
  ]},
  operations: { name: 'Operations', color: '#10b981', agents: [
    { id: 'pdca_analyst', name: 'PDCA分析', role: 'PDCA改善', icon: RefreshCw },
    { id: 'strategy_planner', name: '戦略立案', role: '長期戦略', icon: Target },
    { id: 'seo', name: 'SEO', role: 'WordPress/SEO', icon: Search },
  ]},
  analytics: { name: 'Analytics', color: '#3b82f6', agents: [
    { id: 'knowledge_expert', name: 'ナレッジ', role: '知識管理', icon: Database },
    { id: 'benefit_mapper', name: 'ベネフィット', role: 'ターゲット分析', icon: Users },
    { id: 'researcher', name: 'リサーチャー', role: '市場調査', icon: Eye },
  ]},
  customer: { name: 'Customer', color: '#ec4899', agents: [
    { id: 'video_director', name: '動画監督', role: '動画制作', icon: Video },
    { id: 'multi_scout', name: 'マルチスカウト', role: 'マルチ調査', icon: Search },
    { id: 'scraper', name: 'スクレイパー', role: 'データ収集', icon: Bot },
  ]},
};

function MobileOrgView() {
  const [expandedCluster, setExpandedCluster] = useState<string | null>('executive');

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      {/* CEO Card - Always visible */}
      <div
        className="p-4 rounded-xl border-2"
        style={{
          background: 'linear-gradient(135deg, #8b5cf625, #8b5cf610)',
          borderColor: '#8b5cf6',
          boxShadow: '0 0 20px #8b5cf630'
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#8b5cf630]">
            <Crown size={24} className="text-[#8b5cf6]" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">社長</h3>
            <p className="text-xs text-zinc-400">CEO - 最高経営責任者</p>
          </div>
          <div className="ml-auto w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* Cluster accordions */}
      {Object.entries(CLUSTERS).filter(([key]) => key !== 'executive').map(([key, cluster]) => (
        <div key={key} className="rounded-xl border border-zinc-800 overflow-hidden">
          <button
            onClick={() => setExpandedCluster(expandedCluster === key ? null : key)}
            className="w-full flex items-center justify-between p-3 bg-zinc-900/50"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cluster.color }}
              />
              <span className="font-medium text-white">{cluster.name}</span>
              <span className="text-xs text-zinc-500">({cluster.agents.length})</span>
            </div>
            {expandedCluster === key ? (
              <ChevronUp size={18} className="text-zinc-400" />
            ) : (
              <ChevronDown size={18} className="text-zinc-400" />
            )}
          </button>

          {expandedCluster === key && (
            <div className="p-2 space-y-2 bg-zinc-950/50">
              {cluster.agents.map((agent) => {
                const Icon = agent.icon;
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-2 rounded-lg"
                    style={{ backgroundColor: `${cluster.color}10` }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${cluster.color}20` }}
                    >
                      <Icon size={16} style={{ color: cluster.color }} />
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm">{agent.name}</h4>
                      <p className="text-[10px] text-zinc-500">{agent.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Executive team (CMO, COO, Creative) */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <button
          onClick={() => setExpandedCluster(expandedCluster === 'executive' ? null : 'executive')}
          className="w-full flex items-center justify-between p-3 bg-zinc-900/50"
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#8b5cf6]" />
            <span className="font-medium text-white">Executive Team</span>
            <span className="text-xs text-zinc-500">(3)</span>
          </div>
          {expandedCluster === 'executive' ? (
            <ChevronUp size={18} className="text-zinc-400" />
          ) : (
            <ChevronDown size={18} className="text-zinc-400" />
          )}
        </button>

        {expandedCluster === 'executive' && (
          <div className="p-2 space-y-2 bg-zinc-950/50">
            {CLUSTERS.executive.agents.filter(a => a.id !== 'ceo').map((agent) => {
              const Icon = agent.icon;
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-[#8b5cf610]"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8b5cf620]">
                    <Icon size={16} className="text-[#8b5cf6]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white text-sm">{agent.name}</h4>
                    <p className="text-[10px] text-zinc-500">{agent.role}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// Activity Feed Component
// ========================================

interface ActivityItem {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  type: 'info' | 'success' | 'warning' | 'thinking';
}

function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <div className="h-full rounded-xl bg-zinc-900/90 border border-zinc-800/50 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/50 shrink-0">
        <Radio size={14} className="text-cyan-400" />
        <span className="text-sm font-medium text-zinc-300">LIVE FEED</span>
        <div className="w-2 h-2 rounded-full bg-green-500 ml-auto animate-pulse" />
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {activities.slice(-15).reverse().map((activity) => (
          <div
            key={activity.id}
            className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
              activity.type === 'success' ? 'bg-green-500/10' :
              activity.type === 'warning' ? 'bg-amber-500/10' :
              activity.type === 'thinking' ? 'bg-cyan-500/10' :
              'bg-zinc-800/30'
            }`}
          >
            {activity.type === 'thinking' && <Brain size={12} className="text-cyan-400 mt-0.5 shrink-0" />}
            {activity.type === 'success' && <CheckCircle size={12} className="text-green-400 mt-0.5 shrink-0" />}
            {activity.type === 'warning' && <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />}
            {activity.type === 'info' && <Radio size={12} className="text-zinc-400 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-300">{activity.agent}</span>
                <span className="text-[10px] text-zinc-600">
                  {new Date(activity.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-zinc-500 truncate">{activity.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========================================
// KPI Panel Component
// ========================================

interface KPIData {
  inquiries: { today: number; thisMonth: number };
  posts: { today: number; thisMonth: number };
  impressions: { today: number; total: number };
}

function KPIPanel() {
  const [kpi, setKpi] = useState<KPIData | null>(null);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const res = await fetch('/api/kpi');
        const data = await res.json();
        setKpi(data.kpi);
      } catch {
        // エラーは無視
      }
    };

    fetchKPI();
    const interval = setInterval(fetchKPI, 30000); // 30秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      icon: Mail,
      label: '問い合わせ',
      today: kpi?.inquiries?.today || 0,
      month: kpi?.inquiries?.thisMonth || 0,
      target: 3,
      color: '#10b981',
    },
    {
      icon: Send,
      label: '投稿数',
      today: kpi?.posts?.today || 0,
      month: kpi?.posts?.thisMonth || 0,
      target: 15,
      color: '#3b82f6',
    },
    {
      icon: BarChart3,
      label: 'インプレ',
      today: kpi?.impressions?.today || 0,
      month: Math.round((kpi?.impressions?.total || 0) / 1000),
      target: 15000,
      color: '#f59e0b',
      suffix: 'K',
    },
  ];

  return (
    <div className="flex gap-2 p-2 bg-zinc-900/50 border-b border-zinc-800/50">
      {cards.map((card) => {
        const Icon = card.icon;
        const progressPercent = card.label === '問い合わせ'
          ? Math.round((card.month / card.target) * 100)
          : Math.round((card.today / card.target) * 100);

        return (
          <div
            key={card.label}
            className="flex-1 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} style={{ color: card.color }} />
              <span className="text-[10px] text-zinc-400">{card.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-white">{card.today}</span>
              <span className="text-[10px] text-zinc-500">今日{card.suffix || ''}</span>
              <span className="text-[10px] text-zinc-600 ml-auto">
                月{card.month}{card.suffix || ''}
              </span>
            </div>
            <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, progressPercent)}%`,
                  backgroundColor: card.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========================================
// Main Dashboard Component
// ========================================

const AGENTS = [
  '社長', '番頭', 'CMO', 'Creative',
  'DM対応', 'トレンド分析', 'アフィリエイト',
  'PDCA分析', '戦略立案', 'SEO',
  'ナレッジ', 'ベネフィット', 'リサーチャー',
  'コピーライター', 'エンパサイザー', 'パターンマスター',
  '動画監督', 'マルチスカウト', 'スクレイパー'
];

export default function OrganizationDashboard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Ensure client-side only rendering & detect mobile
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize activities and simulate agent activity
  useEffect(() => {
    setActivities([
      { id: '1', timestamp: new Date().toISOString(), agent: '番頭', action: 'システム起動完了', type: 'success' },
      { id: '2', timestamp: new Date().toISOString(), agent: 'System', action: '全エージェント監視開始', type: 'info' },
    ]);

    const interval = setInterval(() => {
      const randomAgent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const actions = [
        { action: 'タスクを受信', type: 'thinking' as const },
        { action: '処理完了', type: 'success' as const },
        { action: 'データを更新', type: 'info' as const },
        { action: '分析実行中', type: 'thinking' as const },
        { action: 'レポート生成', type: 'success' as const },
      ];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      setActivities(prev => [...prev.slice(-20), {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        agent: randomAgent,
        ...randomAction,
      }]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen w-full bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Network size={28} className="text-cyan-400" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              ORGANIZATION MAP
            </h1>
            <p className="text-[10px] sm:text-xs text-zinc-500">19 AI Agents</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-zinc-400">LIVE</span>
          </div>
          <div className="text-right">
            <div className="text-base sm:text-lg font-mono text-cyan-400">
              {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[10px] text-zinc-600">
              {currentTime.toLocaleDateString('ja-JP')}
            </div>
          </div>
        </div>
      </header>

      {/* KPI Panel */}
      <KPIPanel />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Organization View - React Flow on desktop, Accordion on mobile */}
        <div className="flex-1 relative overflow-hidden" style={{ minHeight: '400px' }}>
          {isMobile ? (
            <MobileOrgView />
          ) : (
            <div className="absolute inset-0 w-full h-full">
              <OrganizationFlow />
            </div>
          )}
        </div>

        {/* Activity Feed - Hidden on mobile, sidebar on desktop */}
        {!isMobile && (
          <div className="w-72 shrink-0 border-l border-zinc-800/50 bg-[#09090b]">
            <ActivityFeed activities={activities} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-zinc-800/50 shrink-0">
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
            <span>Executive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
            <span>Marketing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            <span>Creative</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span>Operations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
            <span>Analytics</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ec4899]" />
            <span>Customer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  Mail, Send, BarChart3, Activity
} from 'lucide-react';

// Dynamic import to avoid SSR issues with React Flow
const OrganizationFlow = dynamic(() => import('./OrganizationFlow'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-500 text-sm">組織図を読み込み中...</p>
      </div>
    </div>
  ),
});

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
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200">
        <Activity size={16} className="text-orange-500" />
        <span className="text-sm font-medium text-stone-700">アクティビティ</span>
        <div className="w-2 h-2 rounded-full bg-green-500 ml-auto animate-pulse" />
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {activities.slice(-15).reverse().map((activity) => (
          <div
            key={activity.id}
            className={`flex items-start gap-3 p-3 rounded-xl text-sm transition-all ${
              activity.type === 'success' ? 'bg-green-50' :
              activity.type === 'warning' ? 'bg-amber-50' :
              activity.type === 'thinking' ? 'bg-blue-50' :
              'bg-stone-50'
            }`}
          >
            {activity.type === 'thinking' && <Brain size={14} className="text-blue-500 mt-0.5 shrink-0" />}
            {activity.type === 'success' && <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />}
            {activity.type === 'warning' && <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />}
            {activity.type === 'info' && <Radio size={14} className="text-stone-400 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-stone-800">{activity.agent}</span>
                <span className="text-xs text-stone-400">
                  {new Date(activity.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-stone-600 text-xs mt-0.5">{activity.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========================================
// KPI Card Component
// ========================================

interface KPIData {
  inquiries: { today: number; thisMonth: number };
  posts: { today: number; thisMonth: number };
  impressions: { today: number; total: number };
}

function KPICards() {
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
    const interval = setInterval(fetchKPI, 30000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      icon: Mail,
      label: '問い合わせ',
      today: kpi?.inquiries?.today || 0,
      month: kpi?.inquiries?.thisMonth || 0,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: Send,
      label: '投稿数',
      today: kpi?.posts?.today || 0,
      month: kpi?.posts?.thisMonth || 0,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: BarChart3,
      label: 'インプレッション',
      today: kpi?.impressions?.today || 0,
      month: Math.round((kpi?.impressions?.total || 0) / 1000),
      suffix: 'K',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white rounded-2xl border border-stone-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                <Icon size={20} className={card.color} />
              </div>
              <span className="text-sm text-stone-500">{card.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-stone-800">{card.today}</span>
              <span className="text-sm text-stone-400">今日{card.suffix || ''}</span>
            </div>
            <div className="text-xs text-stone-400 mt-1">
              月間: {card.month}{card.suffix || ''}
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

  useEffect(() => {
    setMounted(true);
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
      <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-stone-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-stone-50 text-stone-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Network size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-stone-800">
                Organization Map
              </h1>
              <p className="text-xs text-stone-400">19 AI Agents</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-700">Live</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono text-stone-700">
                {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-xs text-stone-400">
                {currentTime.toLocaleDateString('ja-JP')}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Organization Flow */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* KPI Cards */}
          <div className="mb-6">
            <KPICards />
          </div>

          {/* Organization Flow */}
          <div className="flex-1 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="h-full w-full">
              <OrganizationFlow />
            </div>
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="w-80 bg-white border-l border-stone-200 flex flex-col">
          <ActivityFeed activities={activities} />
        </div>
      </div>

      {/* Footer Legend */}
      <footer className="bg-white border-t border-stone-200 px-6 py-3">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-stone-500">
          {[
            { name: 'Executive', color: 'bg-violet-500' },
            { name: 'Marketing', color: 'bg-cyan-500' },
            { name: 'Creative', color: 'bg-amber-500' },
            { name: 'Operations', color: 'bg-emerald-500' },
            { name: 'Analytics', color: 'bg-blue-500' },
            { name: 'Customer', color: 'bg-pink-500' },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}

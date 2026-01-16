'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Crown, Shield, Megaphone, Sparkles,
  MessageCircle, TrendingUp, Globe,
  PenTool, Lightbulb, Layers,
  RefreshCw, Target, Search,
  Database, Users, Eye,
  Video, Bot, Zap
} from 'lucide-react';

// ========================================
// Types
// ========================================

interface AgentNodeData {
  name: string;
  role: string;
  cluster: string;
  color: string;
  icon: string;
  isActive?: boolean;
  currentAction?: string;
  lastActivity?: string;
}

interface AgentActivity {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action: string;
  tool?: string;
  status: 'thinking' | 'executing' | 'success' | 'error';
}

// ========================================
// Custom Node Components
// ========================================

const iconMap: Record<string, any> = {
  Crown, Shield, Megaphone, Sparkles,
  MessageCircle, TrendingUp, Globe,
  PenTool, Lightbulb, Layers,
  RefreshCw, Target, Search,
  Database, Users, Eye,
  Video, Bot
};

function AgentNode({ data }: { data: AgentNodeData }) {
  const Icon = iconMap[data.icon] || Zap;
  const isActive = data.isActive;

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[140px] transition-all duration-300 relative ${
        isActive ? 'animate-pulse' : ''
      }`}
      style={{
        background: `linear-gradient(135deg, ${data.color}15, ${data.color}08)`,
        borderColor: isActive ? data.color : `${data.color}40`,
        boxShadow: isActive ? `0 0 25px ${data.color}50` : 'none',
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping"
          style={{ backgroundColor: data.color }}
        />
      )}
      {isActive && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ backgroundColor: data.color }}
        />
      )}

      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            backgroundColor: `${data.color}20`,
            boxShadow: isActive ? `0 0 10px ${data.color}` : 'none'
          }}
        >
          <Icon size={16} style={{ color: data.color }} />
        </div>
        <span className="font-bold text-white text-sm">{data.name}</span>
      </div>
      <p className="text-[10px] text-zinc-400 pl-9">{data.role}</p>

      {/* Current action */}
      {isActive && data.currentAction && (
        <div
          className="mt-2 px-2 py-1 rounded text-[9px] font-medium truncate"
          style={{ backgroundColor: `${data.color}20`, color: data.color }}
        >
          {data.currentAction}
        </div>
      )}
    </div>
  );
}

function CEONode({ data }: { data: AgentNodeData }) {
  const Icon = iconMap[data.icon] || Crown;
  const isActive = data.isActive;

  return (
    <div
      className={`px-6 py-4 rounded-2xl border-2 min-w-[180px] relative transition-all duration-300 ${
        isActive ? 'animate-pulse' : ''
      }`}
      style={{
        background: `linear-gradient(135deg, ${data.color}25, ${data.color}10)`,
        borderColor: data.color,
        boxShadow: isActive
          ? `0 0 40px ${data.color}50`
          : `0 0 30px ${data.color}30`,
      }}
    >
      {isActive && (
        <div
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full animate-ping"
          style={{ backgroundColor: data.color }}
        />
      )}
      <div
        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-green-500 animate-pulse"
      />

      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: `${data.color}30`,
            boxShadow: isActive ? `0 0 15px ${data.color}` : 'none'
          }}
        >
          <Icon size={24} style={{ color: data.color }} />
        </div>
        <div>
          <span className="font-bold text-white text-lg">{data.name}</span>
          <p className="text-xs text-zinc-400">{data.role}</p>
        </div>
      </div>

      {isActive && data.currentAction && (
        <div
          className="mt-2 px-2 py-1 rounded text-[10px] font-medium"
          style={{ backgroundColor: `${data.color}20`, color: data.color }}
        >
          {data.currentAction}
        </div>
      )}
    </div>
  );
}

function ClusterNode({ data }: { data: { name: string; color: string } }) {
  return (
    <div
      className="px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${data.color}20`,
        color: data.color,
        border: `1px solid ${data.color}40`,
      }}
    >
      {data.name}
    </div>
  );
}

const nodeTypes = {
  agent: AgentNode,
  ceo: CEONode,
  cluster: ClusterNode,
};

// ========================================
// Node & Edge Definitions
// ========================================

const COLORS = {
  executive: '#8b5cf6',
  marketing: '#06b6d4',
  creative: '#f59e0b',
  operations: '#10b981',
  analytics: '#3b82f6',
  customer: '#ec4899',
};

const AGENT_ID_MAP: Record<string, string> = {
  'ceo': '社長',
  'cmo': 'CMO',
  'coo': '番頭',
  'creative_lead': 'Creative',
  'dm_responder': 'DM対応',
  'trend_analyst': 'トレンド分析',
  'affiliate': 'アフィリエイト',
  'copywriter': 'コピーライター',
  'empathizer': 'エンパサイザー',
  'post_pattern': 'パターンマスター',
  'pdca_analyst': 'PDCA分析',
  'strategy_planner': '戦略立案',
  'seo': 'SEO',
  'knowledge_expert': 'ナレッジ',
  'benefit_mapper': 'ベネフィット',
  'researcher': 'リサーチャー',
  'video_director': '動画監督',
  'multi_scout': 'マルチスカウト',
  'scraper': 'スクレイパー',
};

// ノードの幅を考慮した中央配置用のオフセット
const NODE_WIDTH = 160;
const SPACING_X = 200;
const TOTAL_WIDTH = SPACING_X * 5; // 5列
const START_X = 100; // 左端からの開始位置

const createInitialNodes = (): Node[] => [
  // CEO - Top Center
  {
    id: 'ceo',
    type: 'ceo',
    position: { x: START_X + SPACING_X * 2, y: 0 },
    data: { name: '社長', role: 'CEO', cluster: 'executive', color: COLORS.executive, icon: 'Crown' },
  },

  // Executive Layer
  {
    id: 'cmo',
    type: 'agent',
    position: { x: START_X + SPACING_X * 0.5, y: 130 },
    data: { name: 'CMO', role: 'マーケティング統括', cluster: 'executive', color: COLORS.executive, icon: 'Megaphone' },
  },
  {
    id: 'coo',
    type: 'agent',
    position: { x: START_X + SPACING_X * 2, y: 130 },
    data: { name: '番頭', role: '最高執行責任者', cluster: 'executive', color: COLORS.executive, icon: 'Shield' },
  },
  {
    id: 'creative_lead',
    type: 'agent',
    position: { x: START_X + SPACING_X * 3.5, y: 130 },
    data: { name: 'Creative', role: 'クリエイティブ統括', cluster: 'executive', color: COLORS.executive, icon: 'Sparkles' },
  },

  // Marketing Team (Column 0)
  {
    id: 'cluster_marketing',
    type: 'cluster',
    position: { x: START_X, y: 250 },
    data: { name: 'Marketing', color: COLORS.marketing },
  },
  {
    id: 'dm_responder',
    type: 'agent',
    position: { x: START_X, y: 290 },
    data: { name: 'DM対応', role: 'DM自動応答', cluster: 'marketing', color: COLORS.marketing, icon: 'MessageCircle' },
  },
  {
    id: 'trend_analyst',
    type: 'agent',
    position: { x: START_X, y: 400 },
    data: { name: 'トレンド分析', role: 'トレンド検知', cluster: 'marketing', color: COLORS.marketing, icon: 'TrendingUp' },
  },
  {
    id: 'affiliate',
    type: 'agent',
    position: { x: START_X, y: 510 },
    data: { name: 'アフィリエイト', role: 'アフィリエイト', cluster: 'marketing', color: COLORS.marketing, icon: 'Globe' },
  },

  // Operations Team (Column 1)
  {
    id: 'cluster_operations',
    type: 'cluster',
    position: { x: START_X + SPACING_X, y: 250 },
    data: { name: 'Operations', color: COLORS.operations },
  },
  {
    id: 'pdca_analyst',
    type: 'agent',
    position: { x: START_X + SPACING_X, y: 290 },
    data: { name: 'PDCA分析', role: 'PDCA改善', cluster: 'operations', color: COLORS.operations, icon: 'RefreshCw' },
  },
  {
    id: 'strategy_planner',
    type: 'agent',
    position: { x: START_X + SPACING_X, y: 400 },
    data: { name: '戦略立案', role: '長期戦略', cluster: 'operations', color: COLORS.operations, icon: 'Target' },
  },
  {
    id: 'seo',
    type: 'agent',
    position: { x: START_X + SPACING_X, y: 510 },
    data: { name: 'SEO', role: 'WordPress/SEO', cluster: 'operations', color: COLORS.operations, icon: 'Search' },
  },

  // Analytics Team (Column 2)
  {
    id: 'cluster_analytics',
    type: 'cluster',
    position: { x: START_X + SPACING_X * 2, y: 250 },
    data: { name: 'Analytics', color: COLORS.analytics },
  },
  {
    id: 'knowledge_expert',
    type: 'agent',
    position: { x: START_X + SPACING_X * 2, y: 290 },
    data: { name: 'ナレッジ', role: '知識管理', cluster: 'analytics', color: COLORS.analytics, icon: 'Database' },
  },
  {
    id: 'benefit_mapper',
    type: 'agent',
    position: { x: START_X + SPACING_X * 2, y: 400 },
    data: { name: 'ベネフィット', role: 'ターゲット分析', cluster: 'analytics', color: COLORS.analytics, icon: 'Users' },
  },
  {
    id: 'researcher',
    type: 'agent',
    position: { x: START_X + SPACING_X * 2, y: 510 },
    data: { name: 'リサーチャー', role: '市場調査', cluster: 'analytics', color: COLORS.analytics, icon: 'Eye' },
  },

  // Creative Team (Column 3)
  {
    id: 'cluster_creative',
    type: 'cluster',
    position: { x: START_X + SPACING_X * 3, y: 250 },
    data: { name: 'Creative', color: COLORS.creative },
  },
  {
    id: 'copywriter',
    type: 'agent',
    position: { x: START_X + SPACING_X * 3, y: 290 },
    data: { name: 'コピーライター', role: 'コピー作成', cluster: 'creative', color: COLORS.creative, icon: 'PenTool' },
  },
  {
    id: 'empathizer',
    type: 'agent',
    position: { x: START_X + SPACING_X * 3, y: 400 },
    data: { name: 'エンパサイザー', role: '共感設計', cluster: 'creative', color: COLORS.creative, icon: 'Lightbulb' },
  },
  {
    id: 'post_pattern',
    type: 'agent',
    position: { x: START_X + SPACING_X * 3, y: 510 },
    data: { name: 'パターンマスター', role: 'パターン生成', cluster: 'creative', color: COLORS.creative, icon: 'Layers' },
  },

  // Customer Team (Column 4)
  {
    id: 'cluster_customer',
    type: 'cluster',
    position: { x: START_X + SPACING_X * 4, y: 250 },
    data: { name: 'Customer', color: COLORS.customer },
  },
  {
    id: 'video_director',
    type: 'agent',
    position: { x: START_X + SPACING_X * 4, y: 290 },
    data: { name: '動画監督', role: '動画制作', cluster: 'customer', color: COLORS.customer, icon: 'Video' },
  },
  {
    id: 'multi_scout',
    type: 'agent',
    position: { x: START_X + SPACING_X * 4, y: 400 },
    data: { name: 'マルチスカウト', role: 'マルチ調査', cluster: 'customer', color: COLORS.customer, icon: 'Search' },
  },
  {
    id: 'scraper',
    type: 'agent',
    position: { x: START_X + SPACING_X * 4, y: 510 },
    data: { name: 'スクレイパー', role: 'データ収集', cluster: 'customer', color: COLORS.customer, icon: 'Bot' },
  },
];

const initialEdges: Edge[] = [
  // CEO to Executives
  { id: 'ceo-cmo', source: 'ceo', target: 'cmo', type: 'smoothstep', animated: true, style: { stroke: COLORS.executive, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.executive } },
  { id: 'ceo-coo', source: 'ceo', target: 'coo', type: 'smoothstep', animated: true, style: { stroke: COLORS.executive, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.executive } },
  { id: 'ceo-creative', source: 'ceo', target: 'creative_lead', type: 'smoothstep', animated: true, style: { stroke: COLORS.executive, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.executive } },

  // CMO to Marketing
  { id: 'cmo-dm', source: 'cmo', target: 'dm_responder', type: 'smoothstep', style: { stroke: COLORS.marketing, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.marketing } },
  { id: 'cmo-trend', source: 'cmo', target: 'trend_analyst', type: 'smoothstep', style: { stroke: COLORS.marketing, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.marketing } },
  { id: 'cmo-affiliate', source: 'cmo', target: 'affiliate', type: 'smoothstep', style: { stroke: COLORS.marketing, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.marketing } },

  // COO to Operations & Analytics
  { id: 'coo-pdca', source: 'coo', target: 'pdca_analyst', type: 'smoothstep', style: { stroke: COLORS.operations, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.operations } },
  { id: 'coo-strategy', source: 'coo', target: 'strategy_planner', type: 'smoothstep', style: { stroke: COLORS.operations, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.operations } },
  { id: 'coo-seo', source: 'coo', target: 'seo', type: 'smoothstep', style: { stroke: COLORS.operations, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.operations } },
  { id: 'coo-knowledge', source: 'coo', target: 'knowledge_expert', type: 'smoothstep', style: { stroke: COLORS.analytics, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.analytics } },
  { id: 'coo-benefit', source: 'coo', target: 'benefit_mapper', type: 'smoothstep', style: { stroke: COLORS.analytics, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.analytics } },
  { id: 'coo-researcher', source: 'coo', target: 'researcher', type: 'smoothstep', style: { stroke: COLORS.analytics, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.analytics } },

  // Creative Lead to Creative & Customer Team
  { id: 'creative-copy', source: 'creative_lead', target: 'copywriter', type: 'smoothstep', style: { stroke: COLORS.creative, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.creative } },
  { id: 'creative-empathy', source: 'creative_lead', target: 'empathizer', type: 'smoothstep', style: { stroke: COLORS.creative, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.creative } },
  { id: 'creative-pattern', source: 'creative_lead', target: 'post_pattern', type: 'smoothstep', style: { stroke: COLORS.creative, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.creative } },
  { id: 'creative-video', source: 'creative_lead', target: 'video_director', type: 'smoothstep', style: { stroke: COLORS.customer, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.customer } },
  { id: 'creative-scout', source: 'creative_lead', target: 'multi_scout', type: 'smoothstep', style: { stroke: COLORS.customer, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.customer } },
  { id: 'creative-scraper', source: 'creative_lead', target: 'scraper', type: 'smoothstep', style: { stroke: COLORS.customer, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.customer } },
];

// ========================================
// Main Component
// ========================================

interface OrganizationFlowProps {
  activities?: AgentActivity[];
}

function OrganizationFlowInner({ activities = [] }: OrganizationFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(createInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const { fitView } = useReactFlow();

  // コンテナサイズ変更時にfitViewを再実行
  useEffect(() => {
    // 初回とリサイズ時にfitViewを実行
    const handleFitView = () => {
      fitView({ padding: 0.15 });
    };

    // 初回実行（複数回試行）
    const timer1 = setTimeout(handleFitView, 50);
    const timer2 = setTimeout(handleFitView, 200);
    const timer3 = setTimeout(handleFitView, 500);

    // リサイズ時
    window.addEventListener('resize', handleFitView);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', handleFitView);
    };
  }, [fitView]);

  // アクティビティに基づいてノードを更新
  useEffect(() => {
    if (activities.length === 0) return;

    // 最近のアクティブなエージェントを特定
    const recentActivities = activities.slice(0, 10);
    const newActiveAgents = new Set<string>();

    recentActivities.forEach(activity => {
      // エージェント名からIDを逆引き
      const agentId = Object.entries(AGENT_ID_MAP).find(
        ([, name]) => name === activity.agentName
      )?.[0];

      if (agentId && (activity.status === 'thinking' || activity.status === 'executing')) {
        newActiveAgents.add(agentId);
      }
    });

    setActiveAgents(newActiveAgents);

    // ノードを更新
    setNodes(currentNodes =>
      currentNodes.map(node => {
        if (node.type === 'cluster') return node;

        const isActive = newActiveAgents.has(node.id);
        const latestActivity = recentActivities.find(a => {
          const agentId = Object.entries(AGENT_ID_MAP).find(
            ([, name]) => name === a.agentName
          )?.[0];
          return agentId === node.id;
        });

        return {
          ...node,
          data: {
            ...node.data,
            isActive,
            currentAction: isActive && latestActivity ? latestActivity.action : undefined,
          },
        };
      })
    );
  }, [activities, setNodes]);

  // デモ用: ランダムにエージェントをアクティブに
  useEffect(() => {
    if (activities.length > 0) return; // 実際のアクティビティがある場合はスキップ

    const interval = setInterval(() => {
      const agentIds = Object.keys(AGENT_ID_MAP);
      const randomId = agentIds[Math.floor(Math.random() * agentIds.length)];
      const actions = [
        '投稿を生成中...',
        'データを分析中...',
        'トレンドを検知...',
        'レポートを作成中...',
        'DM返信を準備中...',
      ];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      setNodes(currentNodes =>
        currentNodes.map(node => {
          if (node.type === 'cluster') return node;

          const isActive = node.id === randomId;
          return {
            ...node,
            data: {
              ...node.data,
              isActive,
              currentAction: isActive ? randomAction : undefined,
            },
          };
        })
      );

      // 3秒後にリセット
      setTimeout(() => {
        setNodes(currentNodes =>
          currentNodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              isActive: false,
              currentAction: undefined,
            },
          }))
        );
      }, 3000);
    }, 5000);

    return () => clearInterval(interval);
  }, [activities.length, setNodes]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', background: '#09090b' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#09090b' }}
      >
        <Background color="#27272a" gap={24} size={1} style={{ background: '#09090b' }} />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as AgentNodeData;
            return data.isActive ? '#22c55e' : (data.color || '#8b5cf6');
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
          position="bottom-left"
          style={{ background: '#18181b' }}
        />
      </ReactFlow>
    </div>
  );
}

export default function OrganizationFlow({ activities = [] }: OrganizationFlowProps) {
  return (
    <ReactFlowProvider>
      <OrganizationFlowInner activities={activities} />
    </ReactFlowProvider>
  );
}

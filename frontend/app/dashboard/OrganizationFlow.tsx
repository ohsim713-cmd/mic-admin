'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Crown, Shield, Megaphone, Sparkles,
  MessageCircle, TrendingUp, Globe,
  PenTool, Lightbulb, Layers,
  RefreshCw, Target, Search,
  Database, Users, Eye,
  Video, Bot
} from 'lucide-react';

// ========================================
// Custom Node Component
// ========================================

interface AgentNodeData {
  name: string;
  role: string;
  cluster: string;
  color: string;
  icon: string;
  isActive?: boolean;
}

const iconMap: Record<string, any> = {
  Crown, Shield, Megaphone, Sparkles,
  MessageCircle, TrendingUp, Globe,
  PenTool, Lightbulb, Layers,
  RefreshCw, Target, Search,
  Database, Users, Eye,
  Video, Bot
};

function AgentNode({ data }: { data: AgentNodeData }) {
  const Icon = iconMap[data.icon] || Crown;

  return (
    <div
      className="px-4 py-3 rounded-xl border-2 min-w-[140px] transition-all"
      style={{
        background: `linear-gradient(135deg, ${data.color}15, ${data.color}08)`,
        borderColor: data.isActive ? data.color : `${data.color}40`,
        boxShadow: data.isActive ? `0 0 20px ${data.color}40` : 'none',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${data.color}20` }}
        >
          <Icon size={16} style={{ color: data.color }} />
        </div>
        <span className="font-bold text-white text-sm">{data.name}</span>
      </div>
      <p className="text-[10px] text-zinc-400 pl-9">{data.role}</p>
      {data.isActive && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
      )}
    </div>
  );
}

// CEO Node (larger)
function CEONode({ data }: { data: AgentNodeData }) {
  const Icon = iconMap[data.icon] || Crown;

  return (
    <div
      className="px-6 py-4 rounded-2xl border-2 min-w-[180px] relative"
      style={{
        background: `linear-gradient(135deg, ${data.color}25, ${data.color}10)`,
        borderColor: data.color,
        boxShadow: `0 0 30px ${data.color}30`,
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${data.color}30` }}
        >
          <Icon size={24} style={{ color: data.color }} />
        </div>
        <div>
          <span className="font-bold text-white text-lg">{data.name}</span>
          <p className="text-xs text-zinc-400">{data.role}</p>
        </div>
      </div>
      <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-green-500 animate-pulse" />
    </div>
  );
}

// Cluster label node
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

// CEO at center top, then executives, then teams below
const initialNodes: Node[] = [
  // CEO - Top Center
  {
    id: 'ceo',
    type: 'ceo',
    position: { x: 400, y: 0 },
    data: { name: '社長', role: 'CEO', cluster: 'executive', color: COLORS.executive, icon: 'Crown' },
  },

  // Executive Layer (directly under CEO)
  {
    id: 'cmo',
    type: 'agent',
    position: { x: 150, y: 120 },
    data: { name: 'CMO', role: 'マーケティング統括', cluster: 'executive', color: COLORS.executive, icon: 'Megaphone' },
  },
  {
    id: 'coo',
    type: 'agent',
    position: { x: 400, y: 120 },
    data: { name: '番頭', role: '最高執行責任者', cluster: 'executive', color: COLORS.executive, icon: 'Shield' },
  },
  {
    id: 'creative_lead',
    type: 'agent',
    position: { x: 650, y: 120 },
    data: { name: 'Creative', role: 'クリエイティブ統括', cluster: 'executive', color: COLORS.executive, icon: 'Sparkles' },
  },

  // Marketing Team (under CMO)
  {
    id: 'cluster_marketing',
    type: 'cluster',
    position: { x: 0, y: 230 },
    data: { name: 'Marketing', color: COLORS.marketing },
  },
  {
    id: 'dm_responder',
    type: 'agent',
    position: { x: 0, y: 270 },
    data: { name: 'DM対応', role: 'DM自動応答', cluster: 'marketing', color: COLORS.marketing, icon: 'MessageCircle' },
  },
  {
    id: 'trend_analyst',
    type: 'agent',
    position: { x: 0, y: 370 },
    data: { name: 'トレンド分析', role: 'トレンド検知', cluster: 'marketing', color: COLORS.marketing, icon: 'TrendingUp' },
  },
  {
    id: 'affiliate',
    type: 'agent',
    position: { x: 0, y: 470 },
    data: { name: 'アフィリエイト', role: 'アフィリエイト', cluster: 'marketing', color: COLORS.marketing, icon: 'Globe' },
  },

  // Operations Team (under COO)
  {
    id: 'cluster_operations',
    type: 'cluster',
    position: { x: 280, y: 230 },
    data: { name: 'Operations', color: COLORS.operations },
  },
  {
    id: 'pdca_analyst',
    type: 'agent',
    position: { x: 280, y: 270 },
    data: { name: 'PDCA分析', role: 'PDCA改善', cluster: 'operations', color: COLORS.operations, icon: 'RefreshCw' },
  },
  {
    id: 'strategy_planner',
    type: 'agent',
    position: { x: 280, y: 370 },
    data: { name: '戦略立案', role: '長期戦略', cluster: 'operations', color: COLORS.operations, icon: 'Target' },
  },
  {
    id: 'seo',
    type: 'agent',
    position: { x: 280, y: 470 },
    data: { name: 'SEO', role: 'WordPress/SEO', cluster: 'operations', color: COLORS.operations, icon: 'Search' },
  },

  // Analytics Team
  {
    id: 'cluster_analytics',
    type: 'cluster',
    position: { x: 480, y: 230 },
    data: { name: 'Analytics', color: COLORS.analytics },
  },
  {
    id: 'knowledge_expert',
    type: 'agent',
    position: { x: 480, y: 270 },
    data: { name: 'ナレッジ', role: '知識管理', cluster: 'analytics', color: COLORS.analytics, icon: 'Database' },
  },
  {
    id: 'benefit_mapper',
    type: 'agent',
    position: { x: 480, y: 370 },
    data: { name: 'ベネフィット', role: 'ターゲット分析', cluster: 'analytics', color: COLORS.analytics, icon: 'Users' },
  },
  {
    id: 'researcher',
    type: 'agent',
    position: { x: 480, y: 470 },
    data: { name: 'リサーチャー', role: '市場調査', cluster: 'analytics', color: COLORS.analytics, icon: 'Eye' },
  },

  // Creative Team (under Creative Lead)
  {
    id: 'cluster_creative',
    type: 'cluster',
    position: { x: 680, y: 230 },
    data: { name: 'Creative', color: COLORS.creative },
  },
  {
    id: 'copywriter',
    type: 'agent',
    position: { x: 680, y: 270 },
    data: { name: 'コピーライター', role: 'コピー作成', cluster: 'creative', color: COLORS.creative, icon: 'PenTool' },
  },
  {
    id: 'empathizer',
    type: 'agent',
    position: { x: 680, y: 370 },
    data: { name: 'エンパサイザー', role: '共感設計', cluster: 'creative', color: COLORS.creative, icon: 'Lightbulb' },
  },
  {
    id: 'post_pattern',
    type: 'agent',
    position: { x: 680, y: 470 },
    data: { name: 'パターンマスター', role: 'パターン生成', cluster: 'creative', color: COLORS.creative, icon: 'Layers' },
  },

  // Customer/Support Team
  {
    id: 'cluster_customer',
    type: 'cluster',
    position: { x: 880, y: 230 },
    data: { name: 'Customer', color: COLORS.customer },
  },
  {
    id: 'video_director',
    type: 'agent',
    position: { x: 880, y: 270 },
    data: { name: '動画監督', role: '動画制作', cluster: 'customer', color: COLORS.customer, icon: 'Video' },
  },
  {
    id: 'multi_scout',
    type: 'agent',
    position: { x: 880, y: 370 },
    data: { name: 'マルチスカウト', role: 'マルチ調査', cluster: 'customer', color: COLORS.customer, icon: 'Search' },
  },
  {
    id: 'scraper',
    type: 'agent',
    position: { x: 880, y: 470 },
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

  // Creative Lead to Creative Team
  { id: 'creative-copy', source: 'creative_lead', target: 'copywriter', type: 'smoothstep', style: { stroke: COLORS.creative, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.creative } },
  { id: 'creative-empathy', source: 'creative_lead', target: 'empathizer', type: 'smoothstep', style: { stroke: COLORS.creative, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.creative } },
  { id: 'creative-pattern', source: 'creative_lead', target: 'post_pattern', type: 'smoothstep', style: { stroke: COLORS.creative, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.creative } },

  // Creative Lead to Customer Team
  { id: 'creative-video', source: 'creative_lead', target: 'video_director', type: 'smoothstep', style: { stroke: COLORS.customer, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.customer } },
  { id: 'creative-scout', source: 'creative_lead', target: 'multi_scout', type: 'smoothstep', style: { stroke: COLORS.customer, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.customer } },
  { id: 'creative-scraper', source: 'creative_lead', target: 'scraper', type: 'smoothstep', style: { stroke: COLORS.customer, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.customer } },
];

// ========================================
// Main Component
// ========================================

export default function OrganizationFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-full h-full" style={{ minHeight: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={20} size={1} />
        <Controls
          showInteractive={false}
          position="bottom-right"
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as AgentNodeData;
            return data.color || '#8b5cf6';
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
          position="bottom-left"
        />
      </ReactFlow>
    </div>
  );
}

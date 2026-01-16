'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Node,
  Edge,
  Position,
  Handle,
  MarkerType,
  ConnectionMode,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Sparkles, Activity, Zap, Eye, Target, Crown,
  MessageCircle, TrendingUp, Clock, CheckCircle, AlertTriangle,
  Radio, Cpu, Network, Shield, BarChart3, Users, Send,
  ChevronRight, Play, Pause, Settings2, Layers, GitBranch,
  FileText, Search, PenTool, Video, Megaphone, Lightbulb,
  Bot, Database, Globe, Workflow, ArrowRight, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamic imports for React Flow components (SSR issues)
const ReactFlow = dynamic(
  () => import('reactflow').then((mod) => mod.default),
  { ssr: false }
);
const Background = dynamic(
  () => import('reactflow').then((mod) => mod.Background),
  { ssr: false }
);
const Controls = dynamic(
  () => import('reactflow').then((mod) => mod.Controls),
  { ssr: false }
);
const MiniMap = dynamic(
  () => import('reactflow').then((mod) => mod.MiniMap),
  { ssr: false }
);
const Panel = dynamic(
  () => import('reactflow').then((mod) => mod.Panel),
  { ssr: false }
);

// ========================================
// Types
// ========================================

interface AgentNode {
  id: string;
  name: string;
  role: string;
  cluster: 'executive' | 'marketing' | 'creative' | 'operations' | 'analytics' | 'customer';
  status: 'idle' | 'thinking' | 'executing' | 'success' | 'error';
  icon: any;
  metrics?: {
    tasksCompleted: number;
    successRate: number;
  };
  lastAction?: string;
  skills?: string[];
}

interface DataFlow {
  id: string;
  from: string;
  to: string;
  label: string;
  animated: boolean;
  type: 'data' | 'command' | 'result';
}

interface SystemMetrics {
  totalImpressions: number;
  totalEngagement: number;
  dmCount: number;
  dmGoal: number;
  activeAgents: number;
  totalAgents: number;
  tasksToday: number;
  successRate: number;
}

// ========================================
// Agent Definitions
// ========================================

const AGENT_CLUSTERS: Record<string, { name: string; color: string; position: { x: number; y: number } }> = {
  executive: { name: 'Executive', color: '#8b5cf6', position: { x: 400, y: 50 } },
  marketing: { name: 'Marketing', color: '#06b6d4', position: { x: 100, y: 250 } },
  creative: { name: 'Creative', color: '#f59e0b', position: { x: 700, y: 250 } },
  operations: { name: 'Operations', color: '#10b981', position: { x: 100, y: 500 } },
  analytics: { name: 'Analytics', color: '#3b82f6', position: { x: 700, y: 500 } },
  customer: { name: 'Customer Service', color: '#ec4899', position: { x: 400, y: 700 } },
};

const AGENTS: AgentNode[] = [
  // Executive Cluster
  { id: 'ceo', name: '社長', role: 'CEO', cluster: 'executive', status: 'idle', icon: Crown, metrics: { tasksCompleted: 0, successRate: 100 }, skills: ['vision', 'decision'] },
  { id: 'cmo', name: 'CMO', role: 'マーケティング統括', cluster: 'executive', status: 'idle', icon: Megaphone, metrics: { tasksCompleted: 89, successRate: 91 }, skills: ['trend', 'strategy'] },
  { id: 'coo', name: '番頭', role: '最高執行責任者', cluster: 'executive', status: 'idle', icon: Shield, metrics: { tasksCompleted: 156, successRate: 94 }, skills: ['qa', 'coordinate'] },
  { id: 'creative_lead', name: 'Creative', role: 'クリエイティブ統括', cluster: 'executive', status: 'idle', icon: Sparkles, metrics: { tasksCompleted: 234, successRate: 88 }, skills: ['generate', 'design'] },

  // Marketing Cluster
  { id: 'dm_responder', name: 'DM対応', role: 'DM自動応答', cluster: 'marketing', status: 'idle', icon: MessageCircle, metrics: { tasksCompleted: 512, successRate: 98 }, skills: ['dm', 'reply'] },
  { id: 'trend_analyst', name: 'トレンド分析', role: 'トレンド検知', cluster: 'marketing', status: 'idle', icon: TrendingUp, metrics: { tasksCompleted: 67, successRate: 96 }, skills: ['trend', 'detect'] },
  { id: 'affiliate', name: 'アフィリエイト', role: 'アフィリエイト', cluster: 'marketing', status: 'idle', icon: Globe, metrics: { tasksCompleted: 45, successRate: 82 }, skills: ['affiliate', 'promote'] },

  // Creative Cluster
  { id: 'copywriter', name: 'コピーライター', role: 'コピー作成', cluster: 'creative', status: 'idle', icon: PenTool, metrics: { tasksCompleted: 178, successRate: 85 }, skills: ['write', 'hook'] },
  { id: 'empathizer', name: 'エンパサイザー', role: '共感設計', cluster: 'creative', status: 'idle', icon: Lightbulb, metrics: { tasksCompleted: 92, successRate: 90 }, skills: ['empathy', 'persona'] },
  { id: 'post_pattern', name: 'パターンマスター', role: 'パターン生成', cluster: 'creative', status: 'idle', icon: Layers, metrics: { tasksCompleted: 203, successRate: 87 }, skills: ['pattern', 'template'] },

  // Operations Cluster
  { id: 'pdca_analyst', name: 'PDCA分析', role: 'PDCA改善', cluster: 'operations', status: 'idle', icon: RefreshCw, metrics: { tasksCompleted: 124, successRate: 93 }, skills: ['pdca', 'optimize'] },
  { id: 'strategy_planner', name: '戦略立案', role: '長期戦略', cluster: 'operations', status: 'idle', icon: Target, metrics: { tasksCompleted: 38, successRate: 95 }, skills: ['plan', 'strategy'] },
  { id: 'seo', name: 'SEO', role: 'WordPress/SEO', cluster: 'operations', status: 'idle', icon: Search, metrics: { tasksCompleted: 156, successRate: 89 }, skills: ['seo', 'wordpress'] },

  // Analytics Cluster
  { id: 'knowledge_expert', name: 'ナレッジ', role: '知識管理', cluster: 'analytics', status: 'idle', icon: Database, metrics: { tasksCompleted: 78, successRate: 97 }, skills: ['knowledge', 'learn'] },
  { id: 'benefit_mapper', name: 'ベネフィット', role: 'ターゲット分析', cluster: 'analytics', status: 'idle', icon: Users, metrics: { tasksCompleted: 56, successRate: 91 }, skills: ['benefit', 'target'] },
  { id: 'researcher', name: 'リサーチャー', role: '市場調査', cluster: 'analytics', status: 'idle', icon: Eye, metrics: { tasksCompleted: 89, successRate: 92 }, skills: ['research', 'scrape'] },

  // Customer Service Cluster
  { id: 'video_director', name: '動画監督', role: '動画制作', cluster: 'customer', status: 'idle', icon: Video, metrics: { tasksCompleted: 34, successRate: 88 }, skills: ['video', 'direct'] },
  { id: 'multi_scout', name: 'マルチスカウト', role: 'マルチ調査', cluster: 'customer', status: 'idle', icon: Search, metrics: { tasksCompleted: 145, successRate: 86 }, skills: ['scout', 'multi'] },
  { id: 'scraper', name: 'スクレイパー', role: 'データ収集', cluster: 'customer', status: 'idle', icon: Bot, metrics: { tasksCompleted: 512, successRate: 98 }, skills: ['scrape', 'collect'] },
];

// ========================================
// Data Flows (Edges)
// ========================================

const DATA_FLOWS: DataFlow[] = [
  // CEO to executives
  { id: 'ceo-cmo', from: 'ceo', to: 'cmo', label: '方針', animated: true, type: 'command' },
  { id: 'ceo-coo', from: 'ceo', to: 'coo', label: '指示', animated: true, type: 'command' },
  { id: 'ceo-creative', from: 'ceo', to: 'creative_lead', label: '依頼', animated: true, type: 'command' },

  // CMO to marketing
  { id: 'cmo-dm', from: 'cmo', to: 'dm_responder', label: 'DM戦略', animated: false, type: 'command' },
  { id: 'cmo-trend', from: 'cmo', to: 'trend_analyst', label: 'トレンド指示', animated: false, type: 'command' },
  { id: 'cmo-affiliate', from: 'cmo', to: 'affiliate', label: '提携戦略', animated: false, type: 'command' },

  // COO to operations
  { id: 'coo-pdca', from: 'coo', to: 'pdca_analyst', label: 'PDCA指示', animated: false, type: 'command' },
  { id: 'coo-strategy', from: 'coo', to: 'strategy_planner', label: '戦略依頼', animated: false, type: 'command' },
  { id: 'coo-seo', from: 'coo', to: 'seo', label: 'SEO指示', animated: false, type: 'command' },

  // Creative to creative team
  { id: 'creative-copy', from: 'creative_lead', to: 'copywriter', label: 'コピー依頼', animated: false, type: 'command' },
  { id: 'creative-empathy', from: 'creative_lead', to: 'empathizer', label: 'ペルソナ依頼', animated: false, type: 'command' },
  { id: 'creative-pattern', from: 'creative_lead', to: 'post_pattern', label: 'パターン依頼', animated: false, type: 'command' },

  // Cross-cluster data flows
  { id: 'trend-creative', from: 'trend_analyst', to: 'creative_lead', label: 'トレンドデータ', animated: true, type: 'data' },
  { id: 'researcher-knowledge', from: 'researcher', to: 'knowledge_expert', label: '調査結果', animated: true, type: 'data' },
  { id: 'pdca-cmo', from: 'pdca_analyst', to: 'cmo', label: '改善提案', animated: true, type: 'result' },
  { id: 'benefit-copy', from: 'benefit_mapper', to: 'copywriter', label: 'ターゲット情報', animated: false, type: 'data' },
  { id: 'scraper-researcher', from: 'scraper', to: 'researcher', label: '生データ', animated: true, type: 'data' },
  { id: 'video-cmo', from: 'video_director', to: 'cmo', label: '動画コンテンツ', animated: false, type: 'result' },
];

// ========================================
// Custom Node Components
// ========================================

// CEO Node - Special central node
function CEONode({ data }: { data: any }) {
  const isActive = data.status === 'thinking' || data.status === 'executing';

  return (
    <motion.div
      className={cn(
        "relative w-48 rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950",
        "border-2",
        isActive ? "border-violet-500/60" : "border-zinc-700/50",
        "shadow-2xl"
      )}
      animate={isActive ? {
        boxShadow: ['0 0 20px rgba(139, 92, 246, 0.3)', '0 0 40px rgba(139, 92, 246, 0.5)', '0 0 20px rgba(139, 92, 246, 0.3)']
      } : {}}
      transition={{ duration: 2, repeat: Infinity }}
    >
      {/* Glowing border effect */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: 'linear-gradient(45deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1), rgba(139, 92, 246, 0.1))',
            backgroundSize: '200% 200%',
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-zinc-900" />

      <div className="relative p-4">
        {/* Status indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <motion.div
            className={cn(
              "w-2 h-2 rounded-full",
              isActive ? "bg-violet-400" : "bg-zinc-500"
            )}
            animate={isActive ? { scale: [1, 1.3, 1], opacity: [1, 0.5, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className={cn(
            "text-[9px] font-mono uppercase tracking-wider",
            isActive ? "text-violet-400" : "text-zinc-500"
          )}>
            {data.status}
          </span>
        </div>

        {/* Icon with glow */}
        <div className="relative mb-3">
          <div className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center mx-auto",
            "bg-gradient-to-br from-violet-500/20 to-pink-500/20",
            "border border-violet-500/30"
          )}>
            <Crown size={28} className="text-violet-400" />
          </div>
          {isActive && (
            <motion.div
              className="absolute inset-0 rounded-xl bg-violet-500/20"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        {/* Name */}
        <h3 className="text-center font-bold text-white text-lg mb-0.5">{data.name}</h3>
        <p className="text-center text-xs text-zinc-500 mb-3">{data.role}</p>

        {/* Command input hint */}
        <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <Send size={10} className="text-violet-400" />
          <span className="text-[10px] text-zinc-400">命令を入力...</span>
        </div>
      </div>
    </motion.div>
  );
}

// Agent Node - Standard agent visualization
function AgentNodeComponent({ data }: { data: any }) {
  const isActive = data.status === 'thinking' || data.status === 'executing';
  const clusterColor = AGENT_CLUSTERS[data.cluster]?.color || '#3b82f6';

  const Icon = data.icon || Brain;

  return (
    <motion.div
      className={cn(
        "relative w-40 rounded-xl overflow-hidden",
        "bg-gradient-to-br from-zinc-900/95 to-zinc-950/95",
        "border",
        isActive ? "border-opacity-60" : "border-zinc-800/50",
        "shadow-xl backdrop-blur-sm"
      )}
      style={{
        borderColor: isActive ? clusterColor : undefined,
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      animate={isActive ? {
        boxShadow: [`0 0 15px ${clusterColor}33`, `0 0 30px ${clusterColor}55`, `0 0 15px ${clusterColor}33`]
      } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-zinc-800" style={{ backgroundColor: clusterColor }} />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-zinc-800" style={{ backgroundColor: clusterColor }} />

      {/* Processing indicator */}
      {isActive && (
        <motion.div
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ backgroundColor: clusterColor }}
          initial={{ scaleX: 0, transformOrigin: 'left' }}
          animate={{ scaleX: [0, 1, 0], transformOrigin: ['left', 'left', 'right'] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center border"
            style={{
              backgroundColor: `${clusterColor}15`,
              borderColor: `${clusterColor}30`
            }}
          >
            <Icon size={18} style={{ color: clusterColor }} />
          </div>

          <div className="flex items-center gap-1">
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: isActive ? clusterColor : '#71717a' }}
              animate={isActive ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </div>
        </div>

        {/* Name and role */}
        <h4 className="font-semibold text-white text-sm mb-0.5 truncate">{data.name}</h4>
        <p className="text-[10px] text-zinc-500 mb-2 truncate">{data.role}</p>

        {/* Metrics */}
        {data.metrics && (
          <div className="flex items-center gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <CheckCircle size={10} className="text-zinc-600" />
              <span className="text-zinc-400">{data.metrics.tasksCompleted}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap size={10} className="text-zinc-600" />
              <span className="text-zinc-400">{data.metrics.successRate}%</span>
            </div>
          </div>
        )}

        {/* Last action */}
        {data.lastAction && (
          <div className="mt-2 pt-2 border-t border-zinc-800/50">
            <p className="text-[9px] text-zinc-600 truncate">{data.lastAction}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Cluster Label Node
function ClusterLabelNode({ data }: { data: any }) {
  return (
    <div
      className="px-3 py-1.5 rounded-full border text-xs font-medium tracking-wide"
      style={{
        backgroundColor: `${data.color}15`,
        borderColor: `${data.color}40`,
        color: data.color,
      }}
    >
      {data.label}
    </div>
  );
}

const nodeTypes = {
  ceoNode: CEONode,
  agentNode: AgentNodeComponent,
  clusterLabel: ClusterLabelNode,
};

// ========================================
// Metrics Panel
// ========================================

function MetricsPanel({ metrics }: { metrics: SystemMetrics }) {
  const items = [
    { icon: Eye, label: 'Impressions', value: metrics.totalImpressions, color: 'cyan' },
    { icon: MessageCircle, label: 'Engagement', value: metrics.totalEngagement, color: 'green' },
    { icon: Target, label: 'DMs', value: `${metrics.dmCount}/${metrics.dmGoal}`, color: 'amber' },
    { icon: Zap, label: 'Tasks', value: metrics.tasksToday, color: 'violet' },
  ];

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/50 backdrop-blur-xl">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <item.icon size={14} className={cn(
            item.color === 'cyan' && 'text-cyan-400',
            item.color === 'green' && 'text-green-400',
            item.color === 'amber' && 'text-amber-400',
            item.color === 'violet' && 'text-violet-400',
          )} />
          <div>
            <div className={cn(
              "text-sm font-bold",
              item.color === 'cyan' && 'text-cyan-400',
              item.color === 'green' && 'text-green-400',
              item.color === 'amber' && 'text-amber-400',
              item.color === 'violet' && 'text-violet-400',
            )}>
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </div>
            <div className="text-[9px] text-zinc-500">{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ========================================
// Command Console
// ========================================

function CommandConsole({ onSubmit }: { onSubmit: (cmd: string) => void }) {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!command.trim() || isProcessing) return;
    setIsProcessing(true);
    await onSubmit(command);
    setCommand('');
    setIsProcessing(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800/50 backdrop-blur-xl">
      <Cpu size={18} className="text-cyan-400 flex-shrink-0" />
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="命令を入力..."
        className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
      />
      <motion.button
        onClick={handleSubmit}
        disabled={!command.trim() || isProcessing}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
          command.trim() && !isProcessing
            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
            : "bg-zinc-800/50 text-zinc-600"
        )}
        whileHover={command.trim() ? { scale: 1.02 } : {}}
        whileTap={command.trim() ? { scale: 0.98 } : {}}
      >
        {isProcessing ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <RefreshCw size={14} />
          </motion.div>
        ) : (
          <Send size={14} />
        )}
      </motion.button>
    </div>
  );
}

// ========================================
// Activity Feed
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
    <div className="w-72 h-80 rounded-xl bg-zinc-900/90 border border-zinc-800/50 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/50">
        <Radio size={14} className="text-cyan-400" />
        <span className="text-xs font-medium text-zinc-300">LIVE FEED</span>
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-green-500 ml-auto"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {activities.slice(-10).reverse().map((activity) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              className={cn(
                "flex items-start gap-2 p-2 rounded-lg text-xs",
                activity.type === 'success' && "bg-green-500/10",
                activity.type === 'warning' && "bg-amber-500/10",
                activity.type === 'thinking' && "bg-cyan-500/10",
                activity.type === 'info' && "bg-zinc-800/30",
              )}
            >
              {activity.type === 'thinking' && <Brain size={12} className="text-cyan-400 mt-0.5 flex-shrink-0" />}
              {activity.type === 'success' && <CheckCircle size={12} className="text-green-400 mt-0.5 flex-shrink-0" />}
              {activity.type === 'warning' && <AlertTriangle size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />}
              {activity.type === 'info' && <Radio size={12} className="text-zinc-400 mt-0.5 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-300">{activity.agent}</span>
                  <span className="text-[9px] text-zinc-600">
                    {new Date(activity.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-zinc-500 truncate">{activity.action}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ========================================
// Main Component
// ========================================

export default function OrganizationDashboard() {
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalImpressions: 0,
    totalEngagement: 0,
    dmCount: 0,
    dmGoal: 3,
    activeAgents: 0,
    totalAgents: AGENTS.length,
    tasksToday: 0,
    successRate: 94,
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Ensure client-side only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Build nodes
  const initialNodes = useMemo(() => {
    const nodes: Node[] = [];

    // Add cluster labels
    Object.entries(AGENT_CLUSTERS).forEach(([key, cluster]) => {
      nodes.push({
        id: `cluster-${key}`,
        type: 'clusterLabel',
        position: { x: cluster.position.x - 40, y: cluster.position.y - 30 },
        data: { label: cluster.name, color: cluster.color },
        draggable: false,
        selectable: false,
      });
    });

    // Add agents
    AGENTS.forEach((agent, index) => {
      const cluster = AGENT_CLUSTERS[agent.cluster];
      const agentsInCluster = AGENTS.filter(a => a.cluster === agent.cluster);
      const indexInCluster = agentsInCluster.findIndex(a => a.id === agent.id);

      // Calculate position within cluster
      let x = cluster.position.x;
      let y = cluster.position.y;

      if (agent.cluster === 'executive') {
        // Horizontal layout for executives
        x = 150 + indexInCluster * 180;
        y = 80;
      } else {
        // Grid layout for other clusters
        const cols = agent.cluster === 'customer' ? 3 : 2;
        const col = indexInCluster % cols;
        const row = Math.floor(indexInCluster / cols);
        x = cluster.position.x + col * 160;
        y = cluster.position.y + row * 140;
      }

      nodes.push({
        id: agent.id,
        type: agent.id === 'ceo' ? 'ceoNode' : 'agentNode',
        position: { x, y },
        data: { ...agent },
      });
    });

    return nodes;
  }, []);

  // Build edges
  const initialEdges = useMemo(() => {
    return DATA_FLOWS.map((flow) => {
      const edgeColor = flow.type === 'command' ? '#8b5cf6' : flow.type === 'data' ? '#06b6d4' : '#10b981';

      return {
        id: flow.id,
        source: flow.from,
        target: flow.to,
        label: flow.label,
        animated: flow.animated,
        type: 'smoothstep',
        style: {
          stroke: edgeColor,
          strokeWidth: 1.5,
          opacity: 0.6,
        },
        labelStyle: {
          fill: '#a1a1aa',
          fontSize: 9,
          fontWeight: 500,
        },
        labelBgStyle: {
          fill: '#18181b',
          fillOpacity: 0.8,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 15,
          height: 15,
        },
      };
    });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch metrics
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, stockRes] = await Promise.all([
          fetch('/api/db/stats').catch(() => ({ json: () => ({}) })),
          fetch('/api/dm-hunter/stock').catch(() => ({ json: () => ({}) })),
        ]);

        const stats = await statsRes.json() as any;
        const stock = await stockRes.json() as any;

        setMetrics(prev => ({
          ...prev,
          totalImpressions: stats.impressions?.total || 0,
          totalEngagement: stats.engagement?.total || 0,
          dmCount: stats.dm?.todayDMs || 0,
          tasksToday: stock.stocks?.length || 0,
        }));
      } catch (error) {
        console.error('Fetch error:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Demo activity simulation
  useEffect(() => {
    const demoActivities: ActivityItem[] = [
      { id: '1', timestamp: new Date().toISOString(), agent: '番頭', action: 'システム起動完了', type: 'success' },
      { id: '2', timestamp: new Date().toISOString(), agent: 'Automation', action: '定期タスク監視開始', type: 'info' },
    ];
    setActivities(demoActivities);

    // Simulate activity
    const interval = setInterval(() => {
      const randomAgent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const actions = [
        { action: 'タスクを受信', type: 'thinking' as const },
        { action: '処理完了', type: 'success' as const },
        { action: 'データ更新', type: 'info' as const },
        { action: '分析中', type: 'thinking' as const },
      ];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      setActivities(prev => [...prev.slice(-30), {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        agent: randomAgent.name,
        ...randomAction,
      }]);

      // Update node status
      setNodes(nds => nds.map(n => {
        if (n.id === randomAgent.id) {
          return {
            ...n,
            data: {
              ...n.data,
              status: randomAction.type === 'thinking' ? 'thinking' : 'idle',
              lastAction: randomAction.action,
            }
          };
        }
        return n;
      }));

      // Reset after delay
      setTimeout(() => {
        setNodes(nds => nds.map(n => {
          if (n.id === randomAgent.id) {
            return { ...n, data: { ...n.data, status: 'idle' } };
          }
          return n;
        }));
      }, 2000);
    }, 4000);

    return () => clearInterval(interval);
  }, [setNodes]);

  // Handle command
  const handleCommand = useCallback(async (command: string) => {
    setActivities(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      agent: '社長',
      action: `命令: "${command}"`,
      type: 'info',
    }]);

    // Activate CEO and COO
    setNodes(nds => nds.map(n => {
      if (n.id === 'ceo' || n.id === 'coo') {
        return { ...n, data: { ...n.data, status: 'thinking' } };
      }
      return n;
    }));

    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command }),
      });

      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          const lines = text.split('\n').filter(line => line.startsWith('data: '));

          for (const line of lines) {
            if (line === 'data: [DONE]') continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'tool_start') {
                setActivities(prev => [...prev, {
                  id: Date.now().toString(),
                  timestamp: new Date().toISOString(),
                  agent: '番頭',
                  action: `ツール: ${event.tool}`,
                  type: 'thinking',
                }]);
              }
            } catch {}
          }
        }
      }

      setActivities(prev => [...prev, {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        agent: '番頭',
        action: '処理完了',
        type: 'success',
      }]);
    } catch (error) {
      setActivities(prev => [...prev, {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        agent: 'System',
        action: 'エラーが発生しました',
        type: 'warning',
      }]);
    }

    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, status: 'idle' } })));
  }, [setNodes]);

  // Loading state
  if (!mounted) {
    return (
      <main className="h-screen w-full bg-zinc-950 text-white md:ml-[280px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Network size={48} className="text-cyan-400" />
          </motion.div>
          <div className="text-zinc-400 text-sm">組織マップを読み込み中...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-zinc-950 text-white md:ml-[280px]" style={{ width: '100%', height: '100vh' }}>
      <div style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
        >
        {/* Custom dark background */}
        <Background
          color="#27272a"
          gap={40}
          size={1}
          style={{ backgroundColor: '#09090b' }}
        />

        {/* Controls */}
        <Controls
          className="!bg-zinc-900/90 !border-zinc-800/50 !rounded-xl !shadow-xl"
        />

        {/* Mini Map */}
        <MiniMap
          nodeColor={(node) => {
            const cluster = node.data?.cluster;
            return AGENT_CLUSTERS[cluster]?.color || '#3b82f6';
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
          className="!bg-zinc-900/90 !border-zinc-800/50 !rounded-xl"
          style={{ height: 100, width: 150 }}
        />

        {/* Top panel - Header & Metrics */}
        <Panel position="top-left" className="!m-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800/50 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Network size={24} className="text-cyan-400" />
                  <motion.div
                    className="absolute inset-0"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <div className="w-full h-full border border-cyan-400/20 rounded-full" />
                  </motion.div>
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    ORGANIZATION MAP
                  </h1>
                  <p className="text-[10px] text-zinc-500">AI Agent Network Visualization</p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <motion.div
                  className="w-2 h-2 rounded-full bg-green-500"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-xs text-zinc-400">
                  {AGENTS.filter(a => nodes.find(n => n.id === a.id)?.data?.status !== 'idle').length}/{AGENTS.length} ACTIVE
                </span>
              </div>

              <div className="text-right pl-4 border-l border-zinc-800">
                <div className="text-lg font-mono text-cyan-400">
                  {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-[10px] text-zinc-600">
                  {currentTime.toLocaleDateString('ja-JP')}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <MetricsPanel metrics={metrics} />

            {/* Command Console */}
            <CommandConsole onSubmit={handleCommand} />
          </div>
        </Panel>

        {/* Right panel - Activity Feed */}
        <Panel position="top-right" className="!m-4">
          <ActivityFeed activities={activities} />
        </Panel>

        {/* Bottom Legend */}
        <Panel position="bottom-center" className="!mb-4">
          <div className="flex items-center gap-6 px-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800/50 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-8 h-0.5 bg-violet-500" />
              <span className="text-zinc-400">Command</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-8 h-0.5 bg-cyan-500" />
              <span className="text-zinc-400">Data Flow</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-8 h-0.5 bg-green-500" />
              <span className="text-zinc-400">Result</span>
            </div>
            <div className="h-4 w-px bg-zinc-700" />
            {Object.entries(AGENT_CLUSTERS).slice(0, 4).map(([key, cluster]) => (
              <div key={key} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cluster.color }} />
                <span className="text-zinc-500">{cluster.name}</span>
              </div>
            ))}
          </div>
        </Panel>
        </ReactFlow>
      </div>
    </main>
  );
}

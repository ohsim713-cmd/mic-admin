'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Network, Radio, Brain, CheckCircle, AlertTriangle,
  Activity, Users, Zap, Map, List, Play, Square
} from 'lucide-react';

// ========================================
// Types
// ========================================

interface ActivityItem {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  type: 'info' | 'success' | 'warning' | 'thinking';
}

interface AgentStatus {
  name: string;
  dept: string;
  color: string;
  status: 'active' | 'idle' | 'thinking';
}

// エージェントマップ用の型
type NodeType = 'core' | 'sub' | 'tool' | 'data';

interface AgentNode {
  id: string;
  name: string;
  type: NodeType;
  description: string;
  status: 'active' | 'idle' | 'error' | 'sleeping';
  connections: string[];
}

// ========================================
// Agent Data
// ========================================

const AGENTS: AgentStatus[] = [
  { name: '社長', dept: 'Executive', color: '#8b5cf6', status: 'active' },
  { name: '番頭', dept: 'Executive', color: '#8b5cf6', status: 'active' },
  { name: 'CMO', dept: 'Marketing', color: '#06b6d4', status: 'idle' },
  { name: 'Creative', dept: 'Creative', color: '#f59e0b', status: 'thinking' },
  { name: 'DM対応', dept: 'Customer', color: '#ec4899', status: 'idle' },
  { name: 'トレンド分析', dept: 'Analytics', color: '#3b82f6', status: 'active' },
  { name: 'アフィリエイト', dept: 'Marketing', color: '#06b6d4', status: 'idle' },
  { name: 'PDCA分析', dept: 'Analytics', color: '#3b82f6', status: 'thinking' },
  { name: '戦略立案', dept: 'Executive', color: '#8b5cf6', status: 'idle' },
  { name: 'SEO', dept: 'Marketing', color: '#06b6d4', status: 'active' },
  { name: 'ナレッジ', dept: 'Operations', color: '#10b981', status: 'idle' },
  { name: 'ベネフィット', dept: 'Creative', color: '#f59e0b', status: 'idle' },
  { name: 'リサーチャー', dept: 'Analytics', color: '#3b82f6', status: 'thinking' },
  { name: 'コピーライター', dept: 'Creative', color: '#f59e0b', status: 'active' },
  { name: 'エンパサイザー', dept: 'Customer', color: '#ec4899', status: 'idle' },
  { name: 'パターンマスター', dept: 'Analytics', color: '#3b82f6', status: 'idle' },
  { name: '動画監督', dept: 'Creative', color: '#f59e0b', status: 'idle' },
  { name: 'マルチスカウト', dept: 'Operations', color: '#10b981', status: 'idle' },
  { name: 'スクレイパー', dept: 'Operations', color: '#10b981', status: 'active' },
];

// エージェントマップのノードデータ
const AGENT_NODES: AgentNode[] = [
  // コアエージェント
  {
    id: 'react-loop',
    name: 'ReAct Loop',
    type: 'core',
    description: '自律思考ループ',
    status: 'idle',
    connections: ['sns-agent', 'monitor', 'scheduler'],
  },
  {
    id: 'sns-agent',
    name: 'SNS Agent',
    type: 'core',
    description: 'SNS統括',
    status: 'idle',
    connections: ['post-generator', 'sns-poster', 'analytics'],
  },
  // サブエージェント
  {
    id: 'post-generator',
    name: 'Generator',
    type: 'sub',
    description: '投稿生成',
    status: 'idle',
    connections: ['knowledge', 'quality-scorer'],
  },
  {
    id: 'sns-poster',
    name: 'Poster',
    type: 'sub',
    description: '投稿実行',
    status: 'idle',
    connections: ['session-mgr', 'verifier'],
  },
  {
    id: 'monitor',
    name: 'Monitor',
    type: 'sub',
    description: '24h監視',
    status: 'idle',
    connections: ['alerts'],
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    type: 'sub',
    description: 'スケジュール',
    status: 'idle',
    connections: ['post-stock'],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    type: 'sub',
    description: '分析',
    status: 'idle',
    connections: ['success-patterns'],
  },
  {
    id: 'scout',
    name: 'Scout',
    type: 'sub',
    description: 'スクレイピング',
    status: 'idle',
    connections: ['memory'],
  },
  // ツール
  {
    id: 'session-mgr',
    name: 'Session',
    type: 'tool',
    description: 'クッキー管理',
    status: 'idle',
    connections: [],
  },
  {
    id: 'verifier',
    name: 'Verifier',
    type: 'tool',
    description: '結果検証',
    status: 'idle',
    connections: [],
  },
  {
    id: 'quality-scorer',
    name: 'Scorer',
    type: 'tool',
    description: '品質評価',
    status: 'idle',
    connections: [],
  },
  // データ
  {
    id: 'knowledge',
    name: 'Knowledge',
    type: 'data',
    description: 'ナレッジDB',
    status: 'active',
    connections: [],
  },
  {
    id: 'memory',
    name: 'Memory',
    type: 'data',
    description: 'ベクトルDB',
    status: 'active',
    connections: [],
  },
  {
    id: 'post-stock',
    name: 'Stock',
    type: 'data',
    description: '投稿ストック',
    status: 'active',
    connections: [],
  },
  {
    id: 'success-patterns',
    name: 'Patterns',
    type: 'data',
    description: '成功パターン',
    status: 'active',
    connections: [],
  },
  {
    id: 'alerts',
    name: 'Alerts',
    type: 'data',
    description: 'アラート',
    status: 'idle',
    connections: [],
  },
];

// ノードカラー
const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  core: { bg: 'rgba(233, 69, 96, 0.1)', border: '#e94560', text: '#e94560' },
  sub: { bg: 'rgba(77, 168, 218, 0.1)', border: '#4da8da', text: '#4da8da' },
  tool: { bg: 'rgba(155, 89, 182, 0.1)', border: '#9b59b6', text: '#9b59b6' },
  data: { bg: 'rgba(64, 145, 108, 0.1)', border: '#40916c', text: '#40916c' },
};

const STATUS_ICONS: Record<string, string> = {
  active: '🟢',
  idle: '⚪',
  error: '🔴',
  sleeping: '😴',
};

// ========================================
// Activity Feed Component
// ========================================

function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <Activity size={16} color="var(--accent)" />
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          リアルタイムログ
        </span>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--success)',
          marginLeft: 'auto',
          animation: 'pulse 2s infinite',
        }} />
      </div>
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        padding: 'var(--space-2)',
      }}>
        {activities.slice(-10).reverse().map((activity) => (
          <div
            key={activity.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-1)',
              backgroundColor:
                activity.type === 'success' ? 'var(--success-light)' :
                activity.type === 'warning' ? 'var(--warning-light)' :
                activity.type === 'thinking' ? 'var(--accent-light)' :
                'var(--bg-tertiary)',
            }}
          >
            {activity.type === 'thinking' && <Brain size={14} color="var(--accent)" style={{ marginTop: '2px', flexShrink: 0 }} />}
            {activity.type === 'success' && <CheckCircle size={14} color="var(--success)" style={{ marginTop: '2px', flexShrink: 0 }} />}
            {activity.type === 'warning' && <AlertTriangle size={14} color="var(--warning)" style={{ marginTop: '2px', flexShrink: 0 }} />}
            {activity.type === 'info' && <Radio size={14} color="var(--text-tertiary)" style={{ marginTop: '2px', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activity.agent}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {new Date(activity.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {activity.action}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========================================
// Agent Card Component
// ========================================

function AgentCard({ agent }: { agent: AgentStatus }) {
  const statusColors = {
    active: 'var(--success)',
    idle: 'var(--text-tertiary)',
    thinking: 'var(--accent)',
  };

  const statusLabels = {
    active: '稼働中',
    idle: '待機中',
    thinking: '処理中',
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      transition: 'all 0.15s ease',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: `${agent.color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: agent.color }}>
          {agent.name.charAt(0)}
        </span>
        <div style={{
          position: 'absolute',
          bottom: '-2px',
          right: '-2px',
          width: '12px',
          height: '12px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: statusColors[agent.status],
          border: '2px solid var(--bg-elevated)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {agent.name}
        </div>
        <div style={{
          fontSize: 'var(--text-xs)',
          color: statusColors[agent.status],
          fontWeight: 500,
        }}>
          {statusLabels[agent.status]}
        </div>
      </div>
    </div>
  );
}

// ========================================
// Agent Map Components (n8n風)
// ========================================

function AgentMapView({
  nodes,
  reactLoopStatus,
  onToggleReactLoop,
  onNodeSelect,
}: {
  nodes: AgentNode[];
  reactLoopStatus: 'running' | 'stopped';
  onToggleReactLoop: () => void;
  onNodeSelect: (node: AgentNode) => void;
}) {
  // 階層ごとにグループ化
  const layers = [
    { title: '🧠 コア', type: 'core' as NodeType, nodes: nodes.filter(n => n.type === 'core') },
    { title: '🤖 サブエージェント', type: 'sub' as NodeType, nodes: nodes.filter(n => n.type === 'sub') },
    { title: '🔧 ツール', type: 'tool' as NodeType, nodes: nodes.filter(n => n.type === 'tool') },
    { title: '💾 データ', type: 'data' as NodeType, nodes: nodes.filter(n => n.type === 'data') },
  ];

  return (
    <div>
      {/* ReActループ制御 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: reactLoopStatus === 'running'
          ? 'rgba(39, 174, 96, 0.1)'
          : 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${reactLoopStatus === 'running' ? 'rgba(39, 174, 96, 0.3)' : 'var(--border)'}`,
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: reactLoopStatus === 'running' ? '#27ae60' : 'var(--text-tertiary)',
            animation: reactLoopStatus === 'running' ? 'pulse 2s infinite' : 'none',
          }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              自律モード
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              {reactLoopStatus === 'running' ? '稼働中 - 5分ごとに思考' : '停止中'}
            </div>
          </div>
        </div>
        <button
          onClick={onToggleReactLoop}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: reactLoopStatus === 'running' ? '#e94560' : '#27ae60',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {reactLoopStatus === 'running' ? (
            <><Square size={14} /> 停止</>
          ) : (
            <><Play size={14} /> 起動</>
          )}
        </button>
      </div>

      {/* ノードマップ */}
      {layers.map((layer, layerIndex) => (
        <div key={layer.title} style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginBottom: 'var(--space-2)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {layer.title}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: 'var(--space-2)',
          }}>
            {layer.nodes.map(node => (
              <MapNodeCard
                key={node.id}
                node={node}
                onClick={() => onNodeSelect(node)}
              />
            ))}
          </div>

          {/* 接続矢印 */}
          {layerIndex < layers.length - 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: 'var(--space-2) 0',
            }}>
              <svg width="24" height="16" viewBox="0 0 24 16">
                <path
                  d="M12 0 L12 10 M6 6 L12 12 L18 6"
                  stroke="var(--border)"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MapNodeCard({
  node,
  onClick,
}: {
  node: AgentNode;
  onClick: () => void;
}) {
  const colors = NODE_COLORS[node.type];

  return (
    <div
      onClick={onClick}
      style={{
        padding: 'var(--space-2) var(--space-3)',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute',
        top: '4px',
        right: '4px',
        fontSize: '8px',
      }}>
        {STATUS_ICONS[node.status]}
      </div>

      <div style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: colors.text,
        marginBottom: '2px',
        paddingRight: '16px',
      }}>
        {node.name}
      </div>

      <div style={{
        fontSize: '10px',
        color: 'var(--text-tertiary)',
        lineHeight: 1.2,
      }}>
        {node.description}
      </div>

      {node.connections.length > 0 && (
        <div style={{
          fontSize: '9px',
          color: 'var(--text-tertiary)',
          marginTop: '4px',
        }}>
          → {node.connections.length}
        </div>
      )}
    </div>
  );
}

// ノード詳細モーダル
function NodeDetailModal({
  node,
  allNodes,
  onClose
}: {
  node: AgentNode;
  allNodes: AgentNode[];
  onClose: () => void;
}) {
  const colors = NODE_COLORS[node.type];

  // このノードへの接続と、このノードからの接続
  const incomingNodes = allNodes.filter(n => n.connections.includes(node.id));
  const outgoingNodes = node.connections.map(id => allNodes.find(n => n.id === id)).filter(Boolean);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '70vh',
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          padding: 'var(--space-5)',
          overflowY: 'auto',
        }}
      >
        {/* ハンドル */}
        <div style={{
          width: '40px',
          height: '4px',
          backgroundColor: 'var(--border)',
          borderRadius: '2px',
          margin: '0 auto var(--space-4)',
        }} />

        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: colors.bg,
            border: `2px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            {STATUS_ICONS[node.status]}
          </div>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: colors.text,
            }}>
              {node.name}
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              {node.description}
            </p>
          </div>
        </div>

        {/* 接続情報 */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-2)',
          }}>
            接続
          </h3>

          {incomingNodes.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
                ← 入力元
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                {incomingNodes.map(n => (
                  <span
                    key={n.id}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: NODE_COLORS[n.type].bg,
                      border: `1px solid ${NODE_COLORS[n.type].border}`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-xs)',
                      color: NODE_COLORS[n.type].text,
                    }}
                  >
                    {n.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {outgoingNodes.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
                → 出力先
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                {outgoingNodes.map(n => n && (
                  <span
                    key={n.id}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: NODE_COLORS[n.type].bg,
                      border: `1px solid ${NODE_COLORS[n.type].border}`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-xs)',
                      color: NODE_COLORS[n.type].text,
                    }}
                  >
                    {n.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {incomingNodes.length === 0 && outgoingNodes.length === 0 && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              接続なし（末端ノード）
            </div>
          )}
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

// ========================================
// Main Dashboard Component
// ========================================

export default function AgentsDashboard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>(AGENTS);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [mapNodes, setMapNodes] = useState<AgentNode[]>(AGENT_NODES);
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);
  const [reactLoopStatus, setReactLoopStatus] = useState<'running' | 'stopped'>('stopped');

  useEffect(() => {
    setMounted(true);
  }, []);

  // ReActループの状態を取得
  const fetchReactLoopStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/react-loop');
      const data = await res.json();

      if (data.status?.isRunning) {
        setReactLoopStatus('running');
        setMapNodes(prev => prev.map(n =>
          n.id === 'react-loop' ? { ...n, status: 'active' } : n
        ));
      } else {
        setReactLoopStatus('stopped');
        setMapNodes(prev => prev.map(n =>
          n.id === 'react-loop' ? { ...n, status: 'idle' } : n
        ));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchReactLoopStatus();
    const interval = setInterval(fetchReactLoopStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchReactLoopStatus]);

  // ReActループの開始/停止
  const toggleReactLoop = async () => {
    try {
      const action = reactLoopStatus === 'running' ? 'stop' : 'start';
      await fetch('/api/react-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchReactLoopStatus();
    } catch {
      // ignore
    }
  };

  // Initialize activities and simulate agent activity
  useEffect(() => {
    setActivities([
      { id: '1', timestamp: new Date().toISOString(), agent: '番頭', action: 'システム起動完了', type: 'success' },
      { id: '2', timestamp: new Date().toISOString(), agent: 'System', action: '全エージェント監視開始', type: 'info' },
    ]);

    const agentNames = AGENTS.map(a => a.name);
    const statuses: ('active' | 'idle' | 'thinking')[] = ['active', 'idle', 'thinking'];

    const interval = setInterval(() => {
      const randomAgent = agentNames[Math.floor(Math.random() * agentNames.length)];
      const actions = [
        { action: 'タスクを受信', type: 'thinking' as const },
        { action: '処理完了', type: 'success' as const },
        { action: 'データを更新', type: 'info' as const },
        { action: '分析実行中', type: 'thinking' as const },
        { action: 'レポート生成', type: 'success' as const },
        { action: 'コンテンツ作成中', type: 'thinking' as const },
        { action: 'API連携完了', type: 'success' as const },
      ];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      setActivities(prev => [...prev.slice(-15), {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        agent: randomAgent,
        ...randomAction,
      }]);

      setAgents(prev => prev.map(agent => {
        if (Math.random() < 0.15) {
          return { ...agent, status: statuses[Math.floor(Math.random() * statuses.length)] };
        }
        return agent;
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const activeCount = agents.filter(a => a.status === 'active').length;
  const thinkingCount = agents.filter(a => a.status === 'thinking').length;

  if (!mounted) {
    return (
      <div style={{
        height: 'calc(100dvh - var(--mobile-nav-height))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100dvh - var(--mobile-nav-height))',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: 'var(--space-4)',
      width: '100%',
    }}>
      {/* Header */}
      <header style={{
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Network size={20} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                エージェント管理
              </h1>
              <p style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                margin: 0,
              }}>
                {agents.length} AIエージェント
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}>
            <button
              onClick={() => setViewMode('map')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: viewMode === 'map' ? 'var(--bg-elevated)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: viewMode === 'map' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Map size={14} />
              マップ
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: viewMode === 'list' ? 'var(--bg-elevated)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <List size={14} />
              一覧
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            color: 'var(--success)',
          }}>
            {activeCount}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>稼働中</div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            color: 'var(--accent)',
          }}>
            {thinkingCount}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>処理中</div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            {agents.length}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>総数</div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'map' ? (
        <AgentMapView
          nodes={mapNodes}
          reactLoopStatus={reactLoopStatus}
          onToggleReactLoop={toggleReactLoop}
          onNodeSelect={setSelectedNode}
        />
      ) : (
        <>
          {/* Activity Feed */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <ActivityFeed activities={activities} />
          </div>

          {/* Agent Grid */}
          <div>
            <h2 style={{
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-3)',
            }}>
              エージェント一覧
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 'var(--space-2)',
            }}>
              {agents.map((agent) => (
                <AgentCard key={agent.name} agent={agent} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Node Detail Modal */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          allNodes={mapNodes}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

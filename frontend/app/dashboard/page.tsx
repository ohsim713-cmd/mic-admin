'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Network, Radio, Brain, CheckCircle, AlertTriangle,
  Activity, Users, Map, List, Play, Square,
  Twitter, Instagram, Database, FileText, Zap, Eye
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

type NodeType = 'core' | 'sub' | 'tool' | 'data' | 'sns';

interface AgentNode {
  id: string;
  name: string;
  type: NodeType;
  description: string;
  status: 'active' | 'idle' | 'error' | 'sleeping';
  connections: string[];
  icon?: string;
  details?: {
    accounts?: { platform: string; handle: string; status: string }[];
    dataCount?: number;
    lastUpdate?: string;
    metrics?: Record<string, number | string>;
  };
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

// ノードデータ（SNSアカウント情報付き）
const AGENT_NODES: AgentNode[] = [
  // コア
  {
    id: 'react-loop',
    name: 'ReAct Loop',
    type: 'core',
    description: '自律思考エンジン',
    status: 'idle',
    connections: ['sns-agent', 'scheduler'],
    icon: '🧠',
    details: {
      metrics: {
        'サイクル間隔': '5分',
        '稼働モード': '自律',
        '連続エラー': 0,
      }
    }
  },
  {
    id: 'sns-agent',
    name: 'SNS Agent',
    type: 'core',
    description: 'SNS統括マネージャー',
    status: 'idle',
    connections: ['generator', 'poster', 'analytics'],
    icon: '📱',
  },
  // SNSプラットフォーム
  {
    id: 'twitter-node',
    name: 'X (Twitter)',
    type: 'sns',
    description: 'Xへの投稿',
    status: 'active',
    connections: [],
    icon: '𝕏',
    details: {
      accounts: [
        { platform: 'X', handle: '@tt_liver', status: 'active' },
        { platform: 'X', handle: '@tt_chatlady', status: 'idle' },
      ],
      metrics: {
        '今日の投稿': 8,
        '予定': 7,
      }
    }
  },
  {
    id: 'threads-node',
    name: 'Threads',
    type: 'sns',
    description: 'Threadsへの投稿',
    status: 'idle',
    connections: [],
    icon: '🧵',
    details: {
      accounts: [
        { platform: 'Threads', handle: '@liver_recruit', status: 'idle' },
      ],
      metrics: {
        '今日の投稿': 0,
        '予定': 0,
      }
    }
  },
  // サブエージェント
  {
    id: 'generator',
    name: 'Post Generator',
    type: 'sub',
    description: '投稿文を生成',
    status: 'idle',
    connections: ['knowledge', 'patterns'],
    icon: '✍️',
    details: {
      metrics: {
        '生成モード': '粘り強い',
        '目標スコア': '10点以上',
        '最大リトライ': 5,
      }
    }
  },
  {
    id: 'poster',
    name: 'SNS Poster',
    type: 'sub',
    description: 'Playwrightで投稿実行',
    status: 'idle',
    connections: ['twitter-node', 'threads-node', 'session'],
    icon: '🚀',
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    type: 'sub',
    description: '投稿スケジュール管理',
    status: 'active',
    connections: ['stock', 'poster'],
    icon: '📅',
    details: {
      metrics: {
        '1日の投稿枠': 15,
        '次の投稿': '19:00',
      }
    }
  },
  {
    id: 'analytics',
    name: 'Analytics',
    type: 'sub',
    description: 'パフォーマンス分析',
    status: 'idle',
    connections: ['patterns'],
    icon: '📊',
  },
  {
    id: 'scout',
    name: 'Scout',
    type: 'sub',
    description: 'Webスクレイピング',
    status: 'idle',
    connections: ['memory'],
    icon: '🔍',
  },
  // ツール
  {
    id: 'session',
    name: 'Session Manager',
    type: 'tool',
    description: 'ログイン状態を管理',
    status: 'active',
    connections: [],
    icon: '🔐',
    details: {
      accounts: [
        { platform: 'X', handle: '@tt_liver', status: 'logged_in' },
      ],
    }
  },
  // データ
  {
    id: 'knowledge',
    name: 'Knowledge Base',
    type: 'data',
    description: 'ナレッジJSON',
    status: 'active',
    connections: [],
    icon: '📚',
    details: {
      dataCount: 12,
      lastUpdate: '2024-01-15',
      metrics: {
        'ライバー系': '8ファイル',
        'チャトレ系': '4ファイル',
      }
    }
  },
  {
    id: 'stock',
    name: 'Post Stock',
    type: 'data',
    description: '投稿ストック',
    status: 'active',
    connections: [],
    icon: '📦',
    details: {
      dataCount: 23,
      metrics: {
        'ライバー用': 18,
        'チャトレ用': 5,
      }
    }
  },
  {
    id: 'patterns',
    name: 'Success Patterns',
    type: 'data',
    description: '成功パターンDB',
    status: 'active',
    connections: [],
    icon: '🏆',
    details: {
      dataCount: 47,
      metrics: {
        '高スコア': 12,
        '学習済み': 47,
      }
    }
  },
  {
    id: 'memory',
    name: 'Vector Memory',
    type: 'data',
    description: 'セマンティック検索DB',
    status: 'active',
    connections: [],
    icon: '🧬',
    details: {
      metrics: {
        'ドキュメント数': '---',
        '検索精度': '0.7+',
      }
    }
  },
];

// ノードカラー
const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string; glow: string }> = {
  core: { bg: 'rgba(233, 69, 96, 0.15)', border: '#e94560', text: '#e94560', glow: 'rgba(233, 69, 96, 0.4)' },
  sub: { bg: 'rgba(77, 168, 218, 0.15)', border: '#4da8da', text: '#4da8da', glow: 'rgba(77, 168, 218, 0.4)' },
  tool: { bg: 'rgba(155, 89, 182, 0.15)', border: '#9b59b6', text: '#9b59b6', glow: 'rgba(155, 89, 182, 0.4)' },
  data: { bg: 'rgba(64, 145, 108, 0.15)', border: '#40916c', text: '#40916c', glow: 'rgba(64, 145, 108, 0.4)' },
  sns: { bg: 'rgba(29, 161, 242, 0.15)', border: '#1da1f2', text: '#1da1f2', glow: 'rgba(29, 161, 242, 0.4)' },
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
      <div style={{ maxHeight: '300px', overflowY: 'auto', padding: 'var(--space-2)' }}>
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
// n8n-Style Node Graph
// ========================================

function NodeGraph({
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
  const containerRef = useRef<HTMLDivElement>(null);

  // ノードの位置を計算（モバイル対応のグリッドレイアウト）
  const getNodePosition = (nodeId: string): { x: number; y: number } => {
    const positions: Record<string, { x: number; y: number }> = {
      // Row 1: Core
      'react-loop': { x: 25, y: 8 },
      'sns-agent': { x: 75, y: 8 },
      // Row 2: Sub-agents
      'generator': { x: 10, y: 28 },
      'scheduler': { x: 40, y: 28 },
      'poster': { x: 70, y: 28 },
      'analytics': { x: 90, y: 28 },
      // Row 3: SNS
      'twitter-node': { x: 55, y: 48 },
      'threads-node': { x: 85, y: 48 },
      // Row 4: Tools & Data
      'session': { x: 85, y: 68 },
      'scout': { x: 10, y: 48 },
      'knowledge': { x: 10, y: 68 },
      'stock': { x: 35, y: 68 },
      'patterns': { x: 60, y: 68 },
      'memory': { x: 10, y: 88 },
    };
    return positions[nodeId] || { x: 50, y: 50 };
  };

  // 接続線を描画
  const renderConnections = () => {
    const lines: React.ReactElement[] = [];

    nodes.forEach(node => {
      const fromPos = getNodePosition(node.id);

      node.connections.forEach(targetId => {
        const toPos = getNodePosition(targetId);
        const targetNode = nodes.find(n => n.id === targetId);

        if (toPos) {
          const isActive = node.status === 'active' || targetNode?.status === 'active';
          lines.push(
            <line
              key={`${node.id}-${targetId}`}
              x1={`${fromPos.x}%`}
              y1={`${fromPos.y + 4}%`}
              x2={`${toPos.x}%`}
              y2={`${toPos.y}%`}
              stroke={isActive ? 'rgba(39, 174, 96, 0.6)' : 'rgba(255,255,255,0.15)'}
              strokeWidth={isActive ? 2 : 1}
              strokeDasharray={isActive ? '0' : '4 4'}
              style={{
                filter: isActive ? 'drop-shadow(0 0 4px rgba(39, 174, 96, 0.5))' : 'none',
              }}
            />
          );
        }
      });
    });

    return lines;
  };

  return (
    <div>
      {/* ReActループ制御 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-3)',
        backgroundColor: reactLoopStatus === 'running'
          ? 'rgba(39, 174, 96, 0.1)'
          : 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${reactLoopStatus === 'running' ? 'rgba(39, 174, 96, 0.3)' : 'var(--border)'}`,
        marginBottom: 'var(--space-3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: reactLoopStatus === 'running' ? '#27ae60' : 'var(--text-tertiary)',
            animation: reactLoopStatus === 'running' ? 'pulse 2s infinite' : 'none',
            boxShadow: reactLoopStatus === 'running' ? '0 0 8px rgba(39, 174, 96, 0.6)' : 'none',
          }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              自律モード
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
              {reactLoopStatus === 'running' ? '稼働中' : '停止中'}
            </div>
          </div>
        </div>
        <button
          onClick={onToggleReactLoop}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: reactLoopStatus === 'running' ? '#e94560' : '#27ae60',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: `0 2px 8px ${reactLoopStatus === 'running' ? 'rgba(233, 69, 96, 0.3)' : 'rgba(39, 174, 96, 0.3)'}`,
          }}
        >
          {reactLoopStatus === 'running' ? <Square size={14} /> : <Play size={14} />}
          {reactLoopStatus === 'running' ? '停止' : '起動'}
        </button>
      </div>

      {/* ノードグラフ */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '420px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* グリッド背景 */}
        <svg
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.3,
          }}
        >
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* 接続線 */}
        <svg
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {renderConnections()}
        </svg>

        {/* ノード */}
        {nodes.map(node => {
          const pos = getNodePosition(node.id);
          const colors = NODE_COLORS[node.type];
          const isActive = node.status === 'active';

          return (
            <div
              key={node.id}
              onClick={() => onNodeSelect(node)}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                padding: '8px 10px',
                backgroundColor: colors.bg,
                border: `2px solid ${colors.border}`,
                borderRadius: '10px',
                cursor: 'pointer',
                minWidth: '70px',
                maxWidth: '90px',
                textAlign: 'center',
                boxShadow: isActive
                  ? `0 0 12px ${colors.glow}, 0 2px 8px rgba(0,0,0,0.2)`
                  : '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                zIndex: 10,
              }}
            >
              {/* アイコン */}
              <div style={{
                fontSize: '16px',
                marginBottom: '2px',
              }}>
                {node.icon || '⚡'}
              </div>
              {/* 名前 */}
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {node.name}
              </div>
              {/* ステータスドット */}
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isActive ? '#27ae60' : node.status === 'error' ? '#e94560' : '#666',
                border: '2px solid var(--bg-secondary)',
                boxShadow: isActive ? '0 0 6px rgba(39, 174, 96, 0.6)' : 'none',
              }} />
            </div>
          );
        })}

        {/* 凡例 */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          {(['core', 'sub', 'sns', 'data'] as NodeType[]).map(type => (
            <div
              key={type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                backgroundColor: 'rgba(0,0,0,0.4)',
                borderRadius: '4px',
                fontSize: '9px',
                color: NODE_COLORS[type].text,
              }}
            >
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: NODE_COLORS[type].border,
              }} />
              {type === 'core' ? 'コア' : type === 'sub' ? 'エージェント' : type === 'sns' ? 'SNS' : 'データ'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========================================
// Node Detail Modal (Enhanced)
// ========================================

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
  const incomingNodes = allNodes.filter(n => n.connections.includes(node.id));
  const outgoingNodes = node.connections.map(id => allNodes.find(n => n.id === id)).filter(Boolean);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
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
          maxHeight: '80vh',
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          overflowY: 'auto',
        }}
      >
        {/* ハンドル */}
        <div style={{
          width: '40px',
          height: '4px',
          backgroundColor: 'var(--border)',
          borderRadius: '2px',
          margin: '0 auto 16px',
        }} />

        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            backgroundColor: colors.bg,
            border: `2px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            boxShadow: node.status === 'active' ? `0 0 16px ${colors.glow}` : 'none',
          }}>
            {node.icon || '⚡'}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              color: colors.text,
            }}>
              {node.name}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
              {node.description}
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '6px',
              padding: '2px 8px',
              backgroundColor: node.status === 'active' ? 'rgba(39, 174, 96, 0.2)' : 'var(--bg-tertiary)',
              borderRadius: '10px',
              fontSize: '11px',
              color: node.status === 'active' ? '#27ae60' : 'var(--text-secondary)',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: node.status === 'active' ? '#27ae60' : '#666',
              }} />
              {node.status === 'active' ? '稼働中' : node.status === 'error' ? 'エラー' : '待機中'}
            </div>
          </div>
        </div>

        {/* SNSアカウント情報 */}
        {node.details?.accounts && node.details.accounts.length > 0 && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '12px',
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              アカウント
            </div>
            {node.details.accounts.map((acc, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {acc.platform === 'X' && <span style={{ fontSize: '14px' }}>𝕏</span>}
                  {acc.platform === 'Threads' && <span style={{ fontSize: '14px' }}>🧵</span>}
                  {acc.platform === 'Instagram' && <Instagram size={14} color="#E4405F" />}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {acc.handle}
                  </span>
                </div>
                <span style={{
                  padding: '2px 8px',
                  backgroundColor: acc.status === 'active' || acc.status === 'logged_in'
                    ? 'rgba(39, 174, 96, 0.15)'
                    : 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  fontSize: '10px',
                  color: acc.status === 'active' || acc.status === 'logged_in' ? '#27ae60' : 'var(--text-tertiary)',
                }}>
                  {acc.status === 'active' ? '稼働中' : acc.status === 'logged_in' ? 'ログイン済' : '待機中'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* メトリクス */}
        {node.details?.metrics && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '12px',
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              詳細データ
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}>
              {Object.entries(node.details.metrics).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    padding: '8px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{key}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* データ数 */}
        {node.details?.dataCount !== undefined && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            marginBottom: '12px',
          }}>
            <Database size={18} color={colors.text} />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>格納データ</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {node.details.dataCount} 件
              </div>
            </div>
          </div>
        )}

        {/* 接続情報 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            接続
          </div>

          {incomingNodes.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                ← 入力元
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {incomingNodes.map(n => (
                  <span
                    key={n.id}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: NODE_COLORS[n.type].bg,
                      border: `1px solid ${NODE_COLORS[n.type].border}`,
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: NODE_COLORS[n.type].text,
                    }}
                  >
                    {n.icon} {n.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {outgoingNodes.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                → 出力先
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {outgoingNodes.map(n => n && (
                  <span
                    key={n.id}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: NODE_COLORS[n.type].bg,
                      border: `1px solid ${NODE_COLORS[n.type].border}`,
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: NODE_COLORS[n.type].text,
                    }}
                  >
                    {n.icon} {n.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {incomingNodes.length === 0 && outgoingNodes.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              接続なし（末端ノード）
            </div>
          )}
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: '12px',
            color: 'var(--text-primary)',
            fontSize: '14px',
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

  // ストック数を取得
  const fetchStockCount = useCallback(async () => {
    try {
      const res = await fetch('/api/dm-hunter/stock');
      const data = await res.json();
      if (data.count !== undefined) {
        setMapNodes(prev => prev.map(n =>
          n.id === 'stock' ? {
            ...n,
            details: {
              ...n.details,
              dataCount: data.count,
            }
          } : n
        ));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchReactLoopStatus();
    fetchStockCount();
    const interval = setInterval(() => {
      fetchReactLoopStatus();
      fetchStockCount();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchReactLoopStatus, fetchStockCount]);

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
      padding: 'var(--space-3)',
      width: '100%',
    }}>
      {/* Header */}
      <header style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Network size={18} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                Agent Network
              </h1>
              <p style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                margin: 0,
              }}>
                {mapNodes.length} nodes
              </p>
            </div>
          </div>

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
                gap: '4px',
                padding: '6px 10px',
                backgroundColor: viewMode === 'map' ? 'var(--bg-elevated)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: viewMode === 'map' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Map size={12} />
              Map
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                backgroundColor: viewMode === 'list' ? 'var(--bg-elevated)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <List size={12} />
              List
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-3)',
      }}>
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>
            {activeCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Active</div>
        </div>
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>
            {thinkingCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Processing</div>
        </div>
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {mapNodes.length}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Nodes</div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'map' ? (
        <NodeGraph
          nodes={mapNodes}
          reactLoopStatus={reactLoopStatus}
          onToggleReactLoop={toggleReactLoop}
          onNodeSelect={setSelectedNode}
        />
      ) : (
        <>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <ActivityFeed activities={activities} />
          </div>
          <div>
            <h2 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              エージェント一覧
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
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

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

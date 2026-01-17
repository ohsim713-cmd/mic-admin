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
    tech?: Record<string, string>;
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

// サブエージェント管理用のノードデータ（日本語化 + 詳細説明 + 技術情報）
const AGENT_NODES: AgentNode[] = [
  // 中央: メインコントローラー
  {
    id: 'controller',
    name: '司令塔',
    type: 'core',
    description: '全体を統括する自律AIエンジン。5分ごとに状況を判断し、各エージェントに指示を出す。',
    status: 'idle',
    connections: ['generator', 'scheduler', 'analytics'],
    icon: '🧠',
    details: {
      metrics: {
        '動作モード': '自律',
        '判断サイクル': '5分',
        '連続エラー': 0,
      },
      tech: {
        'AI': 'Gemini 2.0 Flash',
        'アーキテクチャ': 'ReActループ',
        'API': '/api/react-loop',
        '実装': 'lib/agents/react-loop.ts',
      },
    }
  },
  // 左上: 投稿生成
  {
    id: 'generator',
    name: '投稿作成',
    type: 'sub',
    description: 'ナレッジと成功パターンを元に、高品質な投稿文を生成。10点以上になるまで最大5回リトライ。',
    status: 'idle',
    connections: ['sns'],
    icon: '✍️',
    details: {
      metrics: {
        '目標スコア': '10点以上',
        '最大リトライ': '5回',
        '生成モード': '粘り強い',
      },
      tech: {
        'AI': 'Gemini 2.0 Flash',
        '品質評価': 'LLM自己評価',
        'API': '/api/generate/persistent',
        'データソース': 'knowledge/*.json',
      },
    }
  },
  // 右上: スケジューラー
  {
    id: 'scheduler',
    name: 'スケジューラー',
    type: 'sub',
    description: '投稿の時間管理。ストックから最適な時間に自動投稿。1日15枠でバランス良く配信。',
    status: 'active',
    connections: ['sns'],
    icon: '📅',
    details: {
      metrics: {
        '1日の投稿枠': 15,
        '次回投稿': '19:00',
        'ストック残': '---',
      },
      tech: {
        '実行': 'setInterval (1分)',
        'ストレージ': 'Supabase',
        'API': '/api/automation/post',
        'スケジュール生成': '/api/automation/create-schedules',
      },
    }
  },
  // 左下: 分析
  {
    id: 'analytics',
    name: '分析',
    type: 'sub',
    description: '投稿のパフォーマンスを分析し、成功パターンを学習。何が効果的かを常に改善。',
    status: 'idle',
    connections: [],
    icon: '📊',
    details: {
      metrics: {
        '学習済みパターン': 47,
        '高スコアパターン': 12,
        '分析頻度': '6時間ごと',
      },
      tech: {
        'AI': 'Gemini 2.0 Flash',
        'データ取得': 'X API (インプレッション)',
        'API': '/api/automation/learn',
        '保存先': 'lib/knowledge/success-patterns.json',
      },
    }
  },
  // 右下: SNS出力
  {
    id: 'sns',
    name: 'SNS投稿',
    type: 'sns',
    description: 'X(Twitter)やThreadsに実際に投稿を行う。Playwrightでブラウザ操作。',
    status: 'active',
    connections: [],
    icon: '📱',
    details: {
      accounts: [
        { platform: 'X', handle: '@tt_liver', status: 'active' },
        { platform: 'Threads', handle: '@liver_recruit', status: 'idle' },
      ],
      metrics: {
        '今日の投稿': 8,
        '本日予定': 7,
      },
      tech: {
        'ブラウザ自動化': 'Playwright',
        'セッション管理': 'Cookies保存',
        'X投稿': '/api/sns/twitter',
        'Threads投稿': '/api/sns/threads',
      },
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
// シンプル組織図コンポーネント
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
  // ノードを役割別に取得
  const coreNode = nodes.find(n => n.type === 'core');
  const subNodes = nodes.filter(n => n.type === 'sub');
  const snsNode = nodes.find(n => n.type === 'sns');

  // ノードカードコンポーネント
  const NodeCard = ({ node, size = 'normal' }: { node: AgentNode; size?: 'large' | 'normal' | 'small' }) => {
    const colors = NODE_COLORS[node.type];
    const isActive = node.status === 'active';
    const isLarge = size === 'large';

    return (
      <div
        onClick={() => onNodeSelect(node)}
        style={{
          padding: isLarge ? '16px 20px' : '12px 16px',
          backgroundColor: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: '12px',
          cursor: 'pointer',
          textAlign: 'center',
          position: 'relative',
          boxShadow: isActive
            ? `0 0 16px ${colors.glow}, 0 4px 12px rgba(0,0,0,0.15)`
            : '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          minWidth: isLarge ? '120px' : '90px',
        }}
      >
        <div style={{ fontSize: isLarge ? '28px' : '20px', marginBottom: '4px' }}>
          {node.icon}
        </div>
        <div style={{
          fontSize: isLarge ? '14px' : '12px',
          fontWeight: 600,
          color: colors.text,
        }}>
          {node.name}
        </div>
        {/* ステータスドット */}
        <div style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: isActive ? '#27ae60' : '#888',
          border: '2px solid var(--bg-elevated)',
          boxShadow: isActive ? '0 0 6px rgba(39, 174, 96, 0.6)' : 'none',
        }} />
      </div>
    );
  };

  return (
    <div>
      {/* 自律モード制御 */}
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
          }}
        >
          {reactLoopStatus === 'running' ? <Square size={14} /> : <Play size={14} />}
          {reactLoopStatus === 'running' ? '停止' : '起動'}
        </button>
      </div>

      {/* 組織図（上から下へのフロー） */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: 'var(--space-4)',
        overflow: 'auto',
      }}>
        {/* レベル1: 司令塔 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 'var(--space-2)',
        }}>
          {coreNode && <NodeCard node={coreNode} size="large" />}
        </div>

        {/* 接続線（司令塔 → サブエージェント） */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 'var(--space-2)',
        }}>
          <svg width="200" height="30" style={{ overflow: 'visible' }}>
            <line x1="100" y1="0" x2="40" y2="30" stroke="var(--border)" strokeWidth="2" />
            <line x1="100" y1="0" x2="100" y2="30" stroke="var(--border)" strokeWidth="2" />
            <line x1="100" y1="0" x2="160" y2="30" stroke="var(--border)" strokeWidth="2" />
          </svg>
        </div>

        {/* レベル2: サブエージェント（横並び） */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-2)',
        }}>
          {subNodes.map(node => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>

        {/* 接続線（サブエージェント → SNS） */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 'var(--space-2)',
        }}>
          <svg width="200" height="30" style={{ overflow: 'visible' }}>
            <line x1="40" y1="0" x2="100" y2="30" stroke="var(--success)" strokeWidth="2" />
            <line x1="160" y1="0" x2="100" y2="30" stroke="var(--success)" strokeWidth="2" />
          </svg>
        </div>

        {/* レベル3: SNS出力 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
        }}>
          {snsNode && <NodeCard node={snsNode} />}
        </div>
      </div>

      {/* 凡例 */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-3)',
        marginTop: 'var(--space-2)',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#27ae60' }} />
          稼働中
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#888' }} />
          待機中
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

        {/* 技術情報 */}
        {node.details?.tech && (
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
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Zap size={12} />
              技術スタック
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              {Object.entries(node.details.tech).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {key}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: colors.text,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    backgroundColor: colors.bg,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}>
                    {value}
                  </span>
                </div>
              ))}
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
          n.id === 'controller' ? { ...n, status: 'active' } : n
        ));
      } else {
        setReactLoopStatus('stopped');
        setMapNodes(prev => prev.map(n =>
          n.id === 'controller' ? { ...n, status: 'idle' } : n
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

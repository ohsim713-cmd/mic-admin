'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Agent Map - エージェント組織図（n8n風）
 * iPhoneでの表示を想定したモバイルファーストUI
 */

// ノードタイプ
type NodeType = 'core' | 'sub' | 'tool' | 'api' | 'data';

interface AgentNode {
  id: string;
  name: string;
  type: NodeType;
  description: string;
  status: 'active' | 'idle' | 'error' | 'sleeping';
  connections: string[];
  metrics?: {
    lastRun?: string;
    successRate?: number;
    totalRuns?: number;
  };
}

interface Connection {
  from: string;
  to: string;
  label?: string;
  active?: boolean;
}

// エージェント構造データ
const AGENT_NODES: AgentNode[] = [
  // コアエージェント
  {
    id: 'react-loop',
    name: 'ReAct Loop',
    type: 'core',
    description: '自律思考ループ（神経）',
    status: 'idle',
    connections: ['sns-agent', 'monitor', 'scheduler'],
  },
  {
    id: 'sns-agent',
    name: 'SNS Agent',
    type: 'core',
    description: 'SNSマーケティング統括',
    status: 'idle',
    connections: ['post-generator', 'sns-poster', 'analytics'],
  },

  // サブエージェント
  {
    id: 'post-generator',
    name: 'Post Generator',
    type: 'sub',
    description: '投稿生成（粘り強い）',
    status: 'idle',
    connections: ['knowledge', 'quality-scorer'],
  },
  {
    id: 'sns-poster',
    name: 'SNS Poster',
    type: 'sub',
    description: 'Playwright投稿実行',
    status: 'idle',
    connections: ['session-mgr', 'verifier'],
  },
  {
    id: 'monitor',
    name: 'Monitor',
    type: 'sub',
    description: '24時間監視',
    status: 'idle',
    connections: ['alerts'],
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    type: 'sub',
    description: '投稿スケジュール管理',
    status: 'idle',
    connections: ['post-stock'],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    type: 'sub',
    description: 'パフォーマンス分析',
    status: 'idle',
    connections: ['success-patterns'],
  },
  {
    id: 'scout',
    name: 'Scout',
    type: 'sub',
    description: 'Webスクレイピング',
    status: 'idle',
    connections: ['memory'],
  },

  // ツール
  {
    id: 'session-mgr',
    name: 'Session',
    type: 'tool',
    description: 'クッキー永続化',
    status: 'idle',
    connections: [],
  },
  {
    id: 'verifier',
    name: 'Verifier',
    type: 'tool',
    description: '実行結果検証',
    status: 'idle',
    connections: [],
  },
  {
    id: 'quality-scorer',
    name: 'Scorer',
    type: 'tool',
    description: '品質スコアリング',
    status: 'idle',
    connections: [],
  },

  // データ
  {
    id: 'knowledge',
    name: 'Knowledge',
    type: 'data',
    description: 'ナレッジベース',
    status: 'active',
    connections: [],
  },
  {
    id: 'memory',
    name: 'Vector Memory',
    type: 'data',
    description: 'セマンティック検索',
    status: 'active',
    connections: [],
  },
  {
    id: 'post-stock',
    name: 'Post Stock',
    type: 'data',
    description: '投稿ストック',
    status: 'active',
    connections: [],
  },
  {
    id: 'success-patterns',
    name: 'Patterns',
    type: 'data',
    description: '成功パターンDB',
    status: 'active',
    connections: [],
  },
  {
    id: 'alerts',
    name: 'Alerts',
    type: 'data',
    description: 'アラート履歴',
    status: 'idle',
    connections: [],
  },
];

// 接続線を生成
function generateConnections(nodes: AgentNode[]): Connection[] {
  const connections: Connection[] = [];
  nodes.forEach(node => {
    node.connections.forEach(targetId => {
      connections.push({
        from: node.id,
        to: targetId,
        active: node.status === 'active',
      });
    });
  });
  return connections;
}

// ノードカラー
const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  core: { bg: '#1a1a2e', border: '#e94560', text: '#e94560' },
  sub: { bg: '#16213e', border: '#0f3460', text: '#4da8da' },
  tool: { bg: '#1a1a2e', border: '#533483', text: '#9b59b6' },
  api: { bg: '#1a1a2e', border: '#27ae60', text: '#2ecc71' },
  data: { bg: '#0d1b2a', border: '#1b4332', text: '#40916c' },
};

// ステータスアイコン
const STATUS_ICONS: Record<string, string> = {
  active: '🟢',
  idle: '⚪',
  error: '🔴',
  sleeping: '😴',
};

export default function AgentMapPage() {
  const [nodes, setNodes] = useState<AgentNode[]>(AGENT_NODES);
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);
  const [reactLoopStatus, setReactLoopStatus] = useState<'running' | 'stopped'>('stopped');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  // ReActループの状態を取得
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/react-loop');
      const data = await res.json();

      if (data.status?.isRunning) {
        setReactLoopStatus('running');
        setNodes(prev => prev.map(n =>
          n.id === 'react-loop' ? { ...n, status: 'active' } : n
        ));
      } else {
        setReactLoopStatus('stopped');
        setNodes(prev => prev.map(n =>
          n.id === 'react-loop' ? { ...n, status: 'idle' } : n
        ));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // ReActループの開始/停止
  const toggleReactLoop = async () => {
    try {
      const action = reactLoopStatus === 'running' ? 'stop' : 'start';
      await fetch('/api/react-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchStatus();
    } catch {
      // ignore
    }
  };

  const connections = generateConnections(nodes);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      paddingBottom: '80px',
    }}>
      {/* ヘッダー */}
      <header style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(10, 10, 15, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '16px',
        borderBottom: '1px solid #333',
        zIndex: 100,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
            Agent Map
          </h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode(viewMode === 'tree' ? 'list' : 'tree')}
              style={{
                padding: '8px 12px',
                background: '#333',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
              }}
            >
              {viewMode === 'tree' ? '📋' : '🌳'}
            </button>
            <button
              onClick={toggleReactLoop}
              style={{
                padding: '8px 16px',
                background: reactLoopStatus === 'running' ? '#e94560' : '#27ae60',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              {reactLoopStatus === 'running' ? '停止' : '起動'}
            </button>
          </div>
        </div>

        {/* ステータスバー */}
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: reactLoopStatus === 'running' ? 'rgba(39, 174, 96, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: reactLoopStatus === 'running' ? '#27ae60' : '#666',
            animation: reactLoopStatus === 'running' ? 'pulse 2s infinite' : 'none',
          }} />
          <span>
            {reactLoopStatus === 'running' ? '自律モード稼働中' : '待機中'}
          </span>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main style={{ padding: '16px' }}>
        {viewMode === 'tree' ? (
          <TreeView
            nodes={nodes}
            connections={connections}
            onNodeSelect={setSelectedNode}
          />
        ) : (
          <ListView
            nodes={nodes}
            onNodeSelect={setSelectedNode}
          />
        )}
      </main>

      {/* ノード詳細モーダル */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          connections={connections}
          allNodes={nodes}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* グローバルスタイル */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

// ツリービュー（階層構造）
function TreeView({
  nodes,
  connections,
  onNodeSelect
}: {
  nodes: AgentNode[];
  connections: Connection[];
  onNodeSelect: (node: AgentNode) => void;
}) {
  // 階層ごとにグループ化
  const layers = [
    { title: '🧠 コア', nodes: nodes.filter(n => n.type === 'core') },
    { title: '🤖 サブエージェント', nodes: nodes.filter(n => n.type === 'sub') },
    { title: '🔧 ツール', nodes: nodes.filter(n => n.type === 'tool') },
    { title: '💾 データ', nodes: nodes.filter(n => n.type === 'data') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {layers.map((layer, layerIndex) => (
        <div key={layer.title}>
          <h2 style={{
            fontSize: '14px',
            color: '#888',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {layer.title}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '12px',
          }}>
            {layer.nodes.map(node => (
              <NodeCard
                key={node.id}
                node={node}
                onClick={() => onNodeSelect(node)}
                hasConnections={connections.some(c => c.from === node.id)}
              />
            ))}
          </div>

          {/* 接続線（矢印） */}
          {layerIndex < layers.length - 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '8px 0',
            }}>
              <svg width="40" height="24" viewBox="0 0 40 24">
                <path
                  d="M20 0 L20 16 M12 10 L20 18 L28 10"
                  stroke="#333"
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

// リストビュー
function ListView({
  nodes,
  onNodeSelect
}: {
  nodes: AgentNode[];
  onNodeSelect: (node: AgentNode) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {nodes.map(node => (
        <div
          key={node.id}
          onClick={() => onNodeSelect(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: NODE_COLORS[node.type].bg,
            borderLeft: `3px solid ${NODE_COLORS[node.type].border}`,
            borderRadius: '8px',
          }}
        >
          <span style={{ fontSize: '16px' }}>{STATUS_ICONS[node.status]}</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 600,
              fontSize: '15px',
              color: NODE_COLORS[node.type].text,
            }}>
              {node.name}
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              {node.description}
            </div>
          </div>
          <span style={{ color: '#666', fontSize: '12px' }}>
            {node.connections.length > 0 && `→ ${node.connections.length}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ノードカード
function NodeCard({
  node,
  onClick,
  hasConnections,
}: {
  node: AgentNode;
  onClick: () => void;
  hasConnections: boolean;
}) {
  const colors = NODE_COLORS[node.type];

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        position: 'relative',
      }}
    >
      {/* ステータスインジケーター */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        fontSize: '10px',
      }}>
        {STATUS_ICONS[node.status]}
      </div>

      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        color: colors.text,
        marginBottom: '4px',
        paddingRight: '20px',
      }}>
        {node.name}
      </div>

      <div style={{
        fontSize: '11px',
        color: '#888',
        lineHeight: 1.3,
      }}>
        {node.description}
      </div>

      {/* 接続数バッジ */}
      {hasConnections && (
        <div style={{
          marginTop: '8px',
          fontSize: '10px',
          color: '#666',
        }}>
          → {node.connections.length} 接続
        </div>
      )}
    </div>
  );
}

// ノード詳細モーダル
function NodeDetailModal({
  node,
  connections,
  allNodes,
  onClose
}: {
  node: AgentNode;
  connections: Connection[];
  allNodes: AgentNode[];
  onClose: () => void;
}) {
  const colors = NODE_COLORS[node.type];

  // このノードへの接続と、このノードからの接続
  const incomingConnections = connections.filter(c => c.to === node.id);
  const outgoingConnections = connections.filter(c => c.from === node.id);

  const getNodeById = (id: string) => allNodes.find(n => n.id === id);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
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
          background: '#1a1a2e',
          borderRadius: '20px 20px 0 0',
          padding: '24px',
          overflowY: 'auto',
        }}
      >
        {/* ハンドル */}
        <div style={{
          width: '40px',
          height: '4px',
          background: '#444',
          borderRadius: '2px',
          margin: '0 auto 20px',
        }} />

        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: colors.bg,
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
              fontSize: '20px',
              fontWeight: 700,
              color: colors.text,
            }}>
              {node.name}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#888' }}>
              {node.description}
            </p>
          </div>
        </div>

        {/* ステータス */}
        <div style={{
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
            ステータス
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            {node.status === 'active' && '🟢 稼働中'}
            {node.status === 'idle' && '⚪ 待機中'}
            {node.status === 'error' && '🔴 エラー'}
            {node.status === 'sleeping' && '😴 スリープ'}
          </div>
        </div>

        {/* 接続情報 */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', color: '#888', marginBottom: '12px' }}>
            接続
          </h3>

          {/* 入力接続 */}
          {incomingConnections.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                ← 入力元
              </div>
              {incomingConnections.map(conn => {
                const sourceNode = getNodeById(conn.from);
                return sourceNode ? (
                  <div
                    key={conn.from}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      fontSize: '14px',
                    }}
                  >
                    {sourceNode.name}
                    <span style={{ color: '#666', marginLeft: '8px' }}>
                      {sourceNode.description}
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* 出力接続 */}
          {outgoingConnections.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                → 出力先
              </div>
              {outgoingConnections.map(conn => {
                const targetNode = getNodeById(conn.to);
                return targetNode ? (
                  <div
                    key={conn.to}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      fontSize: '14px',
                    }}
                  >
                    {targetNode.name}
                    <span style={{ color: '#666', marginLeft: '8px' }}>
                      {targetNode.description}
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {incomingConnections.length === 0 && outgoingConnections.length === 0 && (
            <div style={{ color: '#666', fontSize: '14px' }}>
              接続なし（末端ノード）
            </div>
          )}
        </div>

        {/* APIエンドポイント */}
        {node.type === 'core' || node.type === 'sub' ? (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(39, 174, 96, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(39, 174, 96, 0.3)',
          }}>
            <div style={{ fontSize: '12px', color: '#27ae60', marginBottom: '4px' }}>
              API エンドポイント
            </div>
            <code style={{
              fontSize: '13px',
              color: '#fff',
              fontFamily: 'monospace',
            }}>
              /api/{node.id.replace('-', '-')}
            </code>
          </div>
        ) : null}

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            background: '#333',
            border: 'none',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            marginTop: '20px',
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

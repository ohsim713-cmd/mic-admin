'use client';

import { useState, useEffect } from 'react';
import {
  Network, Radio, Brain, CheckCircle, AlertTriangle,
  Activity, Users, Zap
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
// Main Dashboard Component
// ========================================

export default function AgentsDashboard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>(AGENTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize activities and simulate agent activity
  useEffect(() => {
    setActivities([
      { id: '1', timestamp: new Date().toISOString(), agent: '番頭', action: 'システム起動完了', type: 'success' },
      { id: '2', timestamp: new Date().toISOString(), agent: 'System', action: '全エージェント監視開始', type: 'info' },
    ]);

    const agentNames = AGENTS.map(a => a.name);
    const statuses: ('active' | 'idle' | 'thinking')[] = ['active', 'idle', 'thinking'];

    const interval = setInterval(() => {
      // Random activity
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

      // Random status change
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
        marginBottom: 'var(--space-6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
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
      </header>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-6)',
      }}>
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--success-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Zap size={20} color="var(--success)" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {activeCount}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>稼働中</div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--accent-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Brain size={20} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {thinkingCount}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>処理中</div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Users size={20} color="var(--text-secondary)" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {agents.length}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>総数</div>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <ActivityFeed activities={activities} />
      </div>

      {/* Agent Grid */}
      <div>
        <h2 style={{
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-4)',
        }}>
          エージェント一覧
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 'var(--space-3)',
        }}>
          {agents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}

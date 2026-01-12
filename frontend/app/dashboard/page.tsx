'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain,
  Eye,
  Monitor,
  Wrench,
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  RefreshCw,
  Plus,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: string;
  lastActive: string | null;
  currentTask: string | null;
}

interface Product {
  id: string;
  name: string;
  status: string;
  deployUrl: string | null;
  metrics: {
    users: number;
    revenue: number;
  };
  health: {
    status: string;
  };
}

interface DashboardData {
  agents: {
    director: AgentInfo;
    hunter: AgentInfo;
    dashboard: AgentInfo;
    builder: AgentInfo;
  };
  systemStatus: string;
  products: Product[];
  stats: {
    totalProducts: number;
    activeProducts: number;
    totalRevenue: number;
    totalUsers: number;
  };
}

const agentIcons: Record<string, React.ElementType> = {
  director: Brain,
  hunter: Eye,
  dashboard: Monitor,
  builder: Wrench,
};

const statusColors: Record<string, string> = {
  idle: 'bg-gray-500',
  working: 'bg-blue-500 animate-pulse',
  active: 'bg-green-500',
  error: 'bg-red-500',
};

const healthColors: Record<string, string> = {
  healthy: 'text-green-500',
  degraded: 'text-yellow-500',
  down: 'text-red-500',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/agents/monitor');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>
              🏭 Product Factory Dashboard
            </h1>
            <p style={{ color: '#888', marginTop: '4px' }}>
              自律型プロダクト生成システム
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            更新
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <StatCard icon={Activity} label="稼働プロダクト" value={data?.stats.activeProducts || 0} color="#22c55e" />
          <StatCard icon={Users} label="総ユーザー" value={data?.stats.totalUsers || 0} color="#3b82f6" />
          <StatCard icon={DollarSign} label="総収益" value={`¥${(data?.stats.totalRevenue || 0).toLocaleString()}`} color="#f59e0b" />
          <StatCard icon={TrendingUp} label="総プロダクト" value={data?.stats.totalProducts || 0} color="#8b5cf6" />
        </div>

        {/* Agent Status */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
          <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🤖 Agent Status
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {data?.agents && Object.entries(data.agents).map(([key, agent]) => {
              const Icon = agentIcons[key] || Brain;
              return (
                <div
                  key={key}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={24} color="#8b5cf6" />
                    </div>
                    <div>
                      <div style={{ color: 'white', fontWeight: 'bold' }}>{agent.name}</div>
                      <div style={{ color: '#888', fontSize: '12px' }}>{agent.role}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className={statusColors[agent.status]} style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
                    <span style={{ color: '#aaa', fontSize: '14px', textTransform: 'capitalize' }}>
                      {agent.status}
                    </span>
                  </div>
                  {agent.currentTask && (
                    <div style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
                      {agent.currentTask}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions & Products */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Quick Actions */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '20px' }}>
              ⚡ Quick Actions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ActionButton
                icon={Eye}
                label="機会を探索"
                description="市場から新しいビジネス機会を発見"
                href="/dashboard/opportunities"
              />
              <ActionButton
                icon={Plus}
                label="機会を追加"
                description="手動で新しい機会を登録"
                onClick={() => alert('機会追加モーダル (TODO)')}
              />
              <ActionButton
                icon={Brain}
                label="評価実行"
                description="保留中の機会を一括評価"
                onClick={async () => {
                  const res = await fetch('/api/agents/director', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'evaluate-all' }),
                  });
                  const data = await res.json();
                  alert(`評価完了: ${data.message}`);
                  fetchData();
                }}
              />
            </div>
          </div>

          {/* Products List */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: 'white', fontSize: '20px', margin: 0 }}>
                📦 Products
              </h2>
              <Link href="/dashboard/products" style={{ color: '#8b5cf6', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                すべて見る <ChevronRight size={16} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data?.products && data.products.length > 0 ? (
                data.products.slice(0, 5).map(product => (
                  <div
                    key={product.id}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ color: 'white', fontWeight: 'bold' }}>{product.name}</div>
                      <div style={{ color: '#888', fontSize: '12px' }}>{product.deployUrl || 'デプロイ待ち'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#888', fontSize: '12px' }}>Users</div>
                        <div style={{ color: 'white' }}>{product.metrics.users}</div>
                      </div>
                      <div className={healthColors[product.health.status]}>
                        {product.health.status === 'healthy' ? <CheckCircle size={20} /> :
                         product.health.status === 'degraded' ? <AlertTriangle size={20} /> :
                         <Clock size={20} />}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
                  まだプロダクトがありません
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '16px',
      padding: '20px',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <Icon size={20} color={color} />
        <span style={{ color: '#888', fontSize: '14px' }}>{label}</span>
      </div>
      <div style={{ color: 'white', fontSize: '28px', fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, description, href, onClick }: {
  icon: React.ElementType;
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      cursor: 'pointer',
      border: '1px solid rgba(255,255,255,0.1)',
      transition: 'all 0.2s',
    }}>
      <Icon size={20} color="#8b5cf6" />
      <div>
        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>{label}</div>
        <div style={{ color: '#666', fontSize: '12px' }}>{description}</div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link>;
  }

  return <div onClick={onClick}>{content}</div>;
}

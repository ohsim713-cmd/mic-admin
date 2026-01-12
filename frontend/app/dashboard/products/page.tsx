'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Github,
  Activity,
  Users,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  templateId: string;
  status: string;
  deployUrl: string | null;
  repoUrl: string | null;
  metrics: {
    users: number;
    revenue: number;
    lastActive: string | null;
  };
  health: {
    status: string;
    lastCheck: string | null;
    uptime: number;
  };
  createdAt: string;
  isOriginal: boolean;
}

interface ProductsData {
  products: Product[];
  stats: {
    totalProducts: number;
    activeProducts: number;
    totalRevenue: number;
    totalUsers: number;
  };
}

const statusColors: Record<string, { color: string; bg: string }> = {
  active: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  building: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  deploying: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  paused: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
  error: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
};

const healthIcons: Record<string, React.ElementType> = {
  healthy: CheckCircle,
  degraded: AlertTriangle,
  down: XCircle,
};

const healthColors: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  down: '#ef4444',
};

export default function ProductsPage() {
  const [data, setData] = useState<ProductsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/agents/monitor');
      if (response.ok) {
        const result = await response.json();
        setData({ products: result.products, stats: result.stats });
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runHealthCheck = async () => {
    const response = await fetch('/api/agents/monitor', { method: 'POST' });
    const result = await response.json();
    alert(`監視完了: ${result.message}`);
    fetchData();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/dashboard" style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '16px' }}>
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>
                📦 Products
              </h1>
              <p style={{ color: '#888', marginTop: '4px' }}>
                稼働中のプロダクト一覧
              </p>
            </div>
            <button
              onClick={runHealthCheck}
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
              <RefreshCw size={16} /> ヘルスチェック
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <StatCard icon={Activity} label="総プロダクト" value={data?.stats.totalProducts || 0} color="#8b5cf6" />
          <StatCard icon={CheckCircle} label="稼働中" value={data?.stats.activeProducts || 0} color="#22c55e" />
          <StatCard icon={Users} label="総ユーザー" value={data?.stats.totalUsers || 0} color="#3b82f6" />
          <StatCard icon={DollarSign} label="総収益" value={`¥${(data?.stats.totalRevenue || 0).toLocaleString()}`} color="#f59e0b" />
        </div>

        {/* Products Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          {data?.products && data.products.length > 0 ? (
            data.products.map(product => {
              const statusStyle = statusColors[product.status] || statusColors.active;
              const HealthIcon = healthIcons[product.health.status] || CheckCircle;
              const healthColor = healthColors[product.health.status] || '#22c55e';

              return (
                <div
                  key={product.id}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <h3 style={{ color: 'white', fontSize: '18px', margin: 0 }}>
                          {product.name}
                        </h3>
                        {product.isOriginal && (
                          <span style={{
                            padding: '2px 8px',
                            background: 'rgba(139, 92, 246, 0.2)',
                            color: '#8b5cf6',
                            borderRadius: '4px',
                            fontSize: '10px'
                          }}>
                            ORIGINAL
                          </span>
                        )}
                      </div>
                      <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
                        {product.description}
                      </p>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      fontSize: '12px',
                    }}>
                      {product.status}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#888', fontSize: '11px' }}>Users</div>
                      <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>{product.metrics.users}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#888', fontSize: '11px' }}>Revenue</div>
                      <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>¥{product.metrics.revenue.toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#888', fontSize: '11px' }}>Uptime</div>
                      <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>{product.health.uptime}%</div>
                    </div>
                  </div>

                  {/* Health & Links */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <HealthIcon size={16} color={healthColor} />
                      <span style={{ color: healthColor, fontSize: '13px' }}>
                        {product.health.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {product.repoUrl && (
                        <a
                          href={product.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '8px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            color: '#888',
                          }}
                        >
                          <Github size={16} />
                        </a>
                      )}
                      {product.deployUrl && (
                        <a
                          href={product.deployUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '8px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            color: '#888',
                          }}
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#666' }}>
              <Activity size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>プロダクトがまだありません</p>
              <p style={{ fontSize: '14px' }}>機会を承認してビルドを開始してください</p>
            </div>
          )}
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

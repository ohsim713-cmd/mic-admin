'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Eye,
  Brain,
  Wrench,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

interface Opportunity {
  id: string;
  title: string;
  description: string;
  source: string;
  keywords: string[];
  painPoints: string[];
  targetAudience: string;
  estimatedDemand: 'low' | 'medium' | 'high';
  status: string;
  discoveredAt: string;
  evaluationScore?: number;
  rejectionReason?: string;
}

interface OpportunitiesData {
  opportunities: Opportunity[];
  pipeline: Record<string, string[]>;
  stats: {
    totalDiscovered: number;
    totalApproved: number;
    totalRejected: number;
    totalDeployed: number;
  };
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  discovered: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: Eye },
  evaluating: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: Brain },
  approved: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: CheckCircle },
  building: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', icon: Wrench },
  deployed: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', icon: TrendingUp },
  rejected: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: XCircle },
};

const demandColors: Record<string, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#22c55e',
};

export default function OpportunitiesPage() {
  const [data, setData] = useState<OpportunitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/agents/hunter');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEvaluate = async (id: string) => {
    const response = await fetch('/api/agents/director', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'evaluate', opportunityId: id }),
    });
    const result = await response.json();
    alert(result.message);
    fetchData();
  };

  const handleBuild = async (id: string) => {
    // TODO: 実装
    alert('ビルド機能は準備中です');
  };

  const filteredOpportunities = data?.opportunities.filter(opp => {
    if (filter === 'all') return true;
    return opp.status === filter;
  }) || [];

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
                👁️ Opportunity Pipeline
              </h1>
              <p style={{ color: '#888', marginTop: '4px' }}>
                発見された機会の管理と評価
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} /> 機会を追加
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <StatBox label="発見" value={data?.stats.totalDiscovered || 0} color="#3b82f6" />
          <StatBox label="承認" value={data?.stats.totalApproved || 0} color="#22c55e" />
          <StatBox label="却下" value={data?.stats.totalRejected || 0} color="#ef4444" />
          <StatBox label="デプロイ済" value={data?.stats.totalDeployed || 0} color="#06b6d4" />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {['all', 'discovered', 'evaluating', 'approved', 'building', 'deployed', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: filter === status ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                background: filter === status ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                color: filter === status ? '#8b5cf6' : '#888',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {status === 'all' ? 'すべて' : status}
            </button>
          ))}
        </div>

        {/* Opportunities List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredOpportunities.length > 0 ? (
            filteredOpportunities.map(opp => {
              const config = statusConfig[opp.status] || statusConfig.discovered;
              const Icon = config.icon;

              return (
                <div
                  key={opp.id}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: config.bg,
                          color: config.color,
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Icon size={14} /> {opp.status}
                        </div>
                        <div style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: 'rgba(255,255,255,0.1)',
                          color: demandColors[opp.estimatedDemand],
                          fontSize: '11px',
                        }}>
                          需要: {opp.estimatedDemand}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px' }}>
                          {opp.source}
                        </div>
                      </div>
                      <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 8px 0' }}>
                        {opp.title}
                      </h3>
                      <p style={{ color: '#888', fontSize: '14px', margin: '0 0 12px 0' }}>
                        {opp.description}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {opp.keywords.map(kw => (
                          <span
                            key={kw}
                            style={{
                              padding: '4px 8px',
                              background: 'rgba(255,255,255,0.05)',
                              borderRadius: '4px',
                              color: '#666',
                              fontSize: '12px',
                            }}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {opp.status === 'discovered' && (
                        <button
                          onClick={() => handleEvaluate(opp.id)}
                          style={{
                            padding: '8px 16px',
                            background: 'rgba(139, 92, 246, 0.2)',
                            border: '1px solid #8b5cf6',
                            borderRadius: '8px',
                            color: '#8b5cf6',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Brain size={14} /> 評価
                        </button>
                      )}
                      {opp.status === 'approved' && (
                        <button
                          onClick={() => handleBuild(opp.id)}
                          style={{
                            padding: '8px 16px',
                            background: 'rgba(34, 197, 94, 0.2)',
                            border: '1px solid #22c55e',
                            borderRadius: '8px',
                            color: '#22c55e',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Wrench size={14} /> ビルド
                        </button>
                      )}
                    </div>
                  </div>
                  {opp.rejectionReason && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '13px' }}>
                      却下理由: {opp.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
              <Eye size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>機会がまだありません</p>
              <p style={{ fontSize: '14px' }}>「機会を追加」または Hunterを実行してください</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddOpportunityModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      padding: '16px',
      borderLeft: `3px solid ${color}`
    }}>
      <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}

function AddOpportunityModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    targetAudience: '',
    painPoints: '',
    keywords: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/agents/hunter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          title: form.title,
          description: form.description,
          targetAudience: form.targetAudience,
          painPoints: form.painPoints.split(',').map(s => s.trim()).filter(Boolean),
          keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add opportunity');
      }
    } catch (error) {
      alert('Error: ' + error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1a1a3e',
        borderRadius: '16px',
        padding: '32px',
        width: '500px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h2 style={{ color: 'white', marginBottom: '24px' }}>新しい機会を追加</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#888', fontSize: '14px', display: 'block', marginBottom: '6px' }}>タイトル *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#888', fontSize: '14px', display: 'block', marginBottom: '6px' }}>説明 *</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              required
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#888', fontSize: '14px', display: 'block', marginBottom: '6px' }}>ターゲット</label>
            <input
              type="text"
              value={form.targetAudience}
              onChange={e => setForm({ ...form, targetAudience: e.target.value })}
              placeholder="例: 中小企業経営者"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#888', fontSize: '14px', display: 'block', marginBottom: '6px' }}>ペインポイント (カンマ区切り)</label>
            <input
              type="text"
              value={form.painPoints}
              onChange={e => setForm({ ...form, painPoints: e.target.value })}
              placeholder="例: 時間がない, 面倒, コストが高い"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: '#888', fontSize: '14px', display: 'block', marginBottom: '6px' }}>キーワード (カンマ区切り)</label>
            <input
              type="text"
              value={form.keywords}
              onChange={e => setForm({ ...form, keywords: e.target.value })}
              placeholder="例: 自動化, AI, SaaS"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#888',
                cursor: 'pointer'
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                color: 'white',
                cursor: 'pointer',
                opacity: submitting ? 0.5 : 1
              }}
            >
              {submitting ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

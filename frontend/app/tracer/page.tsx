'use client';

import { useState, useEffect } from 'react';
import { Activity, Zap, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

interface TriggerEvent {
  id: string;
  type: 'trigger' | 'action' | 'result';
  name: string;
  agent: string;
  data?: unknown;
  timestamp: string;
  parentId?: string;
  duration?: number;
  status?: 'pending' | 'running' | 'success' | 'failed';
}

interface TriggerChain {
  id: string;
  startTime: string;
  endTime?: string;
  events: TriggerEvent[];
  status: 'running' | 'completed' | 'failed';
  summary?: string;
}

interface Stats {
  totalChains: number;
  activeChains: number;
  successRate: number;
  avgDuration: number;
  topTriggers: { name: string; count: number }[];
  topAgents: { name: string; count: number }[];
}

export default function TracerPage() {
  const [chains, setChains] = useState<TriggerChain[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/tracer?type=chains&limit=50');
      const data = await res.json();
      if (data.success) {
        setChains(data.chains || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch tracer data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const toggleChain = (chainId: string) => {
    setExpandedChains(prev => {
      const next = new Set(prev);
      if (next.has(chainId)) {
        next.delete(chainId);
      } else {
        next.add(chainId);
      }
      return next;
    });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle size={14} color="var(--success)" />;
      case 'failed':
        return <XCircle size={14} color="var(--error)" />;
      case 'running':
        return <RefreshCw size={14} color="var(--info)" className="animate-spin" />;
      default:
        return <Clock size={14} color="var(--text-tertiary)" />;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'trigger':
        return 'var(--warning)';
      case 'action':
        return 'var(--info)';
      case 'result':
        return 'var(--success)';
      default:
        return 'var(--text-tertiary)';
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Trigger Tracer</h1>
          <p className="page-subtitle">イベント因果関係の追跡</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自動更新
          </label>
          <button
            onClick={fetchData}
            style={{
              padding: 'var(--space-2)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}>
          <div className="card" style={{ padding: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>総チェーン</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{stats.totalChains}</div>
          </div>
          <div className="card" style={{ padding: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>アクティブ</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--info)' }}>
              {stats.activeChains}
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>成功率</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--success)' }}>
              {(stats.successRate * 100).toFixed(0)}%
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>平均時間</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
              {formatDuration(stats.avgDuration)}
            </div>
          </div>
        </div>
      )}

      {/* Top Triggers & Agents */}
      {stats && (stats.topTriggers.length > 0 || stats.topAgents.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}>
          {stats.topTriggers.length > 0 && (
            <div className="card" style={{ padding: 'var(--space-3)' }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-2)',
              }}>
                頻出トリガー
              </div>
              {stats.topTriggers.slice(0, 3).map((t, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--text-xs)',
                  padding: '2px 0',
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t.name}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t.count}</span>
                </div>
              ))}
            </div>
          )}
          {stats.topAgents.length > 0 && (
            <div className="card" style={{ padding: 'var(--space-3)' }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-2)',
              }}>
                活発なエージェント
              </div>
              {stats.topAgents.slice(0, 3).map((a, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--text-xs)',
                  padding: '2px 0',
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{a.name}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chain List */}
      <div className="card">
        {isLoading ? (
          <div style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
          }}>
            読み込み中...
          </div>
        ) : chains.length === 0 ? (
          <div style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
          }}>
            <Activity size={32} color="var(--text-tertiary)" style={{ marginBottom: 'var(--space-2)' }} />
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              トレースデータがありません
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
              エージェントが動作すると表示されます
            </p>
          </div>
        ) : (
          <div>
            {chains.map(chain => (
              <div
                key={chain.id}
                style={{
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {/* Chain Header */}
                <div
                  onClick={() => toggleChain(chain.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                    backgroundColor: chain.status === 'running' ? 'var(--info-bg)' : 'transparent',
                  }}
                >
                  {expandedChains.has(chain.id) ? (
                    <ChevronDown size={16} color="var(--text-tertiary)" />
                  ) : (
                    <ChevronRight size={16} color="var(--text-tertiary)" />
                  )}

                  {getStatusIcon(chain.status)}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {chain.summary || chain.events[0]?.name || 'Unknown'}
                    </div>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                    }}>
                      {formatTime(chain.startTime)} • {chain.events.length}イベント
                      {chain.endTime && ` • ${formatDuration(
                        new Date(chain.endTime).getTime() - new Date(chain.startTime).getTime()
                      )}`}
                    </div>
                  </div>

                  <span style={{
                    fontSize: 'var(--text-xs)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: chain.status === 'completed'
                      ? 'var(--success-bg)'
                      : chain.status === 'failed'
                        ? 'var(--error-bg)'
                        : 'var(--info-bg)',
                    color: chain.status === 'completed'
                      ? 'var(--success)'
                      : chain.status === 'failed'
                        ? 'var(--error)'
                        : 'var(--info)',
                  }}>
                    {chain.status}
                  </span>
                </div>

                {/* Chain Events (expanded) */}
                {expandedChains.has(chain.id) && (
                  <div style={{
                    padding: '0 var(--space-3) var(--space-3)',
                    paddingLeft: 'var(--space-6)',
                  }}>
                    {chain.events.map((event, idx) => (
                      <div
                        key={event.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-2) 0',
                          borderLeft: '2px solid var(--border)',
                          paddingLeft: 'var(--space-3)',
                          marginLeft: 'var(--space-2)',
                          position: 'relative',
                        }}
                      >
                        {/* Timeline dot */}
                        <div style={{
                          position: 'absolute',
                          left: '-5px',
                          top: '10px',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: getEventTypeColor(event.type),
                        }} />

                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                          }}>
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: `${getEventTypeColor(event.type)}20`,
                              color: getEventTypeColor(event.type),
                              textTransform: 'uppercase',
                            }}>
                              {event.type}
                            </span>
                            <span style={{
                              fontSize: 'var(--text-sm)',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                            }}>
                              {event.name}
                            </span>
                            {getStatusIcon(event.status)}
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            marginTop: '2px',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-tertiary)',
                          }}>
                            <span>{event.agent}</span>
                            <span>•</span>
                            <span>{formatTime(event.timestamp)}</span>
                            {event.duration && (
                              <>
                                <span>•</span>
                                <span>{formatDuration(event.duration)}</span>
                              </>
                            )}
                          </div>

                          {event.data !== undefined && event.data !== null && (
                            <div style={{
                              marginTop: 'var(--space-1)',
                              padding: 'var(--space-2)',
                              backgroundColor: 'var(--bg-tertiary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--text-xs)',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                              overflow: 'auto',
                              maxHeight: '100px',
                            }}>
                              {typeof event.data === 'string'
                                ? event.data
                                : JSON.stringify(event.data, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Instagram, Music, Download, Check, RefreshCw,
  Filter, Clock, Sparkles, Video, Image, ExternalLink
} from 'lucide-react';

// ========================================
// Types
// ========================================

interface ContentItem {
  id: string;
  status: 'pending' | 'posted' | 'downloaded';
  caption: string;
  suggestedSound?: string | null;
  textOverlays?: string[];
  imagePrompt?: string;
  backgroundPrompt?: string;
  createdAt: string;
  account: 'liver' | 'chatre';
  mode?: 'self' | 'transform';
  videoType?: string;
  source?: string;
  sourcePostId?: string;
  originalText?: string;
}

interface ContentQueue {
  instagram: ContentItem[];
  tiktok: ContentItem[];
  updatedAt?: string | null;
}

type Platform = 'instagram' | 'tiktok';
type AccountFilter = 'all' | 'liver' | 'chatre';
type StatusFilter = 'all' | 'pending' | 'posted' | 'downloaded';

// ========================================
// Content Card Component
// ========================================

function ContentCard({
  item,
  platform,
  onStatusChange,
}: {
  item: ContentItem;
  platform: Platform;
  onStatusChange: (id: string, status: ContentItem['status']) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    pending: { bg: 'rgba(246, 173, 85, 0.15)', text: '#f6ad55', label: '未投稿' },
    downloaded: { bg: 'rgba(77, 168, 218, 0.15)', text: '#4da8da', label: 'DL済' },
    posted: { bg: 'rgba(72, 187, 120, 0.15)', text: '#48bb78', label: '投稿済' },
  };

  const accountColors = {
    liver: { bg: 'rgba(255, 107, 157, 0.15)', text: '#ff6b9d', label: 'ライバー' },
    chatre: { bg: 'rgba(155, 89, 182, 0.15)', text: '#9b59b6', label: 'チャトレ' },
  };

  const status = statusColors[item.status];
  const account = accountColors[item.account];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {platform === 'instagram' ? (
            <Instagram size={16} color="#E4405F" />
          ) : (
            <Video size={16} color="#00f2ea" />
          )}
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: account.bg,
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              color: account.text,
            }}
          >
            {account.label}
          </span>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: status.bg,
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              color: status.text,
            }}
          >
            {status.label}
          </span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
          {new Date(item.createdAt).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px' }}>
        {/* Caption */}
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-primary)',
            lineHeight: '1.5',
            marginBottom: '12px',
            whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
            overflow: expanded ? 'visible' : 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.caption}
        </p>

        {item.caption.length > 60 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '11px',
              cursor: 'pointer',
              marginBottom: '12px',
              padding: 0,
            }}
          >
            {expanded ? '閉じる' : '全文を見る'}
          </button>
        )}

        {/* Suggested Sound */}
        {item.suggestedSound && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 10px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              marginBottom: '10px',
            }}
          >
            <Music size={14} color="var(--accent)" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              BGM提案:
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}
            >
              {item.suggestedSound}
            </span>
          </div>
        )}

        {/* Text Overlays */}
        {item.textOverlays && item.textOverlays.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              テキストオーバーレイ
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {item.textOverlays.slice(0, expanded ? undefined : 3).map((text, i) => (
                <span
                  key={i}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {i + 1}. {text}
                </span>
              ))}
              {!expanded && item.textOverlays.length > 3 && (
                <span
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'var(--accent-light)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: 'var(--accent)',
                  }}
                >
                  +{item.textOverlays.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Source Info */}
        {item.source === 'cross_post' && item.originalText && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'rgba(155, 89, 182, 0.1)',
              borderRadius: '8px',
              borderLeft: '3px solid #9b59b6',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                color: '#9b59b6',
                marginBottom: '4px',
                fontWeight: 600,
              }}
            >
              X投稿から変換
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.originalText}...
            </div>
          </div>
        )}

        {/* Image/Background Prompt */}
        {(item.imagePrompt || item.backgroundPrompt) && expanded && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                marginBottom: '4px',
              }}
            >
              {item.imagePrompt ? 'サムネイル生成プロンプト' : '背景生成プロンプト'}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
              }}
            >
              {item.imagePrompt || item.backgroundPrompt}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <button
          onClick={() => {
            navigator.clipboard.writeText(item.caption);
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Download size={14} />
          コピー
        </button>

        {item.status === 'pending' && (
          <button
            onClick={() => onStatusChange(item.id, 'downloaded')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: 'rgba(77, 168, 218, 0.15)',
              border: 'none',
              borderRadius: '8px',
              color: '#4da8da',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Check size={14} />
            DL済み
          </button>
        )}

        {(item.status === 'pending' || item.status === 'downloaded') && (
          <button
            onClick={() => onStatusChange(item.id, 'posted')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: 'rgba(72, 187, 120, 0.15)',
              border: 'none',
              borderRadius: '8px',
              color: '#48bb78',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Check size={14} />
            投稿済み
          </button>
        )}
      </div>
    </div>
  );
}

// ========================================
// Main Dashboard Component
// ========================================

export default function ContentDashboard() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<ContentQueue>({ instagram: [], tiktok: [] });
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/content/queue');
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleStatusChange = async (id: string, newStatus: ContentItem['status']) => {
    // Update local state immediately
    setQueue((prev) => ({
      ...prev,
      [platform]: prev[platform].map((item) =>
        item.id === id ? { ...item, status: newStatus } : item
      ),
    }));

    // Persist to API
    try {
      await fetch('/api/content/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, platform }),
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      // Revert on error
      fetchQueue();
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const endpoint = platform === 'instagram' ? '/api/content/instagram' : '/api/content/tiktok';
      const mode = Math.random() > 0.5 ? 'self' : 'transform';
      const account = accountFilter === 'all' ? (Math.random() > 0.5 ? 'liver' : 'chatre') : accountFilter;

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          account,
          ...(platform === 'tiktok' ? { videoType: 'text_overlay' } : { contentType: 'reel' }),
        }),
      });

      await fetchQueue();
    } catch (error) {
      console.error('Failed to generate content:', error);
    } finally {
      setGenerating(false);
    }
  };

  // Filter items
  const items = queue[platform].filter((item) => {
    if (accountFilter !== 'all' && item.account !== accountFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const pendingCount = queue[platform].filter((i) => i.status === 'pending').length;
  const postedCount = queue[platform].filter((i) => i.status === 'posted').length;

  if (!mounted) {
    return (
      <div
        style={{
          height: 'calc(100dvh - var(--mobile-nav-height))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          読み込み中...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - var(--mobile-nav-height))',
        maxWidth: '800px',
        margin: '0 auto',
        padding: 'var(--space-3)',
        width: '100%',
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 'var(--space-3)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #E4405F, #00f2ea)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} color="white" />
            </div>
            <div>
              <h1
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Content Queue
              </h1>
              <p
                style={{
                  fontSize: '10px',
                  color: 'var(--text-tertiary)',
                  margin: 0,
                }}
              >
                {queue.updatedAt
                  ? `更新: ${new Date(queue.updatedAt).toLocaleString('ja-JP')}`
                  : 'データなし'}
              </p>
            </div>
          </div>

          <button
            onClick={fetchQueue}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw
              size={16}
              color="var(--text-secondary)"
              style={{
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </button>
        </div>
      </header>

      {/* Platform Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: 'var(--space-3)',
        }}
      >
        <button
          onClick={() => setPlatform('tiktok')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '12px',
            backgroundColor: platform === 'tiktok' ? 'rgba(0, 242, 234, 0.15)' : 'var(--bg-elevated)',
            border: `2px solid ${platform === 'tiktok' ? '#00f2ea' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            color: platform === 'tiktok' ? '#00f2ea' : 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Video size={18} />
          TikTok
          <span
            style={{
              padding: '2px 6px',
              backgroundColor: platform === 'tiktok' ? 'rgba(0, 242, 234, 0.2)' : 'var(--bg-tertiary)',
              borderRadius: '10px',
              fontSize: '11px',
            }}
          >
            {queue.tiktok.length}
          </span>
        </button>

        <button
          onClick={() => setPlatform('instagram')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '12px',
            backgroundColor: platform === 'instagram' ? 'rgba(228, 64, 95, 0.15)' : 'var(--bg-elevated)',
            border: `2px solid ${platform === 'instagram' ? '#E4405F' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            color: platform === 'instagram' ? '#E4405F' : 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Instagram size={18} />
          Instagram
          <span
            style={{
              padding: '2px 6px',
              backgroundColor: platform === 'instagram' ? 'rgba(228, 64, 95, 0.2)' : 'var(--bg-tertiary)',
              borderRadius: '10px',
              fontSize: '11px',
            }}
          >
            {queue.instagram.length}
          </span>
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f6ad55' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>未投稿</div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#48bb78' }}>
            {postedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>投稿済み</div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Filter size={14} color="var(--text-tertiary)" />
        </div>

        {/* Account Filter */}
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
          style={{
            padding: '6px 10px',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <option value="all">すべてのアカウント</option>
          <option value="liver">ライバー</option>
          <option value="chatre">チャトレ</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={{
            padding: '6px 10px',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <option value="all">すべてのステータス</option>
          <option value="pending">未投稿</option>
          <option value="downloaded">DL済み</option>
          <option value="posted">投稿済み</option>
        </select>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: generating ? 'var(--bg-tertiary)' : 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: generating ? 'var(--text-tertiary)' : 'white',
            fontSize: '12px',
            fontWeight: 600,
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          <Sparkles size={14} />
          {generating ? '生成中...' : '新規生成'}
        </button>
      </div>

      {/* Content List */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            color: 'var(--text-tertiary)',
          }}
        >
          <RefreshCw
            size={24}
            style={{ animation: 'spin 1s linear infinite' }}
          />
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            {platform === 'tiktok' ? (
              <Video size={24} color="var(--text-tertiary)" />
            ) : (
              <Instagram size={24} color="var(--text-tertiary)" />
            )}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            コンテンツがありません
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            「新規生成」ボタンでコンテンツを作成してください
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              platform={platform}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

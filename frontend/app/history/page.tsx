'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, Copy, Check, Calendar, Tag } from 'lucide-react';

type HistoryEntry = {
  id: string;
  timestamp: string;
  target: string;
  atmosphere: string;
  perks: string[];
  generatedPost: string;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('この履歴を削除しますか?')) return;

    try {
      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
          background: 'var(--gradient-main)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          生成履歴
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          過去に生成した投稿文の一覧です（最大100件）
        </p>
      </header>

      {history.length === 0 ? (
        <div className="glass" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            まだ履歴がありません
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {history.map((entry) => (
            <div
              key={entry.id}
              className="glass"
              style={{
                padding: '1.5rem',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '1.5rem',
              }}
            >
              <div>
                {/* メタ情報 */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={14} />
                    {formatDate(entry.timestamp)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Tag size={14} />
                    {entry.target}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Tag size={14} />
                    {entry.atmosphere}
                  </div>
                </div>

                {/* アピールポイント */}
                {entry.perks.length > 0 && (
                  <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {entry.perks.map((perk, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '50px',
                          background: 'rgba(139, 92, 246, 0.15)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          fontSize: '0.8rem',
                          color: '#a78bfa'
                        }}
                      >
                        {perk}
                      </span>
                    ))}
                  </div>
                )}

                {/* 生成された投稿文 */}
                <div style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  color: 'white',
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  {entry.generatedPost}
                </div>
              </div>

              {/* アクション */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => copyToClipboard(entry.generatedPost, entry.id)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copiedId === entry.id ? (
                    <>
                      <Check size={16} color="#4ade80" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      コピー
                    </>
                  )}
                </button>

                <button
                  onClick={() => deleteEntry(entry.id)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem'
                  }}
                >
                  <Trash2 size={16} />
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

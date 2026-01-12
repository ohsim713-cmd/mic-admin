'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Settings,
  ArrowLeft,
  Target,
  TrendingUp,
  MessageCircle
} from 'lucide-react';

interface AutoPostStatus {
  status: string;
  todayPostCount: number;
  maxDailyPosts: number;
  currentSlot: {
    type: string;
    slot: number;
    time: string;
  };
  credentialsConfigured: boolean;
  recentLogs: PostLog[];
}

interface PostLog {
  postedAt: string;
  success: boolean;
  tweetId?: string;
  error?: string;
  slot: number;
  type: string;
  postText?: string;
  processingTime?: number;
}

// 1日15投稿のスケジュール
const SCHEDULE = [
  { slot: 1, time: '6:30', type: 'おはよう' },
  { slot: 2, time: '7:30', type: 'ノウハウ' },
  { slot: 3, time: '8:30', type: 'Q&A' },
  { slot: 4, time: '10:00', type: '体験談' },
  { slot: 5, time: '12:00', type: '共感' },
  { slot: 6, time: '12:45', type: '軽い話題' },
  { slot: 7, time: '14:00', type: '実績' },
  { slot: 8, time: '15:30', type: '不安解消' },
  { slot: 9, time: '17:30', type: '共感' },
  { slot: 10, time: '18:30', type: 'メリット' },
  { slot: 11, time: '20:00', type: '求人' },
  { slot: 12, time: '21:00', type: '成功事例' },
  { slot: 13, time: '21:45', type: '本音' },
  { slot: 14, time: '22:30', type: 'クロージング' },
  { slot: 15, time: '23:30', type: '夜向け' },
];

export default function AutoPostPage() {
  const [status, setStatus] = useState<AutoPostStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/auto-post');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualPost = async () => {
    setPosting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auto-post', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.error || data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '投稿に失敗しました' });
    } finally {
      setPosting(false);
    }
  };

  // 現在時刻に基づいて次のスロットを判定
  const getCurrentSlotIndex = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < SCHEDULE.length; i++) {
      const [h, m] = SCHEDULE[i].time.split(':').map(Number);
      const slotMinutes = h * 60 + m;
      if (slotMinutes > currentMinutes) {
        return i;
      }
    }
    return 0; // 全て過ぎたら翌日の最初
  };

  const nextSlotIndex = getCurrentSlotIndex();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/" style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '16px' }}>
            <ArrowLeft size={16} /> ホームに戻る
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Zap color="#f59e0b" /> 自動投稿システム
              </h1>
              <p style={{ color: '#888', marginTop: '4px' }}>
                1日15投稿を自動で実行
              </p>
            </div>
            <Link
              href="/settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#888',
                textDecoration: 'none',
              }}
            >
              <Settings size={16} /> X API設定
            </Link>
          </div>
        </div>

        {/* Alert */}
        {message && (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '24px',
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
          }}>
            {message.text}
          </div>
        )}

        {/* Status Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <TrendingUp size={20} color="#22c55e" />
              <span style={{ color: '#888' }}>本日の投稿</span>
            </div>
            <div style={{ color: 'white', fontSize: '36px', fontWeight: 'bold' }}>
              {status?.todayPostCount || 0}
              <span style={{ fontSize: '18px', color: '#888' }}> / 15</span>
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Clock size={20} color="#3b82f6" />
              <span style={{ color: '#888' }}>次の投稿</span>
            </div>
            <div style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>
              {SCHEDULE[nextSlotIndex]?.time || '-'}
            </div>
            <div style={{ color: '#888', fontSize: '14px' }}>
              {SCHEDULE[nextSlotIndex]?.type || '-'}
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              {status?.credentialsConfigured ? (
                <CheckCircle size={20} color="#22c55e" />
              ) : (
                <XCircle size={20} color="#ef4444" />
              )}
              <span style={{ color: '#888' }}>X API</span>
            </div>
            <div style={{ color: status?.credentialsConfigured ? '#22c55e' : '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>
              {status?.credentialsConfigured ? '接続済み' : '未設定'}
            </div>
          </div>
        </div>

        {/* Manual Post Button */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
          textAlign: 'center',
        }}>
          <h2 style={{ color: 'white', marginBottom: '16px' }}>手動投稿</h2>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            今すぐ1投稿を実行します（時間帯に合った内容を自動生成）
          </p>
          <button
            onClick={handleManualPost}
            disabled={posting || !status?.credentialsConfigured}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '16px 32px',
              background: status?.credentialsConfigured ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'rgba(107, 114, 128, 0.3)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: status?.credentialsConfigured ? 'pointer' : 'not-allowed',
              opacity: posting ? 0.5 : 1,
            }}
          >
            {posting ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
            {posting ? '投稿中...' : '今すぐ投稿'}
          </button>
        </div>

        {/* Schedule */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
        }}>
          <h2 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} /> 投稿スケジュール
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {SCHEDULE.map((slot, i) => {
              const isPast = i < nextSlotIndex;
              const isNext = i === nextSlotIndex;
              const isPosted = (status?.todayPostCount || 0) > i;

              return (
                <div
                  key={slot.slot}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: isNext ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                    border: isNext ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                    opacity: isPast ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: isNext ? '#3b82f6' : '#888', fontWeight: 'bold' }}>{slot.time}</span>
                    {isPosted && <CheckCircle size={14} color="#22c55e" />}
                  </div>
                  <div style={{ color: 'white', fontSize: '13px' }}>{slot.type}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Logs */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '24px',
        }}>
          <h2 style={{ color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageCircle size={20} /> 最近の投稿ログ
          </h2>
          {status?.recentLogs && status.recentLogs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {status.recentLogs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${log.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {log.success ? (
                        <CheckCircle size={16} color="#22c55e" />
                      ) : (
                        <XCircle size={16} color="#ef4444" />
                      )}
                      <span style={{ color: '#888', fontSize: '13px' }}>
                        {new Date(log.postedAt).toLocaleString('ja-JP')}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(139, 92, 246, 0.2)',
                        color: '#a78bfa',
                        fontSize: '11px'
                      }}>
                        {log.type}
                      </span>
                    </div>
                    {log.tweetId && (
                      <a
                        href={`https://twitter.com/i/web/status/${log.tweetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#3b82f6', fontSize: '12px' }}
                      >
                        投稿を見る →
                      </a>
                    )}
                  </div>
                  {log.postText && (
                    <div style={{ color: '#ccc', fontSize: '13px' }}>{log.postText}</div>
                  )}
                  {log.error && (
                    <div style={{ color: '#ef4444', fontSize: '13px' }}>エラー: {log.error}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
              まだ投稿ログがありません
            </div>
          )}
        </div>

        {/* Goal Reminder */}
        <div style={{
          marginTop: '32px',
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(234, 88, 12, 0.1) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Target size={24} color="#f59e0b" />
            <h3 style={{ color: '#f59e0b', margin: 0 }}>目標: 1日3件の問い合わせ</h3>
          </div>
          <p style={{ color: '#888', margin: 0 }}>
            15投稿 × 継続 = 認知拡大 → DM問い合わせ増加
          </p>
        </div>
      </div>
    </div>
  );
}

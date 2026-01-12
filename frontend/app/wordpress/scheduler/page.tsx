'use client';

import { useState, useEffect } from 'react';
import { Clock, Play, Pause, Trash2, Plus, FileText, Send, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

type WordPressSchedule = {
  id: string;
  enabled: boolean;
  intervalHours: number;
  keywords: string;
  targetLength: string;
  tone: string;
  publishStatus: 'draft' | 'publish';
  generateThumbnail: boolean;
  lastRun?: string;
  nextRun?: string;
  lastPostId?: number;
  lastPostTitle?: string;
};

export default function WordPressSchedulerPage() {
  const [schedules, setSchedules] = useState<WordPressSchedule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newSchedule, setNewSchedule] = useState({
    intervalHours: 24,
    keywords: '',
    targetLength: '2000-3000',
    tone: '親しみやすく、専門的',
    publishStatus: 'draft' as 'draft' | 'publish',
    generateThumbnail: false
  });

  const lengthOptions = ['1000-1500', '2000-3000', '3000-5000', '5000+'];
  const toneOptions = ['親しみやすく、専門的', 'フォーマル', 'カジュアル', '説得力のある'];

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/wordpress/scheduler');
      const data = await response.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      showMessage('error', 'スケジュールの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const createSchedule = async () => {
    try {
      const response = await fetch('/api/wordpress/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule)
      });

      if (response.ok) {
        await fetchSchedules();
        setIsCreating(false);
        setNewSchedule({
          intervalHours: 24,
          keywords: '',
          targetLength: '2000-3000',
          tone: '親しみやすく、専門的',
          publishStatus: 'draft',
          generateThumbnail: false
        });
        showMessage('success', 'スケジュールを作成しました');
      } else {
        showMessage('error', 'スケジュールの作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create schedule:', error);
      showMessage('error', 'スケジュールの作成に失敗しました');
    }
  };

  const toggleSchedule = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/wordpress/scheduler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled })
      });

      if (response.ok) {
        await fetchSchedules();
        showMessage('success', enabled ? 'スケジュールを有効化しました' : 'スケジュールを無効化しました');
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      showMessage('error', 'スケジュールの更新に失敗しました');
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('このスケジュールを削除しますか?')) return;

    try {
      const response = await fetch(`/api/wordpress/scheduler?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchSchedules();
        showMessage('success', 'スケジュールを削除しました');
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      showMessage('error', 'スケジュールの削除に失敗しました');
    }
  };

  const executeNow = async (id: string) => {
    setExecutingId(id);
    try {
      const response = await fetch('/api/wordpress/scheduler/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: id })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await fetchSchedules();
        showMessage('success', `記事を投稿しました: ${data.post.title}`);
      } else {
        showMessage('error', data.error || '記事の投稿に失敗しました');
      }
    } catch (error) {
      console.error('Failed to execute schedule:', error);
      showMessage('error', '記事の投稿に失敗しました');
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <main style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
          background: 'var(--gradient-main)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          WordPress自動投稿スケジューラー
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          指定した間隔でWordPressへの記事を自動生成・投稿します
        </p>
      </header>

      {/* メッセージ表示 */}
      {message && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          borderRadius: '8px',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {message.type === 'success' ? (
            <CheckCircle2 size={18} color="#10b981" />
          ) : (
            <XCircle size={18} color="#ef4444" />
          )}
          <p style={{
            fontSize: '0.9rem',
            color: message.type === 'success' ? '#10b981' : '#ef4444',
            margin: 0
          }}>
            {message.text}
          </p>
        </div>
      )}

      {/* Create New Schedule */}
      <section className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={20} color="var(--accent-secondary)" />
            新しいスケジュール
          </h2>
          <button
            onClick={() => setIsCreating(!isCreating)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              background: 'var(--gradient-main)',
              border: 'none',
              color: 'white',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            {isCreating ? 'キャンセル' : '作成'}
          </button>
        </div>

        {isCreating && (
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                投稿間隔（時間）
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={newSchedule.intervalHours}
                onChange={(e) => setNewSchedule({ ...newSchedule, intervalHours: parseInt(e.target.value) || 24 })}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                キーワード（カンマ区切り）
              </label>
              <input
                type="text"
                value={newSchedule.keywords}
                onChange={(e) => setNewSchedule({ ...newSchedule, keywords: e.target.value })}
                placeholder="例: チャットレディ, 在宅, 高収入"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                目標文字数
              </label>
              <select
                value={newSchedule.targetLength}
                onChange={(e) => setNewSchedule({ ...newSchedule, targetLength: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              >
                {lengthOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}字</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                文章のトーン
              </label>
              <select
                value={newSchedule.tone}
                onChange={(e) => setNewSchedule({ ...newSchedule, tone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              >
                {toneOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                投稿ステータス
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="publishStatus"
                    checked={newSchedule.publishStatus === 'draft'}
                    onChange={() => setNewSchedule({ ...newSchedule, publishStatus: 'draft' })}
                  />
                  <span style={{ fontSize: '0.9rem' }}>下書き</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="publishStatus"
                    checked={newSchedule.publishStatus === 'publish'}
                    onChange={() => setNewSchedule({ ...newSchedule, publishStatus: 'publish' })}
                  />
                  <span style={{ fontSize: '0.9rem' }}>公開</span>
                </label>
              </div>
            </div>

            <button
              onClick={createSchedule}
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'var(--gradient-main)',
                border: 'none',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              スケジュールを作成
            </button>
          </div>
        )}
      </section>

      {/* Active Schedules */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color="var(--accent-secondary)" />
            スケジュール一覧 ({schedules.length})
          </h2>
          <button
            onClick={fetchSchedules}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <Clock size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }}>スケジュールが設定されていません</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {schedules.map(schedule => (
              <div key={schedule.id} className="glass" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: schedule.enabled ? '#10b981' : '#6b7280'
                      }}></div>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                        {schedule.intervalHours}時間ごと
                      </span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '50px',
                        background: schedule.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        fontSize: '0.8rem',
                        color: schedule.enabled ? '#10b981' : '#6b7280'
                      }}>
                        {schedule.enabled ? '有効' : '無効'}
                      </span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '50px',
                        background: schedule.publishStatus === 'publish' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        fontSize: '0.8rem',
                        color: schedule.publishStatus === 'publish' ? '#8b5cf6' : '#6b7280'
                      }}>
                        {schedule.publishStatus === 'publish' ? '公開' : '下書き'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.9rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>キーワード</div>
                        <div>{schedule.keywords || '未設定'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>文字数</div>
                        <div>{schedule.targetLength}字</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>トーン</div>
                        <div>{schedule.tone}</div>
                      </div>
                    </div>

                    {schedule.lastRun && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        最終実行: {new Date(schedule.lastRun).toLocaleString('ja-JP')}
                        {schedule.lastPostTitle && (
                          <span style={{ marginLeft: '0.5rem' }}>
                            | 「{schedule.lastPostTitle.substring(0, 30)}...」
                          </span>
                        )}
                      </div>
                    )}
                    {schedule.nextRun && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        次回実行: {new Date(schedule.nextRun).toLocaleString('ja-JP')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => executeNow(schedule.id)}
                      disabled={executingId === schedule.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(139, 92, 246, 0.15)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        color: '#8b5cf6',
                        cursor: executingId === schedule.id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        opacity: executingId === schedule.id ? 0.5 : 1
                      }}
                      title="今すぐ実行"
                    >
                      {executingId === schedule.id ? (
                        <>
                          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          実行中...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          今すぐ実行
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => toggleSchedule(schedule.id, !schedule.enabled)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                      title={schedule.enabled ? '一時停止' : '再開'}
                    >
                      {schedule.enabled ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={() => deleteSchedule(schedule.id)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

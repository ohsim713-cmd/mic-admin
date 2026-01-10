'use client';

import { useState, useEffect } from 'react';
import { Clock, Play, Pause, Settings, Trash2, Plus, Send } from 'lucide-react';

type ScheduleConfig = {
  id: string;
  enabled: boolean;
  intervalHours: number;
  target: string;
  postType: string;
  keywords: string;
  lastRun?: string;
  nextRun?: string;
};

export default function SchedulerPage() {
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    intervalHours: 2,
    target: 'チャトレ未経験',
    postType: '実績・収入投稿',
    keywords: ''
  });

  const targets = ['チャトレ未経験', 'チャトレ経験者', '夜職経験者'];
  const postTypes = ['実績・収入投稿', 'ノウハウ投稿', '事務所の強み投稿'];

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/scheduler');
      const data = await response.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    }
  };

  const createSchedule = async () => {
    try {
      const response = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule)
      });

      if (response.ok) {
        await fetchSchedules();
        setIsCreating(false);
        setNewSchedule({
          intervalHours: 2,
          target: 'チャトレ未経験',
          postType: '実績・収入投稿',
          keywords: ''
        });
      }
    } catch (error) {
      console.error('Failed to create schedule:', error);
      alert('スケジュールの作成に失敗しました');
    }
  };

  const toggleSchedule = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/scheduler/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      await fetchSchedules();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('このスケジュールを削除しますか?')) return;

    try {
      await fetch(`/api/scheduler/${id}`, { method: 'DELETE' });
      await fetchSchedules();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const testPost = async () => {
    try {
      const response = await fetch('/api/post-to-x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'チャトレ未経験',
          postType: '実績・収入投稿',
          keywords: 'テスト投稿'
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert('テスト投稿が成功しました！');
      } else {
        alert(`投稿に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('Test post failed:', error);
      alert('テスト投稿に失敗しました');
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
          自動投稿スケジューラー
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          指定した間隔でXへの自動投稿を設定できます
        </p>
      </header>

      {/* Test Post Button */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={testPost}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          <Send size={16} />
          テスト投稿（即座にXへ投稿）
        </button>
      </div>

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
                max="24"
                value={newSchedule.intervalHours}
                onChange={(e) => setNewSchedule({ ...newSchedule, intervalHours: parseInt(e.target.value) })}
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
                ターゲット層
              </label>
              <select
                value={newSchedule.target}
                onChange={(e) => setNewSchedule({ ...newSchedule, target: e.target.value })}
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
                {targets.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                投稿の種類
              </label>
              <select
                value={newSchedule.postType}
                onChange={(e) => setNewSchedule({ ...newSchedule, postType: e.target.value })}
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
                {postTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                キーワード（任意）
              </label>
              <input
                type="text"
                value={newSchedule.keywords}
                onChange={(e) => setNewSchedule({ ...newSchedule, keywords: e.target.value })}
                placeholder="例: 日払い、在宅、身バレ防止"
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
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} color="var(--accent-secondary)" />
          アクティブなスケジュール ({schedules.length})
        </h2>

        {schedules.length === 0 ? (
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
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.9rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>ターゲット</div>
                        <div>{schedule.target}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>投稿種類</div>
                        <div>{schedule.postType}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>キーワード</div>
                        <div>{schedule.keywords || '未設定'}</div>
                      </div>
                    </div>

                    {schedule.lastRun && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        最終実行: {new Date(schedule.lastRun).toLocaleString('ja-JP')}
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
    </main>
  );
}

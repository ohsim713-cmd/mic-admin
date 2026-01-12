'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Check, X, Edit3, Clock, MessageCircle, RefreshCw, Zap, Database, Trash2, Copy, Target, Sparkles } from 'lucide-react';
import { useBusinessType } from '../context/BusinessTypeContext';
import { useToast } from '../components/Toast';

interface PostGoal {
  id: string;
  label: string;
  description: string;
  promptHint: string;
  cta: string | null;
}

interface PostAngle {
  id: string;
  label: string;
  description: string;
  promptHint: string;
}

interface PostCandidate {
  id: string;
  content: string;
  target: string;
  theme: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'scheduled';
  scheduledTime?: string;
  createdAt: string;
  accountId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ローカルストレージキー
const STORAGE_KEY = 'mic_admin_candidates';
const CHAT_STORAGE_KEY = 'mic_admin_chat_history';

export default function ApprovalPage() {
  const { businessType } = useBusinessType();
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<PostCandidate[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [generatedCount, setGeneratedCount] = useState(0); // 生成進捗

  // 壁打ちチャット
  const [chatOpen, setChatOpen] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 予約設定
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [selectedAccount] = useState('account1');

  // フィルター
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'scheduled' | 'rejected'>('all');

  // 目的別・切り口の選択
  const [postGoals, setPostGoals] = useState<PostGoal[]>([]);
  const [postAngles, setPostAngles] = useState<PostAngle[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string>('auto');
  const [selectedAngle, setSelectedAngle] = useState<string>('auto');

  // theme_options.jsonから目的別・切り口を読み込む
  useEffect(() => {
    fetch('/api/theme-options')
      .then(res => res.json())
      .then(data => {
        if (data.postGoals) setPostGoals(data.postGoals);
        if (data.postAngles) setPostAngles(data.postAngles);
      })
      .catch(e => console.error('Failed to load theme options:', e));
  }, []);

  // ローカルストレージから読み込み
  useEffect(() => {
    const savedCandidates = localStorage.getItem(STORAGE_KEY);
    const savedChat = localStorage.getItem(CHAT_STORAGE_KEY);

    if (savedCandidates) {
      try {
        setCandidates(JSON.parse(savedCandidates));
      } catch (e) {
        console.error('Failed to load candidates:', e);
      }
    }

    if (savedChat) {
      try {
        setChatMessages(JSON.parse(savedChat));
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, []);

  // ローカルストレージに保存
  useEffect(() => {
    if (candidates.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
    }
  }, [candidates]);

  useEffect(() => {
    if (Object.keys(chatMessages).length > 0) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  // 複数候補を一括生成（並列化）
  const generateCandidates = async () => {
    setIsGenerating(true);
    setGeneratedCount(0);
    const newCandidates: PostCandidate[] = [];

    // 並列で生成（最大3つ同時）
    const batchSize = 3;
    for (let batch = 0; batch < Math.ceil(generateCount / batchSize); batch++) {
      const promises = [];
      const currentBatchSize = Math.min(batchSize, generateCount - batch * batchSize);

      for (let i = 0; i < currentBatchSize; i++) {
        promises.push(generateSinglePost(batch * batchSize + i));
      }

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          newCandidates.push(result.value);
          setGeneratedCount(prev => prev + 1);
        }
      }
    }

    setCandidates(prev => [...newCandidates, ...prev]);
    setIsGenerating(false);
    showToast(`${newCandidates.length}件の投稿を生成しました`, 'success');
  };

  // 単一投稿生成
  const generateSinglePost = async (index: number): Promise<PostCandidate | null> => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType,
          autoMode: true,
          postGoal: selectedGoal !== 'auto' ? selectedGoal : undefined,
          postAngle: selectedAngle !== 'auto' ? selectedAngle : undefined,
        }),
      });

      if (!response.ok) return null;

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullPost = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullPost += decoder.decode(value, { stream: true });
        }
      }

      // メタ情報を抽出
      const metaMatch = fullPost.match(/<!--META:(.*?)-->/);
      let meta = { target: '自動選択', theme: '自動選択', confidence: 3 };
      if (metaMatch) {
        try {
          meta = JSON.parse(metaMatch[1]);
        } catch (e) {}
      }

      const cleanContent = fullPost.replace(/<!--META:.*?-->/, '').trim();

      return {
        id: `post-${Date.now()}-${index}`,
        content: cleanContent,
        target: meta.target,
        theme: meta.theme,
        confidence: meta.confidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Generation error:', error);
      return null;
    }
  };

  // 投稿を承認して予約
  const approveAndSchedule = async (id: string) => {
    const candidate = candidates.find(c => c.id === id);
    if (!candidate || !scheduleDate || !scheduleTime) return;

    const scheduledTime = `${scheduleDate}T${scheduleTime}:00`;

    try {
      await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: candidate.content,
          scheduledTime,
          accountId: selectedAccount,
          status: 'scheduled',
        }),
      });

      // 良い例として保存
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'example',
          data: {
            businessType,
            targetAudience: candidate.target,
            post: candidate.content,
            tags: [candidate.theme],
          },
        }),
      });

      // 壁打ちがあった場合、フィードバックルールを抽出
      const postChatHistory = chatMessages[id];
      if (postChatHistory && postChatHistory.length > 0) {
        await fetch('/api/feedback/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatHistory: postChatHistory,
            originalPost: candidate.content,
            finalPost: candidate.content,
            businessType,
            targetAudience: candidate.target,
          }),
        });
      }

      setCandidates(prev => prev.map(c =>
        c.id === id
          ? { ...c, status: 'scheduled', scheduledTime, accountId: selectedAccount }
          : c
      ));
      setSchedulingId(null);
      showToast('予約しました', 'success');
    } catch (error) {
      console.error('Schedule error:', error);
      showToast('予約に失敗しました', 'error');
    }
  };

  // 投稿を却下
  const rejectPost = (id: string) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'rejected' } : c
    ));
  };

  // 投稿を削除
  const deletePost = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    // チャット履歴も削除
    setChatMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[id];
      return newMessages;
    });
  };

  // 全データをクリア
  const clearAllData = () => {
    if (confirm('すべてのデータを削除しますか？この操作は取り消せません。')) {
      setCandidates([]);
      setChatMessages({});
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      showToast('すべてのデータを削除しました', 'info');
    }
  };

  // 編集を保存
  const saveEdit = (id: string) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, content: editContent } : c
    ));
    setEditingId(null);
    setEditContent('');
  };

  // コピー
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast('コピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  };

  // 壁打ちチャット送信
  const sendChatMessage = async (postId: string) => {
    if (!chatInput.trim()) return;

    const candidate = candidates.find(c => c.id === postId);
    if (!candidate) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    const currentMessages = chatMessages[postId] || [];

    setChatMessages(prev => ({
      ...prev,
      [postId]: [...currentMessages, userMessage]
    }));
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/generate/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPost: candidate.content,
          userRequest: chatInput,
          chatHistory: currentMessages,
          businessType,
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.refinedPost || data.response || 'エラーが発生しました'
      };

      setChatMessages(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), assistantMessage]
      }));

      // 修正された投稿で更新
      if (data.refinedPost) {
        setCandidates(prev => prev.map(c =>
          c.id === postId ? { ...c, content: data.refinedPost } : c
        ));
      }
    } catch (error) {
      console.error('Chat error:', error);
      showToast('エラーが発生しました', 'error');
    } finally {
      setIsChatLoading(false);
    }
  };

  // チャット末尾にスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // フィルタリング
  const filteredCandidates = candidates.filter(c => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  const pendingCount = candidates.filter(c => c.status === 'pending').length;
  const scheduledCount = candidates.filter(c => c.status === 'scheduled').length;
  const rejectedCount = candidates.filter(c => c.status === 'rejected').length;
  const totalCount = candidates.length;

  return (
    <main style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header - コンパクト化 */}
      <header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            marginBottom: '0.25rem',
            background: 'var(--gradient-main)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Zap size={24} />
            壁打ちスタジオ
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            大量生成→選別→改善のサイクルを高速回転
          </p>
        </div>

        {/* データ管理 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Database size={14} />
            {totalCount}件保存中
          </span>
          <button
            onClick={clearAllData}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <Trash2 size={12} />
            全削除
          </button>
        </div>
      </header>

      {/* 生成コントロール - 2行構成 */}
      <section className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
        {/* 1行目: Stats + Filter + Generate */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fbbf24' }}>{pendingCount}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>待機</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#4ade80' }}>{scheduledCount}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>予約</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>{rejectedCount}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>却下</div>
            </div>
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {(['all', 'pending', 'scheduled', 'rejected'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  background: statusFilter === filter ? 'var(--gradient-main)' : 'rgba(255,255,255,0.05)',
                  border: statusFilter === filter ? 'none' : '1px solid var(--glass-border)',
                  color: 'white',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {filter === 'all' ? '全て' : filter === 'pending' ? '待機' : filter === 'scheduled' ? '予約' : '却下'}
              </button>
            ))}
          </div>

          {/* Generate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value))}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid var(--glass-border)',
                color: 'white',
                fontSize: '0.85rem',
              }}
            >
              {[1, 3, 5, 10, 20, 30].map(n => (
                <option key={n} value={n}>{n}件</option>
              ))}
            </select>

            <button
              onClick={generateCandidates}
              disabled={isGenerating}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--gradient-main)',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.7 : 1,
                minWidth: '140px',
                justifyContent: 'center',
              }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  {generatedCount}/{generateCount}
                </>
              ) : (
                <>
                  <Zap size={16} />
                  一括生成
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2行目: 目的別・切り口選択 */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
          {/* 目的別 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Target size={12} />
              目的
            </span>
            <select
              value={selectedGoal}
              onChange={(e) => setSelectedGoal(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid var(--glass-border)',
                color: 'white',
                fontSize: '0.8rem',
                maxWidth: '180px',
              }}
            >
              <option value="auto">🎲 ランダム</option>
              {postGoals.map(goal => (
                <option key={goal.id} value={goal.id}>{goal.label}</option>
              ))}
            </select>
          </div>

          {/* 切り口 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Sparkles size={12} />
              切り口
            </span>
            <select
              value={selectedAngle}
              onChange={(e) => setSelectedAngle(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid var(--glass-border)',
                color: 'white',
                fontSize: '0.8rem',
                maxWidth: '180px',
              }}
            >
              <option value="auto">🎲 ランダム</option>
              {postAngles.map(angle => (
                <option key={angle.id} value={angle.id}>{angle.label}</option>
              ))}
            </select>
          </div>

          {/* 選択中の説明 */}
          {(selectedGoal !== 'auto' || selectedAngle !== 'auto') && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {selectedGoal !== 'auto' && (
                <span style={{ padding: '0.15rem 0.5rem', background: 'rgba(139, 92, 246, 0.2)', borderRadius: '4px' }}>
                  {postGoals.find(g => g.id === selectedGoal)?.description}
                </span>
              )}
              {selectedAngle !== 'auto' && (
                <span style={{ padding: '0.15rem 0.5rem', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '4px' }}>
                  {postAngles.find(a => a.id === selectedAngle)?.description}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Candidates Grid - カード形式 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '1rem'
      }}>
        {filteredCandidates.length === 0 ? (
          <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            <Zap size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>投稿候補がありません</p>
            <p style={{ fontSize: '0.85rem' }}>上の「一括生成」で投稿を大量生成しましょう</p>
          </div>
        ) : (
          filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              className="glass"
              style={{
                padding: '1rem',
                borderLeft: `3px solid ${
                  candidate.status === 'scheduled' ? '#4ade80' :
                  candidate.status === 'rejected' ? '#ef4444' :
                  '#fbbf24'
                }`,
                opacity: candidate.status === 'rejected' ? 0.6 : 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    fontSize: '0.7rem',
                  }}>
                    {candidate.target}
                  </span>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    fontSize: '0.7rem',
                  }}>
                    {candidate.theme}
                  </span>
                </div>
                <button
                  onClick={() => deletePost(candidate.id)}
                  style={{
                    padding: '0.25rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    opacity: 0.5,
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Content */}
              {editingId === candidate.id ? (
                <div style={{ marginBottom: '0.75rem', flex: 1 }}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--glass-border)',
                      color: 'white',
                      fontSize: '0.85rem',
                      lineHeight: '1.6',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => saveEdit(candidate.id)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        background: '#4ade80',
                        border: 'none',
                        color: 'black',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid var(--glass-border)',
                        color: 'white',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  marginBottom: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  flex: 1,
                  maxHeight: '150px',
                  overflowY: 'auto',
                }}>
                  {candidate.content}
                </div>
              )}

              {/* 予約済み表示 */}
              {candidate.status === 'scheduled' && candidate.scheduledTime && (
                <div style={{
                  padding: '0.5rem',
                  background: 'rgba(74, 222, 128, 0.1)',
                  borderRadius: '6px',
                  marginBottom: '0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#4ade80'
                }}>
                  <Clock size={12} />
                  {new Date(candidate.scheduledTime).toLocaleString('ja-JP')}
                </div>
              )}

              {/* 壁打ちチャット */}
              {chatOpen === candidate.id && (
                <div style={{
                  marginBottom: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '6px',
                }}>
                  <div style={{
                    maxHeight: '150px',
                    overflowY: 'auto',
                    marginBottom: '0.5rem',
                  }}>
                    {(chatMessages[candidate.id] || []).map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '0.5rem',
                          marginBottom: '0.25rem',
                          borderRadius: '6px',
                          background: msg.role === 'user'
                            ? 'rgba(139, 92, 246, 0.2)'
                            : 'rgba(59, 130, 246, 0.2)',
                          marginLeft: msg.role === 'user' ? '1.5rem' : '0',
                          marginRight: msg.role === 'assistant' ? '1.5rem' : '0',
                        }}
                      >
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                          {msg.role === 'user' ? 'あなた' : 'AI'}
                        </div>
                        <div style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        考え中...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage(candidate.id)}
                      placeholder="修正指示..."
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--glass-border)',
                        color: 'white',
                        fontSize: '0.8rem',
                      }}
                    />
                    <button
                      onClick={() => sendChatMessage(candidate.id)}
                      disabled={isChatLoading}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        background: 'var(--gradient-main)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* 予約設定 */}
              {schedulingId === candidate.id && (
                <div style={{
                  marginBottom: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(74, 222, 128, 0.1)',
                  borderRadius: '6px',
                  border: '1px solid rgba(74, 222, 128, 0.2)',
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      style={{
                        padding: '0.4rem',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--glass-border)',
                        color: 'white',
                        fontSize: '0.8rem',
                      }}
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{
                        padding: '0.4rem',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--glass-border)',
                        color: 'white',
                        fontSize: '0.8rem',
                      }}
                    />
                    <button
                      onClick={() => approveAndSchedule(candidate.id)}
                      disabled={!scheduleDate || !scheduleTime}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        background: '#4ade80',
                        border: 'none',
                        color: 'black',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        cursor: !scheduleDate || !scheduleTime ? 'not-allowed' : 'pointer',
                        opacity: !scheduleDate || !scheduleTime ? 0.5 : 1,
                      }}
                    >
                      確定
                    </button>
                    <button
                      onClick={() => setSchedulingId(null)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid var(--glass-border)',
                        color: 'white',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* Actions - コンパクト */}
              {candidate.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setChatOpen(chatOpen === candidate.id ? null : candidate.id)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      background: chatOpen === candidate.id ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      color: 'white',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    <MessageCircle size={12} />
                    壁打ち
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(candidate.id);
                      setEditContent(candidate.content);
                    }}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: 'white',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={12} />
                    編集
                  </button>
                  <button
                    onClick={() => copyToClipboard(candidate.content)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid var(--glass-border)',
                      color: 'white',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={() => setSchedulingId(candidate.id)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(74, 222, 128, 0.15)',
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                      color: '#4ade80',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Check size={12} />
                    予約
                  </button>
                  <button
                    onClick={() => rejectPost(candidate.id)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

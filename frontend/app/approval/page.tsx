'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Check, X, Edit3, Clock, MessageCircle, RefreshCw, Zap, Database, Trash2, Copy } from 'lucide-react';
import { useBusinessType } from '../context/BusinessTypeContext';
import { useToast } from '../components/Toast';
import { ProgressBar } from '../components/ActivityIndicator';
import { TypingIndicator } from '../components/TypingIndicator';

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
  const [generatedCount, setGeneratedCount] = useState(0);

  const [chatOpen, setChatOpen] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [selectedAccount] = useState('account1');

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'scheduled' | 'rejected'>('all');

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

  const generateCandidates = async () => {
    setIsGenerating(true);
    setGeneratedCount(0);
    const newCandidates: PostCandidate[] = [];

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

  const generateSinglePost = async (index: number): Promise<PostCandidate | null> => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType,
          autoMode: true,
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

      const metaMatch = fullPost.match(/<!--META:(.*?)-->/);
      let meta = { target: '自動選択', theme: '自動選択', confidence: 3 };
      if (metaMatch) {
        try {
          meta = JSON.parse(metaMatch[1]);
        } catch (e) { }
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

  const rejectPost = (id: string) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'rejected' } : c
    ));
  };

  const deletePost = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    setChatMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[id];
      return newMessages;
    });
  };

  const clearAllData = () => {
    if (confirm('すべてのデータを削除しますか？この操作は取り消せません。')) {
      setCandidates([]);
      setChatMessages({});
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      showToast('すべてのデータを削除しました', 'info');
    }
  };

  const saveEdit = (id: string) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, content: editContent } : c
    ));
    setEditingId(null);
    setEditContent('');
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast('コピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  };

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const filteredCandidates = candidates.filter(c => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  const pendingCount = candidates.filter(c => c.status === 'pending').length;
  const scheduledCount = candidates.filter(c => c.status === 'scheduled').length;
  const rejectedCount = candidates.filter(c => c.status === 'rejected').length;
  const totalCount = candidates.length;

  return (
    <main className="p-6 md:p-10 md:ml-64 max-w-6xl">
      {/* Header */}
      <header className="mb-4 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl mb-1 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
            <Zap size={24} />
            壁打ちスタジオ
          </h1>
          <p className="text-white/60 text-sm">
            大量生成→選別→改善のサイクルを高速回転
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs flex items-center gap-1">
            <Database size={14} />
            {totalCount}件保存中
          </span>
          <button
            onClick={clearAllData}
            className="px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs cursor-pointer flex items-center gap-1 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={12} />
            全削除
          </button>
        </div>
      </header>

      {/* Control Panel */}
      <section className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
          {/* Stats */}
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-xl font-bold text-amber-400">{pendingCount}</div>
              <div className="text-white/60 text-xs">待機</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-400">{scheduledCount}</div>
              <div className="text-white/60 text-xs">予約</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-400">{rejectedCount}</div>
              <div className="text-white/60 text-xs">却下</div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-1">
            {(['all', 'pending', 'scheduled', 'rejected'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                  statusFilter === filter
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {filter === 'all' ? '全て' : filter === 'pending' ? '待機' : filter === 'scheduled' ? '予約' : '却下'}
              </button>
            ))}
          </div>

          {/* Generate */}
          <div className="flex items-center gap-2">
            <select
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm"
            >
              {[1, 3, 5, 10, 20, 30].map(n => (
                <option key={n} value={n}>{n}件</option>
              ))}
            </select>

            <button
              onClick={generateCandidates}
              disabled={isGenerating}
              className={`px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold flex items-center gap-2 min-w-[140px] justify-center transition-opacity ${
                isGenerating ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
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

        {/* Progress Bar */}
        {isGenerating && (
          <div className="mt-3">
            <ProgressBar
              progress={(generatedCount / generateCount) * 100}
              showPercent={false}
              height={6}
              animated={true}
            />
            <div className="flex justify-between mt-1 text-xs text-white/60">
              <span>AI生成中...</span>
              <span>{generatedCount} / {generateCount} 件完了</span>
            </div>
          </div>
        )}
      </section>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCandidates.length === 0 ? (
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-12 text-center text-white/60 col-span-full">
            <Zap size={48} className="mx-auto mb-4 opacity-30" />
            <p>投稿候補がありません</p>
            <p className="text-sm mt-1">上の「一括生成」で投稿を大量生成しましょう</p>
          </div>
        ) : (
          filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              className={`backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col ${
                candidate.status === 'rejected' ? 'opacity-60' : ''
              }`}
              style={{
                borderLeftWidth: '3px',
                borderLeftColor: candidate.status === 'scheduled' ? '#4ade80' :
                  candidate.status === 'rejected' ? '#ef4444' : '#fbbf24'
              }}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-xs font-bold text-purple-300">
                  {candidate.theme}
                </span>
                <button
                  onClick={() => deletePost(candidate.id)}
                  className="p-1 bg-transparent border-none text-white/40 cursor-pointer hover:text-white/70 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Content */}
              {editingId === candidate.id ? (
                <div className="mb-3 flex-1">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full min-h-[120px] p-3 rounded-md bg-black/30 border border-white/10 text-white text-sm leading-relaxed resize-y"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => saveEdit(candidate.id)}
                      className="px-3 py-1.5 rounded-md bg-green-400 border-none text-black text-xs cursor-pointer hover:bg-green-300 transition-colors"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-md bg-white/10 border border-white/10 text-white text-xs cursor-pointer hover:bg-white/20 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed mb-3 p-3 bg-black/20 rounded-md flex-1 max-h-[150px] overflow-y-auto scrollbar-thin">
                  {candidate.content}
                </div>
              )}

              {/* Scheduled Badge */}
              {candidate.status === 'scheduled' && candidate.scheduledTime && (
                <div className="p-2 bg-green-400/10 rounded-md mb-2 text-xs flex items-center gap-2 text-green-400">
                  <Clock size={12} />
                  {new Date(candidate.scheduledTime).toLocaleString('ja-JP')}
                </div>
              )}

              {/* Chat Panel */}
              {chatOpen === candidate.id && (
                <div className="mb-3 p-3 bg-black/30 rounded-md">
                  <div className="max-h-[150px] overflow-y-auto mb-2 scrollbar-thin">
                    {(chatMessages[candidate.id] || []).map((msg, i) => (
                      <div
                        key={i}
                        className={`p-2 mb-1 rounded-md ${
                          msg.role === 'user'
                            ? 'bg-purple-500/20 ml-6'
                            : 'bg-blue-500/20 mr-6'
                        }`}
                      >
                        <div className="text-[10px] text-white/60 mb-0.5">
                          {msg.role === 'user' ? 'あなた' : 'AI'}
                        </div>
                        <div className="text-xs whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="p-2">
                        <TypingIndicator text="修正案を作成中" />
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage(candidate.id)}
                      placeholder="修正指示..."
                      className="flex-1 px-2 py-1.5 rounded-md bg-black/30 border border-white/10 text-white text-xs"
                    />
                    <button
                      onClick={() => sendChatMessage(candidate.id)}
                      disabled={isChatLoading}
                      className="p-1.5 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 border-none text-white cursor-pointer disabled:opacity-50"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule Panel */}
              {schedulingId === candidate.id && (
                <div className="mb-3 p-3 bg-green-400/10 rounded-md border border-green-400/20">
                  <div className="flex gap-2 flex-wrap items-end">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="px-2 py-1.5 rounded-md bg-black/30 border border-white/10 text-white text-xs"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="px-2 py-1.5 rounded-md bg-black/30 border border-white/10 text-white text-xs"
                    />
                    <button
                      onClick={() => approveAndSchedule(candidate.id)}
                      disabled={!scheduleDate || !scheduleTime}
                      className={`px-3 py-1.5 rounded-md bg-green-400 border-none text-black font-bold text-xs ${
                        !scheduleDate || !scheduleTime ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-green-300'
                      }`}
                    >
                      確定
                    </button>
                    <button
                      onClick={() => setSchedulingId(null)}
                      className="px-3 py-1.5 rounded-md bg-white/10 border border-white/10 text-white text-xs cursor-pointer hover:bg-white/20"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {candidate.status === 'pending' && (
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setChatOpen(chatOpen === candidate.id ? null : candidate.id)}
                    className={`px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                      chatOpen === candidate.id
                        ? 'bg-purple-500/30 border-purple-500/30'
                        : 'bg-purple-500/15 border-purple-500/30 hover:bg-purple-500/25'
                    }`}
                  >
                    <MessageCircle size={12} />
                    壁打ち
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(candidate.id);
                      setEditContent(candidate.content);
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-white text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-500/25 transition-colors"
                  >
                    <Edit3 size={12} />
                    編集
                  </button>
                  <button
                    onClick={() => copyToClipboard(candidate.content)}
                    className="px-2.5 py-1.5 rounded-md bg-white/10 border border-white/10 text-white text-xs flex items-center gap-1 cursor-pointer hover:bg-white/20 transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={() => setSchedulingId(candidate.id)}
                    className="px-2.5 py-1.5 rounded-md bg-green-400/15 border border-green-400/30 text-green-400 text-xs flex items-center gap-1 cursor-pointer hover:bg-green-400/25 transition-colors"
                  >
                    <Check size={12} />
                    予約
                  </button>
                  <button
                    onClick={() => rejectPost(candidate.id)}
                    className="px-2.5 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-1 cursor-pointer hover:bg-red-500/25 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}

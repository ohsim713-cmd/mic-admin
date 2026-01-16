'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Hand, Sparkles, Lightbulb, BarChart3, PenLine, TrendingUp, Search, Rocket } from 'lucide-react';

type ChatMode = 'agent' | 'think';
type SettingsTab = 'posts' | 'dm' | 'analytics' | 'settings';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  image?: string;
  isStreaming?: boolean;
}

interface PostStock {
  id: string;
  text: string;
  score: number;
  status: string;
  accountId: string;
}

interface Insight {
  id: string;
  title: string;
  content: string;
  category: string;
}

const ACCOUNTS = [
  { id: 'liver', name: 'ライバー', color: '#ec4899', gradient: 'from-pink-500 to-pink-400' },
  { id: 'chatre1', name: 'チャトレ①', color: '#8b5cf6', gradient: 'from-violet-500 to-violet-400' },
  { id: 'chatre2', name: 'チャトレ②', color: '#3b82f6', gradient: 'from-blue-500 to-blue-400' },
];

export default function MainPage() {
  // Chat state
  const [mode, setMode] = useState<ChatMode>('agent');
  const [agentMessages, setAgentMessages] = useState<Message[]>([]);
  const [thinkMessages, setThinkMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [savedInsights, setSavedInsights] = useState<Insight[]>([]);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('posts');
  const [posts, setPosts] = useState<PostStock[]>([]);
  const [dmStats, setDmStats] = useState({ total: 0, goal: 3, progress: 0 });
  const [generating, setGenerating] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('liver');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentMessages = mode === 'agent' ? agentMessages : thinkMessages;
  const setCurrentMessages = mode === 'agent' ? setAgentMessages : setThinkMessages;

  // 初期読み込み
  useEffect(() => {
    loadAgentHistory();
    loadDashboardData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages, thinkMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const loadAgentHistory = async () => {
    try {
      const res = await fetch('/api/agent/chat');
      const data = await res.json();
      if (data.history) setAgentMessages(data.history);
    } catch {}
  };

  const loadDashboardData = async () => {
    try {
      const [stockRes, dmRes] = await Promise.all([
        fetch('/api/dm-hunter/stock'),
        fetch('/api/db/stats').catch(() => ({ json: () => ({}) })),
      ]);
      const stockData = await stockRes.json();
      const dmData = await dmRes.json() as { dm?: { todayDMs?: number, dailyGoal?: number, goalProgress?: number } };

      if (stockData.posts) setPosts(stockData.posts.slice(0, 30));
      if (dmData.dm) {
        setDmStats({
          total: dmData.dm.todayDMs || 0,
          goal: dmData.dm.dailyGoal || 3,
          progress: dmData.dm.goalProgress || 0,
        });
      }
    } catch {}
  };

  // 画像選択
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSelectedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // メッセージ送信
  const sendMessage = useCallback(async () => {
    if (!input.trim() && !selectedImage) return;
    if (isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      image: selectedImage || undefined,
      timestamp: new Date().toISOString(),
    };

    setCurrentMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    try {
      if (mode === 'agent') {
        setAgentMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          isStreaming: true,
        }]);

        const res = await fetch('/api/agent/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            image: userMessage.image,
          }),
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let responseText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'response') {
                  responseText = event.content || '';
                  setAgentMessages(prev => {
                    const newMessages = [...prev];
                    const lastIdx = newMessages.length - 1;
                    if (lastIdx >= 0 && newMessages[lastIdx].isStreaming) {
                      newMessages[lastIdx] = {
                        ...newMessages[lastIdx],
                        content: responseText,
                      };
                    }
                    return newMessages;
                  });
                }
              } catch {}
            }
          }
        }

        setAgentMessages(prev => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (lastIdx >= 0) {
            newMessages[lastIdx] = {
              ...newMessages[lastIdx],
              content: responseText || 'レスポンスを取得できませんでした',
              isStreaming: false,
            };
          }
          return newMessages;
        });
      } else {
        const res = await fetch('/api/brainstorm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            image: userMessage.image,
            history: thinkMessages.slice(-10),
          }),
        });
        const data = await res.json();
        setThinkMessages(prev => [...prev, {
          role: 'assistant',
          content: data.success ? data.response : `エラー: ${data.error}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (e: any) {
      setCurrentMessages(prev => [...prev, {
        role: 'assistant',
        content: `エラー: ${e.message}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, selectedImage, isLoading, mode, thinkMessages, setCurrentMessages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 壁打ち保存
  const saveInsights = async () => {
    if (thinkMessages.length < 2) return;
    const conversation = thinkMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    try {
      const res = await fetch('/api/brainstorm/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract', conversation }),
      });
      const data = await res.json();
      if (data.success && data.insights) setSavedInsights(data.insights);
    } catch {}
  };

  // 投稿生成
  const generatePosts = async (count: number) => {
    setGenerating(true);
    try {
      await fetch('/api/automation/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount,
          accountType: selectedAccount === 'liver' ? 'ライバー' : 'チャトレ',
          count,
        }),
      });
      loadDashboardData();
    } catch {}
    setGenerating(false);
  };

  // 投稿承認/却下
  const updatePostStatus = async (postId: string, status: string) => {
    try {
      await fetch('/api/dm-hunter/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, status }),
      });
      loadDashboardData();
    } catch {}
  };

  // DM記録
  const recordDM = async (account: string) => {
    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: account }),
      });
      loadDashboardData();
    } catch {}
  };

  const clearChat = () => {
    if (mode === 'agent') {
      setAgentMessages([]);
      fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_history' }),
      });
    } else {
      setThinkMessages([]);
    }
  };

  const pendingPosts = posts.filter(p => p.status === 'pending');
  const approvedCount = posts.filter(p => p.status === 'approved').length;
  const postedCount = posts.filter(p => p.status === 'posted').length;

  return (
    <div className="flex h-dvh bg-[#050505] text-gray-100 font-sans antialiased relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(102,126,234,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(168,85,247,0.1),transparent)]" />
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-90 animate-fade-in md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative left-0 top-0 bottom-0 w-80 z-100
        bg-[rgba(20,20,25,0.85)] backdrop-blur-xl
        border-r border-white/[0.08]
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col
      `}>
        {/* Sidebar Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
          <h2 className="text-[17px] font-semibold bg-gradient-to-br from-gray-100 to-gray-400 bg-clip-text text-transparent">
            管理パネル
          </h2>
          <button
            className="p-2 rounded-lg bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white transition-all md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex p-3 gap-1.5 border-b border-white/[0.06]">
          {[
            { id: 'posts', label: '投稿', icon: '📝' },
            { id: 'dm', label: 'DM', icon: '📩' },
            { id: 'analytics', label: '分析', icon: '📊' },
            { id: 'settings', label: '設定', icon: '⚙️' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`
                flex-1 flex flex-col items-center gap-1 py-3 px-2
                rounded-xl text-[11px] font-medium
                transition-all duration-200
                ${settingsTab === tab.id
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-400'
                }
                active:scale-[0.92]
              `}
              onClick={() => setSettingsTab(tab.id as SettingsTab)}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10">
          {/* Posts Tab */}
          {settingsTab === 'posts' && (
            <div className="space-y-3">
              {/* Generate Card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-lg">✨</span>
                  <h3 className="text-sm font-semibold text-gray-300">投稿生成</h3>
                </div>
                <select
                  value={selectedAccount}
                  onChange={e => setSelectedAccount(e.target.value)}
                  className="w-full px-3.5 py-3 bg-black/30 border border-white/10 rounded-xl text-white text-sm mb-3 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer"
                >
                  {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <div className="flex gap-2">
                  {[1, 3, 5].map(n => (
                    <button
                      key={n}
                      className="flex-1 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/35 active:scale-95 transition-all disabled:opacity-50"
                      onClick={() => generatePosts(n)}
                      disabled={generating}
                    >
                      {generating ? '...' : `${n}件`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pending Card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-lg">📋</span>
                  <h3 className="text-sm font-semibold text-gray-300 flex-1">承認待ち</h3>
                  <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-lg text-xs font-semibold">
                    {pendingPosts.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {pendingPosts.slice(0, 3).map(post => (
                    <div key={post.id} className="bg-black/20 rounded-xl p-3">
                      <p className="text-[13px] text-gray-400 leading-relaxed mb-2.5">
                        {post.text.substring(0, 60)}...
                      </p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 py-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg text-white text-[15px] font-semibold hover:-translate-y-0.5 active:scale-90 transition-all"
                          onClick={() => updatePostStatus(post.id, 'approved')}
                        >
                          ✓
                        </button>
                        <button
                          className="flex-1 py-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-lg text-white text-[15px] font-semibold hover:-translate-y-0.5 active:scale-90 transition-all"
                          onClick={() => updatePostStatus(post.id, 'rejected')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingPosts.length === 0 && (
                    <div className="text-center py-5 text-gray-600 text-[13px]">承認待ちなし</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DM Tab */}
          {settingsTab === 'dm' && (
            <div className="space-y-3">
              {/* DM Progress Card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-sm font-semibold text-gray-300">今日の目標</h3>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold bg-gradient-to-br from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                      {dmStats.total}
                    </span>
                    <span className="text-2xl text-gray-700">/</span>
                    <span className="text-2xl text-gray-500">{dmStats.goal}</span>
                  </div>
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 100 100" className="-rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-white/[0.08]" />
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none" strokeWidth="8" strokeLinecap="round"
                        className="stroke-indigo-500 transition-all duration-500"
                        style={{ strokeDasharray: `${dmStats.progress * 2.51} 251` }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-500">
                      {Math.round(dmStats.progress)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* DM Record Card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-lg">➕</span>
                  <h3 className="text-sm font-semibold text-gray-300">DM記録</h3>
                </div>
                <div className="space-y-2.5">
                  {ACCOUNTS.map(a => (
                    <button
                      key={a.id}
                      className="w-full flex items-center gap-3 px-4 py-3.5 bg-black/30 border-2 rounded-xl text-white text-sm font-medium hover:bg-black/50 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all"
                      style={{ borderColor: a.color }}
                      onClick={() => recordDM(a.id)}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${a.color}, ${a.color}88)` }}
                      />
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {settingsTab === 'analytics' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="text-3xl font-bold bg-gradient-to-br from-gray-100 to-gray-500 bg-clip-text text-transparent">
                  {posts.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">総投稿数</div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="text-3xl font-bold bg-gradient-to-br from-amber-400 to-amber-500 bg-clip-text text-transparent">
                  {pendingPosts.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">承認待ち</div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="text-3xl font-bold bg-gradient-to-br from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                  {approvedCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">承認済み</div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="text-3xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                  {postedCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">投稿済み</div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {settingsTab === 'settings' && (
            <div className="space-y-3">
              {/* Accounts Card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-lg">👤</span>
                  <h3 className="text-sm font-semibold text-gray-300">アカウント</h3>
                </div>
                <div className="space-y-2">
                  {ACCOUNTS.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-3 bg-black/20 rounded-lg text-sm">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${a.color}, ${a.color}88)` }}
                      />
                      <span>{a.name}</span>
                      <span className="ml-auto text-xs text-green-500">有効</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cron Card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-lg">⏰</span>
                  <h3 className="text-sm font-semibold text-gray-300">自動化</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { name: '自動投稿', time: '毎時' },
                    { name: 'ストック補充', time: '毎日 6:30' },
                    { name: 'インプレ取得', time: '毎日 0:00' },
                  ].map(item => (
                    <div key={item.name} className="flex justify-between px-3 py-3 bg-black/20 rounded-lg text-[13px]">
                      <span className="text-gray-400">{item.name}</span>
                      <span className="text-indigo-500 font-medium">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Link */}
              <Link
                href="/auto-hub"
                className="flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 text-sm hover:bg-indigo-500/20 transition-all"
              >
                <span className="flex items-center gap-2">
                  <span>🚀</span>
                  Auto Hub
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-1">
        {/* Header */}
        <header className="flex items-center px-5 py-3.5 gap-4 bg-[rgba(10,10,15,0.7)] backdrop-blur-xl border-b border-white/5 sticky top-0 z-10">
          <button
            className="p-2.5 rounded-xl bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white transition-all flex md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Mode Toggle */}
          <div className="relative flex bg-white/5 rounded-xl p-1">
            <div
              className="absolute top-1 left-1 w-[calc(50%-4px)] h-[calc(100%-8px)] bg-white/10 rounded-lg transition-transform duration-300"
              style={{ transform: mode === 'think' ? 'translateX(100%)' : 'translateX(0)' }}
            />
            <button
              className={`relative px-5 py-2.5 text-[13px] font-medium rounded-lg transition-colors z-1 ${mode === 'agent' ? 'text-white' : 'text-gray-500'}`}
              onClick={() => setMode('agent')}
            >
              エージェント
            </button>
            <button
              className={`relative px-5 py-2.5 text-[13px] font-medium rounded-lg transition-colors z-1 ${mode === 'think' ? 'text-white' : 'text-gray-500'}`}
              onClick={() => setMode('think')}
            >
              壁打ち
            </button>
          </div>

          <div className="ml-auto flex gap-2.5">
            {mode === 'think' && thinkMessages.length > 1 && (
              <button
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                onClick={saveInsights}
              >
                <span>💾</span> 保存
              </button>
            )}
            {currentMessages.length > 0 && (
              <button
                className="px-4 py-2 text-[13px] font-medium bg-white/[0.08] text-gray-500 rounded-lg hover:bg-white/[0.12] hover:text-gray-300 active:scale-[0.92] transition-all"
                onClick={clearChat}
              >
                クリア
              </button>
            )}
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center relative px-6">
              {/* Soft Ambient Glow */}
              <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(139,92,246,0.08),transparent_70%)] rounded-full blur-[60px]" />

              {/* Friendly Greeting */}
              <div className="mb-6 relative z-1 w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--violet-500)]/20 to-[var(--violet-600)]/10 border border-[var(--violet-500)]/20 flex items-center justify-center">
                {mode === 'agent' ? (
                  <Hand size={28} className="text-[var(--violet-400)]" />
                ) : (
                  <Sparkles size={28} className="text-[var(--violet-400)]" />
                )}
              </div>
              <h2 className="text-2xl font-semibold text-white/90 relative z-1">
                {mode === 'agent' ? 'こんにちは！' : '何を考えましょうか？'}
              </h2>
              <p className="text-white/40 text-sm mt-2 mb-10 relative z-1 max-w-md">
                {mode === 'agent' ? '今日も一緒に頑張りましょう。何かお手伝いできることはありますか？' : '一緒にアイデアを広げていきましょう'}
              </p>

              <div className="flex flex-wrap justify-center gap-3 max-w-lg relative z-1">
                {(mode === 'agent' ? [
                  { icon: BarChart3, text: '今日の結果を教えて' },
                  { icon: PenLine, text: '投稿を3件生成して' },
                  { icon: TrendingUp, text: 'パフォーマンスを分析' },
                ] : [
                  { icon: Search, text: '競合分析をしたい' },
                  { icon: Lightbulb, text: '訴求を考えたい' },
                  { icon: Rocket, text: 'アイデアを出したい' },
                ]).map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={i}
                      className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white/70 cursor-pointer transition-all duration-200 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white active:scale-[0.98]"
                      onClick={() => setInput(s.text)}
                    >
                      <Icon size={18} className="text-[var(--violet-400)]" />
                      <span className="text-sm">{s.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-[800px] mx-auto">
              {currentMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 mb-5 animate-message-slide ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-9 h-9 bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center shrink-0">
                      {mode === 'agent' ? (
                        <Sparkles size={16} className="text-[var(--violet-400)]" />
                      ) : (
                        <Lightbulb size={16} className="text-[var(--violet-400)]" />
                      )}
                    </div>
                  )}
                  <div className={`
                    max-w-[75%] px-4.5 py-3.5 rounded-[20px]
                    ${msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 rounded-br-sm'
                      : `bg-white/5 border border-white/[0.08] rounded-bl-sm ${msg.isStreaming ? 'border-indigo-500/40' : ''}`
                    }
                  `}>
                    {msg.image && (
                      <img src={msg.image} alt="" className="max-w-[280px] rounded-xl mb-3" />
                    )}
                    <div className="text-[15px] leading-relaxed">
                      {msg.content ? (
                        msg.content.split('\n').map((line, j) => <p key={j} className="mb-2 last:mb-0">{line || <br />}</p>)
                      ) : msg.isStreaming ? (
                        <div className="flex gap-1.5 py-1.5">
                          <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce [animation-delay:-0.32s]" />
                          <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce [animation-delay:-0.16s]" />
                          <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" />
                        </div>
                      ) : null}
                      {msg.isStreaming && msg.content && (
                        <span className="inline-block w-0.5 h-[1em] bg-indigo-500 ml-0.5 animate-blink align-text-bottom" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Saved Insights Toast */}
        {savedInsights.length > 0 && (
          <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-5 py-3 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400 text-sm animate-slide-up">
            <span>✨</span>
            <span>{savedInsights.length}件の気づきを保存しました</span>
            <button className="p-1 hover:opacity-70" onClick={() => setSavedInsights([])}>✕</button>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 pt-4 pb-6">
          {selectedImage && (
            <div className="relative inline-block mb-3">
              <img src={selectedImage} alt="" className="max-h-[100px] rounded-xl border border-white/10" />
              <button
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white border-2 border-[#050505] text-xs hover:scale-110 transition-transform"
                onClick={() => setSelectedImage(null)}
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-3 max-w-[800px] mx-auto bg-[rgba(30,30,35,0.8)] backdrop-blur-xl border border-white/10 rounded-3xl pl-5 pr-2 py-2 transition-all focus-within:border-indigo-500/50 focus-within:shadow-[0_0_0_4px_rgba(102,126,234,0.1),0_10px_40px_rgba(0,0,0,0.3)]">
            <button
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 hover:bg-white/10 hover:text-white transition-all shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              hidden
            />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              rows={1}
              className="flex-1 py-3 bg-transparent text-gray-100 text-[15px] leading-normal resize-none max-h-[120px] outline-none placeholder:text-gray-600"
            />
            <button
              className={`
                w-11 h-11 flex items-center justify-center rounded-xl shrink-0 transition-all duration-250
                ${(!input.trim() && !selectedImage)
                  ? 'bg-gray-800 opacity-30 cursor-not-allowed'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/40 active:scale-95'
                }
              `}
              onClick={sendMessage}
              disabled={isLoading || (!input.trim() && !selectedImage)}
            >
              {isLoading ? (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.2s]" />
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.1s]" />
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                </div>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Hand, Sparkles, Lightbulb, BarChart3, PenLine, TrendingUp, Search, Rocket, X, Menu, Image as ImageIcon, Send as SendIcon } from 'lucide-react';

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
  { id: 'liver', name: 'ライバー', color: '#ec4899', bg: 'bg-pink-50', text: 'text-pink-600' },
  { id: 'chatre1', name: 'チャトレ①', color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-600' },
  { id: 'chatre2', name: 'チャトレ②', color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600' },
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSelectedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

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
    <div className="flex h-dvh bg-stone-50 text-stone-800 font-sans antialiased relative overflow-hidden">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative left-0 top-0 bottom-0 w-80 z-50
        bg-white border-r border-stone-200
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col shadow-lg md:shadow-none
      `}>
        {/* Sidebar Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800">管理パネル</h2>
          <button
            className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-all md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex p-3 gap-1.5 border-b border-stone-200">
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
                rounded-xl text-xs font-medium transition-all duration-200
                ${settingsTab === tab.id
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-stone-500 hover:bg-stone-100'
                }
              `}
              onClick={() => setSettingsTab(tab.id as SettingsTab)}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Posts Tab */}
          {settingsTab === 'posts' && (
            <div className="space-y-4">
              {/* Generate Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">✨</span>
                  <h3 className="text-sm font-semibold text-stone-700">投稿生成</h3>
                </div>
                <select
                  value={selectedAccount}
                  onChange={e => setSelectedAccount(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-stone-800 text-sm mb-3 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                >
                  {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <div className="flex gap-2">
                  {[1, 3, 5].map(n => (
                    <button
                      key={n}
                      className="flex-1 py-3 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl text-white text-sm font-semibold hover:shadow-lg hover:shadow-orange-200 active:scale-95 transition-all disabled:opacity-50"
                      onClick={() => generatePosts(n)}
                      disabled={generating}
                    >
                      {generating ? '...' : `${n}件`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pending Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📋</span>
                  <h3 className="text-sm font-semibold text-stone-700 flex-1">承認待ち</h3>
                  <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-lg text-xs font-semibold">
                    {pendingPosts.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {pendingPosts.slice(0, 3).map(post => (
                    <div key={post.id} className="bg-white border border-stone-200 rounded-xl p-3">
                      <p className="text-sm text-stone-600 leading-relaxed mb-3">
                        {post.text.substring(0, 60)}...
                      </p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 py-2.5 bg-emerald-500 rounded-lg text-white text-sm font-semibold hover:bg-emerald-600 active:scale-95 transition-all"
                          onClick={() => updatePostStatus(post.id, 'approved')}
                        >
                          ✓
                        </button>
                        <button
                          className="flex-1 py-2.5 bg-red-500 rounded-lg text-white text-sm font-semibold hover:bg-red-600 active:scale-95 transition-all"
                          onClick={() => updatePostStatus(post.id, 'rejected')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingPosts.length === 0 && (
                    <div className="text-center py-6 text-stone-400 text-sm">承認待ちなし</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DM Tab */}
          {settingsTab === 'dm' && (
            <div className="space-y-4">
              {/* DM Progress Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-sm font-semibold text-stone-700">今日の目標</h3>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-orange-500">
                      {dmStats.total}
                    </span>
                    <span className="text-2xl text-stone-300">/</span>
                    <span className="text-2xl text-stone-400">{dmStats.goal}</span>
                  </div>
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 100 100" className="-rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-stone-200" />
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none" strokeWidth="8" strokeLinecap="round"
                        className="stroke-orange-500 transition-all duration-500"
                        style={{ strokeDasharray: `${dmStats.progress * 2.51} 251` }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-stone-600">
                      {Math.round(dmStats.progress)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* DM Record Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">➕</span>
                  <h3 className="text-sm font-semibold text-stone-700">DM記録</h3>
                </div>
                <div className="space-y-2.5">
                  {ACCOUNTS.map(a => (
                    <button
                      key={a.id}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 ${a.bg} border-2 rounded-xl ${a.text} text-sm font-medium hover:shadow-md active:scale-95 transition-all`}
                      style={{ borderColor: a.color }}
                      onClick={() => recordDM(a.id)}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: a.color }}
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
              {[
                { label: '総投稿数', value: posts.length, color: 'text-stone-700' },
                { label: '承認待ち', value: pendingPosts.length, color: 'text-amber-500' },
                { label: '承認済み', value: approvedCount, color: 'text-emerald-500' },
                { label: '投稿済み', value: postedCount, color: 'text-orange-500' },
              ].map(item => (
                <div key={item.label} className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-center">
                  <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-stone-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Settings Tab */}
          {settingsTab === 'settings' && (
            <div className="space-y-4">
              {/* Accounts Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">👤</span>
                  <h3 className="text-sm font-semibold text-stone-700">アカウント</h3>
                </div>
                <div className="space-y-2">
                  {ACCOUNTS.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-3 bg-white border border-stone-200 rounded-lg text-sm">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-stone-700">{a.name}</span>
                      <span className="ml-auto text-xs text-emerald-500 font-medium">有効</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cron Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">⏰</span>
                  <h3 className="text-sm font-semibold text-stone-700">自動化</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { name: '自動投稿', time: '毎時' },
                    { name: 'ストック補充', time: '毎日 6:30' },
                    { name: 'インプレ取得', time: '毎日 0:00' },
                  ].map(item => (
                    <div key={item.name} className="flex justify-between px-3 py-3 bg-white border border-stone-200 rounded-lg text-sm">
                      <span className="text-stone-600">{item.name}</span>
                      <span className="text-orange-500 font-medium">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Link */}
              <Link
                href="/auto-hub"
                className="flex items-center justify-between w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-600 text-sm font-medium hover:bg-orange-100 transition-all"
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
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="flex items-center px-5 py-3.5 gap-4 bg-white border-b border-stone-200 sticky top-0 z-10">
          <button
            className="p-2.5 rounded-xl hover:bg-stone-100 text-stone-500 transition-all flex md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          {/* Mode Toggle */}
          <div className="relative flex bg-stone-100 rounded-xl p-1">
            <div
              className="absolute top-1 left-1 w-[calc(50%-4px)] h-[calc(100%-8px)] bg-white shadow-sm rounded-lg transition-transform duration-300"
              style={{ transform: mode === 'think' ? 'translateX(100%)' : 'translateX(0)' }}
            />
            <button
              className={`relative px-5 py-2.5 text-sm font-medium rounded-lg transition-colors z-1 ${mode === 'agent' ? 'text-stone-800' : 'text-stone-500'}`}
              onClick={() => setMode('agent')}
            >
              エージェント
            </button>
            <button
              className={`relative px-5 py-2.5 text-sm font-medium rounded-lg transition-colors z-1 ${mode === 'think' ? 'text-stone-800' : 'text-stone-500'}`}
              onClick={() => setMode('think')}
            >
              壁打ち
            </button>
          </div>

          <div className="ml-auto flex gap-2.5">
            {mode === 'think' && thinkMessages.length > 1 && (
              <button
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all"
                onClick={saveInsights}
              >
                <span>💾</span> 保存
              </button>
            )}
            {currentMessages.length > 0 && (
              <button
                className="px-4 py-2 text-sm font-medium bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-all"
                onClick={clearChat}
              >
                クリア
              </button>
            )}
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center relative px-6">
              {/* Friendly Greeting */}
              <div className="mb-6 w-16 h-16 rounded-3xl bg-orange-100 flex items-center justify-center">
                {mode === 'agent' ? (
                  <Hand size={28} className="text-orange-500" />
                ) : (
                  <Sparkles size={28} className="text-orange-500" />
                )}
              </div>
              <h2 className="text-2xl font-semibold text-stone-800">
                {mode === 'agent' ? 'こんにちは！' : '何を考えましょうか？'}
              </h2>
              <p className="text-stone-500 text-sm mt-2 mb-10 max-w-md">
                {mode === 'agent' ? '今日も一緒に頑張りましょう。何かお手伝いできることはありますか？' : '一緒にアイデアを広げていきましょう'}
              </p>

              <div className="flex flex-wrap justify-center gap-3 max-w-lg">
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
                      className="flex items-center gap-3 px-5 py-3.5 bg-white border border-stone-200 rounded-2xl text-stone-600 cursor-pointer transition-all duration-200 hover:border-orange-300 hover:shadow-md hover:text-stone-800 active:scale-[0.98]"
                      onClick={() => setInput(s.text)}
                    >
                      <Icon size={18} className="text-orange-500" />
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
                  className={`flex gap-3 mb-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                      {mode === 'agent' ? (
                        <Sparkles size={16} className="text-orange-500" />
                      ) : (
                        <Lightbulb size={16} className="text-orange-500" />
                      )}
                    </div>
                  )}
                  <div className={`
                    max-w-[75%] px-4 py-3 rounded-2xl
                    ${msg.role === 'user'
                      ? 'bg-orange-500 text-white rounded-br-sm'
                      : `bg-white border border-stone-200 text-stone-700 rounded-bl-sm ${msg.isStreaming ? 'border-orange-300' : ''}`
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
                          <span className="w-2 h-2 bg-orange-300 rounded-full animate-bounce [animation-delay:-0.32s]" />
                          <span className="w-2 h-2 bg-orange-300 rounded-full animate-bounce [animation-delay:-0.16s]" />
                          <span className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" />
                        </div>
                      ) : null}
                      {msg.isStreaming && msg.content && (
                        <span className="inline-block w-0.5 h-[1em] bg-orange-500 ml-0.5 animate-pulse align-text-bottom" />
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
          <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-sm shadow-lg">
            <span>✨</span>
            <span>{savedInsights.length}件の気づきを保存しました</span>
            <button className="p-1 hover:opacity-70" onClick={() => setSavedInsights([])}>✕</button>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 pt-4 pb-6 bg-stone-50 border-t border-stone-200">
          {selectedImage && (
            <div className="relative inline-block mb-3">
              <img src={selectedImage} alt="" className="max-h-[100px] rounded-xl border border-stone-200" />
              <button
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs hover:scale-110 transition-transform"
                onClick={() => setSelectedImage(null)}
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-3 max-w-[800px] mx-auto bg-white border border-stone-200 rounded-2xl pl-4 pr-2 py-2 shadow-sm transition-all focus-within:border-orange-400 focus-within:shadow-md">
            <button
              className="w-10 h-10 flex items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-all shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={20} />
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
              className="flex-1 py-3 bg-transparent text-stone-800 text-[15px] leading-normal resize-none max-h-[120px] outline-none placeholder:text-stone-400"
            />
            <button
              className={`
                w-11 h-11 flex items-center justify-center rounded-xl shrink-0 transition-all duration-250
                ${(!input.trim() && !selectedImage)
                  ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg active:scale-95'
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
                <SendIcon size={18} />
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

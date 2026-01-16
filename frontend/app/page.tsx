'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, User, Copy, Check, Plus, MessageSquare, Trash2, Menu, X } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// localStorageキー
const SESSIONS_STORAGE_KEY = 'mic-chat-sessions';
const ACTIVE_SESSION_KEY = 'mic-active-session';

// セッション管理
function loadSessions(): ChatSession[] {
  try {
    const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    // 最新20セッションだけ保存
    const toSave = sessions.slice(0, 20);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

function generateTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    return firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
  }
  return '新しいチャット';
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 現在のセッションを取得
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  // 初期化
  useEffect(() => {
    const loadedSessions = loadSessions();
    setSessions(loadedSessions);

    const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (savedActiveId && loadedSessions.some(s => s.id === savedActiveId)) {
      setActiveSessionId(savedActiveId);
    }
    setIsInitialized(true);
  }, []);

  // セッション保存
  useEffect(() => {
    if (isInitialized) {
      saveSessions(sessions);
    }
  }, [sessions, isInitialized]);

  // アクティブセッション保存
  useEffect(() => {
    if (isInitialized && activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    }
  }, [activeSessionId, isInitialized]);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  useEffect(() => {
    const handleResize = () => setTimeout(scrollToBottom, 100);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
  }, [scrollToBottom]);

  // 新規チャット作成
  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新しいチャット',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  // セッション削除
  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
  };

  // セッション選択
  const selectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsSidebarOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let currentSessionId = activeSessionId;

    // セッションがない場合は新規作成
    if (!currentSessionId) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: '新しいチャット',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions(prev => [newSession, ...prev]);
      currentSessionId = newSession.id;
      setActiveSessionId(currentSessionId);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    // メッセージ追加
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const updatedMessages = [...s.messages, userMessage];
        return {
          ...s,
          messages: updatedMessages,
          title: s.messages.length === 0 ? generateTitle(updatedMessages) : s.title,
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    }));

    setInput('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'エラーが発生しました。',
        timestamp: new Date().toISOString(),
      };

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [...s.messages, assistantMessage],
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      }));
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '申し訳ございません。エラーが発生しました。',
        timestamp: new Date().toISOString(),
      };
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, errorMessage] };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今日';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '昨日';
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      maxHeight: 'calc(100dvh - var(--mobile-nav-height))',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Sidebar Overlay (モバイル) */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        position: isSidebarOpen ? 'fixed' : 'relative',
        left: 0,
        top: 0,
        bottom: 0,
        width: '260px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease',
      }}
      className="chat-sidebar"
      >
        {/* New Chat Button */}
        <div style={{ padding: 'var(--space-3)' }}>
          <button
            onClick={createNewChat}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={18} />
            新規チャット
          </button>
        </div>

        {/* Session List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 var(--space-2)',
        }}>
          {sessions.length === 0 ? (
            <div style={{
              padding: 'var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-sm)',
            }}>
              チャット履歴がありません
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                onClick={() => selectSession(session.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  marginBottom: 'var(--space-1)',
                  backgroundColor: activeSessionId === session.id ? 'var(--bg-elevated)' : 'transparent',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                <MessageSquare size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {session.title}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: 'var(--text-tertiary)',
                  }}>
                    {formatDate(session.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  style={{
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.5,
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Trash2 size={12} color="var(--text-tertiary)" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <header style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          backgroundColor: 'var(--bg-base)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              padding: 'var(--space-2)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 'var(--radius-md)',
            }}
            className="sidebar-toggle"
          >
            {isSidebarOpen ? <X size={20} color="var(--text-secondary)" /> : <Menu size={20} color="var(--text-secondary)" />}
          </button>

          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={16} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              {activeSession?.title || 'MIC Agent'}
            </h1>
            <p style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              margin: 0,
            }}>
              AIアシスタント
            </p>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {messages.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 'var(--space-6)',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, var(--accent-light), var(--bg-tertiary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-3)',
              }}>
                <Sparkles size={24} color="var(--accent)" />
              </div>
              <h2 style={{
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                MIC Agentへようこそ
              </h2>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                maxWidth: '300px',
                lineHeight: 1.5,
              }}>
                SNS投稿や分析について何でも聞いてください
              </p>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-4)',
                justifyContent: 'center',
              }}>
                {['今日の投稿状況', '新しい投稿を作成', 'エージェント状況'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: message.role === 'assistant' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {message.role === 'assistant' ? (
                    <Sparkles size={14} color="white" />
                  ) : (
                    <User size={14} color="var(--text-secondary)" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    marginBottom: '2px',
                  }}>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}>
                      {message.role === 'assistant' ? 'MIC' : 'あなた'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {message.content}
                  </div>
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: 'var(--space-1)',
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        fontSize: '10px',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {copiedId === message.id ? <><Check size={10} />コピー済</> : <><Copy size={10} />コピー</>}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Sparkles size={14} color="white" />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'pulse 1.5s infinite' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'pulse 1.5s infinite 0.3s' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'pulse 1.5s infinite 0.6s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: 'var(--space-3)',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-base)',
          flexShrink: 0,
        }}>
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
          }}>
            <div style={{
              flex: 1,
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-2) var(--space-3)',
              display: 'flex',
              alignItems: 'flex-end',
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={scrollToBottom}
                placeholder="メッセージを入力..."
                rows={1}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontSize: '16px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                  maxHeight: '120px',
                  minHeight: '24px',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: input.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: input.trim() ? 'white' : 'var(--text-tertiary)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }

        @media (min-width: 768px) {
          .chat-sidebar {
            position: relative !important;
            transform: translateX(0) !important;
          }
          .sidebar-toggle {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

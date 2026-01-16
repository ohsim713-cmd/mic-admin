'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, User, RotateCcw, Copy, Check } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string for localStorage
}

// localStorageキー
const CHAT_STORAGE_KEY = 'mic-chat-messages';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // localStorageから履歴を読み込む
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
      }
    } catch {
      // ignore
    }
    setIsInitialized(true);
  }, []);

  // メッセージが変わったらlocalStorageに保存
  useEffect(() => {
    if (isInitialized && messages.length > 0) {
      try {
        // 最新50件だけ保存
        const toSave = messages.slice(-50);
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
      } catch {
        // ignore
      }
    }
  }, [messages, isInitialized]);

  const scrollToBottom = useCallback(() => {
    // キーボード表示時でも正しくスクロールするよう改善
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // visualViewport APIでキーボード対応
  useEffect(() => {
    const handleResize = () => {
      // iOSのキーボード表示時にスクロール位置を調整
      setTimeout(scrollToBottom, 100);
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
  }, [scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // テキストエリアの高さをリセット
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

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '申し訳ございません。エラーが発生しました。もう一度お試しください。',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: 'calc(100dvh - var(--mobile-nav-height))',
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
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-base)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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
          <div>
            <h1 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              MIC Agent
            </h1>
            <p style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              margin: 0,
            }}>
              AIアシスタント
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-1) var(--space-2)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} />
            クリア
          </button>
        )}
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

            {/* Quick Actions */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-4)',
              justifyContent: 'center',
            }}>
              {[
                '今日の投稿状況',
                '新しい投稿を作成',
                'エージェント状況',
              ].map((suggestion) => (
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
              {/* Avatar */}
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

              {/* Content */}
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
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--text-tertiary)',
                  }}>
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
                    {copiedId === message.id ? (
                      <>
                        <Check size={10} />
                        コピー済
                      </>
                    ) : (
                      <>
                        <Copy size={10} />
                        コピー
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-start',
          }}>
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input - 固定位置 */}
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
                fontSize: '16px', // iOS zoom防止
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

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

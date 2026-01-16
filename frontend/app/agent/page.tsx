'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ActivityLog {
  type: 'info' | 'tool' | 'tool_start' | 'tool_end' | 'thinking' | 'success' | 'error';
  message: string;
  detail?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
  activityLogs?: ActivityLog[];
}

interface Stats {
  totalPosts: number;
  postedToday: number;
  impressions: number;
  engagement: number;
  agentStatus: 'active' | 'idle' | 'working';
}

interface AutonomousState {
  isRunning: boolean;
  lastCheck: string;
  lastAction: string;
  actionsToday: number;
  health: 'healthy' | 'warning' | 'critical';
  insights: string[];
}

interface GoalProgress {
  goal: {
    id: string;
    type: 'dm' | 'impression' | 'engagement' | 'follower' | 'post';
    target: number;
    current: number;
    period: 'daily' | 'weekly' | 'monthly';
    status: string;
  };
  daysRemaining: number;
  dailyTarget: number;
  gapPercent: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

interface GoalsSummary {
  goals: GoalProgress[];
  overallHealth: 'healthy' | 'warning' | 'critical';
  alerts: string[];
}


export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalPosts: 0,
    postedToday: 0,
    impressions: 0,
    engagement: 0,
    agentStatus: 'idle',
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<ActivityLog[]>([]);
  const [autonomousState, setAutonomousState] = useState<AutonomousState | null>(null);
  const [isAutonomousRunning, setIsAutonomousRunning] = useState(false);
  const [goalsSummary, setGoalsSummary] = useState<GoalsSummary | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadHistory();
    loadStats();
    loadAutonomousState();
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const res = await fetch('/api/agent/goals');
      const data = await res.json();
      if (data.success) {
        setGoalsSummary(data);
      }
    } catch (e) {
      console.error('Failed to load goals:', e);
    }
  };

  const setGoalFromInput = async () => {
    if (!goalInput.trim()) return;
    try {
      const res = await fetch('/api/agent/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse_and_set', text: goalInput }),
      });
      const data = await res.json();
      if (data.success) {
        setGoalInput('');
        loadGoals();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `🎯 ${data.message}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (e) {
      console.error('Failed to set goal:', e);
    }
  };

  const loadAutonomousState = async () => {
    try {
      const res = await fetch('/api/agent/autonomous');
      const data = await res.json();
      if (data.success) {
        setAutonomousState(data.state);
      }
    } catch (e) {
      console.error('Failed to load autonomous state:', e);
    }
  };

  const runAutonomousCheck = async () => {
    setIsAutonomousRunning(true);
    try {
      const res = await fetch('/api/agent/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setAutonomousState(data.state);
        // インサイトをメッセージとして追加
        if (data.insights && data.insights.length > 0) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🤖 **自律チェック完了**\n\n${data.insights.join('\n')}`,
            timestamp: new Date().toISOString(),
            activityLogs: [{ type: 'success', message: '自律チェック完了' }],
          }]);
        }
      }
    } catch (e) {
      console.error('Autonomous check failed:', e);
    } finally {
      setIsAutonomousRunning(false);
    }
  };

  const runManualAction = async (action: string) => {
    setIsAutonomousRunning(true);
    setStats(s => ({ ...s, agentStatus: 'working' }));

    const actionLabels: Record<string, string> = {
      'analysis': 'パフォーマンス分析',
      'generation': '投稿生成',
      'optimization': '戦略最適化',
      'learning': '学習・ナレッジ更新',
    };

    setCurrentLogs([{ type: 'thinking', message: `${actionLabels[action] || action}を実行中...` }]);

    try {
      const res = await fetch('/api/agent/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.result || '完了しました',
          timestamp: new Date().toISOString(),
          activityLogs: [
            { type: 'tool_start', message: `${actionLabels[action]}を実行` },
            { type: 'success', message: '完了' },
          ],
        }]);
        loadAutonomousState();
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `エラー: ${e.message}`,
        timestamp: new Date().toISOString(),
        activityLogs: [{ type: 'error', message: e.message }],
      }]);
    } finally {
      setIsAutonomousRunning(false);
      setCurrentLogs([]);
      setStats(s => ({ ...s, agentStatus: 'active' }));
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentLogs]);

  const addLog = (log: ActivityLog) => {
    setCurrentLogs(prev => [...prev, log]);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/agent/chat');
      const data = await res.json();
      if (data.history) {
        setMessages(data.history);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/analytics/summary');
      const data = await res.json();
      if (data.summary) {
        setStats({
          totalPosts: data.summary.overview?.totalPosts || 0,
          postedToday: data.summary.overview?.postedPosts || 0,
          impressions: data.summary.performance?.totalImpressions || 0,
          engagement: data.summary.performance?.avgEngagementRate || 0,
          agentStatus: 'active',
        });
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    setInput('');
    setIsLoading(true);
    setStats(s => ({ ...s, agentStatus: 'working' }));
    setCurrentLogs([]); // Clear current logs for new message

    const logs: ActivityLog[] = [];
    const log = (type: ActivityLog['type'], message: string, detail?: string) => {
      const newLog = { type, message, detail };
      logs.push(newLog);
      setCurrentLogs(prev => [...prev, newLog]);
    };

    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // ストリーミングAPIを使用
      const res = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error('ストリーミング接続に失敗しました');
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('ストリームを読み取れません');
      }

      const decoder = new TextDecoder();
      let responseText = '';
      let toolsUsed: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case 'thinking':
                  log('thinking', event.content);
                  break;
                case 'tool_start':
                  log('tool_start', event.content, event.tool);
                  if (event.tool) toolsUsed.push(event.tool);
                  break;
                case 'tool_end':
                  log('tool_end', event.content, event.tool);
                  break;
                case 'response':
                  responseText = event.content || '';
                  log('success', 'レスポンス生成完了');
                  break;
                case 'error':
                  log('error', 'エラー', event.content);
                  break;
              }
            } catch (e) {
              // JSON parse error - skip
            }
          }
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText || 'レスポンスを取得できませんでした',
        timestamp: new Date().toISOString(),
        toolsUsed,
        activityLogs: [...logs],
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (e: any) {
      log('error', '通信エラー', e.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `通信エラー: ${e.message}`,
        timestamp: new Date().toISOString(),
        activityLogs: [...logs],
      }]);
    } finally {
      setIsLoading(false);
      setCurrentLogs([]); // Clear after message is saved
      setStats(s => ({ ...s, agentStatus: 'active' }));
      loadStats();
    }
  }, [input, isLoading]);

  const getToolDescription = (tool: string): string => {
    const descriptions: Record<string, string> = {
      'get_stats': '統計データを取得',
      'get_posts': '投稿一覧を取得',
      'get_knowledge': 'ナレッジベースを参照',
      'update_knowledge': 'ナレッジを更新',
      'generate_post': '新しい投稿を生成',
      'analyze_performance': 'パフォーマンス分析',
      'read_file': 'ファイルを読み取り',
      'write_file': 'ファイルに書き込み',
      'edit_file': 'ファイルを編集',
      'list_files': 'ファイル一覧を取得',
      'search_files': 'ファイル内を検索',
      'run_command': 'コマンドを実行',
      'web_search': 'Web検索',
      'set_goal': '目標を設定',
      'get_goals': '目標進捗を確認',
      'update_goal_progress': '進捗を更新',
      'get_goal_strategy': '戦略を生成',
    };
    return descriptions[tool] || tool;
  };

  const getGoalTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      'dm': '💬',
      'impression': '👁️',
      'engagement': '❤️',
      'follower': '👥',
      'post': '📝',
    };
    return icons[type] || '🎯';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = async () => {
    await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_history' }),
    });
    setMessages([]);
  };

  const suggestions = [
    { icon: '📊', label: '今日の結果', message: '今日の投稿結果を教えて' },
    { icon: '📈', label: 'パフォーマンス分析', message: 'パフォーマンスを分析して改善提案して' },
    { icon: '📝', label: '投稿を見せて', message: '最近の投稿一覧を見せて' },
    { icon: '💡', label: '改善アイデア', message: '効果的な投稿パターンを教えて' },
  ];

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-container">
      {/* Sidebar Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🤖</span>
            <span className="logo-text">SNS Agent</span>
          </div>
          <button className="new-chat-btn" onClick={clearHistory}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Chat
          </button>
        </div>

        <div className="sidebar-stats">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <span className="stat-value">{stats.postedToday}/{stats.totalPosts}</span>
              <span className="stat-label">投稿数</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👁️</div>
            <div className="stat-info">
              <span className="stat-value">{(stats.impressions / 1000).toFixed(1)}K</span>
              <span className="stat-label">インプレッション</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💬</div>
            <div className="stat-info">
              <span className="stat-value">{stats.engagement.toFixed(1)}%</span>
              <span className="stat-label">エンゲージメント</span>
            </div>
          </div>
        </div>

        {/* Goals Panel */}
        <div className="goals-panel">
          <div className="goals-header">
            <span className="goals-title">🎯 目標</span>
            {goalsSummary && (
              <span className={`health-badge ${goalsSummary.overallHealth}`}>
                {goalsSummary.overallHealth === 'healthy' ? '順調' :
                 goalsSummary.overallHealth === 'warning' ? '遅れ' : '危機'}
              </span>
            )}
          </div>

          {/* Goal Input */}
          <div className="goal-input-wrapper">
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setGoalFromInput()}
              placeholder="今月30件DM"
              className="goal-input"
            />
            <button onClick={setGoalFromInput} className="goal-set-btn">設定</button>
          </div>

          {/* Active Goals */}
          {goalsSummary?.goals && goalsSummary.goals.length > 0 && (
            <div className="goals-list">
              {goalsSummary.goals.map((p, i) => (
                <div key={i} className={`goal-item ${p.urgency}`}>
                  <div className="goal-type">{getGoalTypeIcon(p.goal.type)}</div>
                  <div className="goal-info">
                    <div className="goal-progress-text">
                      <span className="goal-current">{p.goal.current}</span>
                      <span className="goal-separator">/</span>
                      <span className="goal-target">{p.goal.target}</span>
                    </div>
                    <div className="goal-bar">
                      <div
                        className="goal-bar-fill"
                        style={{ width: `${Math.min(100, (p.goal.current / p.goal.target) * 100)}%` }}
                      />
                    </div>
                    <div className="goal-meta">
                      残{p.daysRemaining}日 | {p.dailyTarget}件/日
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Alerts */}
          {goalsSummary?.alerts && goalsSummary.alerts.length > 0 && (
            <div className="goal-alerts">
              {goalsSummary.alerts.slice(0, 2).map((alert, i) => (
                <div key={i} className="goal-alert">{alert}</div>
              ))}
            </div>
          )}
        </div>

        {/* Autonomous Mode Panel */}
        <div className="autonomous-panel">
          <div className="autonomous-header">
            <span className="autonomous-title">🧠 自律モード</span>
            <span className={`health-badge ${autonomousState?.health || 'healthy'}`}>
              {autonomousState?.health === 'healthy' ? '正常' :
               autonomousState?.health === 'warning' ? '注意' : '警告'}
            </span>
          </div>

          {autonomousState && (
            <div className="autonomous-stats">
              <div className="auto-stat">
                <span className="auto-stat-value">{autonomousState.actionsToday}</span>
                <span className="auto-stat-label">今日のアクション</span>
              </div>
              {autonomousState.lastCheck && (
                <div className="auto-stat">
                  <span className="auto-stat-value">
                    {new Date(autonomousState.lastCheck).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="auto-stat-label">最終チェック</span>
                </div>
              )}
            </div>
          )}

          <div className="autonomous-actions">
            <button
              className="auto-btn primary"
              onClick={runAutonomousCheck}
              disabled={isAutonomousRunning}
            >
              {isAutonomousRunning ? '実行中...' : '🔄 自律チェック'}
            </button>
            <div className="auto-btn-group">
              <button
                className="auto-btn secondary"
                onClick={() => runManualAction('analysis')}
                disabled={isAutonomousRunning}
                title="分析"
              >
                📊
              </button>
              <button
                className="auto-btn secondary"
                onClick={() => runManualAction('generation')}
                disabled={isAutonomousRunning}
                title="生成"
              >
                ✨
              </button>
              <button
                className="auto-btn secondary"
                onClick={() => runManualAction('optimization')}
                disabled={isAutonomousRunning}
                title="最適化"
              >
                🎯
              </button>
              <button
                className="auto-btn secondary"
                onClick={() => runManualAction('learning')}
                disabled={isAutonomousRunning}
                title="学習"
              >
                🧠
              </button>
            </div>
          </div>

          {autonomousState?.insights && autonomousState.insights.length > 0 && (
            <div className="autonomous-insights">
              {autonomousState.insights.slice(0, 3).map((insight, i) => (
                <div key={i} className="insight-item">{insight}</div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className={`agent-status ${stats.agentStatus}`}>
            <span className="status-indicator"></span>
            <span>{stats.agentStatus === 'working' ? '処理中...' : 'Agent Online'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Toggle Sidebar Button */}
        <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Chat Area */}
        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <div className="welcome-icon-large">
                  <span>🚀</span>
                </div>
                <h1>SNS Marketing Agent</h1>
                <p>AIがあなたのSNSマーケティングをサポートします</p>

                <div className="suggestions-grid">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      className="suggestion-card"
                      onClick={() => sendMessage(s.message)}
                      disabled={isLoading}
                    >
                      <span className="suggestion-icon">{s.icon}</span>
                      <span className="suggestion-label">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-container">
              {messages.map((msg, i) => (
                <div key={i}>
                  {/* Activity Log before assistant message */}
                  {msg.role === 'assistant' && msg.activityLogs && msg.activityLogs.length > 0 && (
                    <div className="inline-activity">
                      {msg.activityLogs.map((log, j) => (
                        <div key={j} className={`activity-line ${log.type}`}>
                          <span className="activity-bullet">●</span>
                          <span className="activity-text">{log.message}</span>
                          {log.detail && <span className="activity-detail-inline">{log.detail}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={`message-wrapper ${msg.role}`}>
                    <div className="message">
                      <div className="message-header">
                        <span className="message-role">
                          {msg.role === 'user' ? 'You' : 'Agent'}
                        </span>
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className="message-body">
                        {msg.content.split('\n').map((line, j) => (
                          <p key={j}>{line || <br />}</p>
                        ))}
                      </div>
                      {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                        <div className="tools-used">
                          <span className="tools-label">Used:</span>
                          {msg.toolsUsed.map((tool, j) => (
                            <span key={j} className="tool-tag">{tool}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {/* Current Activity Log while loading */}
              {isLoading && currentLogs.length > 0 && (
                <div className="inline-activity">
                  {currentLogs.map((log, i) => (
                    <div key={i} className={`activity-line ${log.type}`}>
                      <span className="activity-bullet">●</span>
                      <span className="activity-text">{log.message}</span>
                      {log.detail && <span className="activity-detail-inline">{log.detail}</span>}
                    </div>
                  ))}
                  <div className="activity-line info">
                    <span className="activity-bullet spinning">●</span>
                    <span className="activity-text">処理中...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              disabled={isLoading}
              rows={1}
            />
            <button
              className="send-button"
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <p className="input-hint">Enter で送信 • Shift+Enter で改行</p>
        </div>
      </main>

      <style jsx>{`
        .app-container {
          display: flex;
          height: 100vh;
          background: #0f0f0f;
          color: #e5e5e5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        }

        /* Sidebar */
        .sidebar {
          width: 280px;
          background: #171717;
          border-right: 1px solid #262626;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid #262626;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .logo-icon {
          font-size: 28px;
        }

        .logo-text {
          font-size: 18px;
          font-weight: 600;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .new-chat-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: transparent;
          border: 1px solid #404040;
          border-radius: 8px;
          color: #e5e5e5;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .new-chat-btn:hover {
          background: #262626;
          border-color: #525252;
        }

        .sidebar-stats {
          flex: 1;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #1f1f1f;
          border-radius: 12px;
          border: 1px solid #262626;
        }

        .stat-icon {
          font-size: 24px;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
        }

        .stat-label {
          font-size: 12px;
          color: #737373;
        }

        .sidebar-footer {
          padding: 20px;
          border-top: 1px solid #262626;
        }

        .agent-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #a3a3a3;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
        }

        .agent-status.working .status-indicator {
          background: #f59e0b;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Main Content */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          min-width: 0;
          overflow: hidden;
        }

        .toggle-sidebar {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 10;
          background: #262626;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 8px;
          color: #e5e5e5;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-sidebar:hover {
          background: #333;
        }

        /* Chat Container */
        .chat-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        /* Welcome Screen */
        .welcome-screen {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .welcome-content {
          text-align: center;
          max-width: 600px;
        }

        .welcome-icon-large {
          font-size: 64px;
          margin-bottom: 24px;
        }

        .welcome-content h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .welcome-content p {
          font-size: 16px;
          color: #737373;
          margin-bottom: 40px;
        }

        .suggestions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .suggestion-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px;
          background: #171717;
          border: 1px solid #262626;
          border-radius: 16px;
          color: #e5e5e5;
          cursor: pointer;
          transition: all 0.2s;
        }

        .suggestion-card:hover:not(:disabled) {
          background: #1f1f1f;
          border-color: #404040;
          transform: translateY(-2px);
        }

        .suggestion-card:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .suggestion-icon {
          font-size: 32px;
        }

        .suggestion-label {
          font-size: 14px;
          font-weight: 500;
        }

        /* Messages */
        .messages-container {
          max-width: 800px;
          margin: 0 auto;
        }

        .message-wrapper {
          margin-bottom: 24px;
        }

        .message-wrapper.user {
          display: flex;
          justify-content: flex-end;
        }

        .message-wrapper.user .message {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          max-width: 80%;
        }

        .message-wrapper.assistant .message {
          background: #1f1f1f;
          border: 1px solid #262626;
          max-width: 100%;
        }

        .message {
          padding: 16px 20px;
          border-radius: 16px;
        }

        .message-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .message-role {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
        }

        .message-time {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
        }

        .message-body {
          font-size: 15px;
          line-height: 1.6;
        }

        .message-body p {
          margin: 0 0 8px 0;
        }

        .message-body p:last-child {
          margin-bottom: 0;
        }

        .tools-used {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .tools-label {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
        }

        .tool-tag {
          font-size: 11px;
          padding: 4px 8px;
          background: rgba(102, 126, 234, 0.2);
          color: #a5b4fc;
          border-radius: 4px;
        }

        /* Thinking Animation */
        .thinking {
          display: flex;
          gap: 6px;
          padding: 4px 0;
        }

        .thinking-dot {
          width: 8px;
          height: 8px;
          background: #667eea;
          border-radius: 50%;
          animation: thinking 1.4s infinite ease-in-out both;
        }

        .thinking-dot:nth-child(1) { animation-delay: -0.32s; }
        .thinking-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes thinking {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Inline Activity Log - Claude Code style */
        .inline-activity {
          max-width: 800px;
          margin: 0 auto 24px;
          padding: 16px 20px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
        }

        .activity-line {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          font-size: 13px;
          color: #a3a3a3;
        }

        .activity-bullet {
          font-size: 8px;
          flex-shrink: 0;
        }

        .activity-line.info .activity-bullet {
          color: #3b82f6;
        }

        .activity-line.thinking .activity-bullet {
          color: #f59e0b;
        }

        .activity-line.tool .activity-bullet,
        .activity-line.tool_start .activity-bullet {
          color: #a855f7;
        }

        .activity-line.tool_end .activity-bullet {
          color: #22c55e;
        }

        .activity-line.success .activity-bullet {
          color: #22c55e;
        }

        .activity-line.error .activity-bullet {
          color: #ef4444;
        }

        .activity-bullet.spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { opacity: 1; }
          50% { opacity: 0.3; }
          to { opacity: 1; }
        }

        .activity-text {
          color: #e5e5e5;
        }

        .activity-detail-inline {
          color: #737373;
          margin-left: 8px;
        }

        .activity-detail-inline::before {
          content: '- ';
        }

        /* Input Area */
        .input-container {
          padding: 20px;
          background: linear-gradient(to top, #0f0f0f 0%, transparent 100%);
        }

        .input-wrapper {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 12px 16px;
          background: #171717;
          border: 1px solid #262626;
          border-radius: 16px;
          transition: border-color 0.2s;
        }

        .input-wrapper:focus-within {
          border-color: #667eea;
        }

        .input-wrapper textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #e5e5e5;
          font-size: 15px;
          line-height: 1.5;
          resize: none;
          max-height: 200px;
        }

        .input-wrapper textarea::placeholder {
          color: #525252;
        }

        .send-button {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 10px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .send-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .input-hint {
          text-align: center;
          font-size: 12px;
          color: #525252;
          margin-top: 8px;
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #525252;
        }

        /* Autonomous Panel */
        .autonomous-panel {
          padding: 16px;
          margin: 16px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
          border: 1px solid rgba(102, 126, 234, 0.2);
          border-radius: 12px;
        }

        .autonomous-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .autonomous-title {
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .health-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 500;
        }

        .health-badge.healthy {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .health-badge.warning {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .health-badge.critical {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        /* Goals Panel */
        .goals-panel {
          padding: 16px;
          margin: 16px;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%);
          border: 1px solid rgba(234, 179, 8, 0.2);
          border-radius: 12px;
        }

        .goals-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .goals-title {
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .goal-input-wrapper {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .goal-input {
          flex: 1;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: white;
          font-size: 13px;
        }

        .goal-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .goal-set-btn {
          padding: 8px 12px;
          background: rgba(234, 179, 8, 0.3);
          border: none;
          border-radius: 6px;
          color: #fbbf24;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .goal-set-btn:hover {
          background: rgba(234, 179, 8, 0.4);
        }

        .goals-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .goal-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          border-left: 3px solid #22c55e;
        }

        .goal-item.medium {
          border-left-color: #f59e0b;
        }

        .goal-item.high {
          border-left-color: #f97316;
        }

        .goal-item.critical {
          border-left-color: #ef4444;
          animation: pulse-red 2s infinite;
        }

        @keyframes pulse-red {
          0%, 100% { background: rgba(239, 68, 68, 0.1); }
          50% { background: rgba(239, 68, 68, 0.2); }
        }

        .goal-type {
          font-size: 20px;
        }

        .goal-info {
          flex: 1;
        }

        .goal-progress-text {
          font-size: 14px;
          font-weight: 600;
          color: white;
          margin-bottom: 4px;
        }

        .goal-current {
          color: #fbbf24;
        }

        .goal-separator {
          color: rgba(255, 255, 255, 0.4);
          margin: 0 2px;
        }

        .goal-target {
          color: rgba(255, 255, 255, 0.7);
        }

        .goal-bar {
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .goal-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #fbbf24, #f97316);
          border-radius: 2px;
          transition: width 0.3s;
        }

        .goal-meta {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }

        .goal-alerts {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .goal-alert {
          font-size: 11px;
          color: #fbbf24;
          padding: 4px 0;
        }

        .autonomous-stats {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .auto-stat {
          flex: 1;
          text-align: center;
          padding: 8px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
        }

        .auto-stat-value {
          display: block;
          font-size: 18px;
          font-weight: 600;
          color: white;
        }

        .auto-stat-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
        }

        .autonomous-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .auto-btn {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .auto-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .auto-btn.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          width: 100%;
        }

        .auto-btn.primary:hover:not(:disabled) {
          transform: scale(1.02);
        }

        .auto-btn-group {
          display: flex;
          gap: 8px;
        }

        .auto-btn.secondary {
          flex: 1;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 16px;
          padding: 8px;
        }

        .auto-btn.secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }

        .autonomous-insights {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .insight-item {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          padding: 4px 0;
        }

        /* Sidebar overlay */
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 99;
        }

        /* Sidebar positioning */
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 100;
        }

        .sidebar.closed {
          transform: translateX(-100%);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .suggestions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

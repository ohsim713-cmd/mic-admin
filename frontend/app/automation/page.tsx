'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// アカウント情報
const ACCOUNTS = [
  { id: 'liver', handle: '@tt_liver', name: 'ライバー', type: 'ライバー' as const, color: '#ec4899', platforms: ['X'] },
  { id: 'chatre1', handle: '@mic_chat_', name: 'チャトレ①', type: 'チャトレ' as const, color: '#8b5cf6', platforms: ['X'] },
  { id: 'chatre2', handle: '@ms_stripchat', name: 'チャトレ②', type: 'チャトレ' as const, color: '#3b82f6', platforms: ['X'] },
  { id: 'wordpress', handle: 'ms-livechat.com', name: 'WordPress', type: 'チャトレ' as const, color: '#21759b', platforms: ['WP'] },
];

// 投稿時間（15投稿/日）
const SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '20:00', '22:00', '23:00',
];

type WorkflowStep = 'research' | 'draft' | 'review' | 'revise' | 'polish' | 'complete';

interface GeneratedPost {
  id: string;
  text: string;
  target: string;
  score: number;
  status: string;
}

interface GenerationProgress {
  postNumber: number;
  totalPosts: number;
  currentStep: WorkflowStep;
  score?: {
    empathy: number;
    benefit: number;
    cta: number;
    credibility: number;
    urgency: number;
    total: number;
  };
  revisionCount?: number;
}

// ワークフローステップの説明
const STEP_INFO: Record<WorkflowStep, { label: string; description: string; icon: string }> = {
  research: {
    label: 'RESEARCH',
    description: 'ターゲット層とベネフィットを選定中...',
    icon: '🔍',
  },
  draft: {
    label: 'DRAFT',
    description: 'Geminiで投稿文を生成中...',
    icon: '✏️',
  },
  review: {
    label: 'REVIEW',
    description: '品質スコアを評価中...',
    icon: '📊',
  },
  revise: {
    label: 'REVISE',
    description: 'フィードバックに基づいて修正中...',
    icon: '🔄',
  },
  polish: {
    label: 'POLISH',
    description: '最終調整中（CTA強化、文字数調整）...',
    icon: '✨',
  },
  complete: {
    label: 'COMPLETE',
    description: '投稿生成完了！',
    icon: '✅',
  },
};

interface DBStats {
  posts: {
    total: number;
    byStatus: Record<string, number>;
    avgScore: number;
    todayGenerated: number;
  };
  patterns: {
    totalPatterns: number;
    avgScore: number;
    lastUpdated: string;
  };
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedAccount, setSelectedAccount] = useState<string | null>('liver');

  // 各アカウントのモード（手動/自動）
  const [accountModes, setAccountModes] = useState<Record<string, 'manual' | 'auto'>>({
    liver: 'manual',
    chatre1: 'manual',
    chatre2: 'manual',
    wordpress: 'manual',
  });

  // モード切替
  const toggleMode = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // カード選択を防ぐ
    setAccountModes(prev => ({
      ...prev,
      [accountId]: prev[accountId] === 'auto' ? 'manual' : 'auto',
    }));
  };

  // 生成状態
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // DB統計
  const [dbStats, setDbStats] = useState<DBStats | null>(null);

  // 次の投稿予定（直近3件）
  const [upcomingPosts, setUpcomingPosts] = useState<GeneratedPost[]>([]);

  // コメント機能
  const [commentingPost, setCommentingPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // ターミナル風ログ
  const [logs, setLogs] = useState<Array<{
    id: number;
    type: 'info' | 'success' | 'warning' | 'error' | 'step' | 'score';
    message: string;
    timestamp: Date;
    detail?: string;
  }>>([]);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (type: 'info' | 'success' | 'warning' | 'error' | 'step' | 'score', message: string, detail?: string) => {
    const newLog = {
      id: logIdRef.current++,
      type,
      message,
      timestamp: new Date(),
      detail,
    };
    setLogs(prev => [...prev, newLog]);
    // 自動スクロール
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 10);
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    loadDBStats();
    loadUpcomingPosts();
    return () => clearInterval(interval);
  }, []);

  // 選択アカウント変更時に投稿を再取得
  useEffect(() => {
    if (selectedAccount) {
      loadUpcomingPosts();
    }
  }, [selectedAccount]);

  // 直近の投稿予定を取得
  const loadUpcomingPosts = async () => {
    try {
      const res = await fetch(`/api/db/posts?account=${selectedAccount}&status=pending&limit=3`);
      if (res.ok) {
        const data = await res.json();
        setUpcomingPosts(data.posts || []);
      }
    } catch (e) {
      console.error('投稿取得エラー:', e);
    }
  };

  // DB統計を読み込み
  const loadDBStats = async () => {
    try {
      const res = await fetch('/api/db/stats');
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
      }
    } catch (e) {
      console.error('DB統計取得エラー:', e);
    }
  };

  // ログをクリア
  const clearLogs = () => {
    setLogs([]);
    logIdRef.current = 0;
  };

  // コメント送信（approve/reject/improve/style）
  const submitComment = async (postId: string, postText: string, action: 'approve' | 'reject' | 'improve' | 'style') => {
    setCommentLoading(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          data: {
            postId,
            postText,
            action,
            comment: commentText,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        addLog('success', `コメント送信完了 (${action})`, result.appliedToKnowledge ? 'ナレッジDBに反映済み' : '');

        // 投稿リストを再取得
        loadUpcomingPosts();
        loadDBStats();

        // コメントUIをリセット
        setCommentingPost(null);
        setCommentText('');
      } else {
        const error = await response.json();
        addLog('error', 'コメント送信失敗', error.error);
      }
    } catch (error) {
      addLog('error', 'コメント送信エラー', String(error));
    } finally {
      setCommentLoading(false);
    }
  };

  // 1投稿生成（手動モード用）
  const generateSinglePost = useCallback(async () => {
    if (isGenerating || !selectedAccount) return;

    setIsGenerating(true);
    setCompletedCount(0);
    startTimeRef.current = Date.now();
    clearLogs();

    addLog('info', '投稿生成を開始します...', `アカウント: ${selectedAccount}`);

    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      addLog('info', 'LangGraph API に接続中...');
      const response = await fetch('/api/generate/langgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1, account: selectedAccount }),
      });

      if (!response.body) throw new Error('ストリーミング非対応');
      addLog('success', 'API接続成功', 'ストリーミング開始');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastStep = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                setGenerationProgress(data);
                // ステップが変わったらログ追加
                if (data.currentStep && data.currentStep !== lastStep) {
                  const stepInfo = STEP_INFO[data.currentStep as WorkflowStep];
                  addLog('step', `${stepInfo.icon} ${stepInfo.label}`, stepInfo.description);
                  lastStep = data.currentStep;

                  // スコア情報があればログ
                  if (data.score && data.score.total > 0) {
                    const passed = data.score.total >= 8;
                    addLog(
                      'score',
                      `品質スコア: ${data.score.total}/10 ${passed ? '✓ 合格' : '✗ 要修正'}`,
                      `共感:${data.score.empathy} メリット:${data.score.benefit} CTA:${data.score.cta} 信頼性:${data.score.credibility} 緊急性:${data.score.urgency}`
                    );
                  }
                }
              } else if (data.type === 'complete') {
                setCompletedCount(1);
                addLog('success', '生成完了!', `${data.posts?.length || 1}件の投稿を保存しました`);
                loadUpcomingPosts();
                loadDBStats();
              }
            } catch (e) {
              console.error('パースエラー:', e);
              addLog('error', 'データパースエラー', String(e));
            }
          }
        }
      }
    } catch (error) {
      console.error('生成エラー:', error);
      addLog('error', '生成エラー', String(error));
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      addLog('info', 'プロセス終了', `経過時間: ${Math.floor((Date.now() - startTimeRef.current) / 1000)}秒`);
    }
  }, [isGenerating, selectedAccount]);

  // 15投稿生成（自動モード用）
  const startGeneration = useCallback(async () => {
    if (isGenerating || !selectedAccount) return;

    setIsGenerating(true);
    setGeneratedPosts([]);
    setCompletedCount(0);
    setAvgScore(0);
    startTimeRef.current = Date.now();
    clearLogs();

    addLog('info', '15投稿の一括生成を開始します...', `アカウント: ${selectedAccount}`);

    // 経過時間タイマー
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      addLog('info', 'LangGraph API に接続中...');
      const response = await fetch('/api/generate/langgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 15, account: selectedAccount }),
      });

      if (!response.body) throw new Error('ストリーミング非対応');
      addLog('success', 'API接続成功', 'ストリーミング開始');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastPostNumber = 0;
      let lastStep = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setGenerationProgress(data);

                // 新しい投稿の開始をログ
                if (data.postNumber !== lastPostNumber) {
                  addLog('info', `━━━ 投稿 #${data.postNumber}/15 を生成中 ━━━`);
                  lastPostNumber = data.postNumber;
                  lastStep = '';
                }

                // ステップの変化をログ
                if (data.currentStep && data.currentStep !== lastStep) {
                  const stepInfo = STEP_INFO[data.currentStep as WorkflowStep];
                  addLog('step', `${stepInfo.icon} ${stepInfo.label}`, stepInfo.description);
                  lastStep = data.currentStep;

                  // スコア情報があればログ
                  if (data.score && data.score.total > 0) {
                    const passed = data.score.total >= 8;
                    addLog(
                      'score',
                      `品質スコア: ${data.score.total}/10 ${passed ? '✓ 合格' : '✗ 要修正'}`,
                      `共感:${data.score.empathy} メリット:${data.score.benefit} CTA:${data.score.cta} 信頼性:${data.score.credibility} 緊急性:${data.score.urgency}`
                    );
                  }
                }

                if (data.currentStep === 'complete') {
                  setCompletedCount(data.postNumber);
                  addLog('success', `投稿 #${data.postNumber} 完了!`);
                }
              } else if (data.type === 'complete') {
                setGeneratedPosts(data.posts || []);
                setAvgScore(parseFloat(data.avgScore) || 0);
                addLog('success', '全投稿の生成完了!', `${data.totalGenerated}件生成 / 平均スコア: ${data.avgScore}点`);
              } else if (data.type === 'error') {
                console.error('生成エラー:', data.error);
                addLog('error', '生成エラー', data.error);
              }
            } catch (e) {
              console.error('パースエラー:', e);
              addLog('error', 'データパースエラー', String(e));
            }
          }
        }
      }
    } catch (error) {
      console.error('生成エラー:', error);
      addLog('error', '生成エラー', String(error));
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      addLog('info', 'プロセス終了', `経過時間: ${Math.floor((Date.now() - startTimeRef.current) / 1000)}秒`);
      // DB統計を更新
      loadDBStats();
    }
  }, [isGenerating, selectedAccount]);

  // ステップ表示（シンプル版）
  const renderStepIndicator = (step: WorkflowStep) => {
    const steps: WorkflowStep[] = ['research', 'draft', 'review', 'revise', 'polish'];

    return (
      <div className="step-indicator">
        {steps.map((s, i) => {
          const stepIndex = steps.indexOf(step);
          const currentIndex = steps.indexOf(s);
          const status = currentIndex < stepIndex ? 'done' : currentIndex === stepIndex ? 'current' : 'pending';

          return (
            <span key={s}>
              <span className={`step ${status}`}>{STEP_INFO[s].label}</span>
              {i < steps.length - 1 && <span className="step-arrow">→</span>}
            </span>
          );
        })}
      </div>
    );
  };

  // ワークフロー可視化（詳細版）
  const renderWorkflowVisualization = () => {
    if (!generationProgress) return null;

    const { currentStep, score, revisionCount } = generationProgress;
    const stepInfo = STEP_INFO[currentStep];
    const steps: WorkflowStep[] = ['research', 'draft', 'review', 'revise', 'polish', 'complete'];

    return (
      <div className="workflow-viz">
        {/* グラフ図 */}
        <div className="workflow-graph">
          <div className="workflow-title">LangGraph ワークフロー</div>
          <div className="workflow-nodes">
            {steps.map((s, i) => {
              const info = STEP_INFO[s];
              const stepIndex = steps.indexOf(currentStep);
              const nodeIndex = steps.indexOf(s);
              let status: 'done' | 'current' | 'pending' = 'pending';
              if (nodeIndex < stepIndex) status = 'done';
              else if (nodeIndex === stepIndex) status = 'current';

              return (
                <div key={s} className="workflow-node-wrapper">
                  <div className={`workflow-node ${status}`}>
                    <span className="node-icon">{info.icon}</span>
                    <span className="node-label">{info.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`workflow-edge ${nodeIndex < stepIndex ? 'done' : ''}`}>
                      {s === 'review' && <span className="edge-label">スコア&lt;8</span>}
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* REVISEループの表示 */}
          <div className="workflow-loop">
            <div className="loop-line" />
            <span className="loop-label">修正ループ (最大3回)</span>
          </div>
        </div>

        {/* 現在のステップ詳細 */}
        <div className="current-step-detail">
          <div className="step-icon-large">{stepInfo.icon}</div>
          <div className="step-info">
            <div className="step-name">{stepInfo.label}</div>
            <div className="step-desc">{stepInfo.description}</div>
            {revisionCount !== undefined && revisionCount > 0 && (
              <div className="revision-count">修正回数: {revisionCount}/3</div>
            )}
          </div>
        </div>

        {/* スコア詳細（REVIEWステップ以降で表示） */}
        {score && score.total > 0 && (
          <div className="score-detail">
            <div className="score-title">品質スコア評価</div>
            <div className="score-grid">
              <div className="score-item">
                <span className="score-label">共感</span>
                <div className="score-bar-mini">
                  <div className="score-fill-mini" style={{ width: `${(score.empathy / 3) * 100}%` }} />
                </div>
                <span className="score-value">{score.empathy}/3</span>
              </div>
              <div className="score-item">
                <span className="score-label">メリット</span>
                <div className="score-bar-mini">
                  <div className="score-fill-mini" style={{ width: `${(score.benefit / 2) * 100}%` }} />
                </div>
                <span className="score-value">{score.benefit}/2</span>
              </div>
              <div className="score-item">
                <span className="score-label">CTA</span>
                <div className="score-bar-mini">
                  <div className="score-fill-mini" style={{ width: `${(score.cta / 2) * 100}%` }} />
                </div>
                <span className="score-value">{score.cta}/2</span>
              </div>
              <div className="score-item">
                <span className="score-label">信頼性</span>
                <div className="score-bar-mini">
                  <div className="score-fill-mini" style={{ width: `${(score.credibility / 2) * 100}%` }} />
                </div>
                <span className="score-value">{score.credibility}/2</span>
              </div>
              <div className="score-item">
                <span className="score-label">緊急性</span>
                <div className="score-bar-mini">
                  <div className="score-fill-mini" style={{ width: `${(score.urgency / 1) * 100}%` }} />
                </div>
                <span className="score-value">{score.urgency}/1</span>
              </div>
            </div>
            <div className="score-total">
              <span>合計スコア:</span>
              <span className={`total-value ${score.total >= 8 ? 'pass' : 'fail'}`}>
                {score.total}/10
                {score.total >= 8 ? ' ✓ 合格' : ' ✗ 要修正'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ターミナル風ログ表示
  const renderTerminalLog = () => {
    if (logs.length === 0 && !isGenerating) return null;

    return (
      <div className="terminal-container">
        <div className="terminal-header">
          <div className="terminal-buttons">
            <span className="terminal-btn red" />
            <span className="terminal-btn yellow" />
            <span className="terminal-btn green" />
          </div>
          <span className="terminal-title">LangGraph Terminal</span>
          <span className="terminal-status">
            {isGenerating ? (
              <>
                <span className="status-dot active" />
                実行中
              </>
            ) : (
              <>
                <span className="status-dot" />
                待機中
              </>
            )}
          </span>
        </div>
        <div className="terminal-body" ref={logContainerRef}>
          {logs.map((log) => (
            <div key={log.id} className={`terminal-line ${log.type}`}>
              <span className="log-time">
                {log.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`log-prefix ${log.type}`}>
                {log.type === 'info' && '▸'}
                {log.type === 'success' && '✓'}
                {log.type === 'warning' && '⚠'}
                {log.type === 'error' && '✗'}
                {log.type === 'step' && '◆'}
                {log.type === 'score' && '◈'}
              </span>
              <span className="log-message">{log.message}</span>
              {log.detail && <span className="log-detail">{log.detail}</span>}
            </div>
          ))}
          {isGenerating && (
            <div className="terminal-cursor">
              <span className="cursor-char">▌</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const selectedAccountInfo = ACCOUNTS.find(a => a.id === selectedAccount);

  return (
    <div className="dashboard">
      {/* ヘッダー */}
      <header className="header">
        <div className="header-left">
          <h1>MIC AI</h1>
          <span className="live-badge">
            <span className="live-dot" />
            LIVE
          </span>
        </div>
        <div className="header-right">
          <span className="time">{currentTime.toLocaleTimeString('ja-JP')}</span>
        </div>
      </header>

      {/* アカウント選択 */}
      <section className="section">
        <div className="section-header">
          <h2>アカウント</h2>
        </div>
        <div className="accounts">
          {ACCOUNTS.map(acc => {
            const isSelected = selectedAccount === acc.id;
            const mode = accountModes[acc.id] || 'manual';
            const isAuto = mode === 'auto';

            return (
              <div
                key={acc.id}
                className={`account-card ${isSelected ? 'selected' : ''}`}
                style={{ borderColor: isSelected ? acc.color : 'transparent' }}
                onClick={() => setSelectedAccount(acc.id)}
              >
                {/* モード切替スイッチ */}
                <div
                  className={`mode-switch ${isAuto ? 'auto' : 'manual'}`}
                  onClick={(e) => toggleMode(acc.id, e)}
                >
                  <span className="mode-label">{isAuto ? '自動' : '手動'}</span>
                  <div className="switch-track">
                    <div className="switch-thumb" />
                  </div>
                </div>

                <div className="account-name">{acc.name}</div>
                <div className="account-handle">{acc.handle}</div>
                <div className="account-platforms">
                  {acc.platforms.map(p => (
                    <span key={p} className="platform-badge">{p}</span>
                  ))}
                </div>
                {isAuto && (
                  <div className="auto-badge">
                    <span className="auto-dot" />
                    AUTO
                  </div>
                )}
                {isSelected && <div className="account-indicator" style={{ background: acc.color }} />}
              </div>
            );
          })}
          <div className="account-card add-card">
            <span>+ 追加</span>
          </div>
        </div>
      </section>

      {/* 選択中アカウント詳細 */}
      {selectedAccountInfo && (
        <section className="section detail-section">
          <div className="section-header">
            <h2 style={{ color: selectedAccountInfo.color }}>{selectedAccountInfo.handle} 詳細</h2>
          </div>
          <div className="detail-grid">
            {/* コンテンツ種別 */}
            <div className="detail-card">
              <div className="detail-title">コンテンツ</div>
              <div className="content-types">
                <div className="content-type active">
                  <span className="type-icon">文章</span>
                  <span className="type-status">稼働中</span>
                </div>
                <div className="content-type">
                  <span className="type-icon">動画</span>
                  <span className="type-status">準備中</span>
                </div>
                <div className="content-type">
                  <span className="type-icon">画像</span>
                  <span className="type-status">準備中</span>
                </div>
              </div>
            </div>

            {/* 今日の予定（15投稿） */}
            <div className="detail-card schedule-card">
              <div className="detail-title">
                今日の予定
                <span className="schedule-count">
                  {SLOTS.filter(slot => {
                    const now = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
                    return slot < now;
                  }).length}/{SLOTS.length}投稿
                </span>
              </div>
              <div className="schedule-grid">
                {SLOTS.map(slot => {
                  const now = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
                  const isDone = slot < now;
                  const isCurrent = slot.slice(0, 2) === now.slice(0, 2);
                  return (
                    <span key={slot} className={`time-chip ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                      {slot}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* AI分析 */}
            <div className="detail-card">
              <div className="detail-title">AI分析</div>
              <div className="analysis">
                <div className="analysis-item">
                  <span className="analysis-label">週間DM</span>
                  <span className="analysis-value">0/21件</span>
                </div>
                <div className="analysis-item">
                  <span className="analysis-label">課題</span>
                  <span className="analysis-value">データ収集中</span>
                </div>
              </div>
            </div>
          </div>

          {/* 目標達成 */}
          <div className="goal-progress">
            <span className="goal-label">月間DM目標</span>
            <div className="goal-bar">
              <div className="goal-fill" style={{ width: '0%' }} />
            </div>
            <span className="goal-value">0/90件 (0%)</span>
          </div>

          {/* 直近の投稿予定 */}
          <div className="upcoming-section">
            <div className="upcoming-header">
              <span className="upcoming-title">次の投稿予定</span>
              <div className="upcoming-header-right">
                <span className="upcoming-count">{upcomingPosts.length}件</span>
                <button
                  className={`single-generate-btn ${isGenerating ? 'generating' : ''}`}
                  onClick={generateSinglePost}
                  disabled={isGenerating}
                >
                  {isGenerating ? '生成中...' : '+ 1投稿生成'}
                </button>
              </div>
            </div>
            {upcomingPosts.length > 0 ? (
              <div className="upcoming-list">
                {upcomingPosts.map((post, index) => (
                  <div key={post.id} className="upcoming-item">
                    <div className="upcoming-item-header">
                      <span className="upcoming-num">#{index + 1}</span>
                      <span className="upcoming-score">{post.score}点</span>
                      <span className="upcoming-target">{post.target}</span>
                      <span className="upcoming-status">{post.status}</span>
                    </div>
                    <div className="upcoming-text">{post.text}</div>

                    {/* コメント入力エリア */}
                    {commentingPost === post.id ? (
                      <div className="comment-area">
                        <textarea
                          className="comment-input"
                          placeholder="コメントを入力（任意）..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          rows={2}
                        />
                        <div className="comment-actions">
                          <button
                            className="comment-btn approve"
                            onClick={() => submitComment(post.id, post.text, 'approve')}
                            disabled={commentLoading}
                          >
                            承認（成功パターンに追加）
                          </button>
                          <button
                            className="comment-btn reject"
                            onClick={() => submitComment(post.id, post.text, 'reject')}
                            disabled={commentLoading}
                          >
                            却下（NGパターンに追加）
                          </button>
                          <button
                            className="comment-btn improve"
                            onClick={() => submitComment(post.id, post.text, 'improve')}
                            disabled={commentLoading || !commentText}
                          >
                            改善提案
                          </button>
                          <button
                            className="comment-btn style"
                            onClick={() => submitComment(post.id, post.text, 'style')}
                            disabled={commentLoading || !commentText}
                          >
                            スタイル指定
                          </button>
                          <button
                            className="comment-btn cancel"
                            onClick={() => { setCommentingPost(null); setCommentText(''); }}
                          >
                            キャンセル
                          </button>
                        </div>
                        <div className="comment-hints">
                          <span className="hint">承認: この投稿を成功パターンとして記録</span>
                          <span className="hint">却下: この投稿をNGパターンとして記録</span>
                          <span className="hint">改善: 生成プロンプトの改善に反映</span>
                          <span className="hint">スタイル: 文体・トーンの指定に反映</span>
                        </div>
                      </div>
                    ) : (
                      <div className="upcoming-actions">
                        <button
                          className="upcoming-btn comment"
                          onClick={() => setCommentingPost(post.id)}
                        >
                          コメント
                        </button>
                        <button
                          className="upcoming-btn approve"
                          onClick={() => submitComment(post.id, post.text, 'approve')}
                        >
                          承認
                        </button>
                        <button
                          className="upcoming-btn reject"
                          onClick={() => submitComment(post.id, post.text, 'reject')}
                        >
                          却下
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="upcoming-empty">
                <span>投稿予定がありません</span>
                <span className="upcoming-hint">「15投稿生成」で作成してください</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* AI生成セクション */}
      <section className="section generate-section">
        <div className="section-header">
          <h2>LangGraph AI生成</h2>
        </div>

        <div className="generate-controls">
          <button
            className={`generate-btn ${isGenerating ? 'generating' : ''}`}
            onClick={startGeneration}
            disabled={isGenerating || !selectedAccount}
          >
            {isGenerating ? '生成中...' : '15投稿生成'}
          </button>
          <button className="generate-btn secondary" disabled>
            ショート動画案
          </button>
          <button className="generate-btn secondary" disabled>
            画像案
          </button>
        </div>

        {/* 進捗表示 */}
        {(isGenerating || generatedPosts.length > 0) && (
          <div className="progress-section">
            <div className="progress-header">
              <span>進捗: {completedCount}/{generationProgress?.totalPosts || 15}</span>
              <span>平均 {avgScore.toFixed(1)}点</span>
              <span>経過 {elapsedTime}秒</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(completedCount / (generationProgress?.totalPosts || 15)) * 100}%` }}
                />
              </div>
            </div>

            {/* ターミナル風ログ表示 */}
            {renderTerminalLog()}

            {/* ワークフロー可視化 */}
            {isGenerating && renderWorkflowVisualization()}

            {/* ステップ表示（シンプル版） */}
            {generationProgress && !isGenerating && (
              <div className="current-post">
                <span>#{generationProgress.postNumber}</span>
                {renderStepIndicator(generationProgress.currentStep)}
              </div>
            )}

            {/* 完了した投稿 */}
            {generatedPosts.length > 0 && (
              <div className="completed-posts">
                <div className="completed-header">完了した投稿:</div>
                <div className="completed-list">
                  {generatedPosts.slice(0, 5).map((post, i) => (
                    <div key={post.id} className="completed-item">
                      <span className="completed-num">#{i + 1}</span>
                      <span className="completed-score">[{post.score}点]</span>
                      <span className="completed-text">{post.text.slice(0, 30)}...</span>
                    </div>
                  ))}
                  {generatedPosts.length > 5 && (
                    <div className="completed-more">...他 {generatedPosts.length - 5}件</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* データベース状況 */}
      <section className="section db-section">
        <div className="section-header">
          <h2>データベース状況</h2>
        </div>
        <div className="db-stats">
          <div className="db-stat">
            <div className="db-value">{dbStats?.posts.total || 0}</div>
            <div className="db-label">生成済み投稿</div>
          </div>
          <div className="db-stat">
            <div className="db-value">{dbStats?.patterns.totalPatterns || 0}</div>
            <div className="db-label">成功パターン</div>
          </div>
          <div className="db-stat">
            <div className="db-value">{dbStats?.posts.avgScore?.toFixed(1) || '-'}</div>
            <div className="db-label">平均スコア</div>
          </div>
          <div className="db-stat">
            <div className="db-value">{dbStats?.posts.todayGenerated || 0}</div>
            <div className="db-label">今日の生成</div>
          </div>
        </div>

        {/* 学習結果 */}
        <div className="learning-results">
          <div className="learning-header">学習中のパターン:</div>
          <div className="learning-items">
            <div className="learning-item">「ぶっちゃけ」で始まる投稿</div>
            <div className="learning-item">「DMで」を含むCTA</div>
            <div className="learning-item">月収の具体的数字</div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .dashboard {
          padding: 1rem;
          max-width: 900px;
          margin: 0 auto;
          color: white;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header h1 {
          font-size: 1.5rem;
          margin: 0;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.5rem;
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.4);
          border-radius: 12px;
          font-size: 0.65rem;
          color: #22c55e;
          font-weight: 600;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .time {
          font-family: monospace;
          font-size: 1.25rem;
          color: #8b5cf6;
        }

        .section {
          margin-bottom: 1.5rem;
        }

        .section-header {
          margin-bottom: 0.75rem;
        }

        .section-header h2 {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.7);
          margin: 0;
          font-weight: 500;
        }

        /* アカウントカード */
        .accounts {
          display: flex;
          gap: 0.75rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .account-card {
          flex: 0 0 auto;
          min-width: 120px;
          padding: 0.75rem;
          background: rgba(255,255,255,0.03);
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .account-card:hover {
          background: rgba(255,255,255,0.06);
        }

        .account-card.selected {
          background: rgba(255,255,255,0.08);
        }

        .account-indicator {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 40%;
          height: 3px;
          border-radius: 3px 3px 0 0;
        }

        .account-name {
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .account-handle {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.5);
          margin-bottom: 0.5rem;
        }

        .platform-badge {
          display: inline-block;
          padding: 0.15rem 0.4rem;
          background: rgba(139, 92, 246, 0.2);
          border-radius: 4px;
          font-size: 0.6rem;
          color: #a78bfa;
        }

        .add-card {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.4);
          font-size: 0.85rem;
        }

        /* モード切替スイッチ */
        .mode-switch {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.5rem;
          padding: 0.25rem 0.4rem;
          background: rgba(255,255,255,0.05);
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-switch:hover {
          background: rgba(255,255,255,0.1);
        }

        .mode-switch.auto {
          background: rgba(34, 197, 94, 0.15);
        }

        .mode-label {
          font-size: 0.6rem;
          font-weight: 600;
          min-width: 24px;
        }

        .mode-switch.manual .mode-label {
          color: rgba(255,255,255,0.6);
        }

        .mode-switch.auto .mode-label {
          color: #22c55e;
        }

        .switch-track {
          width: 28px;
          height: 14px;
          background: rgba(255,255,255,0.2);
          border-radius: 7px;
          position: relative;
          transition: all 0.2s;
        }

        .mode-switch.auto .switch-track {
          background: #22c55e;
        }

        .switch-thumb {
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: all 0.2s;
        }

        .mode-switch.auto .switch-thumb {
          left: 16px;
        }

        .auto-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.15rem 0.35rem;
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.4);
          border-radius: 8px;
          font-size: 0.5rem;
          color: #22c55e;
          font-weight: 700;
        }

        .auto-dot {
          width: 4px;
          height: 4px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        /* 直近の投稿予定 */
        .upcoming-section {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .upcoming-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .upcoming-header-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .upcoming-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
        }

        .upcoming-count {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.5);
          padding: 0.15rem 0.4rem;
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }

        .single-generate-btn {
          padding: 0.35rem 0.65rem;
          font-size: 0.7rem;
          font-weight: 600;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .single-generate-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 10px rgba(139, 92, 246, 0.4);
        }

        .single-generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .single-generate-btn.generating {
          animation: generating 1s infinite;
        }

        .upcoming-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .upcoming-item {
          padding: 0.75rem;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          transition: all 0.2s;
        }

        .upcoming-item:hover {
          border-color: rgba(139, 92, 246, 0.3);
        }

        .upcoming-item-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .upcoming-num {
          font-size: 0.7rem;
          font-weight: 700;
          color: #8b5cf6;
        }

        .upcoming-score {
          font-size: 0.65rem;
          padding: 0.1rem 0.3rem;
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border-radius: 4px;
        }

        .upcoming-target {
          font-size: 0.65rem;
          padding: 0.1rem 0.3rem;
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          border-radius: 4px;
        }

        .upcoming-text {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.9);
          line-height: 1.5;
          margin-bottom: 0.5rem;
          white-space: pre-wrap;
          max-height: 80px;
          overflow-y: auto;
        }

        .upcoming-actions {
          display: flex;
          gap: 0.5rem;
        }

        .upcoming-btn {
          padding: 0.3rem 0.6rem;
          font-size: 0.65rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .upcoming-btn.edit {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
        }

        .upcoming-btn.edit:hover {
          background: rgba(255,255,255,0.2);
        }

        .upcoming-btn.approve {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .upcoming-btn.approve:hover {
          background: rgba(34, 197, 94, 0.3);
        }

        .upcoming-btn.skip {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .upcoming-btn.skip:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .upcoming-btn.reject {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .upcoming-btn.reject:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .upcoming-btn.comment {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }

        .upcoming-btn.comment:hover {
          background: rgba(139, 92, 246, 0.3);
        }

        .upcoming-status {
          font-size: 0.6rem;
          padding: 0.1rem 0.3rem;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          border-radius: 4px;
          margin-left: auto;
        }

        /* コメント入力エリア */
        .comment-area {
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .comment-input {
          width: 100%;
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: white;
          font-size: 0.75rem;
          resize: vertical;
          font-family: inherit;
        }

        .comment-input:focus {
          outline: none;
          border-color: rgba(139, 92, 246, 0.5);
        }

        .comment-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .comment-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .comment-btn {
          padding: 0.4rem 0.6rem;
          font-size: 0.65rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .comment-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .comment-btn.approve {
          background: rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        .comment-btn.approve:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.4);
        }

        .comment-btn.reject {
          background: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .comment-btn.reject:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.4);
        }

        .comment-btn.improve {
          background: rgba(59, 130, 246, 0.3);
          color: #3b82f6;
        }

        .comment-btn.improve:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.4);
        }

        .comment-btn.style {
          background: rgba(236, 72, 153, 0.3);
          color: #ec4899;
        }

        .comment-btn.style:hover:not(:disabled) {
          background: rgba(236, 72, 153, 0.4);
        }

        .comment-btn.cancel {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
        }

        .comment-btn.cancel:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .comment-hints {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .hint {
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.4);
        }

        .upcoming-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1.5rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          color: rgba(255,255,255,0.5);
          font-size: 0.8rem;
        }

        .upcoming-hint {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.3);
          margin-top: 0.25rem;
        }

        /* 詳細セクション */
        .detail-section {
          background: rgba(255,255,255,0.02);
          border-radius: 12px;
          padding: 1rem;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .detail-card {
          padding: 0.75rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
        }

        .detail-title {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.5);
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
        }

        .content-types {
          display: flex;
          gap: 0.5rem;
        }

        .content-type {
          text-align: center;
          flex: 1;
        }

        .content-type.active .type-icon {
          color: #22c55e;
        }

        .type-icon {
          display: block;
          font-size: 0.75rem;
          margin-bottom: 0.25rem;
        }

        .type-status {
          font-size: 0.6rem;
          color: rgba(255,255,255,0.4);
        }

        /* スケジュールカード（15投稿対応） */
        .schedule-card {
          grid-column: span 2;
        }

        .schedule-count {
          font-size: 0.65rem;
          color: #22c55e;
          margin-left: 0.5rem;
          font-weight: 600;
        }

        .schedule-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.35rem;
        }

        .time-chip {
          font-size: 0.6rem;
          padding: 0.25rem 0.3rem;
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          font-family: monospace;
          text-align: center;
          transition: all 0.2s;
        }

        .time-chip.done {
          background: rgba(34, 197, 94, 0.25);
          color: #22c55e;
        }

        .time-chip.current {
          background: rgba(139, 92, 246, 0.35);
          color: #a78bfa;
          animation: currentSlot 1.5s infinite;
          font-weight: 600;
        }

        @keyframes currentSlot {
          0%, 100% { box-shadow: 0 0 8px rgba(139, 92, 246, 0.4); }
          50% { box-shadow: 0 0 2px rgba(139, 92, 246, 0.2); }
        }

        .analysis-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          margin-bottom: 0.25rem;
        }

        .analysis-label {
          color: rgba(255,255,255,0.5);
        }

        .goal-progress {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
        }

        .goal-label {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.6);
          min-width: 80px;
        }

        .goal-bar {
          flex: 1;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .goal-fill {
          height: 100%;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          border-radius: 4px;
          transition: width 0.5s;
        }

        .goal-value {
          font-size: 0.75rem;
          min-width: 100px;
          text-align: right;
        }

        /* 生成セクション */
        .generate-section {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1));
          border-radius: 12px;
          padding: 1rem;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .generate-controls {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .generate-btn {
          padding: 0.75rem 1.25rem;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .generate-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        }

        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .generate-btn.secondary {
          background: rgba(255,255,255,0.1);
        }

        .generate-btn.generating {
          animation: generating 1s infinite;
        }

        @keyframes generating {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .progress-section {
          padding: 1rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          margin-bottom: 0.75rem;
          color: rgba(255,255,255,0.8);
        }

        .progress-bar-container {
          margin-bottom: 0.75rem;
        }

        .progress-bar {
          height: 10px;
          background: rgba(255,255,255,0.1);
          border-radius: 5px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          border-radius: 5px;
          transition: width 0.3s;
        }

        .current-post {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8rem;
          margin-bottom: 0.75rem;
        }

        .step-indicator {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .step {
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 600;
        }

        .step.done {
          background: rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        .step.current {
          background: rgba(139, 92, 246, 0.3);
          color: #a78bfa;
          animation: stepPulse 1s infinite;
        }

        .step.pending {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.4);
        }

        .step-arrow {
          color: rgba(255,255,255,0.3);
          font-size: 0.7rem;
        }

        @keyframes stepPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        /* ワークフロー可視化 */
        .workflow-viz {
          margin: 1rem 0;
          padding: 1rem;
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .workflow-graph {
          margin-bottom: 1rem;
        }

        .workflow-title {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.6);
          margin-bottom: 0.75rem;
          text-align: center;
        }

        .workflow-nodes {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          flex-wrap: wrap;
        }

        .workflow-node-wrapper {
          display: flex;
          align-items: center;
        }

        .workflow-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          border: 2px solid transparent;
          min-width: 70px;
          transition: all 0.3s;
        }

        .workflow-node.done {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.4);
        }

        .workflow-node.current {
          background: rgba(139, 92, 246, 0.2);
          border-color: #8b5cf6;
          animation: nodeGlow 1.5s infinite;
        }

        .workflow-node.pending {
          opacity: 0.4;
        }

        @keyframes nodeGlow {
          0%, 100% { box-shadow: 0 0 10px rgba(139, 92, 246, 0.3); }
          50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.6); }
        }

        .node-icon {
          font-size: 1.25rem;
          margin-bottom: 0.25rem;
        }

        .node-label {
          font-size: 0.6rem;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
        }

        .workflow-edge {
          color: rgba(255,255,255,0.3);
          font-size: 0.8rem;
          padding: 0 0.25rem;
          position: relative;
        }

        .workflow-edge.done {
          color: #22c55e;
        }

        .edge-label {
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.5rem;
          color: rgba(255,255,255,0.4);
          white-space: nowrap;
        }

        .workflow-loop {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 0.5rem;
          gap: 0.5rem;
        }

        .loop-line {
          width: 120px;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent);
          border-radius: 1px;
        }

        .loop-label {
          font-size: 0.6rem;
          color: rgba(255,255,255,0.4);
        }

        .current-step-detail {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .step-icon-large {
          font-size: 2rem;
        }

        .step-info {
          flex: 1;
        }

        .step-name {
          font-size: 0.9rem;
          font-weight: 700;
          color: #a78bfa;
          margin-bottom: 0.25rem;
        }

        .step-desc {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.7);
        }

        .revision-count {
          font-size: 0.7rem;
          color: #f59e0b;
          margin-top: 0.25rem;
        }

        .score-detail {
          padding: 0.75rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
        }

        .score-title {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.6);
          margin-bottom: 0.5rem;
        }

        .score-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .score-item {
          text-align: center;
        }

        .score-label {
          display: block;
          font-size: 0.6rem;
          color: rgba(255,255,255,0.5);
          margin-bottom: 0.25rem;
        }

        .score-bar-mini {
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 0.2rem;
        }

        .score-fill-mini {
          height: 100%;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          border-radius: 2px;
          transition: width 0.3s;
        }

        .score-value {
          font-size: 0.65rem;
          color: rgba(255,255,255,0.7);
        }

        .score-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255,255,255,0.1);
          font-size: 0.8rem;
        }

        .total-value {
          font-weight: 700;
        }

        .total-value.pass {
          color: #22c55e;
        }

        .total-value.fail {
          color: #ef4444;
        }

        .completed-posts {
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 0.75rem;
        }

        .completed-header {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.6);
          margin-bottom: 0.5rem;
        }

        .completed-list {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .completed-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
        }

        .completed-num {
          color: #8b5cf6;
          font-weight: 600;
        }

        .completed-score {
          color: #22c55e;
        }

        .completed-text {
          color: rgba(255,255,255,0.7);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .completed-more {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.5);
        }

        /* DB統計セクション */
        .db-section {
          background: rgba(255,255,255,0.02);
          border-radius: 12px;
          padding: 1rem;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .db-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .db-stat {
          text-align: center;
          padding: 0.75rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
        }

        .db-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #a78bfa;
        }

        .db-label {
          font-size: 0.65rem;
          color: rgba(255,255,255,0.5);
          margin-top: 0.25rem;
        }

        .learning-results {
          padding: 0.75rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
        }

        .learning-header {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.6);
          margin-bottom: 0.5rem;
        }

        .learning-items {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .learning-item {
          padding: 0.25rem 0.5rem;
          background: rgba(139, 92, 246, 0.2);
          border-radius: 4px;
          font-size: 0.7rem;
          color: #a78bfa;
        }

        /* ターミナル風ログ */
        .terminal-container {
          margin: 1rem 0;
          border-radius: 10px;
          overflow: hidden;
          background: #0d1117;
          border: 1px solid #30363d;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: #161b22;
          border-bottom: 1px solid #30363d;
        }

        .terminal-buttons {
          display: flex;
          gap: 0.4rem;
          margin-right: 0.75rem;
        }

        .terminal-btn {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .terminal-btn.red {
          background: #ff5f56;
        }

        .terminal-btn.yellow {
          background: #ffbd2e;
        }

        .terminal-btn.green {
          background: #27c93f;
        }

        .terminal-title {
          flex: 1;
          font-size: 0.7rem;
          color: #8b949e;
          text-align: center;
        }

        .terminal-status {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.65rem;
          color: #8b949e;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #484f58;
        }

        .status-dot.active {
          background: #3fb950;
          animation: statusPulse 1s infinite;
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px #3fb950; }
          50% { opacity: 0.6; box-shadow: none; }
        }

        .terminal-body {
          max-height: 300px;
          overflow-y: auto;
          padding: 0.75rem;
          scrollbar-width: thin;
          scrollbar-color: #30363d transparent;
        }

        .terminal-body::-webkit-scrollbar {
          width: 6px;
        }

        .terminal-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .terminal-body::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 3px;
        }

        .terminal-line {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
          font-size: 0.72rem;
          line-height: 1.5;
        }

        .log-time {
          color: #484f58;
          flex-shrink: 0;
          font-size: 0.65rem;
        }

        .log-prefix {
          flex-shrink: 0;
          width: 14px;
          text-align: center;
        }

        .log-prefix.info {
          color: #58a6ff;
        }

        .log-prefix.success {
          color: #3fb950;
        }

        .log-prefix.warning {
          color: #d29922;
        }

        .log-prefix.error {
          color: #f85149;
        }

        .log-prefix.step {
          color: #a371f7;
        }

        .log-prefix.score {
          color: #db61a2;
        }

        .log-message {
          color: #c9d1d9;
        }

        .terminal-line.success .log-message {
          color: #3fb950;
        }

        .terminal-line.error .log-message {
          color: #f85149;
        }

        .terminal-line.step .log-message {
          color: #a371f7;
          font-weight: 500;
        }

        .terminal-line.score .log-message {
          color: #db61a2;
        }

        .log-detail {
          color: #6e7681;
          font-size: 0.65rem;
          margin-left: 0.25rem;
        }

        .terminal-cursor {
          margin-top: 0.25rem;
        }

        .cursor-char {
          color: #58a6ff;
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        @media (max-width: 600px) {
          .detail-grid {
            grid-template-columns: 1fr;
          }
          .schedule-card {
            grid-column: span 1;
          }
          .schedule-grid {
            grid-template-columns: repeat(5, 1fr);
          }
          .db-stats {
            grid-template-columns: repeat(2, 1fr);
          }
          .generate-controls {
            flex-wrap: wrap;
          }
          .generate-btn {
            flex: 1 1 auto;
          }
          .terminal-body {
            max-height: 200px;
          }
          .log-time {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

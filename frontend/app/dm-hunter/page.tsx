'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  Target,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Clock,
  TrendingUp,
  MessageCircle,
  ArrowLeft,
  Users,
  Eye,
  RotateCcw,
  Send,
  Edit3,
} from 'lucide-react';

interface AccountStatus {
  account: string;
  name: string;
  handle: string;
  connected: boolean;
  username?: string;
  error?: string;
}

interface PostLog {
  id: string;
  timestamp: string;
  text: string;
  target: string;
  benefit: string;
  account?: string;
  score: number;
  results: {
    platform: string;
    account?: string;
    success: boolean;
    id?: string;
    error?: string;
  }[];
}

interface Stats {
  todayPosts: number;
  todaySuccess: number;
  totalPosts: number;
}

interface AutoRunStatus {
  status: string;
  accounts: AccountStatus[];
  todayPosts: number;
  todaySuccess: number;
  scheduledTimes: string[];
}

interface PreviewPost {
  account: string;
  text: string;
  target: string;
  benefit: string;
  score: number;
  passed: boolean;
}

const ACCOUNT_COLORS: Record<string, string> = {
  liver: '#f59e0b',
  chatre1: '#ec4899',
  chatre2: '#8b5cf6',
};

const ACCOUNT_LABELS: Record<string, string> = {
  liver: 'ライバー',
  chatre1: 'チャトレ①',
  chatre2: 'チャトレ②',
};

export default function DMHunterPage() {
  const [status, setStatus] = useState<AutoRunStatus | null>(null);
  const [logs, setLogs] = useState<PostLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PreviewPost[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [regeneratingAccount, setRegeneratingAccount] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // データ取得
  const fetchData = async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/dm-hunter/auto-run'),
        fetch('/api/dm-hunter/logs?limit=15'),
      ]);

      const statusData = await statusRes.json();
      const logsData = await logsRes.json();

      setStatus(statusData);
      setLogs(logsData.logs || []);
      setStats(logsData.stats || null);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // ページ読み込み時に自動でプレビュー生成
    generatePreviews();
  }, []);

  // プレビュー生成（3アカウント分）
  const generatePreviews = async () => {
    setPreviewLoading(true);
    setPreviews([]);
    try {
      const res = await fetch('/api/dm-hunter/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      if (data.posts) {
        setPreviews(data.posts.map((p: any) => ({
          account: p.account,
          text: p.text,
          target: p.target,
          benefit: p.benefit,
          score: p.score?.total ?? p.score,
          passed: p.score?.passed ?? p.score >= 7,
        })));
      }
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 単一アカウント再生成
  const regenerateForAccount = async (account: string) => {
    setRegeneratingAccount(account);
    try {
      const res = await fetch('/api/dm-hunter/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true, account }),
      });
      const data = await res.json();
      if (data.post) {
        setPreviews(prev => prev.map(p =>
          p.account === account
            ? {
                account,
                text: data.post.text,
                target: data.post.target,
                benefit: data.post.benefit,
                score: data.score?.total ?? data.score,
                passed: data.score?.passed ?? data.score >= 7,
              }
            : p
        ));
      }
    } catch (error) {
      console.error('Regenerate error:', error);
    } finally {
      setRegeneratingAccount(null);
    }
  };

  // 編集確定
  const confirmEdit = (account: string) => {
    setPreviews(prev => prev.map(p =>
      p.account === account ? { ...p, text: editText } : p
    ));
    setEditingAccount(null);
    setEditText('');
  };

  // プレビューから投稿実行
  const postFromPreviews = async () => {
    if (previews.length === 0) return;
    setRunning(true);
    setLastResult(null);
    try {
      // 各アカウントに個別投稿
      const results = [];
      for (const preview of previews) {
        const res = await fetch('/api/dm-hunter/post-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: preview.text,
            account: preview.account,
            target: preview.target,
            benefit: preview.benefit,
            score: preview.score,
          }),
        });
        const data = await res.json();
        results.push({ ...data, account: preview.account });
      }
      setLastResult({
        success: results.some(r => r.success),
        results: results.map(r => ({
          account: ACCOUNT_LABELS[r.account] || r.account,
          success: r.success,
          error: r.error,
        })),
      });
      await fetchData();
      setPreviews([]);
    } catch (error: any) {
      setLastResult({ success: false, error: error.message });
    } finally {
      setRunning(false);
    }
  };

  // 手動実行
  const runManually = async (dryRun: boolean = false, account?: string) => {
    setRunning(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/dm-hunter/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, account }),
      });

      const data = await res.json();
      setLastResult(data);

      if (!dryRun) {
        await fetchData();
      }
    } catch (error: any) {
      setLastResult({ success: false, error: error.message });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={32} />
        <p style={{ marginTop: '16px', color: '#888' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/" style={{ color: '#888' }}>
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Target size={32} color="#f59e0b" />
            DM Hunter
          </h1>
          <p style={{ color: '#888', marginTop: '4px' }}>3アカウント同時運用 - DM問い合わせ獲得</p>
        </div>
      </div>

      {/* アカウント状態 */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} />
          アカウント状態
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {status?.accounts?.map((acc) => (
            <div
              key={acc.account}
              style={{
                padding: '20px',
                background: `linear-gradient(135deg, ${ACCOUNT_COLORS[acc.account]}22 0%, ${ACCOUNT_COLORS[acc.account]}11 100%)`,
                border: `1px solid ${ACCOUNT_COLORS[acc.account]}44`,
                borderRadius: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{acc.name}</div>
                  <div style={{ color: '#888', fontSize: '14px' }}>{acc.handle}</div>
                </div>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  background: acc.connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: acc.connected ? '#22c55e' : '#ef4444',
                }}>
                  {acc.connected ? '接続OK' : '未接続'}
                </div>
              </div>
              {acc.connected && (
                <button
                  onClick={() => runManually(true, acc.account)}
                  disabled={running}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: ACCOUNT_COLORS[acc.account],
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: running ? 'not-allowed' : 'pointer',
                    opacity: running ? 0.5 : 1,
                  }}
                >
                  テスト生成
                </button>
              )}
              {!acc.connected && acc.error && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>
                  {acc.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ステータスカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b22 0%, #f59e0b11 100%)',
          border: '1px solid #f59e0b44',
          borderRadius: '16px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <MessageCircle size={20} color="#f59e0b" />
            <span style={{ color: '#888', fontSize: '14px' }}>今日の投稿</span>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#f59e0b' }}>
            {stats?.todayPosts || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>/ 18 目標 (6回×3アカウント)</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #22c55e22 0%, #22c55e11 100%)',
          border: '1px solid #22c55e44',
          borderRadius: '16px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle size={20} color="#22c55e" />
            <span style={{ color: '#888', fontSize: '14px' }}>成功</span>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#22c55e' }}>
            {stats?.todaySuccess || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>投稿成功</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #3b82f622 0%, #3b82f611 100%)',
          border: '1px solid #3b82f644',
          borderRadius: '16px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TrendingUp size={20} color="#3b82f6" />
            <span style={{ color: '#888', fontSize: '14px' }}>累計</span>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#3b82f6' }}>
            {stats?.totalPosts || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>総投稿数</div>
        </div>
      </div>

      {/* 投稿プレビュー */}
      <div style={{
        marginBottom: '32px',
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} color="#8b5cf6" />
            投稿プレビュー
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>
              (投稿前に内容を確認・修正)
            </span>
          </h2>
          <button
            onClick={generatePreviews}
            disabled={previewLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: previewLoading ? '#333' : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontWeight: 'bold',
              cursor: previewLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {previewLoading ? <RefreshCw size={18} className="animate-spin" /> : <Eye size={18} />}
            {previewLoading ? '生成中...' : '3アカウント分 生成'}
          </button>
        </div>

        {previews.length === 0 ? (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: '#666',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px',
          }}>
            <Eye size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>「3アカウント分 生成」で投稿内容をプレビュー</p>
            <p style={{ fontSize: '13px', marginTop: '8px' }}>変な内容は再生成・編集してから投稿できます</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {previews.map((preview) => (
                <div
                  key={preview.account}
                  style={{
                    padding: '16px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${ACCOUNT_COLORS[preview.account] || '#888'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        background: ACCOUNT_COLORS[preview.account] + '44',
                        color: ACCOUNT_COLORS[preview.account],
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                      }}>
                        {ACCOUNT_LABELS[preview.account]}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        background: 'rgba(139, 92, 246, 0.2)',
                        color: '#a78bfa',
                        borderRadius: '4px',
                        fontSize: '11px',
                      }}>
                        {preview.target}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#3b82f6',
                        borderRadius: '4px',
                        fontSize: '11px',
                      }}>
                        {preview.benefit}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        background: preview.passed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: preview.passed ? '#22c55e' : '#ef4444',
                        borderRadius: '4px',
                        fontSize: '11px',
                      }}>
                        スコア: {preview.score}/10
                      </span>
                      <span style={{ color: '#666', fontSize: '12px' }}>
                        ({preview.text.length}文字)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setEditingAccount(preview.account);
                          setEditText(preview.text);
                        }}
                        disabled={regeneratingAccount === preview.account}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          borderRadius: '6px',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                        }}
                      >
                        <Edit3 size={14} />
                        編集
                      </button>
                      <button
                        onClick={() => regenerateForAccount(preview.account)}
                        disabled={regeneratingAccount === preview.account}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(245, 158, 11, 0.2)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          borderRadius: '6px',
                          color: '#f59e0b',
                          cursor: regeneratingAccount === preview.account ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {regeneratingAccount === preview.account ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                        再生成
                      </button>
                    </div>
                  </div>

                  {editingAccount === preview.account ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '120px',
                          padding: '12px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid #444',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                        <span style={{ color: '#888', fontSize: '12px', marginRight: 'auto' }}>
                          {editText.length}文字
                          {editText.length > 280 && <span style={{ color: '#ef4444' }}> (280文字超過)</span>}
                        </span>
                        <button
                          onClick={() => {
                            setEditingAccount(null);
                            setEditText('');
                          }}
                          style={{
                            padding: '6px 16px',
                            background: 'transparent',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            color: '#888',
                            cursor: 'pointer',
                          }}
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={() => confirmEdit(preview.account)}
                          style={{
                            padding: '6px 16px',
                            background: '#22c55e',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                          }}
                        >
                          確定
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.7',
                      fontSize: '14px',
                      padding: '12px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '8px',
                    }}>
                      {preview.text}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setPreviews([])}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  border: '1px solid #444',
                  borderRadius: '10px',
                  color: '#888',
                  cursor: 'pointer',
                }}
              >
                クリア
              </button>
              <button
                onClick={postFromPreviews}
                disabled={running || previews.some(p => !p.passed)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 32px',
                  background: running ? '#333' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: previews.some(p => !p.passed) ? 0.5 : 1,
                }}
              >
                {running ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                {running ? '投稿中...' : 'この内容で投稿する'}
              </button>
            </div>
            {previews.some(p => !p.passed) && (
              <p style={{ textAlign: 'center', color: '#f59e0b', fontSize: '13px', marginTop: '12px' }}>
                ⚠️ スコア7点未満の投稿があります。再生成してください。
              </p>
            )}
          </>
        )}
      </div>

      {/* アクションボタン */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <button
          onClick={() => runManually(false)}
          disabled={running}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '16px 32px',
            background: running ? '#333' : 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
          {running ? '実行中...' : '即時投稿（プレビューなし）'}
        </button>

        <button
          onClick={fetchData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '16px 24px',
            background: 'transparent',
            border: '1px solid #333',
            borderRadius: '12px',
            color: '#666',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* 実行結果 */}
      {lastResult && (
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          background: lastResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${lastResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            {lastResult.success ? (
              <CheckCircle size={24} color="#22c55e" />
            ) : (
              <XCircle size={24} color="#ef4444" />
            )}
            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>
              {lastResult.dryRun ? 'テスト結果' : lastResult.success ? '投稿成功' : '投稿失敗'}
            </span>
            {lastResult.processingTime && (
              <span style={{ color: '#888', fontSize: '14px' }}>
                ({lastResult.processingTime}ms)
              </span>
            )}
          </div>

          {/* 複数アカウントの結果 */}
          {lastResult.posts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {lastResult.posts.map((p: any, i: number) => (
                <div key={i} style={{
                  padding: '16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '12px',
                  borderLeft: `4px solid ${ACCOUNT_COLORS[p.account] || '#888'}`,
                }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: ACCOUNT_COLORS[p.account] + '33',
                      color: ACCOUNT_COLORS[p.account],
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}>
                      {p.accountName || ACCOUNT_LABELS[p.account]}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}>
                      {p.target}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#3b82f6',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}>
                      {p.benefit}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: (p.score?.passed ?? p.score >= 7) ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: (p.score?.passed ?? p.score >= 7) ? '#22c55e' : '#f59e0b',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}>
                      スコア: {p.score?.total ?? p.score}/10
                    </span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '14px' }}>
                    {p.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 単一アカウントの結果 */}
          {lastResult.post && !lastResult.posts && (
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
            }}>
              {lastResult.post.text || lastResult.post}
            </div>
          )}

          {lastResult.results && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              {lastResult.results.map((r: any, i: number) => (
                <span
                  key={i}
                  style={{
                    padding: '4px 12px',
                    background: r.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: r.success ? '#22c55e' : '#ef4444',
                    borderRadius: '20px',
                    fontSize: '14px',
                  }}
                >
                  {r.account || r.platform}: {r.success ? 'OK' : r.error?.substring(0, 30) || 'NG'}
                </span>
              ))}
            </div>
          )}

          {lastResult.error && (
            <div style={{ color: '#ef4444', marginTop: '8px' }}>
              Error: {lastResult.error}
            </div>
          )}
        </div>
      )}

      {/* スケジュール */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} />
          自動投稿スケジュール
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['07:00', '12:00', '18:00', '20:00', '22:00', '24:00'].map((time) => (
            <div
              key={time}
              style={{
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid #333',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{time}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>3アカウント</div>
            </div>
          ))}
        </div>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '12px' }}>
          GitHub Actionsで自動実行（1日18投稿）
        </p>
      </div>

      {/* ログ */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          投稿ログ
        </h2>

        {/* アカウントフィルター */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => setSelectedAccount(null)}
            style={{
              padding: '8px 16px',
              background: selectedAccount === null ? '#f59e0b' : 'transparent',
              border: '1px solid #444',
              borderRadius: '8px',
              color: selectedAccount === null ? 'white' : '#888',
              cursor: 'pointer',
            }}
          >
            全て
          </button>
          {Object.entries(ACCOUNT_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedAccount(key)}
              style={{
                padding: '8px 16px',
                background: selectedAccount === key ? ACCOUNT_COLORS[key] : 'transparent',
                border: `1px solid ${ACCOUNT_COLORS[key]}`,
                borderRadius: '8px',
                color: selectedAccount === key ? 'white' : ACCOUNT_COLORS[key],
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {logs.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#666',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '16px',
          }}>
            まだ投稿ログがありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs
              .filter(log => !selectedAccount || log.account === selectedAccount)
              .map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  borderLeft: `4px solid ${ACCOUNT_COLORS[log.account || ''] || '#888'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#888', fontSize: '13px' }}>
                      {new Date(log.timestamp).toLocaleString('ja-JP')}
                    </span>
                    {log.account && (
                      <span style={{
                        padding: '2px 8px',
                        background: ACCOUNT_COLORS[log.account] + '33',
                        color: ACCOUNT_COLORS[log.account],
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                      }}>
                        {ACCOUNT_LABELS[log.account]}
                      </span>
                    )}
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}>
                      {log.target}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#3b82f6',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}>
                      {log.benefit}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: log.score >= 7 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: log.score >= 7 ? '#22c55e' : '#f59e0b',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}>
                      スコア: {log.score}
                    </span>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  padding: '12px',
                  borderRadius: '8px',
                  whiteSpace: 'pre-wrap',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  marginBottom: '12px',
                }}>
                  {log.text}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {log.results.map((r, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 8px',
                        background: r.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: r.success ? '#22c55e' : '#ef4444',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {r.account || r.platform}: {r.success ? 'OK' : 'NG'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

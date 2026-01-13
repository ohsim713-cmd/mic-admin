'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Activity, Zap, Image, Video, FileText, Target, Brain,
  Play, Pause, Settings, RefreshCw, CheckCircle, Clock,
  TrendingUp, Sparkles, BarChart3, Layers
} from 'lucide-react';

// Types
interface PDCACycle {
  id: string;
  phase: 'plan' | 'do' | 'check' | 'act';
  target: string;
  status: 'running' | 'completed';
  startedAt: string;
}

interface MediaJob {
  id: string;
  type: 'image' | 'video' | 'thumbnail';
  target: string;
  status: 'queued' | 'generating' | 'processing' | 'completed';
  progress: number;
}

interface SystemStatus {
  dmHunter: { active: boolean; todayPosts: number; nextRun: string };
  contentGen: { active: boolean; generated: number; queued: number };
  instagram: { active: boolean; scheduled: number };
  wordpress: { active: boolean; articles: number };
  video: { active: boolean; processing: number };
}

const PHASE_COLORS = {
  plan: '#3b82f6',
  do: '#f59e0b',
  check: '#8b5cf6',
  act: '#22c55e',
};

const PHASE_LABELS = {
  plan: 'Plan',
  do: 'Do',
  check: 'Check',
  act: 'Act',
};

export default function AutoRunPage() {
  const [isRunning, setIsRunning] = useState(true);
  const [pdcaCycles, setPdcaCycles] = useState<PDCACycle[]>([]);
  const [mediaJobs, setMediaJobs] = useState<MediaJob[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    dmHunter: { active: true, todayPosts: 12, nextRun: '14:00' },
    contentGen: { active: true, generated: 45, queued: 3 },
    instagram: { active: true, scheduled: 8 },
    wordpress: { active: true, articles: 3 },
    video: { active: true, processing: 1 },
  });
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalPDCA: 0,
    totalMedia: 0,
    improvements: 0,
    uptime: '24h 32m',
  });

  const logRef = useRef<HTMLDivElement>(null);

  // シミュレーション: PDCAサイクル
  useEffect(() => {
    if (!isRunning) return;

    const runPDCA = () => {
      const targets = ['dm-hunter', 'content', 'instagram', 'wordpress', 'video'];
      const target = targets[Math.floor(Math.random() * targets.length)];
      const phases: PDCACycle['phase'][] = ['plan', 'do', 'check', 'act'];

      const cycle: PDCACycle = {
        id: `pdca-${Date.now()}`,
        phase: 'plan',
        target,
        status: 'running',
        startedAt: new Date().toISOString(),
      };

      setPdcaCycles(prev => [...prev.slice(-4), cycle]);
      addLog(`🔄 PDCA開始: ${target}`);

      let phaseIndex = 0;
      const phaseInterval = setInterval(() => {
        phaseIndex++;
        if (phaseIndex < phases.length) {
          cycle.phase = phases[phaseIndex];
          setPdcaCycles(prev => prev.map(c => c.id === cycle.id ? { ...c, phase: phases[phaseIndex] } : c));
          addLog(`  → ${PHASE_LABELS[phases[phaseIndex]]}フェーズ実行中`);
        } else {
          cycle.status = 'completed';
          setPdcaCycles(prev => prev.map(c => c.id === cycle.id ? { ...c, status: 'completed' } : c));
          setStats(prev => ({ ...prev, totalPDCA: prev.totalPDCA + 1, improvements: prev.improvements + 1 }));
          addLog(`✅ PDCA完了: ${target} - 改善適用済み`);
          clearInterval(phaseInterval);

          // 完了したサイクルを削除
          setTimeout(() => {
            setPdcaCycles(prev => prev.filter(c => c.id !== cycle.id));
          }, 3000);
        }
      }, 2000);
    };

    const interval = setInterval(runPDCA, 8000);
    runPDCA(); // 初回実行

    return () => clearInterval(interval);
  }, [isRunning]);

  // シミュレーション: メディア生成
  useEffect(() => {
    if (!isRunning) return;

    const generateMedia = () => {
      const types: MediaJob['type'][] = ['image', 'video', 'thumbnail'];
      const targets = ['instagram', 'wordpress', 'youtube', 'twitter'];

      const job: MediaJob = {
        id: `media-${Date.now()}`,
        type: types[Math.floor(Math.random() * types.length)],
        target: targets[Math.floor(Math.random() * targets.length)],
        status: 'generating',
        progress: 0,
      };

      setMediaJobs(prev => [...prev.slice(-5), job]);
      addLog(`🎨 ${job.type === 'video' ? '動画' : '画像'}生成開始: ${job.target}`);

      // 進捗更新
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          job.status = 'completed';
          setMediaJobs(prev => prev.map(j => j.id === job.id ? { ...j, progress: 100, status: 'completed' } : j));
          setStats(prev => ({ ...prev, totalMedia: prev.totalMedia + 1 }));
          addLog(`✅ ${job.type === 'video' ? '動画' : '画像'}完成: ${job.target}`);
          clearInterval(progressInterval);

          // 完了したジョブを削除
          setTimeout(() => {
            setMediaJobs(prev => prev.filter(j => j.id !== job.id));
          }, 2000);
        } else {
          setMediaJobs(prev => prev.map(j => j.id === job.id ? { ...j, progress } : j));
        }
      }, 500);
    };

    const interval = setInterval(generateMedia, 6000);
    generateMedia(); // 初回実行

    return () => clearInterval(interval);
  }, [isRunning]);

  // ログ自動スクロール
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [activityLog]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    setActivityLog(prev => [...prev.slice(-50), `[${timestamp}] ${message}`]);
  };

  return (
    <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes wave {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px currentColor; }
          50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
        }
        .pulse { animation: pulse 2s ease-in-out infinite; }
        .spin { animation: spin 1s linear infinite; }
        .wave-bg {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: wave 2s linear infinite;
        }
        .glow { animation: glow 2s ease-in-out infinite; }
      `}</style>

      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }} className={isRunning ? 'glow' : ''}>
              <Brain size={24} />
            </div>
            AI自動運用センター
            {isRunning && (
              <span style={{
                padding: '4px 12px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid #22c55e',
                borderRadius: '20px',
                fontSize: '12px',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#22c55e',
                }} className="pulse" />
                LIVE
              </span>
            )}
          </h1>
          <p style={{ color: '#888', marginTop: '4px', fontSize: '14px' }}>
            全システムが自動でPDCAを回し続けています
          </p>
        </div>

        <button
          onClick={() => setIsRunning(!isRunning)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: isRunning
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
          {isRunning ? '停止' : '開始'}
        </button>
      </div>

      {/* 統計カード */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {[
          { label: 'PDCAサイクル', value: stats.totalPDCA, icon: RefreshCw, color: '#8b5cf6' },
          { label: 'メディア生成', value: stats.totalMedia, icon: Image, color: '#ec4899' },
          { label: '改善適用', value: stats.improvements, icon: TrendingUp, color: '#22c55e' },
          { label: '稼働時間', value: stats.uptime, icon: Clock, color: '#f59e0b' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: '16px',
              background: `linear-gradient(135deg, ${stat.color}22, ${stat.color}11)`,
              border: `1px solid ${stat.color}44`,
              borderRadius: '12px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {isRunning && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)`,
                backgroundSize: '200% 100%',
              }} className="wave-bg" />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <stat.icon size={16} color={stat.color} className={isRunning ? 'pulse' : ''} />
              <span style={{ color: '#888', fontSize: '12px' }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* メインコンテンツ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        {/* PDCA サイクル表示 */}
        <div style={{
          padding: '20px',
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <RefreshCw size={18} color="#8b5cf6" className={isRunning ? 'spin' : ''} />
            PDCAサイクル
            <span style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              background: 'rgba(139, 92, 246, 0.3)',
              borderRadius: '10px',
              fontSize: '11px',
            }}>
              {pdcaCycles.filter(c => c.status === 'running').length} 実行中
            </span>
          </h2>

          {pdcaCycles.length === 0 ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: '#666',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '12px',
            }}>
              {isRunning ? 'サイクル開始を待機中...' : '停止中'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pdcaCycles.map(cycle => (
                <div
                  key={cycle.id}
                  style={{
                    padding: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    borderLeft: `3px solid ${PHASE_COLORS[cycle.phase]}`,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                      {cycle.target}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      background: cycle.status === 'completed'
                        ? 'rgba(34, 197, 94, 0.2)'
                        : `${PHASE_COLORS[cycle.phase]}33`,
                      color: cycle.status === 'completed' ? '#22c55e' : PHASE_COLORS[cycle.phase],
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}>
                      {cycle.status === 'completed' ? '完了' : PHASE_LABELS[cycle.phase]}
                    </span>
                  </div>

                  {/* PDCAインジケーター */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['plan', 'do', 'check', 'act'] as const).map((phase, i) => {
                      const isActive = cycle.phase === phase && cycle.status === 'running';
                      const isCompleted = ['plan', 'do', 'check', 'act'].indexOf(cycle.phase) > i ||
                        cycle.status === 'completed';

                      return (
                        <div
                          key={phase}
                          style={{
                            flex: 1,
                            height: '4px',
                            borderRadius: '2px',
                            background: isCompleted
                              ? PHASE_COLORS[phase]
                              : isActive
                                ? `linear-gradient(90deg, ${PHASE_COLORS[phase]}, transparent)`
                                : 'rgba(255,255,255,0.1)',
                            transition: 'all 0.3s',
                          }}
                          className={isActive ? 'wave-bg' : ''}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* メディア生成キュー */}
        <div style={{
          padding: '20px',
          background: 'rgba(236, 72, 153, 0.1)',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          borderRadius: '16px',
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Layers size={18} color="#ec4899" className={isRunning ? 'pulse' : ''} />
            メディア生成
            <span style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              background: 'rgba(236, 72, 153, 0.3)',
              borderRadius: '10px',
              fontSize: '11px',
            }}>
              {mediaJobs.filter(j => j.status !== 'completed').length} 処理中
            </span>
          </h2>

          {mediaJobs.length === 0 ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: '#666',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '12px',
            }}>
              {isRunning ? '次の生成を待機中...' : '停止中'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mediaJobs.map(job => (
                <div
                  key={job.id}
                  style={{
                    padding: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {job.type === 'video' ? (
                        <Video size={16} color="#ec4899" />
                      ) : (
                        <Image size={16} color="#ec4899" />
                      )}
                      <span style={{ fontSize: '13px' }}>
                        {job.type === 'video' ? '動画' : job.type === 'thumbnail' ? 'サムネイル' : '画像'}
                      </span>
                      <span style={{
                        padding: '2px 6px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#888',
                      }}>
                        {job.target}
                      </span>
                    </div>
                    {job.status === 'completed' ? (
                      <CheckCircle size={16} color="#22c55e" />
                    ) : (
                      <span style={{ fontSize: '12px', color: '#ec4899' }}>
                        {Math.round(job.progress)}%
                      </span>
                    )}
                  </div>

                  {/* 進捗バー */}
                  <div style={{
                    height: '4px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${job.progress}%`,
                        background: job.status === 'completed'
                          ? '#22c55e'
                          : 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                        borderRadius: '2px',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* システムステータス */}
        <div style={{
          padding: '20px',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '16px',
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Activity size={18} color="#22c55e" className={isRunning ? 'pulse' : ''} />
            システムステータス
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { key: 'dmHunter', label: 'DM Hunter', icon: Target, color: '#f59e0b', info: `${systemStatus.dmHunter.todayPosts}投稿` },
              { key: 'contentGen', label: 'コンテンツ生成', icon: FileText, color: '#3b82f6', info: `${systemStatus.contentGen.generated}生成` },
              { key: 'instagram', label: 'Instagram', icon: Image, color: '#ec4899', info: `${systemStatus.instagram.scheduled}予約` },
              { key: 'wordpress', label: 'WordPress', icon: FileText, color: '#8b5cf6', info: `${systemStatus.wordpress.articles}記事` },
              { key: 'video', label: '動画生成', icon: Video, color: '#22c55e', info: `${systemStatus.video.processing}処理中` },
            ].map(system => (
              <div
                key={system.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isRunning ? '#22c55e' : '#666',
                }} className={isRunning ? 'pulse' : ''} />
                <system.icon size={16} color={system.color} />
                <span style={{ flex: 1, fontSize: '13px' }}>{system.label}</span>
                <span style={{ fontSize: '12px', color: '#888' }}>{system.info}</span>
              </div>
            ))}
          </div>
        </div>

        {/* アクティビティログ */}
        <div style={{
          padding: '20px',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '16px',
          gridColumn: 'span 1',
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <BarChart3 size={18} color="#3b82f6" />
            アクティビティログ
            <Sparkles size={14} color="#f59e0b" className={isRunning ? 'pulse' : ''} style={{ marginLeft: 'auto' }} />
          </h2>

          <div
            ref={logRef}
            style={{
              height: '200px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              lineHeight: '1.8',
            }}
          >
            {activityLog.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                ログを待機中...
              </div>
            ) : (
              activityLog.map((log, i) => (
                <div key={i} style={{ color: log.includes('✅') ? '#22c55e' : log.includes('🔄') ? '#f59e0b' : '#888' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

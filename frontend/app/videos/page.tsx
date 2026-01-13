'use client';

import React, { useState, useEffect } from 'react';
import { Video, Play, Pause, Download, Eye, RefreshCw, Check, Clock, Zap, Film, Clapperboard } from 'lucide-react';

interface GeneratedVideo {
  id: string;
  title: string;
  prompt: string;
  thumbnailUrl: string;
  videoUrl: string;
  status: 'generating' | 'rendering' | 'ready' | 'published';
  progress: number;
  platform: 'youtube' | 'tiktok' | 'reels';
  duration: number;
  createdAt: string;
}

const platformConfig = {
  youtube: { label: 'YouTube', color: '#ff0000', icon: '📺' },
  tiktok: { label: 'TikTok', color: '#00f2ea', icon: '🎵' },
  reels: { label: 'Reels', color: '#e4405f', icon: '📱' },
};

export default function VideosPage() {
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, rendering: 0, published: 0 });

  // 自動生成シミュレーション
  useEffect(() => {
    if (!autoMode) return;

    const generateVideo = () => {
      const platforms: Array<'youtube' | 'tiktok' | 'reels'> = ['youtube', 'tiktok', 'reels'];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];

      const titles = [
        '【必見】在宅ワークで月収50万円達成した方法',
        '自由な働き方を実現！成功者の1日ルーティン',
        '副業初心者が3ヶ月で結果を出した秘訣',
        '高収入×自由時間を両立するコツ',
        '新時代の働き方 完全ガイド',
      ];

      const prompts = [
        'モダンなテキストアニメーションとダイナミックな背景',
        '成功をイメージさせるキラキラエフェクト',
        'プロフェッショナルなビジネス風映像',
        'ポジティブで明るい雰囲気の映像',
        'トレンド感のあるショート動画スタイル',
      ];

      const newVideo: GeneratedVideo = {
        id: `vid-${Date.now()}`,
        title: titles[Math.floor(Math.random() * titles.length)],
        prompt: prompts[Math.floor(Math.random() * prompts.length)],
        thumbnailUrl: '',
        videoUrl: '',
        status: 'generating',
        progress: 0,
        platform,
        duration: platform === 'youtube' ? 60 : 15 + Math.floor(Math.random() * 45),
        createdAt: new Date().toISOString(),
      };

      setVideos(prev => [newVideo, ...prev.slice(0, 7)]);
      setIsGenerating(true);
      setCurrentProgress(0);

      // 進捗シミュレーション
      const progressInterval = setInterval(() => {
        setCurrentProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + Math.random() * 15;
        });

        setVideos(prev =>
          prev.map(v =>
            v.id === newVideo.id
              ? {
                  ...v,
                  status: v.progress < 50 ? 'generating' : 'rendering',
                  progress: Math.min(v.progress + Math.random() * 15, 100),
                }
              : v
          )
        );
      }, 500);

      // 生成完了
      setTimeout(() => {
        clearInterval(progressInterval);
        const seed = Math.floor(Math.random() * 1000);
        setVideos(prev =>
          prev.map(v =>
            v.id === newVideo.id
              ? {
                  ...v,
                  thumbnailUrl: `https://picsum.photos/seed/${seed}/640/360`,
                  videoUrl: '/sample-video.mp4',
                  status: Math.random() > 0.5 ? 'ready' : 'published',
                  progress: 100,
                }
              : v
          )
        );
        setIsGenerating(false);
        setStats(prev => ({
          total: prev.total + 1,
          rendering: prev.rendering,
          published: prev.published + (Math.random() > 0.5 ? 1 : 0),
        }));
      }, 6000 + Math.random() * 4000);
    };

    // 初回生成
    generateVideo();

    // 定期生成
    const interval = setInterval(generateVideo, 30000 + Math.random() * 20000);
    return () => clearInterval(interval);
  }, [autoMode]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
            }}>
              <Video size={24} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: '1.75rem',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                動画
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'rgba(156, 163, 175, 0.8)' }}>
                AI が自動でショート動画を生成
              </p>
            </div>
          </div>
        </div>

        {/* 自動モードトグル */}
        <button
          onClick={() => setAutoMode(!autoMode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            borderRadius: '12px',
            border: 'none',
            background: autoMode
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))'
              : 'rgba(255, 255, 255, 0.05)',
            color: autoMode ? '#22c55e' : '#9ca3af',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}
        >
          {autoMode ? (
            <>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              自動生成 ON
            </>
          ) : (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b7280' }} />
              自動生成 OFF
            </>
          )}
        </button>
      </div>

      {/* 統計カード */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {[
          { label: '生成済み', value: stats.total, icon: Film, color: '#f59e0b' },
          { label: '公開済み', value: stats.published, icon: Check, color: '#22c55e' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: '1.25rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <stat.icon size={18} color={stat.color} />
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'white' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 生成中プログレス */}
      {isGenerating && (
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(236, 72, 153, 0.1))',
          borderRadius: '16px',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          marginBottom: '2rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Clapperboard size={20} color="white" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', color: 'white', marginBottom: '0.25rem' }}>
                動画を生成中...
              </div>
              <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>
                {currentProgress < 50 ? 'スクリプト生成中' : currentProgress < 80 ? '映像レンダリング中' : '最終処理中'}
              </div>
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#f59e0b',
            }}>
              {Math.min(Math.round(currentProgress), 100)}%
            </div>
          </div>

          {/* プログレスバー */}
          <div style={{
            height: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(currentProgress, 100)}%`,
              background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
              borderRadius: '4px',
              transition: 'width 0.3s',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 1.5s infinite',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* 動画リスト */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.5rem',
      }}>
        {videos.map((video) => {
          const config = platformConfig[video.platform];
          const isProcessing = video.status === 'generating' || video.status === 'rendering';

          return (
            <div
              key={video.id}
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.03)',
                border: isProcessing
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.3s',
              }}
            >
              {/* サムネイルエリア */}
              <div style={{
                aspectRatio: '16/9',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {isProcessing ? (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(236, 72, 153, 0.1))',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      border: '4px solid rgba(245, 158, 11, 0.2)',
                      borderTopColor: '#f59e0b',
                      animation: 'spin 1s linear infinite',
                    }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#f59e0b', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {video.status === 'generating' ? 'スクリプト生成中' : 'レンダリング中'}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                        {Math.round(video.progress)}%
                      </div>
                    </div>

                    {/* ミニプログレスバー */}
                    <div style={{
                      width: '80%',
                      height: '4px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${video.progress}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />

                    {/* 再生ボタンオーバーレイ */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}>
                      <Play size={24} color="white" style={{ marginLeft: '3px' }} />
                    </div>

                    {/* 時間表示 */}
                    <div style={{
                      position: 'absolute',
                      bottom: '0.5rem',
                      right: '0.5rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: 'rgba(0, 0, 0, 0.8)',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                    }}>
                      {formatDuration(video.duration)}
                    </div>
                  </>
                )}

                {/* プラットフォームバッジ */}
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  left: '0.75rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  background: config.color,
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  {config.icon} {config.label}
                </div>

                {/* ステータスバッジ */}
                {video.status === 'published' && (
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(34, 197, 94, 0.9)',
                    color: 'white',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}>
                    <Check size={12} />
                    公開済み
                  </div>
                )}
              </div>

              {/* 情報エリア */}
              <div style={{ padding: '1.25rem' }}>
                <h3 style={{
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '0.5rem',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {video.title}
                </h3>
                <p style={{
                  fontSize: '0.8rem',
                  color: 'rgba(156, 163, 175, 0.8)',
                  marginBottom: '1rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {video.prompt}
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {new Date(video.createdAt).toLocaleTimeString('ja-JP')}
                  </span>

                  {!isProcessing && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'transparent',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}>
                        <Eye size={12} />
                        プレビュー
                      </button>
                      <button style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontWeight: '500',
                      }}>
                        <Download size={12} />
                        保存
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {videos.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            padding: '4rem',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <Video size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>自動生成を開始しています...</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

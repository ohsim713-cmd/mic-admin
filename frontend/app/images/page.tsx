'use client';

import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Sparkles, Download, Eye, RefreshCw, Check, Grid, Zap } from 'lucide-react';

interface GeneratedImage {
  id: string;
  prompt: string;
  url: string;
  status: 'generating' | 'ready' | 'used';
  platform: 'instagram' | 'twitter' | 'blog';
  createdAt: string;
  style: string;
}

const styleOptions = [
  { id: 'modern', label: 'モダン', color: '#8b5cf6' },
  { id: 'minimal', label: 'ミニマル', color: '#3b82f6' },
  { id: 'vibrant', label: 'ビビッド', color: '#ec4899' },
  { id: 'elegant', label: 'エレガント', color: '#f59e0b' },
];

export default function ImagesPage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [stats, setStats] = useState({ total: 0, used: 0 });

  // 自動生成シミュレーション
  useEffect(() => {
    if (!autoMode) return;

    const generateImage = () => {
      const platforms: Array<'instagram' | 'twitter' | 'blog'> = ['instagram', 'twitter', 'blog'];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const style = styleOptions[Math.floor(Math.random() * styleOptions.length)];

      const prompts = [
        '自由な働き方をイメージした明るい風景',
        '成功と達成感を表現するアブストラクト',
        '新しいライフスタイルを象徴するモダンなビジュアル',
        '目標達成の喜びを表現する華やかなイメージ',
        'プロフェッショナルな印象のビジネスビジュアル',
      ];

      const newImage: GeneratedImage = {
        id: `img-${Date.now()}`,
        prompt: prompts[Math.floor(Math.random() * prompts.length)],
        url: '',
        status: 'generating',
        platform,
        createdAt: new Date().toISOString(),
        style: style.id,
      };

      setImages(prev => [newImage, ...prev.slice(0, 11)]);
      setIsGenerating(true);

      // 生成完了をシミュレート
      setTimeout(() => {
        const seed = Math.floor(Math.random() * 1000);
        setImages(prev =>
          prev.map(img =>
            img.id === newImage.id
              ? {
                  ...img,
                  url: `https://picsum.photos/seed/${seed}/400/400`,
                  status: Math.random() > 0.3 ? 'ready' : 'used',
                }
              : img
          )
        );
        setIsGenerating(false);
        setStats(prev => ({
          total: prev.total + 1,
          used: prev.used + (Math.random() > 0.7 ? 1 : 0),
        }));
      }, 3000 + Math.random() * 4000);
    };

    // 初回生成
    generateImage();

    // 定期生成
    const interval = setInterval(generateImage, 20000 + Math.random() * 15000);
    return () => clearInterval(interval);
  }, [autoMode]);

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
              background: 'linear-gradient(135deg, #10b981, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
            }}>
              <ImageIcon size={24} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: '1.75rem',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                画像
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'rgba(156, 163, 175, 0.8)' }}>
                AI が自動でSNS向け画像を生成
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

      {/* 統計バー */}
      <div style={{
        display: 'flex',
        gap: '2rem',
        padding: '1rem 1.5rem',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Grid size={18} color="#10b981" />
          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>生成済み:</span>
          <span style={{ color: 'white', fontWeight: '700', fontSize: '1.25rem' }}>{stats.total}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Check size={18} color="#3b82f6" />
          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>使用済み:</span>
          <span style={{ color: 'white', fontWeight: '700', fontSize: '1.25rem' }}>{stats.used}</span>
        </div>
        {isGenerating && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#a78bfa',
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: '2px solid rgba(139, 92, 246, 0.2)',
              borderTopColor: '#8b5cf6',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontSize: '0.85rem' }}>生成中...</span>
          </div>
        )}
      </div>

      {/* 画像グリッド */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.25rem',
      }}>
        {images.map((image) => {
          const styleConfig = styleOptions.find(s => s.id === image.style) || styleOptions[0];

          return (
            <div
              key={image.id}
              onClick={() => image.status !== 'generating' && setSelectedImage(image)}
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: image.status !== 'generating' ? 'pointer' : 'default',
                transition: 'all 0.3s',
              }}
            >
              {/* 画像エリア */}
              <div style={{
                aspectRatio: '1',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {image.status === 'generating' ? (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: '3px solid rgba(16, 185, 129, 0.2)',
                      borderTopColor: '#10b981',
                      animation: 'spin 1s linear infinite',
                    }} />
                    <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '500' }}>
                      画像を生成中...
                    </span>
                  </div>
                ) : (
                  <>
                    <img
                      src={image.url}
                      alt={image.prompt}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {/* オーバーレイ */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                    }}
                      className="image-overlay"
                    >
                      <div style={{
                        position: 'absolute',
                        bottom: '1rem',
                        left: '1rem',
                        right: '1rem',
                        display: 'flex',
                        gap: '0.5rem',
                      }}>
                        <button style={{
                          flex: 1,
                          padding: '0.5rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          fontSize: '0.8rem',
                        }}>
                          <Eye size={14} />
                          プレビュー
                        </button>
                        <button style={{
                          flex: 1,
                          padding: '0.5rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          fontSize: '0.8rem',
                        }}>
                          <Download size={14} />
                          保存
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ステータスバッジ */}
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  display: 'flex',
                  gap: '0.5rem',
                }}>
                  {image.status === 'used' && (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      background: 'rgba(34, 197, 94, 0.9)',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      <Check size={10} />
                      使用済み
                    </span>
                  )}
                </div>
              </div>

              {/* 情報エリア */}
              <div style={{ padding: '1rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}>
                  <span style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    background: `${styleConfig.color}20`,
                    color: styleConfig.color,
                    fontSize: '0.7rem',
                    fontWeight: '600',
                  }}>
                    {styleConfig.label}
                  </span>
                  <span style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#9ca3af',
                    fontSize: '0.7rem',
                  }}>
                    {image.platform}
                  </span>
                </div>
                <p style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {image.prompt}
                </p>
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.7rem',
                  color: '#6b7280',
                }}>
                  {new Date(image.createdAt).toLocaleTimeString('ja-JP')}
                </div>
              </div>
            </div>
          );
        })}

        {images.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            padding: '4rem',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <Sparkles size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>自動生成を開始しています...</p>
          </div>
        )}
      </div>

      {/* モーダル */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '600px',
              width: '100%',
              background: 'rgba(20, 20, 30, 0.95)',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.prompt}
              style={{ width: '100%', display: 'block' }}
            />
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'white', marginBottom: '1rem', lineHeight: '1.5' }}>
                {selectedImage.prompt}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}>
                  閉じる
                </button>
                <button style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}>
                  ダウンロード
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        div:hover .image-overlay {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

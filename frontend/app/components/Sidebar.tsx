'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Zap, FileText, Image, Video, Activity } from 'lucide-react';

// シンプル化 - ダッシュボード1つに統合
const menuItems = [
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    sublabel: '全体状況・投稿管理・分析',
    icon: Activity,
    href: '/automation',
    isMain: true,
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);

  // アニメーション用の位相更新
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* ハンバーガーボタン（モバイル用） */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mobile-menu-btn"
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 1001,
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.2)',
        }}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* オーバーレイ */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="sidebar-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
          }}
        />
      )}

      {/* サイドバー - 先進的デザイン */}
      <aside style={{
        width: '280px',
        height: '100vh',
        background: 'linear-gradient(180deg, rgba(15, 15, 25, 0.98) 0%, rgba(10, 10, 20, 0.99) 100%)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(139, 92, 246, 0.15)',
        padding: '1.5rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: isOpen ? 0 : '-280px',
        top: 0,
        zIndex: 1000,
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
        className="sidebar-desktop-open"
      >
        {/* ロゴエリア - 先進的 */}
        <div style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
          borderRadius: '16px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 動くグラデーション背景 */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(${pulsePhase * 3.6}deg, rgba(139, 92, 246, 0.1), transparent, rgba(236, 72, 153, 0.1))`,
            transition: 'background 0.1s linear',
          }} />

          <div style={{ position: 'relative', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}>
              <Activity
                size={24}
                style={{
                  color: '#8b5cf6',
                  filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))',
                }}
              />
              <h1 style={{
                fontSize: '1.4rem',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #a78bfa, #ec4899, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}>
                MIC AI
              </h1>
            </div>
            <p style={{
              fontSize: '0.7rem',
              color: 'rgba(167, 139, 250, 0.8)',
              fontWeight: '500',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Autonomous System
            </p>

            {/* ライブインジケーター */}
            <div style={{
              marginTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 10px rgba(34, 197, 94, 0.6)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <span style={{
                fontSize: '0.65rem',
                color: '#22c55e',
                fontWeight: '600',
                letterSpacing: '0.05em',
              }}>
                LIVE • 自動運用中
              </span>
            </div>
          </div>
        </div>

        {/* メニューアイテム - ミニマル&先進的 */}
        <nav style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const isMain = item.isMain;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: isMain ? '1rem 1.25rem' : '0.85rem 1.25rem',
                    borderRadius: '14px',
                    textDecoration: 'none',
                    background: isActive
                      ? `linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.15))`
                      : isMain
                        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.05))'
                        : 'rgba(255, 255, 255, 0.02)',
                    border: isActive
                      ? '1px solid rgba(139, 92, 246, 0.4)'
                      : isMain
                        ? '1px solid rgba(139, 92, 246, 0.2)'
                        : '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* アイコン背景 */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: isActive ? item.gradient : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s',
                    boxShadow: isActive ? `0 4px 15px rgba(139, 92, 246, 0.3)` : 'none',
                  }}>
                    <Icon
                      size={20}
                      color={isActive ? 'white' : '#9ca3af'}
                      style={{
                        filter: isActive ? 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.5))' : 'none',
                      }}
                    />
                  </div>

                  {/* テキスト */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.95rem',
                      fontWeight: isActive ? '700' : '500',
                      color: isActive ? 'white' : 'rgba(255, 255, 255, 0.85)',
                      marginBottom: '0.15rem',
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: isActive ? 'rgba(167, 139, 250, 0.9)' : 'rgba(156, 163, 175, 0.7)',
                      fontWeight: '400',
                    }}>
                      {item.sublabel}
                    </div>
                  </div>

                  {/* AUTO バッジ (メインアイテムのみ) */}
                  {isMain && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3))',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      borderRadius: '8px',
                      fontSize: '9px',
                      color: '#a78bfa',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#8b5cf6',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }} />
                      AUTO
                    </div>
                  )}

                  {/* アクティブ時のグロー効果 */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: `linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.1), transparent)`,
                      animation: 'shimmer 2s infinite',
                      pointerEvents: 'none',
                    }} />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ステータス表示 */}
        <div style={{
          padding: '1rem',
          background: 'rgba(34, 197, 94, 0.08)',
          borderRadius: '12px',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          marginTop: '1rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#22c55e',
            }}>
              システム稼働中
            </span>
          </div>
          <div style={{
            fontSize: '0.65rem',
            color: 'rgba(156, 163, 175, 0.8)',
            lineHeight: '1.5',
          }}>
            AI が自律的にコンテンツを生成・最適化しています
          </div>
        </div>

        {/* フッター */}
        <div style={{
          padding: '1rem 0 0',
          marginTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '0.65rem',
          color: 'rgba(156, 163, 175, 0.5)',
          textAlign: 'center',
        }}>
          Powered by AI Automation
        </div>

        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.95); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </aside>
    </>
  );
}

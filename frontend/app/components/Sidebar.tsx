'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, FileText, BarChart3, Settings, Menu, X, BookOpen, Video, Building2, Share2, MessageSquare, Cloud, Instagram, Music, Youtube, ChevronDown } from 'lucide-react';
import { useBusinessType } from '../context/BusinessTypeContext';

const contentMenuItems = [
  { id: 'approval', label: '文章生成', icon: Sparkles, href: '/approval' },
  { id: 'wordpress', label: 'SEO記事生成', icon: BookOpen, href: '/wordpress' },
  { id: 'instagram', label: '画像生成', icon: Instagram, href: '/instagram' },
  { id: 'short-video', label: 'ショート動画生成', icon: Video, href: '/short-video' },
];

const snsMenuItems = [
  { id: 'twitter', label: 'X (Twitter)', icon: Share2 },
  { id: 'threads', label: 'Threads', icon: MessageSquare },
  { id: 'bluesky', label: 'Bluesky', icon: Cloud },
  { id: 'tiktok', label: 'TikTok', icon: Music },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
];

const systemMenuItems = [
  { id: 'history', label: '生成履歴', icon: FileText, href: '/history' },
  { id: 'analytics', label: 'アナリティクス', icon: BarChart3, href: '/analytics' },
  { id: 'settings', label: '設定', icon: Settings, href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [snsExpanded, setSnsExpanded] = useState(false);
  const { businessType, setBusinessType, businessLabel } = useBusinessType();

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
          borderRadius: '12px',
          background: 'rgba(17, 24, 39, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* オーバーレイ（モバイル時、サイドバー開いている時のみ表示） */}
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
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 999,
            display: 'block',
          }}
        />
      )}

      {/* サイドバー */}
      <aside style={{
        width: '260px',
        height: '100vh',
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '2rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: isOpen ? 0 : '-260px',
        top: 0,
        zIndex: 1000,
        transition: 'left 0.3s ease',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
        className="sidebar-desktop-open"
      >
        {/* Logo */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'center', marginTop: '0.5rem' }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            background: 'var(--gradient-main)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.25rem'
          }}>
            MIC Admin
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            AI SNS自動投稿
          </p>
        </div>

        {/* ビジネスタイプ選択 */}
        <div style={{
          marginBottom: '2rem',
          padding: '0.75rem',
          background: 'rgba(139, 92, 246, 0.08)',
          borderRadius: '12px',
          border: '1px solid rgba(139, 92, 246, 0.2)'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: '#a78bfa',
            marginBottom: '0.75rem',
            fontWeight: '600'
          }}>
            <Building2 size={16} />
            ビジネスタイプ
          </label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value as 'chat-lady' | 'liver-agency' | 'nail-salon')}
            style={{
              width: '100%',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              background: 'rgba(31, 41, 55, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="chat-lady" style={{ background: '#1f2937', color: 'white' }}>配信事務所</option>
            <option value="liver-agency" style={{ background: '#1f2937', color: 'white' }}>ライバー事務所</option>
            <option value="nail-salon" style={{ background: '#1f2937', color: 'white' }}>サロン</option>
          </select>
          <p style={{
            fontSize: '0.75rem',
            color: '#c4b5fd',
            marginTop: '0.75rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <span style={{ color: '#22c55e' }}>●</span> 選択中: {businessLabel}
          </p>
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '1rem' }}>
          {/* コンテンツ生成 */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0 0.85rem',
              marginBottom: '0.5rem'
            }}>
              コンテンツ生成
            </p>
            {contentMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '0.25rem',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    color: isActive ? 'white' : 'var(--text-muted)',
                    background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon size={18} color={isActive ? '#8b5cf6' : '#9ca3af'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: isActive ? '600' : '400' }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* システム */}
          <div style={{
            marginTop: '0.25rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0 0.85rem',
              marginBottom: '0.5rem'
            }}>
              システム
            </p>
            {systemMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '0.25rem',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    color: isActive ? 'white' : 'var(--text-muted)',
                    background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon size={18} color={isActive ? '#8b5cf6' : '#9ca3af'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: isActive ? '600' : '400' }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* SNS連携 */}
          <div style={{ marginTop: '0.75rem' }}>
            <button
              onClick={() => setSnsExpanded(!snsExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '0.5rem 0.85rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '8px',
              }}
            >
              <span style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                SNS連携
              </span>
              <ChevronDown
                size={14}
                color="#9ca3af"
                style={{
                  transform: snsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              />
            </button>
            {snsExpanded && (
              <div style={{
                padding: '0.5rem 0.85rem',
                marginTop: '0.25rem'
              }}>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  marginBottom: '0.75rem'
                }}>
                  {snsMenuItems.slice(0, 3).map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === 'bluesky';
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.3rem 0.5rem',
                          borderRadius: '5px',
                          background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'rgba(107, 114, 128, 0.1)',
                          border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : 'none',
                          opacity: isActive ? 1 : 0.5,
                        }}
                      >
                        <Icon size={12} color={isActive ? '#8b5cf6' : '#6b7280'} />
                        <span style={{ fontSize: '0.7rem', color: isActive ? '#a78bfa' : '#6b7280' }}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Link
                  href="/settings"
                  style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    color: '#8b5cf6',
                    textDecoration: 'none',
                    padding: '0.25rem 0',
                  }}
                >
                  API設定はこちら →
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div style={{
          padding: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          © 2024 MIC Admin
        </div>
      </aside>
    </>
  );
}

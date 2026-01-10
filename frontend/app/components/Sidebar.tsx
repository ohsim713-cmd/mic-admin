'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, FileText, BarChart3, Settings, Book, Menu, X, Zap, Clock, BookOpen, Video, Building2, Share2, MessageSquare, Cloud, Instagram, Music, Youtube } from 'lucide-react';
import { useBusinessType } from '../context/BusinessTypeContext';

const contentMenuItems = [
  { id: 'generate', label: '投稿生成', icon: Sparkles, href: '/' },
  { id: 'advanced', label: '高度な生成', icon: Zap, href: '/advanced' },
  { id: 'instagram', label: 'Instagram投稿', icon: Instagram, href: '/instagram' },
  { id: 'wordpress', label: 'WordPress記事', icon: BookOpen, href: '/wordpress' },
  { id: 'short-video', label: 'ショート動画', icon: Video, href: '/short-video' },
];

const snsMenuItems = [
  { id: 'twitter', label: 'X (Twitter)', icon: Share2, href: '/sns/twitter', badge: '準備中' },
  { id: 'threads', label: 'Threads', icon: MessageSquare, href: '/sns/threads', badge: '準備中' },
  { id: 'bluesky', label: 'Bluesky', icon: Cloud, href: '/sns/bluesky', badge: '準備中' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, href: '/sns/instagram', badge: '準備中' },
  { id: 'tiktok', label: 'TikTok', icon: Music, href: '/sns/tiktok', badge: '準備中' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, href: '/sns/youtube', badge: '準備中' },
];

const systemMenuItems = [
  { id: 'scheduler', label: '自動投稿', icon: Clock, href: '/scheduler' },
  { id: 'history', label: '生成履歴', icon: FileText, href: '/history' },
  { id: 'analytics', label: 'アナリティクス', icon: BarChart3, href: '/analytics' },
  { id: 'knowledge', label: 'ナレッジ編集', icon: Book, href: '/knowledge' },
  { id: 'settings', label: '設定', icon: Settings, href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
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
            left: '260px',
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
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
        <div style={{ marginBottom: '2rem', textAlign: 'center', marginTop: '3rem' }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            background: 'var(--gradient-main)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.25rem'
          }}>
            Mignon Admin
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            投稿管理システム
          </p>
        </div>

        {/* ビジネスタイプ選択 */}
        <div style={{
          marginBottom: '2rem',
          padding: '0 0.5rem'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem'
          }}>
            <Building2 size={14} />
            ビジネスタイプ
          </label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value as 'chat-lady' | 'liver-agency' | 'nail-salon')}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontSize: '0.9rem',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="chat-lady" style={{ background: '#1f2937', color: 'white' }}>チャットレディ事務所</option>
            <option value="liver-agency" style={{ background: '#1f2937', color: 'white' }}>ライバー事務所</option>
            <option value="nail-salon" style={{ background: '#1f2937', color: 'white' }}>ネイルサロン</option>
          </select>
          <p style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            marginTop: '0.5rem',
            fontWeight: '500'
          }}>
            選択中: {businessLabel}
          </p>
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '1rem' }}>
          {/* コンテンツ生成 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 1rem',
              marginBottom: '0.75rem'
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
                    gap: '1rem',
                    padding: '0.875rem 1rem',
                    marginBottom: '0.5rem',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: isActive ? 'white' : 'var(--text-muted)',
                    background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon size={20} color={isActive ? '#8b5cf6' : '#9ca3af'} />
                  <span style={{ fontSize: '0.95rem', fontWeight: isActive ? '600' : '400' }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* SNS投稿 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 1rem',
              marginBottom: '0.75rem'
            }}>
              SNS投稿
            </p>
            {snsMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.875rem 1rem',
                    marginBottom: '0.5rem',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: isActive ? 'white' : 'var(--text-muted)',
                    background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                    transition: 'all 0.2s',
                    opacity: 0.6,
                    cursor: 'not-allowed'
                  }}
                  onClick={(e) => e.preventDefault()}
                >
                  <Icon size={18} color={isActive ? '#8b5cf6' : '#9ca3af'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: isActive ? '600' : '400', flex: 1 }}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa'
                    }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* システム */}
          <div>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 1rem',
              marginBottom: '0.75rem'
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
                    gap: '1rem',
                    padding: '0.875rem 1rem',
                    marginBottom: '0.5rem',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: isActive ? 'white' : 'var(--text-muted)',
                    background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon size={20} color={isActive ? '#8b5cf6' : '#9ca3af'} />
                  <span style={{ fontSize: '0.95rem', fontWeight: isActive ? '600' : '400' }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
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
          © 2024 Mignon Group
        </div>
      </aside>
    </>
  );
}

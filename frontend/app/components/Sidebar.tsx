'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare, Network, Settings, Sparkles
} from 'lucide-react';

const menuItems = [
  {
    id: 'chat',
    label: 'チャット',
    sublabel: 'AIアシスタント',
    icon: MessageSquare,
    href: '/',
  },
  {
    id: 'agents',
    label: 'エージェント',
    sublabel: '稼働状況',
    icon: Network,
    href: '/dashboard',
  },
  {
    id: 'settings',
    label: '設定',
    sublabel: 'API連携',
    icon: Settings,
    href: '/settings',
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar - Desktop Only */}
      <aside
        style={{
          width: 'var(--sidebar-width)',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 40,
          display: 'none',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
        }}
        className="sidebar"
      >
        {/* Logo */}
        <div style={{
          padding: 'var(--space-5)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(235, 90, 60, 0.25)',
              }}
            >
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                MIC
              </h1>
              <p style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                margin: 0,
              }}>
                AI Automation Hub
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isActive ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    }}
                  >
                    <Icon
                      size={18}
                      color={isActive ? 'var(--accent)' : 'var(--text-secondary)'}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                      }}
                    >
                      {item.sublabel}
                    </div>
                  </div>
                  {isActive && (
                    <div
                      style={{
                        width: '4px',
                        height: '24px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--space-4)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)'
            }}>
              MIC v1.0
            </span>
          </div>
        </div>
      </aside>

      <style jsx>{`
        @media (min-width: 768px) {
          .sidebar {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Network, Settings } from 'lucide-react';

interface NavItem {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: MessageSquare, label: 'チャット', href: '/' },
  { icon: Network, label: 'エージェント', href: '/dashboard' },
  { icon: Settings, label: '設定', href: '/settings' },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* モバイルボトムナビゲーション */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 'var(--mobile-nav-height)',
          backgroundColor: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 var(--space-2)',
          zIndex: 100,
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
        }}
        className="mobile-nav"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
                minWidth: '56px',
              }}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 600 : 400,
                  marginTop: '2px',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* CSS for hiding on desktop */}
      <style jsx global>{`
        @media (min-width: 768px) {
          .mobile-nav {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}

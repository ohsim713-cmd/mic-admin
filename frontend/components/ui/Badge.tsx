'use client';

import { HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  children: ReactNode;
}

export default function Badge({
  variant = 'default',
  size = 'md',
  icon,
  children,
  style,
  ...props
}: BadgeProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-secondary)',
    },
    success: {
      backgroundColor: 'var(--success-bg)',
      color: 'var(--success)',
    },
    warning: {
      backgroundColor: 'var(--warning-bg)',
      color: 'var(--warning)',
    },
    error: {
      backgroundColor: 'var(--error-bg)',
      color: 'var(--error)',
    },
    info: {
      backgroundColor: 'var(--info-bg)',
      color: 'var(--info)',
    },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: '0.125rem var(--space-2)',
      fontSize: 'var(--text-xs)',
    },
    md: {
      padding: 'var(--space-1) var(--space-3)',
      fontSize: 'var(--text-sm)',
    },
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    borderRadius: 'var(--radius-full)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  };

  return (
    <span
      style={{
        ...baseStyles,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: 'success' | 'warning' | 'error' | 'default' }) {
  const colors: Record<string, string> = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    error: 'var(--error)',
    default: 'var(--text-tertiary)',
  };

  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: colors[status],
      }}
    />
  );
}

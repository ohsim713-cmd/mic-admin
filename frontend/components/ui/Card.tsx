'use client';

import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'default',
  padding = 'md',
  children,
  style,
  ...props
}, ref) => {
  const baseStyles: React.CSSProperties = {
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      boxShadow: 'var(--shadow-sm)',
    },
    elevated: {
      boxShadow: 'var(--shadow-md)',
    },
    bordered: {
      boxShadow: 'none',
    },
    interactive: {
      boxShadow: 'var(--shadow-sm)',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
  };

  const paddingStyles: Record<string, React.CSSProperties> = {
    none: {},
    sm: { padding: 'var(--space-3)' },
    md: { padding: 'var(--space-4)' },
    lg: { padding: 'var(--space-6)' },
  };

  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...paddingStyles[padding],
    ...style,
  };

  return (
    <div
      ref={ref}
      style={combinedStyles}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action, style, ...props }: CardHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-4)',
        ...style,
      }}
      {...props}
    >
      <div>
        <h3 style={{
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            margin: 0,
            marginTop: 'var(--space-1)',
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export default Card;

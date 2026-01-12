'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  text?: string;
  subText?: string;
}

export function LoadingSpinner({ size = 24, text, subText }: LoadingSpinnerProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      <div style={{
        width: size,
        height: size,
        border: '3px solid rgba(139, 92, 246, 0.2)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      {text && (
        <span style={{
          fontSize: '0.95rem',
          color: 'white',
          fontWeight: '500',
        }}>
          {text}
        </span>
      )}
      {subText && (
        <span style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}>
          {subText}
        </span>
      )}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

interface LoadingDotsProps {
  text?: string;
}

export function LoadingDots({ text = '生成中' }: LoadingDotsProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      {text}
      <span style={{ display: 'inline-flex', gap: '2px' }}>
        <span className="dot" style={{ animationDelay: '0s' }}>.</span>
        <span className="dot" style={{ animationDelay: '0.2s' }}>.</span>
        <span className="dot" style={{ animationDelay: '0.4s' }}>.</span>
      </span>
      <style jsx>{`
        .dot {
          animation: blink 1.2s infinite;
          opacity: 0;
        }
        @keyframes blink {
          0%, 20% { opacity: 0; }
          40%, 60% { opacity: 1; }
          80%, 100% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}

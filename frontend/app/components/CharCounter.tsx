'use client';

import React from 'react';

interface CharCounterProps {
  current: number;
  max?: number;
  warning?: number;
  showProgress?: boolean;
}

export function CharCounter({ current, max, warning, showProgress = false }: CharCounterProps) {
  const isOver = max && current > max;
  const isWarning = warning && current > warning && (!max || current <= max);

  const getColor = () => {
    if (isOver) return '#ef4444';
    if (isWarning) return '#f59e0b';
    return 'var(--text-muted)';
  };

  const percentage = max ? Math.min((current / max) * 100, 100) : 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginTop: '0.5rem'
    }}>
      {showProgress && max && (
        <div style={{
          flex: 1,
          height: '4px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: isOver ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--accent-primary)',
            borderRadius: '2px',
            transition: 'width 0.2s, background 0.2s',
          }} />
        </div>
      )}
      <span style={{
        fontSize: '0.8rem',
        color: getColor(),
        fontWeight: isOver ? '600' : '400',
        whiteSpace: 'nowrap',
      }}>
        {current.toLocaleString()}
        {max && ` / ${max.toLocaleString()}`}
        {isOver && ' (超過)'}
      </span>
    </div>
  );
}

'use client';

import React from 'react';

// パルスアニメーション付きのドット
interface PulsingDotProps {
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

export function PulsingDot({ color = 'green', size = 'md' }: PulsingDotProps) {
  const colors = {
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    blue: '#3b82f6',
    purple: '#8b5cf6',
  };

  const sizes = {
    sm: 6,
    md: 8,
    lg: 12,
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        className="pulse-ring"
        style={{
          position: 'absolute',
          width: sizes[size] * 2,
          height: sizes[size] * 2,
          top: -sizes[size] / 2,
          left: -sizes[size] / 2,
          backgroundColor: colors[color],
          borderRadius: '50%',
          opacity: 0.4,
        }}
      />
      <span
        style={{
          display: 'block',
          width: sizes[size],
          height: sizes[size],
          backgroundColor: colors[color],
          borderRadius: '50%',
          position: 'relative',
          zIndex: 1,
        }}
      />
      <style jsx>{`
        .pulse-ring {
          animation: pulse-ring 1.5s ease-out infinite;
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.5);
            opacity: 0;
          }
          100% {
            transform: scale(0.8);
            opacity: 0;
          }
        }
      `}</style>
    </span>
  );
}

// シマーエフェクト（ローディング中のスケルトン）
interface ShimmerProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export function Shimmer({ width = '100%', height = 20, borderRadius = 8 }: ShimmerProps) {
  return (
    <div
      className="shimmer"
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.05) 100%)',
        backgroundSize: '200% 100%',
      }}
    >
      <style jsx>{`
        .shimmer {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}

// 波形アニメーション（処理中を示す）
interface WaveBarProps {
  barCount?: number;
  color?: string;
  height?: number;
}

export function WaveBar({ barCount = 4, color = 'var(--accent-primary)', height = 20 }: WaveBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height }}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            width: 4,
            height: '40%',
            backgroundColor: color,
            borderRadius: 2,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style jsx>{`
        .wave-bar {
          animation: wave 1.2s ease-in-out infinite;
        }
        @keyframes wave {
          0%, 100% {
            height: 40%;
          }
          50% {
            height: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// 回転するリングアニメーション
interface SpinningRingProps {
  size?: number;
  thickness?: number;
  color?: string;
}

export function SpinningRing({ size = 24, thickness = 3, color = 'var(--accent-secondary)' }: SpinningRingProps) {
  return (
    <div
      className="spinning-ring"
      style={{
        width: size,
        height: size,
        border: `${thickness}px solid rgba(255,255,255,0.1)`,
        borderTopColor: color,
        borderRadius: '50%',
      }}
    >
      <style jsx>{`
        .spinning-ring {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

// アクティビティステータスバッジ
interface ActivityBadgeProps {
  status: 'idle' | 'working' | 'success' | 'error' | 'waiting';
  label?: string;
  showAnimation?: boolean;
}

export function ActivityBadge({ status, label, showAnimation = true }: ActivityBadgeProps) {
  const statusConfig = {
    idle: { color: '#64748b', text: '待機中', bgColor: 'rgba(100, 116, 139, 0.2)' },
    working: { color: '#3b82f6', text: '処理中', bgColor: 'rgba(59, 130, 246, 0.2)' },
    success: { color: '#22c55e', text: '完了', bgColor: 'rgba(34, 197, 94, 0.2)' },
    error: { color: '#ef4444', text: 'エラー', bgColor: 'rgba(239, 68, 68, 0.2)' },
    waiting: { color: '#eab308', text: '待機中', bgColor: 'rgba(234, 179, 8, 0.2)' },
  };

  const config = statusConfig[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 20,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}40`,
        fontSize: '0.75rem',
        fontWeight: 500,
      }}
    >
      {showAnimation && status === 'working' ? (
        <PulsingDot color="blue" size="sm" />
      ) : (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: config.color,
          }}
        />
      )}
      <span style={{ color: config.color }}>{label || config.text}</span>
    </span>
  );
}

// プログレスバー
interface ProgressBarProps {
  progress: number; // 0-100
  showPercent?: boolean;
  color?: string;
  height?: number;
  animated?: boolean;
}

export function ProgressBar({
  progress,
  showPercent = true,
  color = 'var(--accent-primary)',
  height = 8,
  animated = true
}: ProgressBarProps) {
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          width: '100%',
          height,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <div
          className={animated ? 'progress-bar-animated' : ''}
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            height: '100%',
            background: animated
              ? `linear-gradient(90deg, ${color}, var(--accent-secondary), ${color})`
              : color,
            backgroundSize: '200% 100%',
            borderRadius: height / 2,
            transition: 'width 0.3s ease-out',
          }}
        />
      </div>
      {showPercent && (
        <div style={{
          textAlign: 'right',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginTop: 4
        }}>
          {Math.round(progress)}%
        </div>
      )}
      <style jsx>{`
        .progress-bar-animated {
          animation: progress-shimmer 2s linear infinite;
        }
        @keyframes progress-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}

// カウントアップアニメーション付き数字
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}

export function AnimatedCounter({ value, duration = 1000, suffix = '', prefix = '' }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutExpo
      const easeProgress = 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startValue + (value - startValue) * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// タイムスタンプ（最終更新時刻）
interface LastUpdatedProps {
  timestamp: Date | null;
  isUpdating?: boolean;
}

export function LastUpdated({ timestamp, isUpdating = false }: LastUpdatedProps) {
  const [, forceUpdate] = React.useState({});

  React.useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 10000);
    return () => clearInterval(interval);
  }, []);

  const getRelativeTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 5) return 'たった今';
    if (seconds < 60) return `${seconds}秒前`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`;
    return `${Math.floor(seconds / 86400)}日前`;
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: '0.75rem',
      color: 'var(--text-muted)',
    }}>
      {isUpdating ? (
        <>
          <SpinningRing size={12} thickness={2} />
          <span>更新中...</span>
        </>
      ) : (
        <>
          <span style={{ opacity: 0.6 }}>最終更新:</span>
          <span>{timestamp ? getRelativeTime(timestamp) : '---'}</span>
        </>
      )}
    </span>
  );
}

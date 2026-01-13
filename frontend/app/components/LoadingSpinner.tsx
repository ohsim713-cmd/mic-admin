'use client';


interface LoadingSpinnerProps {
  size?: number;
  text?: string;
  subText?: string;
  variant?: 'default' | 'gradient' | 'pulse' | 'orbit';
}

export function LoadingSpinner({ size = 24, text, subText, variant = 'default' }: LoadingSpinnerProps) {
  const renderSpinner = () => {
    switch (variant) {
      case 'gradient':
        return (
          <div
            className="gradient-spinner"
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, transparent, var(--accent-primary), var(--accent-secondary), transparent)',
              padding: 3,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-color)',
              }}
            />
          </div>
        );

      case 'pulse':
        return (
          <div style={{ position: 'relative', width: size, height: size }}>
            <div
              className="pulse-outer"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                opacity: 0.3,
              }}
            />
            <div
              className="pulse-inner"
              style={{
                position: 'absolute',
                inset: size * 0.25,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
              }}
            />
          </div>
        );

      case 'orbit':
        return (
          <div style={{ position: 'relative', width: size, height: size }}>
            <div
              style={{
                position: 'absolute',
                inset: size * 0.35,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
              }}
            />
            <div
              className="orbit-ring"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: 'var(--accent-secondary)',
              }}
            />
            <div
              className="orbit-dot"
              style={{
                position: 'absolute',
                width: size * 0.2,
                height: size * 0.2,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-secondary)',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          </div>
        );

      default:
        return (
          <div
            className="default-spinner"
            style={{
              width: size,
              height: size,
              border: '3px solid rgba(139, 92, 246, 0.2)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
            }}
          />
        );
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      {renderSpinner()}
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
        .default-spinner {
          animation: spin 0.8s linear infinite;
        }
        .gradient-spinner {
          animation: spin 1s linear infinite;
        }
        .pulse-outer {
          animation: pulse-scale 1.5s ease-in-out infinite;
        }
        .pulse-inner {
          animation: pulse-inner-scale 1.5s ease-in-out infinite;
        }
        .orbit-ring {
          animation: spin 1.5s linear infinite;
        }
        .orbit-dot {
          animation: orbit 1.5s linear infinite;
          transform-origin: center calc(50% + ${size / 2}px);
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse-scale {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.1;
          }
        }
        @keyframes pulse-inner-scale {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(0.8);
          }
        }
        @keyframes orbit {
          from {
            transform: translateX(-50%) rotate(0deg) translateY(0);
          }
          to {
            transform: translateX(-50%) rotate(360deg) translateY(0);
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

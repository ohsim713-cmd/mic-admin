'use client';

import React from 'react';

// チャット用のタイピングインジケーター
interface TypingIndicatorProps {
  text?: string;
  showDots?: boolean;
}

export function TypingIndicator({ text = 'AIが考え中', showDots = true }: TypingIndicatorProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderTopLeftRadius: 4,
      }}
    >
      {showDots && (
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="typing-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-secondary)',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}
      <span
        style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        {text}
      </span>
      <style jsx>{`
        .typing-dot {
          animation: typing-bounce 1.4s ease-in-out infinite;
        }
        @keyframes typing-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// 生成中のストリーミングテキスト風インジケーター
interface StreamingTextProps {
  text: string;
  speed?: number;
}

export function StreamingText({ text, speed = 50 }: StreamingTextProps) {
  const [displayedText, setDisplayedText] = React.useState('');
  const [cursorVisible, setCursorVisible] = React.useState(true);

  React.useEffect(() => {
    let index = 0;
    setDisplayedText('');

    const textInterval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(textInterval);
      }
    }, speed);

    return () => clearInterval(textInterval);
  }, [text, speed]);

  React.useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <span>
      {displayedText}
      <span
        style={{
          opacity: cursorVisible ? 1 : 0,
          color: 'var(--accent-primary)',
          fontWeight: 'bold',
        }}
      >
        |
      </span>
    </span>
  );
}

// AIアシスタントがアクティブであることを示すアバター
interface AIAvatarProps {
  isActive?: boolean;
  size?: number;
}

export function AIAvatar({ isActive = false, size = 40 }: AIAvatarProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      {/* パルスリング */}
      {isActive && (
        <div
          className="ai-pulse-ring"
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid var(--accent-primary)',
          }}
        />
      )}

      {/* アバター本体 */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--gradient-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 波形アニメーション */}
        {isActive && (
          <div
            className="ai-wave"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
            }}
          />
        )}

        {/* AIアイコン */}
        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
          <path d="M7.5 13a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
          <path d="M16.5 13a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
        </svg>
      </div>

      <style jsx>{`
        .ai-pulse-ring {
          animation: ai-pulse 2s ease-in-out infinite;
        }
        @keyframes ai-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.5;
          }
        }
        .ai-wave {
          animation: ai-wave 1.5s ease-in-out infinite;
        }
        @keyframes ai-wave {
          0%, 100% {
            transform: scale(0.8);
            opacity: 0;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}

// チャットメッセージのローディングスケルトン
interface MessageSkeletonProps {
  lines?: number;
}

export function MessageSkeleton({ lines = 3 }: MessageSkeletonProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderTopLeftRadius: 4,
      }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{
            height: 12,
            borderRadius: 6,
            backgroundColor: 'rgba(255,255,255,0.1)',
            width: i === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
      <style jsx>{`
        .skeleton-line {
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.05) 100%
          );
          background-size: 200% 100%;
        }
        @keyframes skeleton-shimmer {
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

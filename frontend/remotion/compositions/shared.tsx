/**
 * 共通コンポーネント・アニメーション
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSansJP';

export const { fontFamily } = loadFont();

// アスペクト比タイプ
export type AspectRatio = 'vertical' | 'horizontal';

// アスペクト比に応じたサイズ計算
export function getAspectDimensions(aspect: AspectRatio) {
  return aspect === 'vertical'
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

// 共通カラーテーマ
export const ttLiverTheme = {
  primary: '#FF6B9D',
  secondary: '#FFE4EC',
  accent: '#FF4081',
  text: '#333333',
  white: '#FFFFFF',
  gradient: 'linear-gradient(135deg, #FF6B9D 0%, #FF4081 100%)',
};

// フェードインアニメーション
export function useFadeIn(startFrame: number, duration: number = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

// スライドインアニメーション
export function useSlideIn(
  startFrame: number,
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
  distance: number = 100
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  const sign = direction === 'right' || direction === 'down' ? -1 : 1;

  return `translate${axis}(${interpolate(progress, [0, 1], [distance * sign, 0])}px)`;
}

// 数字カウントアップアニメーション
export function useCountUp(
  startFrame: number,
  endFrame: number,
  targetValue: number,
  startValue: number = 0
) {
  const frame = useCurrentFrame();
  return Math.round(
    interpolate(frame, [startFrame, endFrame], [startValue, targetValue], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  );
}

// スケールポップアニメーション
export function useScalePop(startFrame: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
}

// パルスアニメーション
export function usePulse(frequency: number = 60) {
  const frame = useCurrentFrame();
  return 1 + Math.sin((frame / frequency) * Math.PI * 2) * 0.05;
}

// 背景グラデーション
export const GradientBackground: React.FC<{
  colors?: string[];
  animated?: boolean;
}> = ({ colors = [ttLiverTheme.secondary, ttLiverTheme.primary], animated = false }) => {
  const frame = useCurrentFrame();
  const angle = animated ? 135 + Math.sin(frame / 60) * 20 : 135;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(${angle}deg, ${colors.join(', ')})`,
      }}
    />
  );
};

// パーティクル装飾
export const Particles: React.FC<{
  count?: number;
  color?: string;
}> = ({ count = 20, color = ttLiverTheme.primary }) => {
  const frame = useCurrentFrame();

  const particles = Array.from({ length: count }, (_, i) => {
    const x = (i * 123) % 100;
    const y = ((i * 456) % 100 + frame * 0.2) % 120 - 10;
    const size = 4 + (i % 5) * 2;
    const opacity = 0.3 + (i % 4) * 0.1;

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          opacity,
        }}
      />
    );
  });

  return <>{particles}</>;
};

// 装飾円
export const DecorativeCircle: React.FC<{
  x: number;
  y: number;
  size: number;
  color?: string;
  delay?: number;
}> = ({ x, y, size, color = ttLiverTheme.primary, delay = 0 }) => {
  const scale = useScalePop(delay);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${color}`,
        opacity: 0.5,
        transform: `scale(${scale})`,
      }}
    />
  );
};

// テキストアニメーション（1文字ずつ）
export const AnimatedText: React.FC<{
  text: string;
  startFrame: number;
  fontSize: number;
  color?: string;
  delay?: number;
}> = ({ text, startFrame, fontSize, color = ttLiverTheme.text, delay = 2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <span>
      {text.split('').map((char, i) => {
        const charProgress = spring({
          frame: frame - startFrame - i * delay,
          fps,
          config: { damping: 12, stiffness: 100 },
        });

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontSize,
              color,
              fontWeight: 700,
              opacity: charProgress,
              transform: `translateY(${interpolate(charProgress, [0, 1], [20, 0])}px)`,
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
};

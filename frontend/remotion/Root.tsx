/**
 * Remotion ルートコンポーネント
 *
 * すべてのCompositionをここで登録
 */

import React from 'react';
import { Composition } from 'remotion';
import { ReelTemplate } from './ReelTemplate';

// デフォルトProps（プレビュー用）
const defaultReelProps = {
  topic: '事務所がやること',
  description: '配信者様と一緒に\nアカウントを育てていく',
  subDescription: '',
  backgroundColor: '#FFE4EC',
  accentColor: '#FF6B9D',
  textColor: '#333333',
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Instagram Reel / TikTok (1080x1920) */}
      <Composition
        id="ReelTemplate"
        component={ReelTemplate as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps}
      />

      {/* Instagram Post (1080x1080) */}
      <Composition
        id="SquareTemplate"
        component={ReelTemplate as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={defaultReelProps}
      />

      {/* Twitter/X Post (1200x675) */}
      <Composition
        id="TwitterTemplate"
        component={ReelTemplate as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={1}
        fps={30}
        width={1200}
        height={675}
        defaultProps={defaultReelProps}
      />
    </>
  );
};

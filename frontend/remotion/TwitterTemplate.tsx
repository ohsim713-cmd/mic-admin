/**
 * Twitter/X 用テンプレート（横長 1200x675）
 */

import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Img, delayRender, continueRender } from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSansJP';

const { fontFamily, waitUntilDone } = loadFont();

export interface TwitterTemplateProps {
  topic: string;
  description: string;
  subDescription?: string;
  backgroundColor?: string;
  accentColor?: string;
  textColor?: string;
  headerText?: string;
  backgroundImage?: string;
}

const defaultProps: Partial<TwitterTemplateProps> = {
  backgroundColor: '#FFE4EC',
  accentColor: '#FF6B9D',
  textColor: '#333333',
  headerText: 'HOW TO MAKE MONEY?',
};

export const TwitterTemplate: React.FC<TwitterTemplateProps> = (props) => {
  const {
    topic,
    description,
    subDescription,
    backgroundColor,
    accentColor,
    textColor,
    headerText,
    backgroundImage,
  } = { ...defaultProps, ...props };

  const [fontLoaded, setFontLoaded] = useState(false);
  const [handle] = useState(() => delayRender('Loading Japanese font'));

  useEffect(() => {
    waitUntilDone()
      .then(() => {
        setFontLoaded(true);
        continueRender(handle);
      })
      .catch((err) => {
        console.error('Font loading error:', err);
        // フォントが読み込めなくても続行
        setFontLoaded(true);
        continueRender(handle);
      });
  }, [handle]);

  if (!fontLoaded) {
    return null;
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        fontFamily,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景画像 */}
      {backgroundImage && (
        <Img
          src={backgroundImage}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.2,
          }}
        />
      )}

      {/* 装飾要素 - 左上 */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: 30,
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: `3px solid ${accentColor}`,
          opacity: 0.4,
        }}
      />

      {/* 装飾要素 - 右上 */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          right: 50,
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: `3px solid ${accentColor}`,
          opacity: 0.4,
        }}
      />

      {/* 装飾要素 - 右下 */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 80,
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: `3px solid ${accentColor}`,
          opacity: 0.3,
        }}
      />

      {/* 左上: バッジのみ */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 50,
        }}
      >
        {/* 今日のテーマ バッジ */}
        <div
          style={{
            backgroundColor: accentColor,
            color: 'white',
            padding: '10px 24px',
            borderRadius: 6,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          今日のテーマ
        </div>
      </div>

      {/* 中央: メインコンテンツ */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: '80%',
        }}
      >
        {/* トピック */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: textColor,
            marginBottom: 20,
            lineHeight: 1.3,
          }}
        >
          「{topic}」
        </div>

        {/* 説明 */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            color: textColor,
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
          }}
        >
          {description}
        </div>

        {/* サブ説明 */}
        {subDescription && (
          <div
            style={{
              fontSize: 18,
              color: textColor,
              marginTop: 16,
              opacity: 0.7,
            }}
          >
            {subDescription}
          </div>
        )}
      </div>

      {/* 下部: 装飾ライン */}
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: 60,
          right: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            height: 3,
            backgroundColor: accentColor,
            opacity: 0.5,
          }}
        />
        <div
          style={{
            height: 3,
            backgroundColor: accentColor,
            opacity: 0.5,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default TwitterTemplate;

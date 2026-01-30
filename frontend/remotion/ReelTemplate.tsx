/**
 * Reel/TikTok テンプレート
 *
 * Canvaテンプレートを再現したReactコンポーネント
 * データを渡すだけで画像を生成
 */

import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Img, staticFile, delayRender, continueRender } from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSansJP';

// 日本語フォントを読み込み
const { fontFamily, waitUntilDone } = loadFont();

export interface ReelTemplateProps {
  // メインコンテンツ
  topic: string;
  description: string;
  subDescription?: string;

  // スタイル設定
  backgroundColor?: string;
  accentColor?: string;
  textColor?: string;

  // 画像
  backgroundImage?: string;
  characterImage?: string;

  // ヘッダー
  headerText?: string;
  headerSubText?: string;
}

const defaultProps: Partial<ReelTemplateProps> = {
  backgroundColor: '#FFE4EC',
  accentColor: '#FF6B9D',
  textColor: '#333333',
  headerText: 'HOW TO MAKE MONEY?',
  headerSubText: "TODAY'S TOPIC",
};

export const ReelTemplate: React.FC<ReelTemplateProps> = (props) => {
  const {
    topic,
    description,
    subDescription,
    backgroundColor,
    accentColor,
    textColor,
    headerText,
    headerSubText,
    backgroundImage,
    characterImage,
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
            opacity: 0.3,
          }}
        />
      )}

      {/* 装飾要素 - 左上 */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          width: 120,
          height: 120,
          borderRadius: '50%',
          border: `3px solid ${accentColor}`,
          opacity: 0.5,
        }}
      />

      {/* 装飾要素 - 右上 */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 60,
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: `3px solid ${accentColor}`,
          opacity: 0.5,
        }}
      />

      {/* ヘッダー */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 60,
          color: textColor,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: 4,
        }}
      >
        {headerText}
      </div>

      {/* サブヘッダーバッジ */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            color: textColor,
            fontSize: 18,
            opacity: 0.7,
            marginBottom: 8,
          }}
        >
          {headerSubText}
        </div>
        <div
          style={{
            backgroundColor: accentColor,
            color: 'white',
            padding: '16px 48px',
            borderRadius: 8,
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          今日のテーマ
        </div>
      </div>

      {/* メインコンテンツ */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '85%',
          textAlign: 'center',
        }}
      >
        {/* トピック */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: textColor,
            marginBottom: 32,
            lineHeight: 1.3,
          }}
        >
          「{topic}」
        </div>

        {/* 説明 */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 500,
            color: textColor,
            lineHeight: 1.6,
          }}
        >
          {description}
        </div>

        {/* サブ説明 */}
        {subDescription && (
          <div
            style={{
              fontSize: 28,
              color: textColor,
              marginTop: 24,
              opacity: 0.8,
            }}
          >
            {subDescription}
          </div>
        )}
      </div>

      {/* キャラクター画像 */}
      {characterImage && (
        <Img
          src={characterImage}
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            height: '40%',
            objectFit: 'contain',
          }}
        />
      )}

      {/* 装飾ライン - 下部 */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          left: '10%',
          right: '10%',
          height: 4,
          backgroundColor: accentColor,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 190,
          left: '10%',
          right: '10%',
          height: 4,
          backgroundColor: accentColor,
          opacity: 0.6,
        }}
      />
    </AbsoluteFill>
  );
};

export default ReelTemplate;

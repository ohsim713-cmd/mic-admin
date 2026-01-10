'use client';

import React, { useState, useEffect } from 'react';
import { Send, Copy, Check, ShieldCheck, Clock, Target, MessageSquare, Star, AlertCircle, Heart } from 'lucide-react';
import { useBusinessType } from './context/BusinessTypeContext';

interface PostMeta {
  target: string;
  theme: string;
  confidence: number;
  concerns?: string[];
  desires?: string[];
}

export default function Home() {
  const { businessType } = useBusinessType();
  const [generatedPost, setGeneratedPost] = useState('');
  const [postMeta, setPostMeta] = useState<PostMeta | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(3);

  // ローカルストレージから設定を読み込み
  useEffect(() => {
    const saved = localStorage.getItem('postsPerDay');
    if (saved) setPostsPerDay(parseInt(saved));
  }, []);

  // 設定を保存
  const handlePostsPerDayChange = (value: number) => {
    setPostsPerDay(value);
    localStorage.setItem('postsPerDay', value.toString());
  };

  const generatePost = async () => {
    setIsGenerating(true);
    setGeneratedPost('');
    setPostMeta(null);
    let fullPost = '';

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessType,
          autoMode: true  // 自動モードフラグ
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullPost += chunk;

          // メタ情報のJSONを検出して分離
          const metaMatch = fullPost.match(/<!--META:(.*?)-->/);
          if (metaMatch) {
            try {
              const meta = JSON.parse(metaMatch[1]);
              setPostMeta(meta);
              // メタ部分を除いた本文のみ表示
              setGeneratedPost(fullPost.replace(/<!--META:.*?-->/, '').trim());
            } catch (e) {
              setGeneratedPost(fullPost);
            }
          } else {
            setGeneratedPost(fullPost);
          }
        }
      }

      // 生成完了後、履歴に保存
      const cleanPost = fullPost.replace(/<!--META:.*?-->/, '').trim();
      if (cleanPost) {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: postMeta?.target || '自動選択',
            postType: postMeta?.theme || '自動選択',
            keywords: '',
            generatedPost: cleanPost,
          }),
        });
      }
    } catch (error) {
      setGeneratedPost('エラーが発生しました。接続を確認してください。');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedPost) return;

    const legacyCopy = (text: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    };

    let success = legacyCopy(generatedPost);

    if (!success && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(generatedPost);
        success = true;
      } catch (err) {
        console.error("All copy methods failed", err);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert('コピーが制限されています。プレビューの文章を直接長押ししてコピーしてください。');
    }
  }

  // 自信度の星表示
  const renderConfidenceStars = (confidence: number) => {
    return (
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            fill={star <= confidence ? '#fbbf24' : 'transparent'}
            color={star <= confidence ? '#fbbf24' : '#4b5563'}
          />
        ))}
      </div>
    );
  };

  return (
    <main style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem' }} className="fade-in">
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          自動投稿生成
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>AIが自動でターゲットとテーマを選び、投稿文を生成します</p>
      </header>

      {/* Settings */}
      <section className="glass fade-in" style={{ padding: '1.5rem', marginBottom: '2rem', animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          {/* 1日の投稿回数設定 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              <Clock size={18} color="var(--accent-secondary)" />
              1日の自動投稿回数
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 5, 10].map(num => (
                <button
                  key={num}
                  onClick={() => handlePostsPerDayChange(num)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: postsPerDay === num ? 'var(--gradient-main)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: postsPerDay === num ? '600' : '400',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {num}回
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generatePost}
            disabled={isGenerating}
            style={{
              padding: '0.8rem 2rem',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--gradient-main)',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isGenerating ? 0.7 : 1,
              pointerEvents: isGenerating ? 'none' : 'auto',
              cursor: 'pointer'
            }}
          >
            {isGenerating ? '生成中...' : 'テスト生成'}
            {!isGenerating && <Send size={16} />}
          </button>
        </div>
      </section>

      {/* Preview - Full Width */}
      <section className="glass fade-in" style={{ padding: '2.5rem', animationDelay: '0.2s' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* メタ情報表示 */}
          {postMeta && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}>
              {/* 上段: ターゲット、テーマ、自信度 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <Target size={14} />
                    ターゲット
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{postMeta.target}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <MessageSquare size={14} />
                    主張・テーマ
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{postMeta.theme}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <Star size={14} />
                    自信度
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {renderConfidenceStars(postMeta.confidence)}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({postMeta.confidence}/5)</span>
                  </div>
                </div>
              </div>

              {/* 下段: 不安・悩み、欲求 */}
              {(postMeta.concerns?.length || postMeta.desires?.length) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(139, 92, 246, 0.2)'
                }}>
                  {postMeta.concerns && postMeta.concerns.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                        <AlertCircle size={12} />
                        解消すべき不安
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                        {postMeta.concerns.slice(0, 3).map((c, i) => (
                          <div key={i}>• {c}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {postMeta.desires && postMeta.desires.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                        <Heart size={12} />
                        刺さるポイント
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                        {postMeta.desires.slice(0, 3).map((d, i) => (
                          <div key={i}>• {d}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(45deg, #8b5cf6, #ec4899)' }}></div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>公式アカウント</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@mic_official</div>
            </div>
          </div>

          <div style={{
            whiteSpace: 'pre-wrap',
            fontSize: '1.05rem',
            lineHeight: '1.9',
            minHeight: '300px',
            color: generatedPost ? 'white' : 'var(--text-muted)',
            fontStyle: generatedPost ? 'normal' : 'italic',
            marginBottom: '2rem',
            padding: '1rem 0'
          }}>
            {generatedPost || 'ここに生成された投稿文が表示されます。\n\n「テスト生成」ボタンをクリックしてください。'}
          </div>

          {generatedPost && (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={copyToClipboard}
                style={{
                  padding: '0.85rem 2rem',
                  borderRadius: '12px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {copied ? <Check size={18} color="#4ade80" /> : <Copy size={18} />}
                {copied ? 'コピーしました' : '文章をコピー'}
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="glass fade-in" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', animationDelay: '0.3s' }}>
        <ShieldCheck size={20} color="#4ade80" />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          AIがSNSの規約やトレンドを考慮して、最適な文章を構成します
        </div>
      </div>
    </main>
  );
}

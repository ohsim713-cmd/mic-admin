'use client';

import { useState } from 'react';
import { Sparkles, Send, FileText, Copy, Check, BookOpen, Upload, CheckCircle2, XCircle, Image as ImageIcon } from 'lucide-react';
import { useBusinessType } from '../context/BusinessTypeContext';

export default function WordPressPage() {
  const { businessType } = useBusinessType();
  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [targetLength, setTargetLength] = useState('2000-3000');
  const [tone, setTone] = useState('親しみやすく、専門的');
  const [generatedArticle, setGeneratedArticle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [postMessage, setPostMessage] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailGenerating, setThumbnailGenerating] = useState(false);
  const [featuredImageId, setFeaturedImageId] = useState<number | null>(null);

  const lengthOptions = ['1000-1500', '2000-3000', '3000-5000', '5000+'];
  const toneOptions = ['親しみやすく、専門的', 'フォーマル', 'カジュアル', '説得力のある'];

  const generateThumbnail = async () => {
    if (!title.trim()) {
      setPostMessage('タイトルを入力してください');
      setPostStatus('error');
      return;
    }

    setThumbnailGenerating(true);
    setPostMessage('サムネイル画像を生成中...');
    setPostStatus('idle');

    try {
      const response = await fetch('/api/generate-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });

      const data = await response.json();

      if (data.success) {
        setThumbnailUrl(data.imageUrl);
        setPostMessage('サムネイル画像を生成しました');
        setPostStatus('success');
        setTimeout(() => {
          setPostStatus('idle');
          setPostMessage('');
        }, 3000);
      } else {
        setPostMessage(`エラー: ${data.error}`);
        setPostStatus('error');
      }
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      setPostMessage('サムネイル生成に失敗しました');
      setPostStatus('error');
    } finally {
      setThumbnailGenerating(false);
    }
  };

  const uploadThumbnailToWordPress = async () => {
    if (!thumbnailUrl) {
      setPostMessage('サムネイル画像を先に生成してください');
      setPostStatus('error');
      return;
    }

    setPostMessage('画像をWordPressにアップロード中...');
    setPostStatus('idle');

    try {
      const response = await fetch('/api/wordpress/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: thumbnailUrl,
          filename: `thumbnail-${Date.now()}.png`,
          title: `${title} - サムネイル`
        })
      });

      const data = await response.json();

      if (data.success) {
        setFeaturedImageId(data.media.id);
        setPostMessage(`画像をアップロードしました（ID: ${data.media.id}）`);
        setPostStatus('success');
        setTimeout(() => {
          setPostStatus('idle');
          setPostMessage('');
        }, 3000);
      } else {
        setPostMessage(`エラー: ${data.error}`);
        setPostStatus('error');
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      setPostMessage('画像のアップロードに失敗しました');
      setPostStatus('error');
    }
  };

  const generateArticle = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    setIsGenerating(true);
    setGeneratedArticle('');
    let fullArticle = '';

    try {
      const response = await fetch('/api/generate/wordpress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          keywords,
          targetLength,
          tone,
          businessType
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
          fullArticle += chunk;
          setGeneratedArticle(prev => prev + chunk);
        }
      }
    } catch (error) {
      setGeneratedArticle('エラーが発生しました。接続を確認してください。');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const postToWordPress = async (status: 'draft' | 'publish') => {
    if (!generatedArticle || !title) {
      alert('記事を生成してから投稿してください');
      return;
    }

    setIsPosting(true);
    setPostStatus('idle');
    setPostMessage('');

    try {
      const response = await fetch('/api/wordpress/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content: generatedArticle,
          status,
          featuredImageId
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPostStatus('success');
        setPostMessage(data.message || '投稿に成功しました');
        setTimeout(() => {
          setPostStatus('idle');
          setPostMessage('');
        }, 5000);
      } else {
        setPostStatus('error');
        setPostMessage(data.error || '投稿に失敗しました');
        setTimeout(() => {
          setPostStatus('idle');
          setPostMessage('');
        }, 5000);
      }
    } catch (error) {
      console.error('WordPress post error:', error);
      setPostStatus('error');
      setPostMessage('投稿中にエラーが発生しました');
      setTimeout(() => {
        setPostStatus('idle');
        setPostMessage('');
      }, 5000);
    } finally {
      setIsPosting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedArticle) return;

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

    let success = legacyCopy(generatedArticle);

    if (!success && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(generatedArticle);
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

  return (
    <main style={{ padding: '3rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem' }} className="fade-in">
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          WordPress記事生成
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>AIがSEOに強い、読みやすいWordPress記事を自動生成します</p>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '2rem'
      }}
      className="wordpress-grid">
        {/* Left Column - Controls */}
        <section className="glass fade-in" style={{ padding: '2rem', animationDelay: '0.1s', height: 'fit-content' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            <FileText size={20} color="var(--accent-secondary)" /> 記事設定
          </h2>

          {/* タイトル */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              記事タイトル *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: チャットレディで月収50万円稼ぐための完全ガイド"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '0.95rem'
              }}
            />
          </div>

          {/* キーワード */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              キーワード（カンマ区切り）
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="例: チャットレディ, 在宅, 高収入, 副業"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '0.95rem'
              }}
            />
          </div>

          {/* 目標文字数 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              目標文字数
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {lengthOptions.map(option => (
                <button
                  key={option}
                  onClick={() => setTargetLength(option)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '50px',
                    border: '1px solid var(--glass-border)',
                    background: targetLength === option ? 'var(--gradient-main)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {option}字
                </button>
              ))}
            </div>
          </div>

          {/* トーン */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              文章のトーン
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {toneOptions.map(option => (
                <button
                  key={option}
                  onClick={() => setTone(option)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: tone === option ? 'var(--gradient-main)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateArticle}
            disabled={isGenerating || !title.trim()}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '12px',
              border: 'none',
              background: (!title.trim() || isGenerating) ? 'rgba(139, 92, 246, 0.3)' : 'var(--gradient-main)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              opacity: (!title.trim() || isGenerating) ? 0.5 : 1,
              cursor: (!title.trim() || isGenerating) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {isGenerating ? '生成中...' : '記事を生成する'}
            {!isGenerating && <Send size={18} />}
          </button>

          {/* Thumbnail Generation Section */}
          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-muted)' }}>
              <ImageIcon size={18} color="var(--accent-secondary)" /> サムネイル画像
            </h3>

            <button
              onClick={generateThumbnail}
              disabled={thumbnailGenerating || !title.trim()}
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: (!title.trim() || thumbnailGenerating) ? 'rgba(255, 255, 255, 0.05)' : 'rgba(139, 92, 246, 0.2)',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: (!title.trim() || thumbnailGenerating) ? 0.5 : 1,
                cursor: (!title.trim() || thumbnailGenerating) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                marginBottom: '0.75rem'
              }}
            >
              {thumbnailGenerating ? '生成中...' : 'サムネイルを生成'}
              {!thumbnailGenerating && <ImageIcon size={16} />}
            </button>

            {thumbnailUrl && (
              <>
                <div style={{
                  marginBottom: '0.75rem',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <img
                    src={thumbnailUrl}
                    alt="Generated thumbnail"
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>

                <button
                  onClick={uploadThumbnailToWordPress}
                  disabled={!!featuredImageId}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    background: featuredImageId ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                    color: featuredImageId ? '#4ade80' : 'white',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: featuredImageId ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {featuredImageId ? (
                    <>
                      <CheckCircle2 size={16} />
                      アップロード済み
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      WordPressにアップロード
                    </>
                  )}
                </button>

                {featuredImageId && (
                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.5rem',
                    textAlign: 'center'
                  }}>
                    記事投稿時にこの画像がアイキャッチ画像として設定されます
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Right Column - Preview */}
        <section className="glass fade-in" style={{ padding: '2.5rem', animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <BookOpen size={20} color="var(--accent-secondary)" /> プレビュー
            </h2>
            {generatedArticle && (
              <button
                onClick={copyToClipboard}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {copied ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                {copied ? 'コピー完了' : 'コピー'}
              </button>
            )}
          </div>

          <div style={{
            whiteSpace: 'pre-wrap',
            fontSize: '1rem',
            lineHeight: '1.8',
            minHeight: '600px',
            maxHeight: '800px',
            overflowY: 'auto',
            color: generatedArticle ? 'white' : 'var(--text-muted)',
            fontStyle: generatedArticle ? 'normal' : 'italic',
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            {generatedArticle || 'ここに生成された記事が表示されます。\n\n左側のフォームに必要な情報を入力して「記事を生成する」ボタンをクリックしてください。\n\nAIが自動的に見出しを含む構造化された記事を作成します。'}
          </div>

          {generatedArticle && (
            <>
              {/* WordPress投稿ボタン */}
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => postToWordPress('draft')}
                  disabled={isPosting}
                  style={{
                    flex: 1,
                    padding: '0.85rem 1.5rem',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: isPosting ? 'not-allowed' : 'pointer',
                    opacity: isPosting ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <FileText size={18} />
                  下書きとして保存
                </button>
                <button
                  onClick={() => postToWordPress('publish')}
                  disabled={isPosting}
                  style={{
                    flex: 1,
                    padding: '0.85rem 1.5rem',
                    borderRadius: '10px',
                    background: 'var(--gradient-main)',
                    border: 'none',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: isPosting ? 'not-allowed' : 'pointer',
                    opacity: isPosting ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <Upload size={18} />
                  {isPosting ? '投稿中...' : 'WordPressに公開'}
                </button>
              </div>

              {/* 投稿ステータスメッセージ */}
              {postStatus !== 'idle' && postMessage && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  borderRadius: '8px',
                  background: postStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${postStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {postStatus === 'success' ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : (
                    <XCircle size={18} color="#ef4444" />
                  )}
                  <p style={{
                    fontSize: '0.9rem',
                    color: postStatus === 'success' ? '#10b981' : '#ef4444',
                    margin: 0
                  }}>
                    {postMessage}
                  </p>
                </div>
              )}

              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  <Sparkles size={14} style={{ display: 'inline', marginRight: '0.5rem' }} color="#8b5cf6" />
                  WordPressに直接投稿するか、コピーしてエディタで編集できます。設定ページでWordPress接続を確認してください。
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

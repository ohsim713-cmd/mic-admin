'use client';

import { useState } from 'react';
import { Camera, Sparkles, Upload, Image as ImageIcon, Copy, CheckCircle } from 'lucide-react';
import { useBusinessType } from '../context/BusinessTypeContext';

export default function InstagramPage() {
  const { businessType, businessLabel } = useBusinessType();

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [designDescription, setDesignDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCaption = async () => {
    if (!designDescription) {
      alert('デザインの説明を入力してください');
      return;
    }

    setIsGenerating(true);
    setGeneratedCaption('');

    try {
      const response = await fetch('/api/instagram/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designDescription,
          targetAudience,
          additionalInfo,
          businessType
        })
      });

      const data = await response.json();

      if (response.ok && data.caption) {
        setGeneratedCaption(data.caption);
      } else {
        alert('キャプション生成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to generate caption:', error);
      alert('キャプション生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImage = async () => {
    if (!designDescription) {
      alert('デザインの説明を入力してください');
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImageUrl('');

    try {
      const response = await fetch('/api/instagram/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designDescription,
          referenceImage: selectedImage ? imagePreview : null
        })
      });

      const data = await response.json();

      if (response.ok && data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        setImagePreview(data.imageUrl);
      } else {
        alert('画像生成に失敗しました: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      alert('画像生成に失敗しました');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCaption);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <main style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{
          fontSize: '2.5rem',
          marginBottom: '0.5rem',
          background: 'var(--gradient-main)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <Camera size={40} />
          Instagram投稿生成
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          {businessLabel} - ネイルデザインの写真とキャプションを自動生成
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        {/* 画像アップロードとフォーム */}
        <section className="glass" style={{ padding: '2rem' }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <ImageIcon size={24} color="var(--accent-secondary)" />
            画像とデザイン情報
          </h2>

          {/* 画像アップロード */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.75rem',
              fontSize: '0.95rem',
              fontWeight: '500',
              color: 'var(--text-muted)'
            }}>
              ネイル写真をアップロード
            </label>

            <div style={{
              border: '2px dashed rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              padding: '2rem',
              textAlign: 'center',
              background: 'rgba(139, 92, 246, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
              }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="image-upload"
              />
              <label htmlFor="image-upload" style={{ cursor: 'pointer', display: 'block' }}>
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '8px',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <>
                    <Upload size={48} color="var(--accent-secondary)" style={{ margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--text-muted)' }}>クリックして画像を選択</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      JPG, PNG, HEIC対応
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* デザイン説明 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '500',
              color: 'var(--text-muted)'
            }}>
              デザインの説明 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={designDescription}
              onChange={(e) => setDesignDescription(e.target.value)}
              placeholder="例: グラデーションネイル、ピンク系、キラキラのストーン使用、春らしいデザイン"
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '0.95rem',
                resize: 'vertical'
              }}
            />
          </div>

          {/* ターゲット層 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '500',
              color: 'var(--text-muted)'
            }}>
              ターゲット層（任意）
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="例: 20代女性、OL、結婚式参加予定の方"
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

          {/* 追加情報 */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '500',
              color: 'var(--text-muted)'
            }}>
              追加情報（任意）
            </label>
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="例: キャンペーン情報、価格、所要時間など"
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '0.95rem',
                resize: 'vertical'
              }}
            />
          </div>

          {/* 生成ボタン */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={generateImage}
              disabled={isGeneratingImage || !designDescription}
              style={{
                flex: 1,
                padding: '1rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: 'white',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isGeneratingImage || !designDescription ? 'not-allowed' : 'pointer',
                opacity: isGeneratingImage || !designDescription ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isGeneratingImage && designDescription) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <ImageIcon size={20} />
              {isGeneratingImage ? 'AI画像生成中...' : 'AI画像生成'}
            </button>

            <button
              onClick={generateCaption}
              disabled={isGenerating || !designDescription}
              style={{
                flex: 1,
                padding: '1rem',
                borderRadius: '8px',
                background: 'var(--gradient-main)',
                border: 'none',
                color: 'white',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isGenerating || !designDescription ? 'not-allowed' : 'pointer',
                opacity: isGenerating || !designDescription ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isGenerating && designDescription) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Sparkles size={20} />
              {isGenerating ? 'キャプション生成中...' : 'キャプションを生成'}
            </button>
          </div>
        </section>

        {/* 生成されたキャプション */}
        <section className="glass" style={{ padding: '2rem' }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <Sparkles size={24} color="var(--accent-secondary)" />
            生成されたキャプション
          </h2>

          {generatedCaption ? (
            <div>
              <div style={{
                padding: '1.5rem',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                marginBottom: '1rem',
                minHeight: '300px',
                whiteSpace: 'pre-wrap',
                fontSize: '0.95rem',
                lineHeight: '1.7'
              }}>
                {generatedCaption}
              </div>

              <button
                onClick={copyToClipboard}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  background: isCopied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                  border: isCopied ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: isCopied ? '#10b981' : 'white',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                {isCopied ? (
                  <>
                    <CheckCircle size={18} />
                    コピーしました
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    クリップボードにコピー
                  </>
                )}
              </button>

              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: 'var(--text-muted)'
              }}>
                <strong style={{ color: 'white' }}>次のステップ:</strong>
                <ol style={{ paddingLeft: '1.2rem', marginTop: '0.5rem', lineHeight: '1.6' }}>
                  <li>キャプションをコピー</li>
                  <li>Instagramアプリを開く</li>
                  <li>アップロードした画像を選択</li>
                  <li>キャプションを貼り付け</li>
                  <li>ハッシュタグを追加して投稿</li>
                </ol>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <Camera size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>デザイン情報を入力して</p>
              <p>キャプションを生成してください</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

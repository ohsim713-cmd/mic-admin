'use client';

import { useState } from 'react';
import { Sparkles, User, Copy, Check, RefreshCw, Lightbulb, TrendingUp, FileText } from 'lucide-react';
import { useBusinessType } from '../context/BusinessTypeContext';

type GeneratedVariant = {
  id: number;
  text: string;
};

export default function AdvancedPage() {
  const { businessType, businessLabel } = useBusinessType();
  const [target, setTarget] = useState('チャトレ未経験');
  const [postType, setPostType] = useState('実績・収入投稿');
  const [keywords, setKeywords] = useState('');
  const [referencePost, setReferencePost] = useState('');

  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [feedback, setFeedback] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ビジネスタイプ別のターゲット選択肢
  const targets = businessType === 'liver-agency'
    ? ['配信未経験', '配信経験者', '夜職経験者']
    : ['チャトレ未経験', 'チャトレ経験者', '夜職経験者'];

  const postTypes = ['実績・収入投稿', 'ノウハウ投稿', '事務所の強み投稿'];

  const generateVariants = async (count: number = 3) => {
    setIsGenerating(true);
    setVariants([]);
    setFeedback('');

    try {
      const newVariants: GeneratedVariant[] = [];

      for (let i = 0; i < count; i++) {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target,
            postType,
            keywords,
            referencePost: referencePost || undefined,
            businessType,
          }),
        });

        if (!response.ok) throw new Error('Generation failed');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullPost = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullPost += decoder.decode(value, { stream: true });
          }
        }

        newVariants.push({ id: i + 1, text: fullPost });
      }

      setVariants(newVariants);
      setSelectedVariant(0);

      // 履歴に保存
      if (newVariants.length > 0) {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target,
            postType,
            keywords,
            generatedPost: newVariants[0].text,
          }),
        });
      }
    } catch (error) {
      console.error(error);
      alert('生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const analyzePost = async () => {
    const currentPost = variants[selectedVariant]?.text;
    if (!currentPost) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: currentPost }),
      });

      const data = await response.json();
      setFeedback(data.feedback || 'フィードバックの取得に失敗しました');
    } catch (error) {
      console.error(error);
      setFeedback('分析に失敗しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main style={{ padding: '3rem', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
          background: 'var(--gradient-main)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          高度な投稿生成
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          複数案生成、AIフィードバック、参考投稿学習機能を搭載
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
        {/* Left: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="glass" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={20} color="var(--accent-secondary)" /> ターゲット層
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {targets.map(t => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '50px',
                    border: '1px solid var(--glass-border)',
                    background: target === t ? 'var(--gradient-main)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: '0.85rem'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          <section className="glass" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="var(--accent-secondary)" /> 投稿の種類
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {postTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setPostType(type)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '50px',
                    border: '1px solid var(--glass-border)',
                    background: postType === type ? 'var(--gradient-main)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: '0.85rem'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>

          <section className="glass" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} color="var(--accent-secondary)" /> キーワード
            </h2>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="例: 日払い、在宅、身バレ防止"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '0.85rem'
              }}
            />
          </section>

          <section className="glass" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={20} color="#10b981" /> 参考投稿（任意）
            </h2>
            <textarea
              value={referencePost}
              onChange={(e) => setReferencePost(e.target.value)}
              placeholder="伸びた投稿や参考にしたい投稿を貼り付けると、その型を学習して生成します"
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '0.9rem',
                resize: 'vertical'
              }}
            />
          </section>

          <button
            onClick={() => generateVariants(3)}
            disabled={isGenerating}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--gradient-main)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              opacity: isGenerating ? 0.7 : 1,
              pointerEvents: isGenerating ? 'none' : 'auto'
            }}
          >
            {isGenerating ? '生成中...' : '3パターン生成'}
            {!isGenerating && <RefreshCw size={18} />}
          </button>
        </div>

        {/* Right: Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Variant Tabs */}
          {variants.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {variants.map((variant, index) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(index)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: selectedVariant === index ? '2px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: selectedVariant === index ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: selectedVariant === index ? 'bold' : 'normal'
                  }}
                >
                  パターン {variant.id}
                </button>
              ))}
            </div>
          )}

          {/* Preview */}
          <section className="glass" style={{ padding: '2rem', flex: 1 }}>
            {variants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>生成ボタンを押すと、3パターンの投稿文が表示されます</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(45deg, #444, #666)' }}></div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>事務所公式</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>@office_official</div>
                  </div>
                </div>

                <div style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.95rem',
                  lineHeight: '1.7',
                  minHeight: '200px',
                  color: 'white',
                  marginBottom: '1.5rem'
                }}>
                  {variants[selectedVariant]?.text}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => copyToClipboard(variants[selectedVariant]?.text)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {copied ? <Check size={18} color="#4ade80" /> : <Copy size={18} />}
                    {copied ? 'コピー済み' : 'コピー'}
                  </button>

                  <button
                    onClick={analyzePost}
                    disabled={isAnalyzing}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      opacity: isAnalyzing ? 0.7 : 1
                    }}
                  >
                    <Lightbulb size={18} />
                    {isAnalyzing ? '分析中...' : 'AI分析'}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* AI Feedback */}
          {feedback && (
            <section className="glass" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lightbulb size={20} color="#10b981" />
                AIフィードバック
              </h3>
              <div style={{
                whiteSpace: 'pre-wrap',
                fontSize: '0.95rem',
                lineHeight: '1.7',
                color: 'var(--text-muted)'
              }}>
                {feedback}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { Video, Sparkles, Download, Play, Pause, Volume2 } from 'lucide-react';

export default function ShortVideoPage() {
  const [script, setScript] = useState('');
  const [mood, setMood] = useState('happy');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [progress, setProgress] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const moods = [
    { id: 'happy', label: '元気・明るい', emoji: '😊' },
    { id: 'energetic', label: 'エネルギッシュ', emoji: '🔥' },
    { id: 'calm', label: '落ち着いた', emoji: '😌' },
    { id: 'cute', label: 'かわいい', emoji: '💕' }
  ];

  // アバター画像を生成
  const generateAvatar = async () => {
    setProgress('アバターを生成中...');
    try {
      const response = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: 'anime', mood })
      });

      const data = await response.json();
      if (data.success) {
        setAvatarUrl(data.imageUrl);
        setProgress('');
      }
    } catch (error) {
      console.error('Avatar generation failed:', error);
      setProgress('');
    }
  };

  // 音声合成と動画生成
  const generateVideo = async () => {
    if (!script.trim()) {
      alert('台本を入力してください');
      return;
    }

    setIsGenerating(true);
    setProgress('動画を生成中...');

    try {
      // アバター生成をスキップして直接動画録画を開始
      // (アバターAPIが動作しない場合でも動画生成できるように)
      await synthesizeSpeechAndRecord();

    } catch (error) {
      console.error('Video generation failed:', error);
      setProgress('動画生成に失敗しました');
      alert('動画生成に失敗しました。ブラウザのコンソールを確認してください。');
    } finally {
      setIsGenerating(false);
    }
  };

  // 音声合成と動画録画
  const synthesizeSpeechAndRecord = () => {
    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.3; // 女性らしい高めの声

      // 日本語の女性音声を選択
      const voices = speechSynthesis.getVoices();
      const japaneseVoice = voices.find(voice =>
        voice.lang.startsWith('ja') && voice.name.includes('Female')
      ) || voices.find(voice => voice.lang.startsWith('ja'));

      if (japaneseVoice) {
        utterance.voice = japaneseVoice;
      }

      // キャンバスに動画を描画開始
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (!canvas || !ctx) {
        reject(new Error('Canvas not available'));
        return;
      }

      canvas.width = 1080;
      canvas.height = 1920;

      // MediaRecorder でキャンバスを録画
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        setProgress('動画が完成しました!');
        resolve();
      };

      // 音声開始時に録画開始
      utterance.onstart = () => {
        setIsRecording(true);
        mediaRecorder.start();
        animateAvatar(ctx, canvas.width, canvas.height);
      };

      // 音声終了時に録画停止
      utterance.onend = () => {
        setTimeout(() => {
          mediaRecorder.stop();
        }, 500); // 少し余韻を持たせる
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        reject(event);
      };

      speechSynthesis.speak(utterance);
    });
  };

  // アバターアニメーション
  const animateAvatar = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    let frame = 0;

    // ムードに応じた背景色
    const bgColors = {
      happy: ['#ffd6e8', '#c084fc'],
      energetic: ['#fde047', '#fb923c'],
      calm: ['#bae6fd', '#93c5fd'],
      cute: ['#fecaca', '#fda4af']
    };

    const colors = bgColors[mood as keyof typeof bgColors] || bgColors.happy;

    const animate = () => {
      if (!isRecording && !isGenerating) return;

      // 背景グラデーション
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 装飾的な円（パルスエフェクト）
      const pulseScale = 1 + Math.sin(frame * 0.05) * 0.1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.3, 200 * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(width / 2, height * 0.3, 150 * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // キラキラエフェクト
      if (frame % 10 < 5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        const sparkles = 8;
        for (let i = 0; i < sparkles; i++) {
          const x = (Math.sin(frame * 0.02 + i) * width / 3) + width / 2;
          const y = (Math.cos(frame * 0.03 + i) * height / 4) + height * 0.3;
          const size = 3 + Math.sin(frame * 0.1 + i) * 2;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 字幕エリア(下部)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, height - 350, width, 350);

      // 字幕テキスト
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 52px "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // テキストを複数行に分割
      const lines = wrapText(ctx, script, width - 120);
      const lineHeight = 70;
      const startY = height - 220;

      lines.forEach((line, index) => {
        // テキストに影を追加
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(line, width / 2, startY + index * lineHeight);
      });

      // 影をリセット
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      frame++;
      requestAnimationFrame(animate);
    };

    animate();
  };

  // テキストを複数行に分割
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.slice(0, 3); // 最大3行
  };

  // 動画をダウンロード
  const downloadVideo = () => {
    if (!videoBlob) return;

    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `short-video-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 音声の読み込み(ページ読み込み時に必要)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.getVoices();
    }
  }, []);

  return (
    <main style={{ padding: '3rem', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }} className="fade-in">
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ショート動画生成
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          AIアバターが話す15秒のショート動画を自動生成(Instagram/TikTok向け)
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* 設定セクション */}
        <section className="glass fade-in" style={{ padding: '2rem', animationDelay: '0.1s' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            <Sparkles size={20} color="var(--accent-secondary)" /> 動画設定
          </h2>

          {/* 台本入力 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              台本(15秒分) *
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="例: 在宅で月30万稼げるお仕事があるって知ってた?顔出しなしでもOK!スマホ一台で今日から始められます。気になる方はDMください♪"
              rows={6}
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
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              約50-60文字で15秒程度になります
            </p>
          </div>

          {/* ムード選択 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              キャラクターのムード
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {moods.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMood(m.id)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: mood === m.id ? 'var(--gradient-main)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* アバタープレビューボタン */}
          <button
            onClick={generateAvatar}
            disabled={isGenerating}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(139, 92, 246, 0.2)',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: '1rem'
            }}
          >
            <Sparkles size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            アバタープレビュー
          </button>

          {/* 動画生成ボタン */}
          <button
            onClick={generateVideo}
            disabled={isGenerating || !script.trim()}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '12px',
              border: 'none',
              background: (!script.trim() || isGenerating) ? 'rgba(139, 92, 246, 0.3)' : 'var(--gradient-main)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              opacity: (!script.trim() || isGenerating) ? 0.5 : 1,
              cursor: (!script.trim() || isGenerating) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {isGenerating ? '生成中...' : '動画を生成する'}
            {!isGenerating && <Video size={18} />}
          </button>

          {/* 進捗状況 */}
          {progress && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: '8px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              fontSize: '0.9rem',
              color: 'white',
              textAlign: 'center'
            }}>
              {progress}
            </div>
          )}
        </section>

        {/* プレビューセクション */}
        <section className="glass fade-in" style={{ padding: '2rem', animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Video size={20} color="var(--accent-secondary)" /> プレビュー
            </h2>
            {videoBlob && (
              <button
                onClick={downloadVideo}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Download size={16} />
                ダウンロード
              </button>
            )}
          </div>

          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '400px',
            margin: '0 auto',
            aspectRatio: '9/16',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* アバタープレビュー */}
            {avatarUrl && !videoUrl && (
              <img
                src={avatarUrl}
                alt="Avatar preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {/* 動画プレビュー */}
            {videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {/* プレースホルダー */}
            {!avatarUrl && !videoUrl && (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem'
              }}>
                <Video size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>ここに動画が表示されます</p>
                <p style={{ fontSize: '0.8rem' }}>9:16 (1080x1920)</p>
              </div>
            )}

            {/* 録画中インジケーター */}
            {isRecording && (
              <div style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                background: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'white',
                  animation: 'pulse 1s infinite'
                }} />
                録画中
              </div>
            )}
          </div>

          {/* Canvas (非表示) */}
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(139, 92, 246, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)'
          }}>
            <p style={{ margin: 0, marginBottom: '0.5rem' }}>
              <strong style={{ color: 'white' }}>完全無料:</strong> ブラウザのWeb Speech APIを使用しているため、外部API料金は一切かかりません
            </p>
            <p style={{ margin: 0 }}>
              <Volume2 size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
              音声はデバイスの言語設定に依存します
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

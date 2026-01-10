import { NextResponse } from 'next/server';
import { createCanvas } from 'canvas';

export async function POST(request: Request) {
  try {
    const { style = 'anime', mood = 'happy' } = await request.json();

    // 縦型動画用のキャンバス(9:16比率)
    const width = 1080;
    const height = 1920;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 背景グラデーション
    const bgGradients = {
      happy: { start: '#ffd6e8', end: '#c084fc' },    // ピンク→紫
      energetic: { start: '#fde047', end: '#fb923c' }, // 黄色→オレンジ
      calm: { start: '#bae6fd', end: '#93c5fd' },      // 水色→青
      cute: { start: '#fecaca', end: '#fda4af' }       // 淡いピンク
    };

    const selectedBg = bgGradients[mood as keyof typeof bgGradients] || bgGradients.happy;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, selectedBg.start);
    gradient.addColorStop(1, selectedBg.end);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // キラキラエフェクト(背景装飾)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 8 + 3;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // 星形キラキラ
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        drawStar(ctx, x, y, 5, size * 2, size);
      }
    }

    // アニメ風女性キャラクターを描画
    drawAnimeGirl(ctx, width, height, mood);

    // PNGバッファに変換
    const buffer = canvas.toBuffer('image/png');
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      width,
      height,
      format: 'png'
    });

  } catch (error: any) {
    console.error('Avatar generation error:', error);
    return NextResponse.json(
      {
        error: 'アバター生成中にエラーが発生しました',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// アニメ風の女性キャラクターを描画
function drawAnimeGirl(ctx: any, width: number, height: number, mood: string) {
  const centerX = width / 2;
  const centerY = height * 0.4; // 上部寄りに配置

  // 顔の楕円(肌色)
  const faceWidth = 280;
  const faceHeight = 350;

  ctx.fillStyle = '#ffd4b3';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, faceWidth / 2, faceHeight / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 影(首元)
  ctx.fillStyle = 'rgba(255, 200, 160, 0.3)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + faceHeight / 2 - 30, faceWidth / 2 - 10, 40, 0, 0, Math.PI);
  ctx.fill();

  // 髪の毛(ツインテール風)
  ctx.fillStyle = '#6b4423'; // 茶髪

  // 左のツインテール
  ctx.beginPath();
  ctx.ellipse(centerX - 200, centerY + 50, 80, 180, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // 右のツインテール
  ctx.beginPath();
  ctx.ellipse(centerX + 200, centerY + 50, 80, 180, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 前髪
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - faceHeight / 2 + 20, faceWidth / 2 + 30, 100, 0, 0, Math.PI);
  ctx.fill();

  // リボン(ヘアアクセサリー)
  ctx.fillStyle = '#ff69b4';
  // 左リボン
  drawRibbon(ctx, centerX - 200, centerY - 50);
  // 右リボン
  drawRibbon(ctx, centerX + 200, centerY - 50);

  // 目(大きなアニメ目)
  const eyeY = centerY - 30;
  const eyeSpacing = 100;

  // 左目
  drawAnimeEye(ctx, centerX - eyeSpacing, eyeY, mood);
  // 右目
  drawAnimeEye(ctx, centerX + eyeSpacing, eyeY, mood);

  // 眉毛
  ctx.strokeStyle = '#4a3728';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';

  // 左眉
  ctx.beginPath();
  ctx.moveTo(centerX - eyeSpacing - 40, eyeY - 60);
  ctx.lineTo(centerX - eyeSpacing + 40, eyeY - 65);
  ctx.stroke();

  // 右眉
  ctx.beginPath();
  ctx.moveTo(centerX + eyeSpacing - 40, eyeY - 65);
  ctx.lineTo(centerX + eyeSpacing + 40, eyeY - 60);
  ctx.stroke();

  // 鼻(小さな点)
  ctx.fillStyle = '#ffb399';
  ctx.beginPath();
  ctx.arc(centerX, centerY + 30, 8, 0, Math.PI * 2);
  ctx.fill();

  // 口(笑顔)
  drawMouth(ctx, centerX, centerY + 80, mood);

  // チーク(頬の赤み)
  ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
  // 左
  ctx.beginPath();
  ctx.ellipse(centerX - 120, centerY + 40, 40, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  // 右
  ctx.beginPath();
  ctx.ellipse(centerX + 120, centerY + 40, 40, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // 体(簡易的な服)
  ctx.fillStyle = '#ff69b4';
  ctx.beginPath();
  ctx.moveTo(centerX - 200, centerY + faceHeight / 2);
  ctx.lineTo(centerX + 200, centerY + faceHeight / 2);
  ctx.lineTo(centerX + 250, height);
  ctx.lineTo(centerX - 250, height);
  ctx.closePath();
  ctx.fill();

  // 服の装飾
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(centerX, centerY + faceHeight / 2 + 100, 80, 0, Math.PI * 2);
  ctx.fill();
}

// アニメ目を描画
function drawAnimeEye(ctx: any, x: number, y: number, mood: string) {
  // 白目
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, 45, 55, 0, 0, Math.PI * 2);
  ctx.fill();

  // 虹彩(グラデーション)
  const irisGradient = ctx.createRadialGradient(x, y, 10, x, y, 35);
  irisGradient.addColorStop(0, '#8b5cf6');
  irisGradient.addColorStop(0.6, '#6b21a8');
  irisGradient.addColorStop(1, '#4c1d95');
  ctx.fillStyle = irisGradient;
  ctx.beginPath();
  ctx.arc(x, y, 35, 0, Math.PI * 2);
  ctx.fill();

  // 瞳孔
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fill();

  // ハイライト
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(x - 10, y - 15, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + 15, y - 8, 6, 0, Math.PI * 2);
  ctx.fill();

  // まつ毛(上)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, 50, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
}

// 口を描画
function drawMouth(ctx: any, x: number, y: number, mood: string) {
  ctx.strokeStyle = '#ff6b9d';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  // 笑顔
  ctx.beginPath();
  ctx.arc(x, y - 10, 50, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // 舌(少し見える)
  ctx.fillStyle = '#ff9999';
  ctx.beginPath();
  ctx.ellipse(x, y + 15, 25, 15, 0, 0, Math.PI);
  ctx.fill();
}

// リボンを描画
function drawRibbon(ctx: any, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);

  // 左の羽
  ctx.beginPath();
  ctx.ellipse(-20, 0, 25, 20, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // 右の羽
  ctx.beginPath();
  ctx.ellipse(20, 0, 25, 20, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // 中央の結び目
  ctx.fillStyle = '#ff1493';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 星を描画
function drawStar(ctx: any, x: number, y: number, spikes: number, outerRadius: number, innerRadius: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0 - outerRadius);

  for (let i = 0; i < spikes; i++) {
    const rotation = (Math.PI * 2 * i) / spikes;
    const xOuter = Math.sin(rotation) * outerRadius;
    const yOuter = -Math.cos(rotation) * outerRadius;
    ctx.lineTo(xOuter, yOuter);

    const xInner = Math.sin(rotation + Math.PI / spikes) * innerRadius;
    const yInner = -Math.cos(rotation + Math.PI / spikes) * innerRadius;
    ctx.lineTo(xInner, yInner);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

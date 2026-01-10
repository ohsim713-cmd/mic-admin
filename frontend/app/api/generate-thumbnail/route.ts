import { NextResponse } from 'next/server';
import { createCanvas, registerFont } from 'canvas';

export async function POST(request: Request) {
  try {
    const { title } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: 'タイトルが必要です' },
        { status: 400 }
      );
    }

    // キャンバスのサイズ（OGP画像の標準サイズ）
    const width = 1200;
    const height = 630;

    // Canvas作成
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // グラデーション背景を作成（ランダムで選択）
    const gradients = [
      { start: '#667eea', end: '#764ba2' }, // 紫系
      { start: '#f093fb', end: '#f5576c' }, // ピンク系
      { start: '#4facfe', end: '#00f2fe' }, // 青系
      { start: '#43e97b', end: '#38f9d7' }, // 緑系
      { start: '#fa709a', end: '#fee140' }, // オレンジ系
      { start: '#30cfd0', end: '#330867' }, // ダーク系
    ];

    const selectedGradient = gradients[Math.floor(Math.random() * gradients.length)];

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, selectedGradient.start);
    gradient.addColorStop(1, selectedGradient.end);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 半透明の白い背景を追加（テキストの可読性向上）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(80, 150, width - 160, height - 300);

    // テキストのスタイル設定
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // タイトルを複数行に分割（長い場合）
    const maxWidth = width - 160;
    let fontSize = 72;
    ctx.font = `bold ${fontSize}px "Arial", "Hiragino Sans", "Yu Gothic", sans-serif`;

    // テキストが長すぎる場合はフォントサイズを調整
    let titleLines = wrapText(ctx, title, maxWidth);
    while (titleLines.length > 3 && fontSize > 40) {
      fontSize -= 4;
      ctx.font = `bold ${fontSize}px "Arial", "Hiragino Sans", "Yu Gothic", sans-serif`;
      titleLines = wrapText(ctx, title, maxWidth);
    }

    // テキストを中央に描画
    const lineHeight = fontSize * 1.3;
    const totalHeight = titleLines.length * lineHeight;
    const startY = (height - totalHeight) / 2 + lineHeight / 2;

    titleLines.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + index * lineHeight);
    });

    // ロゴやブランド名を追加（オプション）
    ctx.font = '24px "Arial", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 5;
    ctx.fillText('Mignon Group', width / 2, height - 40);

    // PNGとしてバッファに変換
    const buffer = canvas.toBuffer('image/png');
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      message: 'サムネイル画像を生成しました',
      format: 'png',
      width,
      height
    });

  } catch (error: any) {
    console.error('Thumbnail generation error:', error);
    return NextResponse.json(
      {
        error: 'サムネイル生成中にエラーが発生しました',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// テキストを指定幅で折り返す関数
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split('');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

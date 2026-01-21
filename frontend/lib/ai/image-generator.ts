/**
 * AI画像生成ヘルパー
 *
 * テキストベースの画像（タイトルカード、資料風インフォグラフィック）を生成
 * Canvas APIを使用してシンプルなテキスト画像を作成
 */

import { createCanvas } from 'canvas';

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
}

// 短いキャッチコピーテンプレート（ライバー向け）
const LIVER_CATCHCOPY = [
  'スマホ1台で\n人生変わる',
  '好きな時間に\n配信するだけ',
  '未経験でも\n月○万円',
  'ライバーという\n新しい働き方',
  '顔出しなしでも\nOK',
  '在宅で\n自由に稼ぐ',
];

// 短いキャッチコピーテンプレート（チャトレ向け）
const CHATRE_CATCHCOPY = [
  '海外サイトは\n桁が違う',
  'ドル建てで\n高単価',
  '日本人という\nアドバンテージ',
  '在宅で\n自由に稼ぐ',
  '英語できなくても\n問題なし',
  'チップ文化で\n稼ぎやすい',
];

/**
 * 投稿テキストから画像生成用のプロンプトを作成
 */
export function createImagePrompt(
  postText: string,
  accountType: 'liver' | 'chatre'
): string {
  // アカウントタイプに応じた基本スタイル
  const baseStyle = accountType === 'liver'
    ? 'Young Japanese woman streaming on smartphone, bright modern room, ring light, happy expression, clean aesthetic, pastel colors'
    : 'Stylish Japanese woman working from home, laptop, modern minimalist room, professional yet comfortable, warm lighting';

  // 投稿内容からキーワードを抽出
  const keywords: string[] = [];

  if (postText.includes('稼') || postText.includes('収入')) {
    keywords.push('successful, confident');
  }
  if (postText.includes('自由') || postText.includes('時間')) {
    keywords.push('relaxed, freedom');
  }
  if (postText.includes('スマホ') || postText.includes('配信')) {
    keywords.push('smartphone, live streaming setup');
  }
  if (postText.includes('在宅') || postText.includes('家')) {
    keywords.push('cozy home interior');
  }

  const prompt = `${baseStyle}, ${keywords.join(', ')}, high quality, photorealistic, no text, no watermark, Instagram style`;

  return prompt;
}

// カラーパレット（アカウントタイプ別）
const COLOR_PALETTES = {
  liver: [
    { bg: '#FFE4E1', text: '#8B0000', accent: '#FF69B4' }, // ピンク系
    { bg: '#E6E6FA', text: '#4B0082', accent: '#9370DB' }, // 紫系
    { bg: '#F0FFF0', text: '#228B22', accent: '#90EE90' }, // 緑系
    { bg: '#FFF8DC', text: '#8B4513', accent: '#DEB887' }, // ベージュ系
  ],
  chatre: [
    { bg: '#1a1a2e', text: '#eaeaea', accent: '#e94560' }, // ダーク赤
    { bg: '#16213e', text: '#eaeaea', accent: '#0f3460' }, // ダーク青
    { bg: '#2d132c', text: '#eaeaea', accent: '#801336' }, // ダーク紫
    { bg: '#1f1f1f', text: '#f5f5f5', accent: '#c9a227' }, // ゴールド
  ],
};

/**
 * テキストベースの画像（タイトルカード）を生成
 */
export async function generateImage(prompt: string): Promise<GeneratedImage | null> {
  // この関数は現在使用しない（generateTextImageを使用）
  console.log('[ImageGen] generateImage called but not implemented for AI generation');
  return null;
}

/**
 * 短いキャッチコピー形式のタイトルカード画像を生成
 */
export function generateTextImage(
  text: string,
  accountType: 'liver' | 'chatre'
): GeneratedImage | null {
  try {
    const canvas = createCanvas(1080, 1080);
    const ctx = canvas.getContext('2d');

    const palettes = COLOR_PALETTES[accountType];
    const palette = palettes[Math.floor(Math.random() * palettes.length)];

    // 背景
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, 1080, 1080);

    // 装飾的な要素（グラデーション円）
    const gradient = ctx.createRadialGradient(540, 540, 100, 540, 540, 500);
    gradient.addColorStop(0, palette.accent + '40');
    gradient.addColorStop(1, palette.accent + '00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1080);

    // キャッチコピーをランダム選択（投稿内容は使わない）
    const catchcopies = accountType === 'liver' ? LIVER_CATCHCOPY : CHATRE_CATCHCOPY;
    const titleText = catchcopies[Math.floor(Math.random() * catchcopies.length)];

    // テキストを描画（大きめのフォント）
    ctx.font = 'bold 96px sans-serif';
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = titleText.split('\n');
    const lineHeight = 120;
    const totalHeight = lines.length * lineHeight;
    const startY = (1080 - totalHeight) / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, 540, startY + i * lineHeight);
    });

    // アカウント名を下部に
    ctx.font = '36px sans-serif';
    ctx.fillStyle = palette.text + '80';
    const handle = accountType === 'liver' ? '@tt_liver' : '@ms_stripchat';
    ctx.fillText(handle, 540, 1000);

    const buffer = canvas.toBuffer('image/png');
    console.log(`[ImageGen] Generated catchcopy image: ${buffer.length} bytes`);

    return { buffer, mimeType: 'image/png' };
  } catch (error: any) {
    console.error('[ImageGen] Text image error:', error.message);
    return null;
  }
}

/**
 * 資料風インフォグラフィック画像を生成（NotebookLM風）
 */
export function generateInfoGraphic(
  title: string,
  points: string[],
  accountType: 'liver' | 'chatre'
): GeneratedImage | null {
  try {
    const canvas = createCanvas(1080, 1350); // 4:5縦長（Instagram推奨）
    const ctx = canvas.getContext('2d');

    const palettes = COLOR_PALETTES[accountType];
    const palette = palettes[Math.floor(Math.random() * palettes.length)];

    // 背景
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, 1080, 1350);

    // ヘッダー部分（アクセントカラー）
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, 0, 1080, 200);

    // タイトル
    ctx.font = 'bold 56px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 540, 100);

    // ポイントを描画
    ctx.textAlign = 'left';
    const startY = 300;
    const pointHeight = 160;

    points.slice(0, 5).forEach((point, i) => {
      const y = startY + i * pointHeight;

      // 番号の丸
      ctx.beginPath();
      ctx.arc(120, y, 40, 0, Math.PI * 2);
      ctx.fillStyle = palette.accent;
      ctx.fill();

      // 番号
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, 120, y + 4);

      // ポイントテキスト
      ctx.font = '40px sans-serif';
      ctx.fillStyle = palette.text;
      ctx.textAlign = 'left';

      // テキストを折り返し
      const maxWidth = 800;
      const words = point.split('');
      let line = '';
      let lineY = y - 15;

      for (const char of words) {
        const testLine = line + char;
        if (ctx.measureText(testLine).width > maxWidth && line) {
          ctx.fillText(line, 190, lineY);
          line = char;
          lineY += 50;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 190, lineY);
    });

    // フッター
    ctx.font = '32px sans-serif';
    ctx.fillStyle = palette.text + '80';
    ctx.textAlign = 'center';
    const handle = accountType === 'liver' ? '@tt_liver' : '@ms_stripchat';
    ctx.fillText(handle, 540, 1280);

    const buffer = canvas.toBuffer('image/png');
    console.log(`[ImageGen] Generated infographic: ${buffer.length} bytes`);

    return { buffer, mimeType: 'image/png' };
  } catch (error: any) {
    console.error('[ImageGen] Infographic error:', error.message);
    return null;
  }
}

// 資料用のテンプレート
const INFO_TEMPLATES = {
  liver: [
    {
      title: 'ライバーで稼ぐ3つのコツ',
      points: ['毎日決まった時間に配信する', 'リスナーとの会話を大切に', '他のライバーと差別化する'],
    },
    {
      title: 'ライバーのメリット5選',
      points: ['在宅で働ける', '好きな時間に配信できる', '特別なスキル不要', '顔出しなしもOK', '収入に上限がない'],
    },
    {
      title: '配信で人気が出る秘訣',
      points: ['最初の5秒でインパクトを', '定期的な配信スケジュール', 'コメントには必ず反応'],
    },
  ],
  chatre: [
    {
      title: '海外チャトレの魅力3選',
      points: ['円安でドル収入が有利', 'チップ文化で稼ぎやすい', '日本人の希少価値が高い'],
    },
    {
      title: 'ストチャで稼ぐコツ',
      points: ['プロフィールを充実させる', '配信時間を固定する', '翻訳ツールを活用する'],
    },
    {
      title: '海外サイトvs国内サイト',
      points: ['単価が2〜3倍違う', 'チップがもらえる', '競争が少ない'],
    },
  ],
};

/**
 * 投稿内容に合わせた画像を生成
 * ランダムで「キャッチコピー」or「資料風インフォグラフィック」
 */
export async function generateImageForPost(
  postText: string,
  accountType: 'liver' | 'chatre',
  imageType?: 'catchcopy' | 'infographic'
): Promise<Buffer | null> {
  // 指定がなければランダム（資料風を多めに）
  const type = imageType || (Math.random() < 0.6 ? 'infographic' : 'catchcopy');

  if (type === 'infographic') {
    console.log(`[ImageGen] Generating infographic for ${accountType}...`);
    const templates = INFO_TEMPLATES[accountType];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const result = generateInfoGraphic(template.title, template.points, accountType);
    return result?.buffer || null;
  } else {
    console.log(`[ImageGen] Generating catchcopy for ${accountType}...`);
    const result = generateTextImage(postText, accountType);
    return result?.buffer || null;
  }
}

/**
 * 代替: ストック画像フォルダからランダム選択
 * (AI生成が失敗した場合のフォールバック)
 */
export async function getStockImage(accountType: 'liver' | 'chatre'): Promise<Buffer | null> {
  // TODO: Vercel Blobからストック画像を取得する実装
  // 現時点では画像なしで投稿を続行
  console.log('[ImageGen] Falling back to no image');
  return null;
}

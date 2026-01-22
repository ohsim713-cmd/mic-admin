/**
 * Gemini Imagen 3 画像生成ライブラリ
 *
 * Google AI Studio の Imagen 3 を使用して画像を生成
 * Canva の代替として使用
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// 画像生成リクエストの型
export interface ImageGenerationRequest {
  prompt: string;
  style?: 'liver' | 'chatre';
  aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
  numberOfImages?: number;
}

// 画像生成レスポンスの型
export interface ImageGenerationResponse {
  success: boolean;
  images: Array<{
    base64: string;
    mimeType: string;
  }>;
  error?: string;
}

// アカウント別スタイルプロンプト
const STYLE_PROMPTS: Record<string, string> = {
  liver: `
    Style: Bright, cheerful, youthful, anime-inspired aesthetic
    Colors: Pink (#FF6B9D), Light Pink (#FFB6C1), Lavender
    Mood: Optimistic, energetic, supportive, dreams coming true
    Elements: Sparkles, stars, soft gradients, kawaii elements
  `,
  chatre: `
    Style: Elegant, sophisticated, mature, luxurious aesthetic
    Colors: Purple (#9B59B6), Deep Red (#E74C3C), Dark Blue (#2C3E50)
    Mood: Confident, empowering, successful, independent
    Elements: Gold accents, subtle patterns, professional look
  `,
};

// プラットフォーム別アスペクト比
export const PLATFORM_ASPECT_RATIOS = {
  instagram_reel: '9:16',
  instagram_post: '1:1',
  instagram_story: '9:16',
  tiktok: '9:16',
  twitter: '16:9',
  wordpress_thumbnail: '16:9',
} as const;

/**
 * Gemini Imagen 3 クライアント
 */
export class ImagenClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Gemini 2.0 Flash（画像生成対応）を使用
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });
  }

  /**
   * 画像を生成
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      const { prompt, style, aspectRatio = '9:16' } = request;

      // スタイルプロンプトを追加
      const stylePrompt = style ? STYLE_PROMPTS[style] : '';
      // アスペクト比をプロンプトに含める
      const aspectDesc = aspectRatio === '16:9' ? 'horizontal landscape 16:9'
                       : aspectRatio === '9:16' ? 'vertical portrait 9:16'
                       : aspectRatio === '4:5' ? 'portrait 4:5'
                       : 'square 1:1';
      const fullPrompt = `${prompt}\n\nAspect ratio: ${aspectDesc}\n\n${stylePrompt}`.trim();

      console.log('[Imagen] Generating image with prompt:', fullPrompt.substring(0, 100) + '...');

      // Imagen 3 API呼び出し（シンプルな形式）
      const result = await this.model.generateContent(fullPrompt);

      const response = result.response;
      const images: Array<{ base64: string; mimeType: string }> = [];

      // 画像データを抽出
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData) {
            images.push({
              base64: part.inlineData.data || '',
              mimeType: part.inlineData.mimeType || 'image/png',
            });
          }
        }
      }

      if (images.length === 0) {
        throw new Error('No images generated');
      }

      console.log(`[Imagen] Generated ${images.length} image(s)`);

      return {
        success: true,
        images,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Imagen] Generation error:', error);

      return {
        success: false,
        images: [],
        error: errorMessage,
      };
    }
  }

  /**
   * テキストオーバーレイ用の背景画像を生成
   */
  async generateTextOverlayBackground(
    theme: string,
    style: 'liver' | 'chatre',
    platform: 'tiktok' | 'instagram'
  ): Promise<ImageGenerationResponse> {
    const aspectRatio = platform === 'tiktok' ? '9:16' : '9:16';

    const prompt = `
      Create a simple, clean background image for text overlay video.
      Theme: ${theme}
      Requirements:
      - Soft gradient or blurred background
      - No text or letters in the image
      - Leave space in the center for text overlay
      - Subtle decorative elements on edges only
      - High contrast friendly for white/black text
      - Modern, trendy social media aesthetic
    `;

    return this.generateImage({
      prompt,
      style,
      aspectRatio: aspectRatio as '9:16',
    });
  }

  /**
   * サムネイル画像を生成
   */
  async generateThumbnail(
    title: string,
    style: 'liver' | 'chatre',
    platform: 'wordpress' | 'twitter' | 'instagram'
  ): Promise<ImageGenerationResponse> {
    const aspectRatio =
      platform === 'instagram'
        ? '1:1'
        : platform === 'twitter'
          ? '16:9'
          : '16:9';

    const prompt = `
      Create an eye-catching thumbnail image.
      Topic: ${title}
      Requirements:
      - Bold, attention-grabbing composition
      - Clear focal point
      - No text or letters (text will be added separately)
      - High contrast and vibrant colors
      - Professional quality
      - Japanese social media style
    `;

    return this.generateImage({
      prompt,
      style,
      aspectRatio: aspectRatio as '1:1' | '16:9',
    });
  }
}

// シングルトンインスタンス
let imagenClient: ImagenClient | null = null;

export function getImagenClient(): ImagenClient {
  if (!imagenClient) {
    imagenClient = new ImagenClient();
  }
  return imagenClient;
}

/**
 * Base64画像をBufferに変換
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * 画像をData URLに変換
 */
export function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

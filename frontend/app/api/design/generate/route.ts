/**
 * 画像生成エンドポイント
 *
 * Canva API または Imagen 3 を使用して画像を生成
 *
 * POST /api/design/generate
 * {
 *   platform: 'instagram' | 'tiktok' | 'twitter' | 'wordpress',
 *   type: 'reel' | 'text_overlay' | 'thumbnail' | 'post',
 *   title: string,
 *   style: 'liver' | 'chatre',
 *   useCanva?: boolean,  // true: Canva, false: Imagen
 *   templateId?: string  // Canvaテンプレート指定時
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createDesign,
  createDesignFromTemplate,
  exportDesign,
  listBrandTemplates,
  refreshAccessToken,
  PLATFORM_SIZES,
} from '@/lib/canva-api';
import { getImagenClient, PLATFORM_ASPECT_RATIOS } from '@/lib/imagen';

export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Pro: Canvaのデザイン作成+エクスポートに時間がかかるため延長

// トークンキャッシュ（サーバーレス環境では限定的だが、同一インスタンス内では有効）
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

// アクセストークンを取得（必要に応じて自動リフレッシュ）
async function getAccessToken(): Promise<string | null> {
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  const refreshTokenEnv = process.env.CANVA_REFRESH_TOKEN;

  if (!accessToken) {
    console.error('[Design Generate] No access token');
    return null;
  }

  // キャッシュされたトークンがあり、まだ有効な場合はそれを使用
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    console.log('[Design Generate] Using cached token');
    return cachedToken.accessToken;
  }

  // まずは環境変数のトークンを試す
  const testResult = await testToken(accessToken);

  if (testResult) {
    // トークンが有効 - キャッシュして返す（4時間の有効期限を仮定）
    cachedToken = {
      accessToken,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000, // 4時間
    };
    console.log('[Design Generate] Token is valid');
    return accessToken;
  }

  // トークンが無効 - リフレッシュを試みる
  if (refreshTokenEnv) {
    console.log('[Design Generate] Token expired, attempting refresh...');
    const refreshed = await refreshAccessToken(refreshTokenEnv);

    if (refreshed) {
      // リフレッシュ成功
      cachedToken = {
        accessToken: refreshed.access_token,
        expiresAt: Date.now() + (refreshed.expires_in * 1000) - 60000, // 1分余裕
      };
      console.log('[Design Generate] Token refreshed successfully');

      // 注意: Vercelでは環境変数を動的に更新できないため、
      // 新しいトークンはログに出力し、手動で更新が必要な場合がある
      console.log('[Design Generate] New tokens (update in Vercel if needed):');
      console.log('CANVA_ACCESS_TOKEN:', refreshed.access_token.substring(0, 50) + '...');
      console.log('CANVA_REFRESH_TOKEN:', refreshed.refresh_token.substring(0, 50) + '...');

      return refreshed.access_token;
    }
  }

  console.error('[Design Generate] Token invalid and refresh failed');
  return null;
}

// トークンの有効性をテスト
async function testToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.canva.com/rest/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 画像生成結果の型
interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  base64?: string;
  error?: string;
}

// Canvaでデザインを生成
async function generateWithCanva(
  accessToken: string,
  options: {
    platform: string;
    type: string;
    title: string;
    style: string;
    templateId?: string;
  }
): Promise<GenerationResult> {
  try {
    const size = PLATFORM_SIZES[`${options.platform}_${options.type}`] ||
                 PLATFORM_SIZES[options.platform] ||
                 PLATFORM_SIZES.instagram_post;

    let design;

    if (options.templateId) {
      // テンプレートから作成
      design = await createDesignFromTemplate(
        accessToken,
        options.templateId,
        options.title,
        { title: options.title }
      );
    } else {
      // 空のデザインを作成
      design = await createDesign(accessToken, {
        title: options.title,
        width: size.width,
        height: size.height,
      });
    }

    if (!design) {
      return { success: false, error: 'Failed to create design' };
    }

    console.log('[Design Generate] Design created:', design.id);

    // デザインをエクスポート
    const urls = await exportDesign(accessToken, design.id, 'png', { quality: 'high' });

    if (!urls || urls.length === 0) {
      return { success: false, error: 'Failed to export design' };
    }

    return { success: true, imageUrl: urls[0] };
  } catch (error) {
    console.error('[Design Generate] Canva error:', error);
    return { success: false, error: String(error) };
  }
}

// Imagenで画像を生成
async function generateWithImagen(
  options: {
    platform: string;
    type: string;
    title: string;
    style: 'liver' | 'chatre';
  }
): Promise<GenerationResult> {
  try {
    const client = getImagenClient();

    // アスペクト比を決定
    const aspectRatioKey = `${options.platform}_${options.type}` as keyof typeof PLATFORM_ASPECT_RATIOS;
    const aspectRatio = PLATFORM_ASPECT_RATIOS[aspectRatioKey] || '9:16';

    // プロンプトを生成
    let prompt = '';

    if (options.type === 'text_overlay' || options.type === 'reel') {
      // テキストオーバーレイ用の背景
      prompt = `
        Create a simple, clean background image for text overlay video.
        Theme: ${options.title}
        Requirements:
        - Soft gradient or blurred background
        - No text or letters in the image
        - Leave space in the center for text overlay
        - Subtle decorative elements on edges only
        - High contrast friendly for white/black text
        - Modern, trendy social media aesthetic
        - Japanese style, cute and appealing
      `;
    } else if (options.type === 'thumbnail') {
      // サムネイル用
      prompt = `
        Create an eye-catching thumbnail image.
        Topic: ${options.title}
        Requirements:
        - Bold, attention-grabbing composition
        - Clear focal point
        - No text or letters (text will be added separately)
        - High contrast and vibrant colors
        - Professional quality
        - Japanese social media style
      `;
    } else {
      // 一般的な投稿用
      prompt = `
        Create a visually appealing social media post image.
        Topic: ${options.title}
        Requirements:
        - Clean, modern design
        - No text or letters
        - Suitable for ${options.platform}
        - Japanese aesthetic
      `;
    }

    const result = await client.generateImage({
      prompt,
      style: options.style,
      aspectRatio: aspectRatio as '1:1' | '9:16' | '16:9' | '4:5',
    });

    if (!result.success || result.images.length === 0) {
      return { success: false, error: result.error || 'No images generated' };
    }

    // Base64画像をData URLとして返す
    const image = result.images[0];
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;

    return { success: true, imageUrl: dataUrl, base64: image.base64 };
  } catch (error) {
    console.error('[Design Generate] Imagen error:', error);
    return { success: false, error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      platform = 'instagram',
      type = 'reel',
      title,
      style = 'liver',
      useCanva = false,
      templateId,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    console.log(`[Design Generate] Generating ${type} for ${platform}, style: ${style}, useCanva: ${useCanva}`);

    let result;

    if (useCanva) {
      // Canvaで生成
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return NextResponse.json(
          { error: 'Canva not authenticated. Please run /api/canva/auth first.' },
          { status: 401 }
        );
      }

      result = await generateWithCanva(accessToken, {
        platform,
        type,
        title,
        style,
        templateId,
      });
    } else {
      // Imagenで生成
      result = await generateWithImagen({
        platform,
        type,
        title,
        style: style as 'liver' | 'chatre',
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Image generation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      base64: result.base64,
      platform,
      type,
      style,
      generatedWith: useCanva ? 'canva' : 'imagen',
    });
  } catch (error) {
    console.error('[Design Generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: Canvaテンプレート一覧を取得
export async function GET() {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Canva not authenticated' },
        { status: 401 }
      );
    }

    const result = await listBrandTemplates(accessToken, { limit: 50 });

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: result.templates,
      continuation: result.continuation,
    });
  } catch (error) {
    console.error('[Design Generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

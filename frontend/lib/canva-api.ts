/**
 * Canva Connect API クライアント
 *
 * API: https://api.canva.com/rest/v1/
 * 機能: デザイン作成、テンプレート使用、エクスポート
 *
 * 注意: OAuth認証が必要。以下の環境変数を設定:
 * - CANVA_CLIENT_ID
 * - CANVA_CLIENT_SECRET
 * - CANVA_REDIRECT_URI
 *
 * 認証フロー:
 * 1. /api/canva/auth でOAuthフロー開始
 * 2. Canvaでユーザー認可
 * 3. コールバックでアクセストークン取得
 * 4. トークンを使ってAPI呼び出し
 */

const BASE_URL = 'https://api.canva.com/rest/v1';

// ========== 型定義 ==========

export interface CanvaDesign {
  id: string;
  title: string;
  owner?: {
    user_id?: string;
    team_id?: string;
  };
  thumbnail?: {
    width: number;
    height: number;
    url: string;
  };
  urls?: {
    edit_url?: string;
    view_url?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface CanvaTemplate {
  id: string;
  title: string;
  thumbnail?: {
    width: number;
    height: number;
    url: string;
  };
}

export interface CanvaExportJob {
  id: string;
  status: 'in_progress' | 'completed' | 'failed';
  urls?: string[];
  error?: {
    code: string;
    message: string;
  };
}

export interface CanvaAsset {
  id: string;
  name: string;
  type: string;
  thumbnail?: {
    url: string;
  };
  created_at?: string;
}

export interface DesignSize {
  width: number;
  height: number;
  unit: 'px' | 'mm' | 'cm' | 'in';
}

// プラットフォーム別の推奨サイズ
export const PLATFORM_SIZES: Record<string, DesignSize> = {
  instagram_post: { width: 1080, height: 1080, unit: 'px' },
  instagram_story: { width: 1080, height: 1920, unit: 'px' },
  instagram_reel: { width: 1080, height: 1920, unit: 'px' },
  tiktok_video: { width: 1080, height: 1920, unit: 'px' },
  twitter_post: { width: 1200, height: 675, unit: 'px' },
  wordpress_thumbnail: { width: 1200, height: 675, unit: 'px' },
  note_header: { width: 1280, height: 670, unit: 'px' },
};

// ========== 認証関連 ==========

/**
 * OAuth認証URLを生成
 */
export function getAuthorizationUrl(state: string): string {
  const clientId = process.env.CANVA_CLIENT_ID;
  const redirectUri = process.env.CANVA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('CANVA_CLIENT_ID and CANVA_REDIRECT_URI are required');
  }

  const scopes = [
    'design:content:read',
    'design:content:write',
    'design:meta:read',
    'asset:read',
    'asset:write',
    'brandtemplate:meta:read',
    'brandtemplate:content:read',
    'profile:read',
  ];

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
  });

  return `https://www.canva.com/api/oauth/authorize?${params.toString()}`;
}

/**
 * 認可コードをアクセストークンに交換
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('[Canva API] Missing credentials');
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] Token exchange failed:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Canva API] Token exchange error:', error);
    return null;
  }
}

/**
 * リフレッシュトークンでアクセストークンを更新
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Canva API] Missing credentials');
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] Token refresh failed:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Canva API] Token refresh error:', error);
    return null;
  }
}

// ========== デザイン操作 ==========

/**
 * 新しいデザインを作成
 */
export async function createDesign(
  accessToken: string,
  options: {
    title: string;
    design_type?: string;
    asset_id?: string;  // 既存アセットから作成
    width?: number;
    height?: number;
  }
): Promise<CanvaDesign | null> {
  try {
    const body: any = {
      title: options.title,
    };

    if (options.design_type) {
      body.design_type = { type: options.design_type };
    } else if (options.width && options.height) {
      body.design_type = {
        type: 'custom',
        width: options.width,
        height: options.height,
      };
    }

    if (options.asset_id) {
      body.asset_id = options.asset_id;
    }

    const response = await fetch(`${BASE_URL}/designs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] Create design failed:', error);
      return null;
    }

    const data = await response.json();
    return data.design;
  } catch (error) {
    console.error('[Canva API] Create design error:', error);
    return null;
  }
}

/**
 * テンプレートからデザインを作成
 */
export async function createDesignFromTemplate(
  accessToken: string,
  templateId: string,
  title: string,
  data?: Record<string, any>  // Autofill用のデータ
): Promise<CanvaDesign | null> {
  try {
    const body: any = {
      title,
      brand_template_id: templateId,
    };

    if (data) {
      body.data = data;
    }

    const response = await fetch(`${BASE_URL}/autofills`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] Create from template failed:', error);
      return null;
    }

    const result = await response.json();

    // Autofill jobの完了を待つ
    if (result.job?.id) {
      return await waitForAutofillJob(accessToken, result.job.id);
    }

    return result.design;
  } catch (error) {
    console.error('[Canva API] Create from template error:', error);
    return null;
  }
}

/**
 * Autofillジョブの完了を待つ
 */
async function waitForAutofillJob(
  accessToken: string,
  jobId: string,
  maxAttempts: number = 30
): Promise<CanvaDesign | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/autofills/${jobId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[Canva API] Check autofill job failed');
        return null;
      }

      const result = await response.json();

      if (result.job?.status === 'completed') {
        return result.job.result?.design || null;
      }

      if (result.job?.status === 'failed') {
        console.error('[Canva API] Autofill job failed:', result.job.error);
        return null;
      }

      // 1秒待って再チェック
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('[Canva API] Check autofill job error:', error);
      return null;
    }
  }

  console.error('[Canva API] Autofill job timeout');
  return null;
}

/**
 * デザインをエクスポート
 */
export async function exportDesign(
  accessToken: string,
  designId: string,
  format: 'png' | 'jpg' | 'pdf' | 'mp4' = 'png',
  options?: {
    quality?: 'regular' | 'high';
    pages?: number[];
  }
): Promise<string[] | null> {
  try {
    const body: any = {
      design_id: designId,
      format: {
        type: format,
      },
    };

    if (options?.quality) {
      body.format.quality = options.quality;
    }

    if (options?.pages) {
      body.pages = options.pages;
    }

    const response = await fetch(`${BASE_URL}/exports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] Export design failed:', error);
      return null;
    }

    const result = await response.json();

    // エクスポートジョブの完了を待つ
    if (result.job?.id) {
      return await waitForExportJob(accessToken, result.job.id);
    }

    return result.job?.urls || null;
  } catch (error) {
    console.error('[Canva API] Export design error:', error);
    return null;
  }
}

/**
 * エクスポートジョブの完了を待つ
 */
async function waitForExportJob(
  accessToken: string,
  jobId: string,
  maxAttempts: number = 60
): Promise<string[] | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/exports/${jobId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[Canva API] Check export job failed');
        return null;
      }

      const result = await response.json();

      if (result.job?.status === 'completed') {
        return result.job.urls || [];
      }

      if (result.job?.status === 'failed') {
        console.error('[Canva API] Export job failed:', result.job.error);
        return null;
      }

      // 1秒待って再チェック
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('[Canva API] Check export job error:', error);
      return null;
    }
  }

  console.error('[Canva API] Export job timeout');
  return null;
}

// ========== テンプレート操作 ==========

/**
 * ブランドテンプレート一覧を取得
 */
export async function listBrandTemplates(
  accessToken: string,
  options?: {
    limit?: number;
    continuation?: string;
  }
): Promise<{
  templates: CanvaTemplate[];
  continuation?: string;
} | null> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.continuation) params.append('continuation', options.continuation);

    const url = `${BASE_URL}/brand-templates${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] List templates failed:', error);
      return null;
    }

    const data = await response.json();
    return {
      templates: data.items || [],
      continuation: data.continuation,
    };
  } catch (error) {
    console.error('[Canva API] List templates error:', error);
    return null;
  }
}

/**
 * テンプレートの詳細を取得
 */
export async function getBrandTemplate(
  accessToken: string,
  templateId: string
): Promise<CanvaTemplate | null> {
  try {
    const response = await fetch(`${BASE_URL}/brand-templates/${templateId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] Get template failed:', error);
      return null;
    }

    const data = await response.json();
    return data.brand_template;
  } catch (error) {
    console.error('[Canva API] Get template error:', error);
    return null;
  }
}

// ========== アセット操作 ==========

/**
 * アセットをアップロード
 */
export async function uploadAsset(
  accessToken: string,
  file: Buffer,
  name: string,
  mimeType: string
): Promise<CanvaAsset | null> {
  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(file)], { type: mimeType });
    formData.append('asset', blob, name);
    formData.append('name', name);

    const response = await fetch(`${BASE_URL}/assets/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] Upload asset failed:', error);
      return null;
    }

    const data = await response.json();
    return data.asset;
  } catch (error) {
    console.error('[Canva API] Upload asset error:', error);
    return null;
  }
}

/**
 * アセット一覧を取得
 */
export async function listAssets(
  accessToken: string,
  options?: {
    limit?: number;
    continuation?: string;
  }
): Promise<{
  assets: CanvaAsset[];
  continuation?: string;
} | null> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.continuation) params.append('continuation', options.continuation);

    const url = `${BASE_URL}/assets${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Canva API] List assets failed:', error);
      return null;
    }

    const data = await response.json();
    return {
      assets: data.items || [],
      continuation: data.continuation,
    };
  } catch (error) {
    console.error('[Canva API] List assets error:', error);
    return null;
  }
}

// ========== ユーティリティ ==========

/**
 * デザインサイズを取得
 */
export function getDesignSize(platform: string): DesignSize {
  return PLATFORM_SIZES[platform] || PLATFORM_SIZES.instagram_post;
}

/**
 * トークンの有効期限をチェック
 */
export function isTokenExpired(expiresAt: number): boolean {
  // 5分の余裕を持たせる
  return Date.now() > (expiresAt - 5 * 60 * 1000);
}

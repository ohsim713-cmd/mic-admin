/**
 * テンプレートデータセット取得エンドポイント
 *
 * GET /api/design/template/[templateId]/dataset
 *
 * ブランドテンプレートのautofill可能なフィールドを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBrandTemplateDataset,
  getBrandTemplate,
  refreshAccessToken,
} from '@/lib/canva-api';

export const runtime = 'nodejs';

// トークンキャッシュ
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  const refreshTokenEnv = process.env.CANVA_REFRESH_TOKEN;

  if (!accessToken) {
    return null;
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  const isValid = await testToken(accessToken);

  if (isValid) {
    cachedToken = {
      accessToken,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    };
    return accessToken;
  }

  if (refreshTokenEnv) {
    const refreshed = await refreshAccessToken(refreshTokenEnv);
    if (refreshed) {
      cachedToken = {
        accessToken: refreshed.access_token,
        expiresAt: Date.now() + (refreshed.expires_in * 1000) - 60000,
      };
      return refreshed.access_token;
    }
  }

  return null;
}

async function testToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.canva.com/rest/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;

  if (!templateId) {
    return NextResponse.json(
      { error: 'templateId is required' },
      { status: 400 }
    );
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Canva not authenticated' },
      { status: 401 }
    );
  }

  // テンプレート情報取得
  const template = await getBrandTemplate(accessToken, templateId);

  // データセット取得
  const datasetResult = await getBrandTemplateDataset(accessToken, templateId);

  if (!datasetResult) {
    return NextResponse.json(
      {
        error: 'Failed to get template dataset',
        hint: 'Make sure the design is saved as a brand template and has autofill fields configured.',
        instructions: [
          '1. In Canva, open your design',
          '2. Click Share > More > Brand template',
          '3. Select text elements and connect them to data fields',
          '4. Save the template',
        ],
      },
      { status: 404 }
    );
  }

  const fieldCount = Object.keys(datasetResult.dataset).length;

  return NextResponse.json({
    success: true,
    templateId,
    template: template ? {
      title: template.title,
      thumbnail: template.thumbnail?.url,
    } : null,
    dataset: datasetResult.dataset,
    fieldCount,
    fields: Object.entries(datasetResult.dataset).map(([name, info]) => ({
      name,
      type: info.type,
    })),
  });
}

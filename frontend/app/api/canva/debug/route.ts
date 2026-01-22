/**
 * Canva環境変数デバッグエンドポイント
 *
 * 環境変数が正しくセットされているか確認用
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const clientId = process.env.CANVA_CLIENT_ID || '';
  const clientSecret = process.env.CANVA_CLIENT_SECRET || '';
  const redirectUri = process.env.CANVA_REDIRECT_URI || '';

  return NextResponse.json({
    clientId: {
      exists: !!clientId,
      length: clientId.length,
      prefix: clientId.substring(0, 5), // 最初の5文字だけ表示
      suffix: clientId.substring(clientId.length - 3), // 最後の3文字
    },
    clientSecret: {
      exists: !!clientSecret,
      length: clientSecret.length,
    },
    redirectUri: {
      exists: !!redirectUri,
      value: redirectUri, // リダイレクトURIは全体表示OK
    },
    expectedClientIdPrefix: 'OC-AZ', // 正しいClient IDの先頭
  });
}

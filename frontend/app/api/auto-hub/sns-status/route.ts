/**
 * Auto Hub - SNS連携状況確認API
 */

import { NextResponse } from 'next/server';
import { checkAllAccountsStatus, ACCOUNTS } from '@/lib/dm-hunter/sns-adapter';

export async function GET() {
  try {
    // 全アカウントの接続状況を確認
    const accountsStatus = await checkAllAccountsStatus();

    // 環境変数の設定状況
    const envStatus = {
      liver: {
        apiKey: !!process.env.TWITTER_API_KEY_TT_LIVER,
        apiSecret: !!process.env.TWITTER_API_SECRET_TT_LIVER,
        accessToken: !!process.env.TWITTER_ACCESS_TOKEN_TT_LIVER,
        accessTokenSecret: !!process.env.TWITTER_ACCESS_TOKEN_SECRET_TT_LIVER,
      },
      chatre1: {
        apiKey: !!process.env.TWITTER_API_KEY_MIC_CHAT,
        apiSecret: !!process.env.TWITTER_API_SECRET_MIC_CHAT,
        accessToken: !!process.env.TWITTER_ACCESS_TOKEN_MIC_CHAT,
        accessTokenSecret: !!process.env.TWITTER_ACCESS_TOKEN_SECRET_MIC_CHAT,
      },
      chatre2: {
        apiKey: !!process.env.TWITTER_API_KEY_MS_STRIPCHAT,
        apiSecret: !!process.env.TWITTER_API_SECRET_MS_STRIPCHAT,
        accessToken: !!process.env.TWITTER_ACCESS_TOKEN_MS_STRIPCHAT,
        accessTokenSecret: !!process.env.TWITTER_ACCESS_TOKEN_SECRET_MS_STRIPCHAT,
      },
    };

    // 接続可能なアカウント数
    const connectedCount = accountsStatus.filter(a => a.connected).length;

    return NextResponse.json({
      success: true,
      summary: {
        total: ACCOUNTS.length,
        connected: connectedCount,
        disconnected: ACCOUNTS.length - connectedCount,
        allConnected: connectedCount === ACCOUNTS.length,
      },
      accounts: accountsStatus.map(a => ({
        ...a,
        envConfigured: envStatus[a.account as keyof typeof envStatus],
        allEnvSet: Object.values(envStatus[a.account as keyof typeof envStatus] || {}).every(v => v),
      })),
      platforms: {
        twitter: {
          name: 'X (Twitter)',
          accounts: accountsStatus.length,
          connected: connectedCount,
        },
        // 他のSNSは未実装
        bluesky: { name: 'Bluesky', accounts: 0, connected: 0, status: 'not_implemented' },
        threads: { name: 'Threads', accounts: 0, connected: 0, status: 'not_implemented' },
        instagram: { name: 'Instagram', accounts: 0, connected: 0, status: 'not_implemented' },
      },
    });
  } catch (error: any) {
    console.error('[SNS Status] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      summary: { total: 3, connected: 0, disconnected: 3, allConnected: false },
      accounts: ACCOUNTS.map(a => ({
        account: a.id,
        name: a.name,
        handle: a.handle,
        connected: false,
        error: 'ステータス確認に失敗',
      })),
    });
  }
}

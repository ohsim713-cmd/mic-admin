/**
 * DM Hunter - SNSアダプター
 * 3アカウント対応版
 */

import { TwitterApi } from 'twitter-api-v2';

// アカウント種別
export type AccountType = 'liver' | 'chatre1' | 'chatre2';

// アカウント設定
export const ACCOUNTS: {
  id: AccountType;
  name: string;
  handle: string;
  type: 'ライバー' | 'チャトレ';
}[] = [
  { id: 'liver', name: 'ライバー事務所', handle: '@tt_liver', type: 'ライバー' },
  { id: 'chatre1', name: 'チャトレ事務所①', handle: '@mic_chat_', type: 'チャトレ' },
  { id: 'chatre2', name: 'チャトレ事務所②', handle: '@ms_stripchat', type: 'チャトレ' },
];

// SNS別の制限
export const SNS_LIMITS = {
  twitter: { maxLength: 280, hashtags: 3 },
};

export interface PostResult {
  platform: string;
  account: string;
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * 環境変数からTwitterクライアントを取得
 */
function getTwitterClient(account: AccountType): TwitterApi | null {
  let apiKey: string | undefined;
  let apiSecret: string | undefined;
  let accessToken: string | undefined;
  let accessTokenSecret: string | undefined;

  switch (account) {
    case 'liver':
      apiKey = process.env.TWITTER_API_KEY_TT_LIVER;
      apiSecret = process.env.TWITTER_API_SECRET_TT_LIVER;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_TT_LIVER;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_TT_LIVER;
      break;
    case 'chatre1':
      apiKey = process.env.TWITTER_API_KEY_MIC_CHAT;
      apiSecret = process.env.TWITTER_API_SECRET_MIC_CHAT;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_MIC_CHAT;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_MIC_CHAT;
      break;
    case 'chatre2':
      apiKey = process.env.TWITTER_API_KEY_MS_STRIPCHAT;
      apiSecret = process.env.TWITTER_API_SECRET_MS_STRIPCHAT;
      accessToken = process.env.TWITTER_ACCESS_TOKEN_MS_STRIPCHAT;
      accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET_MS_STRIPCHAT;
      break;
  }

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return null;
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });
}

/**
 * 投稿をTwitter用にフォーマット
 */
export function formatForTwitter(text: string): string {
  let formatted = text;

  // ハッシュタグを除去
  formatted = formatted.replace(/#[^\s#]+/g, '').trim();

  // 280文字に収める
  if (formatted.length > 260) {
    formatted = formatted.substring(0, 257) + '...';
  }

  // CTAを確認して追加
  if (!formatted.includes('DM') && !formatted.includes('メッセージ')) {
    if (formatted.length < 250) {
      formatted += '\n\n気になる方はDMで💬';
    }
  }

  return formatted;
}

/**
 * 指定アカウントにTwitter投稿
 */
export async function postToTwitterAccount(
  text: string,
  account: AccountType
): Promise<PostResult> {
  const accountInfo = ACCOUNTS.find(a => a.id === account);
  const accountName = accountInfo?.handle || account;

  try {
    const client = getTwitterClient(account);

    if (!client) {
      return {
        platform: 'twitter',
        account: accountName,
        success: false,
        error: `${accountName}の認証情報が設定されていません`,
      };
    }

    const formatted = formatForTwitter(text);
    const tweet = await client.v2.tweet(formatted);

    return {
      platform: 'twitter',
      account: accountName,
      success: true,
      id: tweet.data.id,
    };
  } catch (error: any) {
    return {
      platform: 'twitter',
      account: accountName,
      success: false,
      error: error.message,
    };
  }
}

/**
 * 全アカウントに投稿（それぞれ別の内容）
 */
export async function postToAllAccounts(
  posts: { account: AccountType; text: string }[]
): Promise<PostResult[]> {
  const promises = posts.map(p => postToTwitterAccount(p.text, p.account));
  const results = await Promise.allSettled(promises);

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      platform: 'twitter',
      account: posts[i].account,
      success: false,
      error: result.reason?.message || 'Unknown error',
    };
  });
}

/**
 * 単一アカウントの認証状態確認
 */
export async function checkAccountStatus(account: AccountType): Promise<{
  connected: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const client = getTwitterClient(account);

    if (!client) {
      return { connected: false, error: '認証情報未設定' };
    }

    const me = await client.v2.me();
    return {
      connected: true,
      username: me.data.username,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * 全アカウントの認証状態確認
 */
export async function checkAllAccountsStatus(): Promise<{
  account: AccountType;
  name: string;
  handle: string;
  connected: boolean;
  username?: string;
  error?: string;
}[]> {
  const results = await Promise.all(
    ACCOUNTS.map(async (acc) => {
      const status = await checkAccountStatus(acc.id);
      return {
        account: acc.id,
        name: acc.name,
        handle: acc.handle,
        ...status,
      };
    })
  );
  return results;
}

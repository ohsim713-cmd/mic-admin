/**
 * DM Hunter - SNSアダプター
 * 3アカウント対応版
 */

import { TwitterApi } from 'twitter-api-v2';

// アカウント種別
export type AccountType = 'liver' | 'chatre1' | 'chatre2' | 'wordpress';

// アカウント設定
export const ACCOUNTS: {
  id: AccountType;
  name: string;
  handle: string;
  type: 'ライバー' | 'チャトレ';
  platform: 'twitter' | 'wordpress';
}[] = [
  { id: 'liver', name: 'ライバー事務所', handle: '@tt_liver', type: 'ライバー', platform: 'twitter' },
  { id: 'chatre1', name: 'チャトレ事務所①', handle: '@mic_chat_', type: 'チャトレ', platform: 'twitter' },
  { id: 'chatre2', name: 'チャトレ事務所②', handle: '@ms_stripchat', type: 'チャトレ', platform: 'twitter' },
  { id: 'wordpress', name: 'WordPress記事', handle: 'チャトレブログ', type: 'チャトレ', platform: 'wordpress' },
];

// SNS別の制限
export const SNS_LIMITS = {
  twitter: { maxLength: 280, hashtags: 3 },
  wordpress: { maxLength: 5000, hashtags: 0 },
};

import fs from 'fs';
import path from 'path';

// WordPress認証情報を取得
function getWordPressCredentials(): { siteUrl: string; username: string; appPassword: string } | null {
  try {
    const settingsPath = path.join(process.cwd(), 'knowledge', 'wordpress_credentials.json');
    if (!fs.existsSync(settingsPath)) return null;
    const data = fs.readFileSync(settingsPath, 'utf-8');
    const creds = JSON.parse(data);
    if (!creds.siteUrl || !creds.username || !creds.appPassword) return null;
    return creds;
  } catch {
    return null;
  }
}

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
  // WordPressアカウントの場合
  if (account === 'wordpress') {
    const wpStatus = await checkWordPressStatus();
    return {
      connected: wpStatus.connected,
      username: wpStatus.siteName,
      error: wpStatus.error,
    };
  }

  // Twitterアカウントの場合
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

/**
 * WordPressに投稿
 */
export async function postToWordPress(
  title: string,
  content: string,
  status: 'draft' | 'publish' = 'draft'
): Promise<PostResult> {
  try {
    const creds = getWordPressCredentials();

    if (!creds) {
      return {
        platform: 'wordpress',
        account: 'WordPress',
        success: false,
        error: 'WordPress認証情報が設定されていません',
      };
    }

    const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64');

    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        status,
      }),
    });

    if (response.ok) {
      const post = await response.json();
      return {
        platform: 'wordpress',
        account: 'WordPress',
        success: true,
        id: String(post.id),
      };
    } else {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      return {
        platform: 'wordpress',
        account: 'WordPress',
        success: false,
        error: error.message || response.statusText,
      };
    }
  } catch (error: any) {
    return {
      platform: 'wordpress',
      account: 'WordPress',
      success: false,
      error: error.message,
    };
  }
}

/**
 * WordPressの認証状態確認
 */
export async function checkWordPressStatus(): Promise<{
  connected: boolean;
  siteName?: string;
  error?: string;
}> {
  try {
    const creds = getWordPressCredentials();

    if (!creds) {
      return { connected: false, error: '認証情報未設定' };
    }

    const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64');

    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/users/me`, {
      headers: { 'Authorization': `Basic ${auth}` },
    });

    if (response.ok) {
      const user = await response.json();
      return { connected: true, siteName: user.name };
    } else {
      return { connected: false, error: '認証失敗' };
    }
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

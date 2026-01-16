/**
 * Discord Webhook通知ユーティリティ
 *
 * 社長への通知: 投稿成功、DM獲得、エラーアラート等
 */

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

// 色定義
export const COLORS = {
  SUCCESS: 0x00FF00,  // 緑
  WARNING: 0xFFFF00,  // 黄
  ERROR: 0xFF0000,    // 赤
  INFO: 0x0099FF,     // 青
  DM: 0xFF69B4,       // ピンク（DM獲得）
  MONEY: 0xFFD700,    // ゴールド（収益）
};

/**
 * Discord Webhookに通知を送信
 */
export async function sendDiscordNotification(message: DiscordMessage): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Discord] Webhook URL not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: message.username || '🤖 MIC自動化システム',
        avatar_url: message.avatar_url || 'https://i.imgur.com/4M34hi2.png',
        content: message.content,
        embeds: message.embeds,
      }),
    });

    if (!response.ok) {
      console.error('[Discord] Failed to send notification:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Discord] Error sending notification:', error);
    return false;
  }
}

/**
 * 投稿成功通知
 */
export async function notifyPostSuccess(params: {
  account: string;
  tweetId: string;
  postText: string;
  qualityScore?: number;
  slot?: number;
}) {
  const { account, tweetId, postText, qualityScore, slot } = params;

  const accountNames: Record<string, string> = {
    liver: '@tt_liver（ライバー事務所）',
    chatre1: '@mic_chat_（チャトレ①）',
    chatre2: '@ms_stripchat（チャトレ②）',
  };

  return sendDiscordNotification({
    embeds: [{
      title: '✅ 投稿完了',
      description: postText.length > 200 ? postText.slice(0, 200) + '...' : postText,
      color: COLORS.SUCCESS,
      fields: [
        { name: 'アカウント', value: accountNames[account] || account, inline: true },
        { name: 'スロット', value: slot ? `#${slot}` : '-', inline: true },
        { name: '品質スコア', value: qualityScore ? `${qualityScore}/10` : '-', inline: true },
      ],
      footer: { text: `Tweet ID: ${tweetId}` },
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * DM獲得通知（重要！）
 */
export async function notifyDMReceived(params: {
  account: string;
  fromUser?: string;
  message?: string;
}) {
  const { account, fromUser, message } = params;

  return sendDiscordNotification({
    content: '🎉 **DM獲得！**',
    embeds: [{
      title: '💌 新規DM',
      description: message ? `「${message.slice(0, 100)}...」` : 'DMが届きました',
      color: COLORS.DM,
      fields: [
        { name: 'アカウント', value: account, inline: true },
        { name: '送信者', value: fromUser || '不明', inline: true },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * エラーアラート
 */
export async function notifyError(params: {
  title: string;
  error: string;
  context?: string;
}) {
  const { title, error, context } = params;

  return sendDiscordNotification({
    embeds: [{
      title: `❌ ${title}`,
      description: error,
      color: COLORS.ERROR,
      fields: context ? [{ name: 'コンテキスト', value: context }] : undefined,
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * 日次レポート
 */
export async function notifyDailyReport(params: {
  totalPosts: number;
  successPosts: number;
  dmCount: number;
  impressions: number;
  topPost?: { text: string; score: number };
}) {
  const { totalPosts, successPosts, dmCount, impressions, topPost } = params;
  const successRate = totalPosts > 0 ? Math.round((successPosts / totalPosts) * 100) : 0;

  return sendDiscordNotification({
    embeds: [{
      title: '📊 本日のレポート',
      color: COLORS.INFO,
      fields: [
        { name: '投稿数', value: `${successPosts}/${totalPosts}件`, inline: true },
        { name: '成功率', value: `${successRate}%`, inline: true },
        { name: 'DM獲得', value: `${dmCount}件`, inline: true },
        { name: 'インプレッション', value: impressions.toLocaleString(), inline: true },
      ],
      footer: topPost ? { text: `🏆 Best: ${topPost.text.slice(0, 50)}... (Score: ${topPost.score})` } : undefined,
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * システムステータス
 */
export async function notifySystemStatus(params: {
  status: 'online' | 'offline' | 'warning';
  message: string;
  details?: string;
}) {
  const { status, message, details } = params;

  const statusEmoji = {
    online: '🟢',
    offline: '🔴',
    warning: '🟡',
  };

  const color = {
    online: COLORS.SUCCESS,
    offline: COLORS.ERROR,
    warning: COLORS.WARNING,
  };

  return sendDiscordNotification({
    embeds: [{
      title: `${statusEmoji[status]} システムステータス`,
      description: message,
      color: color[status],
      fields: details ? [{ name: '詳細', value: details }] : undefined,
      timestamp: new Date().toISOString(),
    }],
  });
}

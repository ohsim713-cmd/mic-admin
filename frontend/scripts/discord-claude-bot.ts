/**
 * Discord Claude Bot with Obsidian Integration
 *
 * iPhoneからDiscordで壁打ちし、Obsidianに自動保存
 *
 * 使い方:
 *   npx ts-node scripts/discord-claude-bot.ts
 *
 * 環境変数:
 *   DISCORD_BOT_TOKEN - Discord Bot Token
 *   ANTHROPIC_API_KEY - Claude API Key
 *   OBSIDIAN_VAULT_PATH - Obsidian Vault Path
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { Client, GatewayIntentBits, Message, TextChannel, Partials } from 'discord.js';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';

// ========== Configuration ==========

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OBSIDIAN_VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || 'C:\\Users\\user\\Documents\\Obsidian\\SecondBrain';

if (!DISCORD_BOT_TOKEN) {
  console.error('Error: DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is required');
  process.exit(1);
}

// ========== Types ==========

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Session {
  channelId: string;
  messages: ConversationMessage[];
  startedAt: Date;
  lastActivity: Date;
}

// ========== State ==========

const sessions: Map<string, Session> = new Map();
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ========== Discord Client ==========

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ========== Claude API ==========

async function sendToClaude(messages: ConversationMessage[]): Promise<string> {
  try {
    const formattedMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `あなたはプログラミングと開発のアシスタントです。
日本語で回答してください。
コードを書く際は適切なコメントを付けてください。
質問が曖昧な場合は確認してください。`,
      messages: formattedMessages,
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return 'レスポンスを処理できませんでした。';
  } catch (error) {
    console.error('[Claude] API Error:', error);
    throw error;
  }
}

// ========== Obsidian Integration ==========

async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Directory exists
  }
}

function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

async function saveToObsidian(session: Session, channelName: string): Promise<string> {
  const chatsDir = path.join(OBSIDIAN_VAULT_PATH, '01 - Projects', 'charged-tyson', 'Chats');
  await ensureDirectory(chatsDir);

  const date = formatDate(session.startedAt);
  const safeChannelName = channelName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF-]/g, '_');
  const filename = `${date}-${safeChannelName}-${session.startedAt.getTime()}.md`;
  const filePath = path.join(chatsDir, filename);

  let markdown = `# 💬 Discord Chat: ${channelName}\n\n`;
  markdown += `## メタデータ\n`;
  markdown += `- **日時**: ${date} ${formatTime(session.startedAt)}\n`;
  markdown += `- **チャンネル**: ${channelName}\n`;
  markdown += `- **メッセージ数**: ${session.messages.length}\n\n`;
  markdown += `## 会話内容\n\n`;

  for (const msg of session.messages) {
    const emoji = msg.role === 'user' ? '🧑' : '🤖';
    const name = msg.role === 'user' ? 'User' : 'Claude';
    const time = formatTime(msg.timestamp);

    markdown += `### ${emoji} ${name} (${time})\n`;
    markdown += `${msg.content}\n\n`;
  }

  markdown += `---\n`;
  markdown += `*Saved from Discord Claude Bot*\n`;

  await fs.writeFile(filePath, markdown, 'utf-8');
  console.log(`[Obsidian] Saved: ${filePath}`);

  return filePath;
}

// ========== Session Management ==========

function getOrCreateSession(channelId: string): Session {
  let session = sessions.get(channelId);
  if (!session) {
    session = {
      channelId,
      messages: [],
      startedAt: new Date(),
      lastActivity: new Date(),
    };
    sessions.set(channelId, session);
  }
  return session;
}

function clearSession(channelId: string): void {
  sessions.delete(channelId);
}

// ========== Message Handlers ==========

async function handleMessage(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  const content = message.content.trim();

  // Handle commands
  if (content.startsWith('/')) {
    await handleCommand(message, content);
    return;
  }

  // Normal conversation
  const session = getOrCreateSession(message.channelId);

  // Add user message
  session.messages.push({
    role: 'user',
    content,
    timestamp: new Date(),
  });
  session.lastActivity = new Date();

  // Show typing indicator
  const channel = message.channel as TextChannel;
  await channel.sendTyping();

  try {
    // Get Claude response
    const response = await sendToClaude(session.messages);

    // Add assistant message
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });

    // Send response (split if too long)
    const maxLength = 2000;
    if (response.length <= maxLength) {
      await message.reply(response);
    } else {
      // Split into chunks
      const chunks = [];
      let remaining = response;
      while (remaining.length > 0) {
        chunks.push(remaining.slice(0, maxLength));
        remaining = remaining.slice(maxLength);
      }
      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          await message.reply(chunks[i]);
        } else {
          await channel.send(chunks[i]);
        }
      }
    }
  } catch (error) {
    console.error('[Bot] Error:', error);
    await message.reply('エラーが発生しました。もう一度試してください。');
  }
}

async function handleCommand(message: Message, content: string): Promise<void> {
  const [command, ...args] = content.slice(1).split(' ');

  switch (command.toLowerCase()) {
    case 'save': {
      const session = sessions.get(message.channelId);
      if (!session || session.messages.length === 0) {
        await message.reply('保存する会話がありません。');
        return;
      }

      const channel = message.channel as TextChannel;
      const channelName = channel.name || 'dm';

      try {
        const filePath = await saveToObsidian(session, channelName);
        await message.reply(`✅ Obsidianに保存しました: ${path.basename(filePath)}`);
      } catch (error) {
        console.error('[Bot] Save error:', error);
        await message.reply('保存に失敗しました。');
      }
      break;
    }

    case 'clear': {
      clearSession(message.channelId);
      await message.reply('✅ 会話履歴をクリアしました。');
      break;
    }

    case 'help': {
      const helpText = `
**Discord Claude Bot コマンド**

\`/save\` - 現在の会話をObsidianに保存
\`/clear\` - 会話履歴をクリア
\`/help\` - このヘルプを表示
\`/status\` - ボットの状態を表示

普通にメッセージを送ると、Claudeが返答します。
      `.trim();
      await message.reply(helpText);
      break;
    }

    case 'status': {
      const session = sessions.get(message.channelId);
      const messageCount = session?.messages.length || 0;
      const statusText = `
**Bot Status**
- Sessions: ${sessions.size}
- Current channel messages: ${messageCount}
- Obsidian vault: ${OBSIDIAN_VAULT_PATH}
      `.trim();
      await message.reply(statusText);
      break;
    }

    default:
      await message.reply(`不明なコマンド: \`/${command}\`\n\`/help\` でコマンド一覧を確認できます。`);
  }
}

// ========== Event Handlers ==========

client.once('ready', () => {
  console.log(`[Bot] Logged in as ${client.user?.tag}`);
  console.log(`[Bot] Obsidian vault: ${OBSIDIAN_VAULT_PATH}`);
  console.log('[Bot] Ready to receive messages!');
});

client.on('messageCreate', async (message) => {
  try {
    await handleMessage(message);
  } catch (error) {
    console.error('[Bot] Message handling error:', error);
  }
});

// ========== Auto-save on idle ==========

const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

setInterval(async () => {
  const now = Date.now();

  for (const [channelId, session] of sessions.entries()) {
    const idleTime = now - session.lastActivity.getTime();

    if (idleTime > IDLE_TIMEOUT && session.messages.length > 0) {
      console.log(`[Bot] Auto-saving idle session: ${channelId}`);

      try {
        // Try to get channel name
        const channel = await client.channels.fetch(channelId);
        const channelName = (channel as TextChannel)?.name || 'dm';

        await saveToObsidian(session, channelName);
        clearSession(channelId);
      } catch (error) {
        console.error('[Bot] Auto-save error:', error);
      }
    }
  }
}, 60 * 1000); // Check every minute

// ========== Start ==========

console.log('[Bot] Starting Discord Claude Bot...');
client.login(DISCORD_BOT_TOKEN);

/**
 * Discord Gemini Bot - 壁打ち用
 *
 * iPhoneからDiscordでGeminiと壁打ち
 *
 * 使い方:
 *   npx tsx scripts/discord-gemini-bot.ts
 *
 * 環境変数:
 *   DISCORD_BOT_TOKEN - Discord Bot Token
 *   GEMINI_API_KEY - Gemini API Key
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { Client, GatewayIntentBits, Message, TextChannel, Partials } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ========== Configuration ==========

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 壁打ち用チャンネル（「一般」チャンネルのID、または名前で判定）
const ALLOWED_CHANNEL_NAMES = ['一般', 'general', '壁打ち', 'gemini'];

if (!DISCORD_BOT_TOKEN) {
  console.error('Error: DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is required');
  process.exit(1);
}

// ========== Types ==========

interface ConversationMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface Session {
  channelId: string;
  history: ConversationMessage[];
  lastActivity: Date;
}

// ========== State ==========

const sessions: Map<string, Session> = new Map();
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Gemini 3 Flash Preview (壁打ち向け)
const model = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',  // 壁打ち用
});

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

// ========== Gemini API ==========

async function sendToGemini(history: ConversationMessage[], newMessage: string): Promise<string> {
  try {
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 4096,
      },
    });

    const result = await chat.sendMessage(newMessage);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('[Gemini] API Error:', error);
    throw error;
  }
}

// ========== Session Management ==========

function getOrCreateSession(channelId: string): Session {
  let session = sessions.get(channelId);
  if (!session) {
    session = {
      channelId,
      history: [],
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

  // Check if channel is allowed
  const channel = message.channel as TextChannel;
  const channelName = channel.name?.toLowerCase() || '';

  console.log(`[Gemini] Message received in channel: "${channelName}" from ${message.author.tag}`);

  const isAllowed = ALLOWED_CHANNEL_NAMES.some(name =>
    channelName.includes(name.toLowerCase())
  );

  // Also allow DMs
  const isDM = !channel.name;

  console.log(`[Gemini] Channel allowed: ${isAllowed}, isDM: ${isDM}`);

  if (!isAllowed && !isDM) return;

  const content = message.content.trim();

  // Handle commands
  if (content.startsWith('/')) {
    await handleCommand(message, content);
    return;
  }

  // Normal conversation
  const session = getOrCreateSession(message.channelId);

  console.log(`[Gemini] Processing message: "${content.substring(0, 50)}..."`);

  // Show typing indicator
  await channel.sendTyping();

  try {
    // Get Gemini response
    console.log('[Gemini] Calling Gemini API...');
    const response = await sendToGemini(session.history, content);
    console.log(`[Gemini] Response received: ${response.substring(0, 50)}...`);

    // Add to history
    session.history.push({
      role: 'user',
      parts: [{ text: content }],
    });
    session.history.push({
      role: 'model',
      parts: [{ text: response }],
    });
    session.lastActivity = new Date();

    // Keep history manageable (last 20 exchanges)
    if (session.history.length > 40) {
      session.history = session.history.slice(-40);
    }

    // Send response (split if too long)
    const maxLength = 2000;
    if (response.length <= maxLength) {
      await message.reply(response);
    } else {
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
  const [command] = content.slice(1).split(' ');

  switch (command.toLowerCase()) {
    case 'clear':
    case 'reset': {
      clearSession(message.channelId);
      await message.reply('✅ 会話履歴をクリアしました。');
      break;
    }

    case 'help': {
      const helpText = `
**Gemini 壁打ちBot**

普通にメッセージを送ると、Geminiが返答します。

**コマンド:**
\`/clear\` - 会話履歴をクリア
\`/help\` - このヘルプを表示
\`/status\` - ステータス表示

**対応チャンネル:** 一般, general, 壁打ち, gemini, DM
      `.trim();
      await message.reply(helpText);
      break;
    }

    case 'status': {
      const session = sessions.get(message.channelId);
      const messageCount = session?.history.length || 0;
      const statusText = `
**Gemini Bot Status**
- Model: gemini-3-flash-preview
- Sessions: ${sessions.size}
- Current history: ${messageCount} messages
      `.trim();
      await message.reply(statusText);
      break;
    }

    default:
      // Don't reply to unknown commands, might be for ClawdBot
      break;
  }
}

// ========== Event Handlers ==========

client.once('ready', () => {
  console.log(`[Gemini Bot] Logged in as ${client.user?.tag}`);
  console.log(`[Gemini Bot] Listening on channels: ${ALLOWED_CHANNEL_NAMES.join(', ')}`);
  console.log('[Gemini Bot] Ready!');
});

client.on('messageCreate', async (message) => {
  try {
    await handleMessage(message);
  } catch (error) {
    console.error('[Bot] Message handling error:', error);
  }
});

// ========== Auto-clear old sessions ==========

setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 30 * 60 * 1000; // 30 minutes

  for (const [channelId, session] of sessions.entries()) {
    if (now - session.lastActivity.getTime() > TIMEOUT) {
      console.log(`[Gemini Bot] Clearing idle session: ${channelId}`);
      sessions.delete(channelId);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// ========== Start ==========

console.log('[Gemini Bot] Starting...');
client.login(DISCORD_BOT_TOKEN);

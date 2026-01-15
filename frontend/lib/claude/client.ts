/**
 * Claude API クライアント
 */

import Anthropic from '@anthropic-ai/sdk';

let claudeClient: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!claudeClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY が設定されていません');
    }
    claudeClient = new Anthropic({ apiKey });
  }
  return claudeClient;
}

// モデル定義
export const CLAUDE_MODELS = {
  // 最高品質（複雑な判断）
  opus: 'claude-opus-4-5-20250514',
  // バランス型（推奨）
  sonnet: 'claude-sonnet-4-20250514',
  // 高速・低コスト
  haiku: 'claude-3-5-haiku-20241022',
} as const;

export type ClaudeModel = keyof typeof CLAUDE_MODELS;

/**
 * Claude でメッセージを送信
 */
export async function sendClaudeMessage(
  prompt: string,
  options: {
    model?: ClaudeModel;
    maxTokens?: number;
    temperature?: number;
    system?: string;
  } = {}
): Promise<string> {
  const client = getClaudeClient();
  const {
    model = 'sonnet',
    maxTokens = 2048,
    temperature = 0.7,
    system,
  } = options;

  const response = await client.messages.create({
    model: CLAUDE_MODELS[model],
    max_tokens: maxTokens,
    temperature,
    ...(system && { system }),
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude からのレスポンスにテキストがありません');
  }

  return textBlock.text;
}

/**
 * Claude でストリーミング
 */
export async function* streamClaudeMessage(
  prompt: string,
  options: {
    model?: ClaudeModel;
    maxTokens?: number;
    temperature?: number;
    system?: string;
  } = {}
): AsyncGenerator<string> {
  const client = getClaudeClient();
  const {
    model = 'sonnet',
    maxTokens = 2048,
    temperature = 0.7,
    system,
  } = options;

  const stream = await client.messages.create({
    model: CLAUDE_MODELS[model],
    max_tokens: maxTokens,
    temperature,
    stream: true,
    ...(system && { system }),
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

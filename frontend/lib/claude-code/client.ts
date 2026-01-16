/**
 * Claude SDK クライアント（Agent機能付き）
 *
 * Anthropic SDKを使ってClaudeでコード生成・レビュー・修正
 * + Claude Code CLIをサブプロセスで実行
 */

import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';

// Claude SDKの設定
const CLAUDE_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
};

// Anthropic クライアント
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// ========== Claude API ==========

/**
 * Claudeでタスクを実行
 */
export async function runClaudeCodeTask(
  prompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<{
  success: boolean;
  result: string;
  messages: Array<{ role: string; content: string }>;
}> {
  try {
    const client = getClient();

    const response = await client.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: options?.maxTokens || CLAUDE_CONFIG.maxTokens,
      temperature: options?.temperature ?? 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const resultText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return {
      success: true,
      result: resultText,
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: resultText },
      ],
    };
  } catch (error: any) {
    console.error('[Claude] Error:', error);
    return {
      success: false,
      result: error.message || 'Unknown error',
      messages: [],
    };
  }
}

/**
 * Claude Code CLIを実行（サブプロセス）
 */
export async function runClaudeCodeCLI(
  prompt: string,
  options?: {
    workingDirectory?: string;
    timeout?: number;
  }
): Promise<{
  success: boolean;
  output: string;
}> {
  return new Promise((resolve) => {
    const timeout = options?.timeout || 120000;
    const cwd = options?.workingDirectory || process.cwd();

    const proc = spawn('npx', ['claude', '-p', prompt], {
      cwd,
      shell: true,
      timeout,
    });

    let output = '';
    let errorOutput = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output || errorOutput,
      });
    });

    proc.on('error', (error) => {
      resolve({
        success: false,
        output: error.message,
      });
    });
  });
}

/**
 * コード生成タスク
 */
export async function generateCode(
  description: string,
  language: string = 'typescript'
): Promise<string> {
  const prompt = `Generate ${language} code for the following:

${description}

Only output the code, no explanations.`;

  const result = await runClaudeCodeTask(prompt);
  return result.result;
}

/**
 * コードレビュー
 */
export async function reviewCode(
  code: string,
  language: string = 'typescript'
): Promise<{
  score: number;
  issues: string[];
  suggestions: string[];
}> {
  const prompt = `Review this ${language} code and provide feedback:

\`\`\`${language}
${code}
\`\`\`

Output JSON with: { "score": 1-10, "issues": [], "suggestions": [] }`;

  const result = await runClaudeCodeTask(prompt);

  try {
    const jsonMatch = result.result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // パース失敗
  }

  return { score: 0, issues: ['Failed to parse review'], suggestions: [] };
}

/**
 * バグ修正
 */
export async function fixBug(
  code: string,
  errorMessage: string,
  language: string = 'typescript'
): Promise<string> {
  const prompt = `Fix this bug in the ${language} code:

Error: ${errorMessage}

Code:
\`\`\`${language}
${code}
\`\`\`

Output only the fixed code.`;

  const result = await runClaudeCodeTask(prompt);
  return result.result;
}

/**
 * テスト生成
 */
export async function generateTests(
  code: string,
  framework: string = 'jest'
): Promise<string> {
  const prompt = `Generate ${framework} tests for this code:

\`\`\`typescript
${code}
\`\`\`

Output only the test code.`;

  const result = await runClaudeCodeTask(prompt);
  return result.result;
}

// ========== ユーティリティ ==========

/**
 * Claude SDKの設定確認
 */
export function checkClaudeCodeConfig(): {
  available: boolean;
  apiKey: boolean;
} {
  return {
    available: true,
    apiKey: !!process.env.ANTHROPIC_API_KEY,
  };
}

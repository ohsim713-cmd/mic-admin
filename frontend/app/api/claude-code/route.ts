/**
 * Claude Code API
 *
 * POST: Claude Codeでタスクを実行
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runClaudeCodeTask,
  generateCode,
  reviewCode,
  fixBug,
  generateTests,
  checkClaudeCodeConfig,
} from '@/lib/claude-code/client';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, prompt, code, language, errorMessage, framework } = body;

    // 設定確認
    const config = checkClaudeCodeConfig();
    if (!config.apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    let result: any;

    switch (action) {
      case 'run':
        // 汎用タスク実行
        result = await runClaudeCodeTask(prompt);
        break;

      case 'generate':
        // コード生成
        result = { code: await generateCode(prompt, language) };
        break;

      case 'review':
        // コードレビュー
        result = await reviewCode(code, language);
        break;

      case 'fix':
        // バグ修正
        result = { code: await fixBug(code, errorMessage, language) };
        break;

      case 'test':
        // テスト生成
        result = { tests: await generateTests(code, framework) };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: run, generate, review, fix, test' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
    });
  } catch (error: any) {
    console.error('[Claude Code API] Error:', error);
    return NextResponse.json(
      { error: 'Claude Code execution failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const config = checkClaudeCodeConfig();

  return NextResponse.json({
    service: 'Claude Code SDK',
    status: config.apiKey ? 'ready' : 'not configured',
    actions: ['run', 'generate', 'review', 'fix', 'test'],
    usage: {
      run: 'POST { action: "run", prompt: "..." }',
      generate: 'POST { action: "generate", prompt: "description", language: "typescript" }',
      review: 'POST { action: "review", code: "...", language: "typescript" }',
      fix: 'POST { action: "fix", code: "...", errorMessage: "...", language: "typescript" }',
      test: 'POST { action: "test", code: "...", framework: "jest" }',
    },
  });
}

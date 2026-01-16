/**
 * Claude Agent API
 *
 * POST: エージェントでタスクを実行
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runAgent,
  generateCodeWithAgent,
  reviewCodeWithAgent,
  fixBugWithAgent,
  runTestsWithAgent,
  runSNSPostingAgent,
  checkAgentConfig,
  analyzeWithHaiku,
  analyzeLocalData,
  runKnowledgeLearningAgent,
  runPerformanceAnalysisAgent,
  runAutoPDCAAgent,
} from '@/lib/claude-agent/client';
import fs from 'fs';
import path from 'path';

export const maxDuration = 300; // 5分

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      prompt,
      filePath,
      errorDescription,
      testCommand,
      accountType,
      count,
      options,
    } = body;

    // 設定確認
    const config = checkAgentConfig();
    if (!config.available) {
      return NextResponse.json(
        { error: config.message },
        { status: 500 }
      );
    }

    let result;

    switch (action) {
      case 'run':
        // 汎用タスク実行
        result = await runAgent(prompt, options);
        break;

      case 'generate-code':
        // コード生成
        result = await generateCodeWithAgent(prompt, options);
        break;

      case 'review':
        // コードレビュー
        if (!filePath) {
          return NextResponse.json(
            { error: 'filePath is required for review action' },
            { status: 400 }
          );
        }
        result = await reviewCodeWithAgent(filePath);
        break;

      case 'fix-bug':
        // バグ修正
        if (!filePath || !errorDescription) {
          return NextResponse.json(
            { error: 'filePath and errorDescription are required for fix-bug action' },
            { status: 400 }
          );
        }
        result = await fixBugWithAgent(filePath, errorDescription);
        break;

      case 'test':
        // テスト実行
        result = await runTestsWithAgent(testCommand);
        break;

      case 'sns-generate':
        // SNS投稿生成
        result = await runSNSPostingAgent({
          accountType: accountType || 'liver',
          action: 'generate',
          count: count || 5,
        });
        break;

      case 'sns-post':
        // SNS投稿
        result = await runSNSPostingAgent({
          accountType: accountType || 'liver',
          action: 'post',
        });
        break;

      case 'sns-analyze':
        // SNS分析（Agent SDK使用 - 高コスト）
        result = await runSNSPostingAgent({
          accountType: accountType || 'liver',
          action: 'analyze',
        });
        break;

      case 'analyze-haiku':
        // 低コスト分析（Haiku使用 - 約$0.001/回）
        {
          const { data, analysisType } = body;
          if (!data) {
            return NextResponse.json(
              { error: 'data is required for analyze-haiku action' },
              { status: 400 }
            );
          }
          const haikuResult = await analyzeWithHaiku(
            typeof data === 'string' ? data : JSON.stringify(data),
            analysisType || 'performance'
          );
          return NextResponse.json({
            success: haikuResult.success,
            action: 'analyze-haiku',
            result: haikuResult.result,
            insights: haikuResult.insights,
            costUSD: haikuResult.costUSD,
          });
        }

      case 'analyze-local':
        // ローカル分析（APIコストゼロ）
        {
          // post_stock.jsonから投稿データを読み込み
          const stockPath = path.join(process.cwd(), 'data', 'post_stock.json');
          let posts: any[] = [];
          try {
            if (fs.existsSync(stockPath)) {
              const stockData = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
              posts = stockData.stocks || [];
            }
          } catch {
            // ファイル読み込み失敗
          }
          const localResult = analyzeLocalData(posts);
          return NextResponse.json({
            success: true,
            action: 'analyze-local',
            result: localResult,
            costUSD: 0,
          });
        }

      // ========== ハイブリッドワークフロー（Gemini + Agent SDK） ==========

      case 'learn-knowledge':
        // ナレッジ学習エージェント（Agent SDK + Haiku）
        {
          const { focusArea } = body;
          result = await runKnowledgeLearningAgent({
            focusArea: focusArea || 'all',
          });
        }
        break;

      case 'performance-analysis':
        // パフォーマンス分析エージェント（Agent SDK + Haiku）
        {
          const { period } = body;
          result = await runPerformanceAnalysisAgent({
            period: period || 'week',
          });
        }
        break;

      case 'auto-pdca':
        // 自動PDCA（Gemini生成 → Agent SDK評価）
        {
          const { postData } = body;
          if (!postData || !postData.text) {
            return NextResponse.json(
              { error: 'postData with text is required for auto-pdca action' },
              { status: 400 }
            );
          }
          result = await runAutoPDCAAgent(postData);
        }
        break;

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            validActions: [
              'run',
              'generate-code',
              'review',
              'fix-bug',
              'test',
              'sns-generate',
              'sns-post',
              'sns-analyze',
              'analyze-haiku',
              'analyze-local',
              'learn-knowledge',
              'performance-analysis',
              'auto-pdca',
            ],
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: result.success,
      action,
      result: result.result,
      usage: result.usage,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Agent API] Error:', error);
    return NextResponse.json(
      { error: 'Agent execution failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const config = checkAgentConfig();

  return NextResponse.json({
    service: 'Claude Agent SDK',
    status: config.available ? 'ready' : 'not available',
    message: config.message,
    actions: {
      run: 'POST { action: "run", prompt: "...", options?: {} }',
      'generate-code': 'POST { action: "generate-code", prompt: "description", options?: { language, outputPath } }',
      review: 'POST { action: "review", filePath: "..." }',
      'fix-bug': 'POST { action: "fix-bug", filePath: "...", errorDescription: "..." }',
      test: 'POST { action: "test", testCommand?: "npm test" }',
      'sns-generate': 'POST { action: "sns-generate", accountType: "liver"|"chatlady", count?: 5 }',
      'sns-post': 'POST { action: "sns-post", accountType: "liver"|"chatlady" }',
      'sns-analyze': 'POST { action: "sns-analyze", accountType: "liver"|"chatlady" }',
    },
    capabilities: [
      'Autonomous task execution',
      'File read/write/edit',
      'Command execution',
      'Code generation & review',
      'Bug fixing',
      'Test running',
      'SNS automation',
    ],
  });
}

/**
 * Persistent Post Generation API
 * 粘り強い投稿生成（Claude Code風）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateWithPersistence,
  generateHighQualityPost,
  generateNormalPost,
  generateQuickPost,
  PersistentGenerationConfig,
} from '@/lib/langgraph/persistent-generator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      account = 'liver',
      accountType = 'ライバー',
      target,
      benefit,
      mode = 'normal', // 'quick' | 'normal' | 'high_quality' | 'custom'
      config,         // カスタム設定（modeがcustomの場合）
    } = body;

    let result;

    switch (mode) {
      case 'quick':
        // 高速モード（速度優先）
        result = await generateQuickPost(account, accountType, target, benefit);
        break;

      case 'high_quality':
        // 高品質モード（粘り強く高スコアを狙う）
        result = await generateHighQualityPost(account, accountType, target, benefit);
        break;

      case 'custom':
        // カスタムモード
        const customConfig: Partial<PersistentGenerationConfig> = {
          minScore: config?.minScore || 10,
          maxAttempts: config?.maxAttempts || 5,
          maxStrategies: config?.maxStrategies || 3,
          candidatesPerAttempt: config?.candidatesPerAttempt || 3,
          escalateCandidates: config?.escalateCandidates ?? true,
          verbose: config?.verbose ?? false,
        };
        result = await generateWithPersistence(account, accountType, target, benefit, customConfig);
        break;

      default:
        // 通常モード
        result = await generateNormalPost(account, accountType, target, benefit);
    }

    return NextResponse.json({
      success: result.success,
      post: {
        text: result.text,
        target: result.target,
        benefit: result.benefit,
        score: result.score,
      },
      generation: {
        attempts: result.attempts,
        strategiesUsed: result.strategiesUsed,
        totalCandidates: result.totalCandidates,
        failureHistory: result.failureHistory.map(f => ({
          attempt: f.attempt,
          score: f.score,
          primaryIssue: f.diagnosis.primaryFailure,
          strategy: f.strategy,
        })),
      },
      finalDiagnosis: result.finalDiagnosis ? {
        primaryFailure: result.finalDiagnosis.primaryFailure,
        severity: result.finalDiagnosis.severity,
        issues: result.finalDiagnosis.specificIssues,
      } : null,
    });

  } catch (error) {
    console.error('[Persistent Generate API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// 使い方
export async function GET() {
  return NextResponse.json({
    description: '粘り強い投稿生成API（Claude Code風）',
    modes: {
      quick: {
        description: '高速モード - 速度優先',
        minScore: 8,
        maxAttempts: 3,
      },
      normal: {
        description: '通常モード - バランス重視',
        minScore: 10,
        maxAttempts: 5,
      },
      high_quality: {
        description: '高品質モード - 粘り強く高スコアを狙う',
        minScore: 12,
        maxAttempts: 7,
      },
      custom: {
        description: 'カスタムモード - 設定をカスタマイズ',
        configOptions: {
          minScore: 'number (目標スコア)',
          maxAttempts: 'number (最大試行回数)',
          maxStrategies: 'number (試す戦略の数)',
          candidatesPerAttempt: 'number (1回あたりの候補数)',
          escalateCandidates: 'boolean (失敗時に候補数を増やすか)',
        },
      },
    },
    example: {
      request: {
        account: 'liver',
        accountType: 'ライバー',
        mode: 'high_quality',
      },
      response: {
        success: true,
        post: { text: '...', score: { total: 12 } },
        generation: {
          attempts: 3,
          strategiesUsed: ['default', 'story_driven', 'confession'],
          totalCandidates: 11,
        },
      },
    },
  });
}

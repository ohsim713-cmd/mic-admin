/**
 * オーケストレーター API
 *
 * CEOの指示を受けて、サブエージェント（CMO/COO/Creative）が自動連携
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  orchestrate,
  learnFromCEO,
  directCommand,
  cmoAnalyze,
  creativeGenerate,
  cooReview,
} from '@/lib/agent/sub-agents';

export const maxDuration = 180; // 最大3分（複数エージェント連携のため）

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, directive, insight, agent, command, context, content, count } = body;

    // フルパイプライン実行（CEO指示 → CMO → Creative → COO）
    if (action === 'execute' || (!action && directive)) {
      if (!directive) {
        return NextResponse.json(
          { error: 'directive が必要です' },
          { status: 400 }
        );
      }

      console.log('[Orchestrate API] Executing full pipeline:', directive);
      const result = await orchestrate(directive, {
        maxRetries: 2,
        autoSave: true,
      });

      return NextResponse.json(result);
    }

    // CEOの気づきを学習
    if (action === 'learn') {
      if (!insight) {
        return NextResponse.json(
          { error: 'insight が必要です' },
          { status: 400 }
        );
      }

      console.log('[Orchestrate API] Learning from CEO insight:', insight);
      const result = await learnFromCEO(insight);

      return NextResponse.json(result);
    }

    // 特定エージェントへの直接指示
    if (action === 'direct') {
      if (!agent || !command) {
        return NextResponse.json(
          { error: 'agent と command が必要です' },
          { status: 400 }
        );
      }

      console.log('[Orchestrate API] Direct command to:', agent);
      const result = await directCommand(agent, command, context);

      return NextResponse.json(result);
    }

    // CMOのみ実行
    if (action === 'cmo') {
      const result = await cmoAnalyze(directive || 'SNSマーケティング戦略を分析');
      return NextResponse.json(result);
    }

    // Creativeのみ実行
    if (action === 'creative') {
      const result = await creativeGenerate(content || '高品質な投稿を生成', count || 3);
      return NextResponse.json(result);
    }

    // COOのみ実行
    if (action === 'coo') {
      if (!content) {
        return NextResponse.json(
          { error: 'content（レビュー対象）が必要です' },
          { status: 400 }
        );
      }
      const result = await cooReview(content);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'action が必要です (execute, learn, direct, cmo, creative, coo)' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Orchestrate API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

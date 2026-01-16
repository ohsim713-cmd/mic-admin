/**
 * コピー改善・バリエーション生成API
 *
 * POST actions:
 * - improve: 単一コピーの改善
 * - variations: 幅広いバリエーション生成
 * - improve-all: 低スコア投稿の一括改善
 *
 * GET: 利用可能なスタイル一覧
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  improveCopy,
  generateVariations,
  improveLowScorePosts,
  getAvailableStyles,
} from '@/lib/analytics/copy-improver';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, text, target, benefit, score, count = 5, styles, threshold = 8 } = body;

    switch (action) {
      case 'improve': {
        // 単一コピーの改善
        if (!text) {
          return NextResponse.json(
            { error: 'text が必要です' },
            { status: 400 }
          );
        }
        const improvement = await improveCopy(text, { target, benefit, score });
        return NextResponse.json({
          success: true,
          action: 'improve',
          result: improvement,
        });
      }

      case 'variations': {
        // 幅広いバリエーション生成
        if (!target || !benefit) {
          return NextResponse.json(
            { error: 'target と benefit が必要です' },
            { status: 400 }
          );
        }
        const variations = await generateVariations({
          baseText: text,
          target,
          benefit,
          count,
          styles,
        });
        return NextResponse.json({
          success: true,
          action: 'variations',
          count: variations.length,
          variations,
        });
      }

      case 'improve-all': {
        // 低スコア投稿の一括改善
        const result = await improveLowScorePosts(threshold);
        return NextResponse.json({
          success: true,
          action: 'improve-all',
          improved: result.improved.length,
          skipped: result.skipped,
          results: result.improved,
        });
      }

      default: {
        // デフォルト: バリエーション生成
        if (target && benefit) {
          const variations = await generateVariations({
            baseText: text,
            target,
            benefit,
            count: count || 5,
          });
          return NextResponse.json({
            success: true,
            variations,
          });
        }
        return NextResponse.json(
          { error: 'action または target/benefit を指定してください' },
          { status: 400 }
        );
      }
    }
  } catch (error: any) {
    console.error('[Copy API] Error:', error);
    return NextResponse.json(
      { error: 'コピー処理に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const styles = getAvailableStyles();

    return NextResponse.json({
      success: true,
      styles,
      usage: {
        improve: {
          description: '単一コピーの改善提案',
          params: { action: 'improve', text: '投稿文', target: 'ターゲット', benefit: 'ベネフィット', score: '現在のスコア' },
        },
        variations: {
          description: '幅広いバリエーション生成',
          params: { action: 'variations', target: 'ターゲット', benefit: 'ベネフィット', count: '生成数', styles: 'スタイルID配列' },
        },
        'improve-all': {
          description: '低スコア投稿の一括改善',
          params: { action: 'improve-all', threshold: 'スコア閾値（デフォルト8）' },
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

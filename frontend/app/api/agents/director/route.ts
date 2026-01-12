import { NextRequest, NextResponse } from 'next/server';
import { evaluateOpportunity, evaluatePendingOpportunities, generateProductSpec } from '@/lib/agents';

// POST: 機会評価
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, opportunityId } = body;

    switch (action) {
      case 'evaluate': {
        // 単一機会評価
        if (!opportunityId) {
          return NextResponse.json(
            { error: 'opportunityId is required' },
            { status: 400 }
          );
        }

        const result = await evaluateOpportunity(opportunityId);
        if (result) {
          return NextResponse.json({
            success: true,
            message: result.approved ? '機会を承認しました' : '機会を却下しました',
            evaluation: result,
          });
        } else {
          return NextResponse.json(
            { error: 'Evaluation failed' },
            { status: 500 }
          );
        }
      }

      case 'evaluate-all': {
        // 保留中の機会を一括評価
        const result = await evaluatePendingOpportunities();
        return NextResponse.json({
          success: true,
          message: `Evaluated ${result.evaluated} opportunities`,
          ...result,
        });
      }

      case 'generate-spec': {
        // 仕様書生成
        if (!opportunityId) {
          return NextResponse.json(
            { error: 'opportunityId is required' },
            { status: 400 }
          );
        }

        const spec = await generateProductSpec(opportunityId);
        if (spec) {
          return NextResponse.json({
            success: true,
            spec,
          });
        } else {
          return NextResponse.json(
            { error: 'Spec generation failed' },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "evaluate", "evaluate-all", or "generate-spec"' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Request failed', details: String(error) },
      { status: 500 }
    );
  }
}

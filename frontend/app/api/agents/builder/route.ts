import { NextRequest, NextResponse } from 'next/server';
import { buildProduct, buildApprovedOpportunities, getTemplates } from '@/lib/agents';

// GET: テンプレート一覧
export async function GET() {
  try {
    const data = getTemplates();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get templates', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: ビルド実行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'build': {
        // 単一プロダクトビルド
        const { opportunityId, templateId, productName, customizations } = body;

        if (!opportunityId || !templateId || !productName) {
          return NextResponse.json(
            { error: 'opportunityId, templateId, and productName are required' },
            { status: 400 }
          );
        }

        const result = await buildProduct({
          opportunityId,
          templateId,
          productName,
          customizations: customizations || {},
        });

        return NextResponse.json({
          ...result,
          message: result.success ? 'Product built successfully' : result.error,
        });
      }

      case 'build-approved': {
        // 承認済み機会を一括ビルド
        const result = await buildApprovedOpportunities();
        return NextResponse.json({
          success: true,
          message: `Built ${result.built} products`,
          ...result,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "build" or "build-approved"' },
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

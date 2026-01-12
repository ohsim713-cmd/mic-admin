import { NextRequest, NextResponse } from 'next/server';
import { addManualOpportunity, runScheduledHunt, getOpportunities } from '@/lib/agents';

// GET: 機会一覧取得
export async function GET() {
  try {
    const data = getOpportunities();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get opportunities', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: 機会追加 or ハント実行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'hunt': {
        // 定期ハント実行
        const result = await runScheduledHunt();
        return NextResponse.json({
          success: result.success,
          message: `Found ${result.opportunitiesFound} opportunities`,
          data: result,
        });
      }

      case 'add': {
        // 手動で機会追加
        const { title, description, targetAudience, painPoints, keywords } = body;

        if (!title || !description) {
          return NextResponse.json(
            { error: 'Title and description are required' },
            { status: 400 }
          );
        }

        const result = await addManualOpportunity({
          title,
          description,
          targetAudience: targetAudience || '未定義',
          painPoints: painPoints || [],
          keywords: keywords || [],
        });

        if (result.success) {
          return NextResponse.json({
            success: true,
            message: 'Opportunity added',
            opportunity: result.opportunity,
          });
        } else {
          return NextResponse.json(
            { error: result.error },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "hunt" or "add"' },
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

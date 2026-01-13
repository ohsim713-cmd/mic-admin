import { NextRequest, NextResponse } from 'next/server';
import {
  startABTest,
  recordTestResult,
  getCurrentVariant,
  getTestSummary,
  suggestNextTest,
  completeTest,
} from '@/lib/dm-hunter/ab-tester';
import { AccountType } from '@/lib/dm-hunter/sns-adapter';

// GET: テスト状況を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary';
    const account = searchParams.get('account') as AccountType | null;

    if (view === 'summary') {
      const summary = await getTestSummary();
      return NextResponse.json(summary);
    }

    if (view === 'current' && account) {
      const current = await getCurrentVariant(account);
      return NextResponse.json(current);
    }

    if (view === 'suggest' && account) {
      const suggestion = await suggestNextTest(account);
      return NextResponse.json(suggestion);
    }

    // デフォルト
    const summary = await getTestSummary();
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('[AB Test] GET error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// POST: テスト操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // 新規テスト開始
    if (action === 'start') {
      const { account, variantA, variantB, minPostsPerVariant } = params;

      if (!account || !variantA || !variantB) {
        return NextResponse.json({
          error: 'account, variantA, and variantB are required',
        }, { status: 400 });
      }

      try {
        const test = await startABTest({
          account,
          variantA,
          variantB,
          minPostsPerVariant,
        });
        return NextResponse.json({ success: true, test });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          error: e.message,
        }, { status: 400 });
      }
    }

    // 結果を記録
    if (action === 'record') {
      const { account, variant, dm, conversion, score } = params;

      if (!account || !variant) {
        return NextResponse.json({
          error: 'account and variant are required',
        }, { status: 400 });
      }

      const test = await recordTestResult({
        account,
        variant,
        dm,
        conversion,
        score,
      });

      return NextResponse.json({
        success: true,
        test,
      });
    }

    // テストを手動完了
    if (action === 'complete') {
      const { testId } = params;

      if (!testId) {
        return NextResponse.json({
          error: 'testId is required',
        }, { status: 400 });
      }

      const test = await completeTest(testId);

      if (!test) {
        return NextResponse.json({
          error: 'Test not found',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        test,
      });
    }

    // 自動テスト開始（サジェストされた組み合わせで）
    if (action === 'auto-start') {
      const { account } = params;

      if (!account) {
        return NextResponse.json({
          error: 'account is required',
        }, { status: 400 });
      }

      const suggestion = await suggestNextTest(account);

      try {
        const test = await startABTest({
          account,
          variantA: suggestion.variantA,
          variantB: suggestion.variantB,
        });

        return NextResponse.json({
          success: true,
          test,
          reason: suggestion.reason,
        });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          error: e.message,
          suggestion,
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      error: 'Unknown action',
    }, { status: 400 });

  } catch (error: any) {
    console.error('[AB Test] POST error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

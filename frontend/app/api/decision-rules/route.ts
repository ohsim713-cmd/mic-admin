/**
 * 判断ルール状態API
 * GET /api/decision-rules - ルール状態を取得
 * POST /api/decision-rules - ルールを手動実行
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRuleStatus, evaluateAndExecuteRules } from '@/lib/agent/decision-rules';

export async function GET() {
  try {
    const status = getRuleStatus();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...status,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await evaluateAndExecuteRules();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

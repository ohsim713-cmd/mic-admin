/**
 * ログ取得API
 * GET /api/logs - 最近のエラーログと統計を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentErrors, getLogStats } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const recentErrors = getRecentErrors(hours, limit);
    const stats = getLogStats(hours);

    return NextResponse.json({
      success: true,
      period: `${hours}h`,
      stats,
      errors: recentErrors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

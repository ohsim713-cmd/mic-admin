/**
 * DM Hunter - 学習統計API
 * 成功パターンDBの統計情報を返す
 */

import { NextResponse } from 'next/server';
import { getStats } from '@/lib/dm-hunter/success-patterns';

export async function GET() {
  try {
    const stats = await getStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('[Learning Stats] Error:', error);
    return NextResponse.json({
      total: 0,
      avgScore: 0,
      byAccount: { liver: 0, chatre1: 0, chatre2: 0 },
    });
  }
}

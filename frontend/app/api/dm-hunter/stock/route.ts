import { NextRequest, NextResponse } from 'next/server';
import {
  getStockStatus,
  refillStock,
  refillAllStocks,
  getStockDetails,
  deleteStock,
  useFromStock,
  getPostForAccount,
  checkStockLevels,
  STOCK_CONFIG,
} from '@/lib/dm-hunter/post-stock';
import { AccountType } from '@/lib/dm-hunter/sns-adapter';

// GET: ストック状況を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'status';
    const account = searchParams.get('account') as AccountType | null;

    if (view === 'status') {
      const status = await getStockStatus();
      const levels = await checkStockLevels();
      return NextResponse.json({
        ...status,
        config: STOCK_CONFIG,
        levels,
      });
    }

    if (view === 'details') {
      const stocks = await getStockDetails(account || undefined);
      return NextResponse.json({ stocks });
    }

    if (view === 'check') {
      const levels = await checkStockLevels();
      return NextResponse.json(levels);
    }

    // デフォルト
    const status = await getStockStatus();
    return NextResponse.json(status);

  } catch (error: any) {
    console.error('[Stock] GET error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// POST: ストック操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // 全アカウント補充
    if (action === 'refill-all') {
      const result = await refillAllStocks();
      const status = await getStockStatus();
      return NextResponse.json({
        success: true,
        ...result,
        status,
      });
    }

    // 特定アカウント補充
    if (action === 'refill') {
      const { account } = params;
      if (!account || !['liver', 'chatre1', 'chatre2'].includes(account)) {
        return NextResponse.json({
          error: 'Invalid account',
        }, { status: 400 });
      }

      const result = await refillStock(account);
      return NextResponse.json({
        success: true,
        account,
        ...result,
      });
    }

    // ストックから取得
    if (action === 'use') {
      const { account } = params;
      if (!account || !['liver', 'chatre1', 'chatre2'].includes(account)) {
        return NextResponse.json({
          error: 'Invalid account',
        }, { status: 400 });
      }

      const post = await useFromStock(account);
      if (!post) {
        return NextResponse.json({
          success: false,
          error: 'No stock available',
        });
      }

      const status = await getStockStatus();
      return NextResponse.json({
        success: true,
        post,
        remainingStock: status.counts[account as 'liver' | 'chatre1' | 'chatre2'],
      });
    }

    // ストックから取得（なければ生成）
    if (action === 'get-post') {
      const { account } = params;
      if (!account || !['liver', 'chatre1', 'chatre2'].includes(account)) {
        return NextResponse.json({
          error: 'Invalid account',
        }, { status: 400 });
      }

      const result = await getPostForAccount(account);
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // ストック削除
    if (action === 'delete') {
      const { stockId } = params;
      if (!stockId) {
        return NextResponse.json({
          error: 'stockId is required',
        }, { status: 400 });
      }

      const success = await deleteStock(stockId);
      return NextResponse.json({ success });
    }

    return NextResponse.json({
      error: 'Unknown action',
    }, { status: 400 });

  } catch (error: any) {
    console.error('[Stock] POST error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

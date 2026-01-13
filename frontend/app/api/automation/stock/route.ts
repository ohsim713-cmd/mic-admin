import { NextRequest, NextResponse } from 'next/server';
import {
  getStockStatus,
  refillStock,
  refillAllStocks,
  getStockDetails,
  STOCK_CONFIG,
} from '@/lib/dm-hunter/post-stock';
import { AccountType, ACCOUNTS } from '@/lib/dm-hunter/sns-adapter';
import { STOCK_CONFIG as NEW_STOCK_CONFIG } from '@/lib/automation/scheduler';

// POST: ストック補充（強化版 - 各アカウント5件維持）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, secret, account } = body;

    // 認証チェック
    const expectedSecret = process.env.AUTO_POST_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 });
    }

    if (action === 'refill-all') {
      console.log('[Stock] Starting full refill (target: 5 per account)...');

      const accounts: AccountType[] = ['liver', 'chatre1', 'chatre2'];
      const results: Record<string, any> = {};
      let totalAdded = 0;

      // 各アカウントを5件まで補充
      for (const acc of accounts) {
        const status = await getStockStatus();
        const currentCount = status.counts[acc] || 0;
        const needed = NEW_STOCK_CONFIG.minStockPerAccount - currentCount;

        if (needed > 0) {
          console.log(`[Stock] ${acc}: ${currentCount} → need ${needed} more`);

          // 必要な分だけ補充
          let added = 0;
          let failed = 0;

          for (let i = 0; i < needed + 2; i++) { // 余分に試行
            const result = await refillStock(acc);
            added += result.added;
            failed += result.failed;

            if (added >= needed) break;
          }

          results[acc] = { added, failed, currentStock: currentCount + added };
          totalAdded += added;
        } else {
          results[acc] = { added: 0, failed: 0, currentStock: currentCount, skipped: true };
        }
      }

      const finalStatus = await getStockStatus();

      return NextResponse.json({
        success: true,
        message: `Added ${totalAdded} posts to stock`,
        results,
        stockStatus: finalStatus.counts,
        target: NEW_STOCK_CONFIG.minStockPerAccount,
      });
    }

    if (action === 'refill' && account) {
      if (!['liver', 'chatre1', 'chatre2'].includes(account)) {
        return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
      }

      const result = await refillStock(account);
      return NextResponse.json({
        success: true,
        account,
        ...result,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error('[Stock] Error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// GET: ストック状況（詳細付き）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'full';

    const status = await getStockStatus();

    if (view === 'counts') {
      return NextResponse.json({
        counts: status.counts,
        total: Object.values(status.counts).reduce((a, b) => a + b, 0),
        target: NEW_STOCK_CONFIG.minStockPerAccount * 3,
      });
    }

    // フル詳細
    const stocksByAccount: Record<string, any[]> = {
      liver: [],
      chatre1: [],
      chatre2: [],
    };

    for (const acc of ['liver', 'chatre1', 'chatre2'] as AccountType[]) {
      stocksByAccount[acc] = await getStockDetails(acc);
    }

    return NextResponse.json({
      counts: status.counts,
      total: Object.values(status.counts).reduce((a, b) => a + b, 0),
      target: {
        perAccount: NEW_STOCK_CONFIG.minStockPerAccount,
        total: NEW_STOCK_CONFIG.minStockPerAccount * 3,
      },
      needsRefill: status.needsRefill,
      stocks: stocksByAccount,
      config: {
        minPerAccount: NEW_STOCK_CONFIG.minStockPerAccount,
        maxPerAccount: NEW_STOCK_CONFIG.maxStockPerAccount,
        refillThreshold: NEW_STOCK_CONFIG.refillThreshold,
      },
      accounts: ACCOUNTS.map(a => ({
        id: a.id,
        name: a.name,
        handle: a.handle,
        count: status.counts[a.id] || 0,
        isLow: (status.counts[a.id] || 0) < NEW_STOCK_CONFIG.refillThreshold,
      })),
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

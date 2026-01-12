// 3号機【顔：Product Dashboard / Monitor】
// プロダクトの稼働監視、メトリクス収集

import { getProducts, updateProductMetrics, setAgentStatus } from './state';
import type { Product, ProductHealth } from './types';

interface HealthCheckResult {
  productId: string;
  status: ProductHealth['status'];
  responseTime?: number;
  error?: string;
  checkedAt: string;
}

interface MonitoringSummary {
  totalProducts: number;
  healthyProducts: number;
  degradedProducts: number;
  downProducts: number;
  totalRevenue: number;
  totalUsers: number;
  checks: HealthCheckResult[];
}

// ヘルスチェック実行
async function checkProductHealth(product: Product): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    productId: product.id,
    status: 'down',
    checkedAt: new Date().toISOString(),
  };

  if (!product.deployUrl) {
    result.error = 'No deploy URL';
    return result;
  }

  try {
    const start = Date.now();
    const response = await fetch(product.deployUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000), // 10秒タイムアウト
    });
    const responseTime = Date.now() - start;

    result.responseTime = responseTime;

    if (response.ok) {
      result.status = responseTime < 2000 ? 'healthy' : 'degraded';
    } else {
      result.status = 'degraded';
      result.error = `HTTP ${response.status}`;
    }
  } catch (error) {
    result.status = 'down';
    result.error = String(error);
  }

  return result;
}

// 全プロダクト監視
export async function runMonitoringCycle(): Promise<MonitoringSummary> {
  setAgentStatus('dashboard', 'working', '監視サイクル実行中');

  const { products, stats } = getProducts();
  const checks: HealthCheckResult[] = [];

  let healthy = 0;
  let degraded = 0;
  let down = 0;

  for (const product of products) {
    if (product.status === 'active') {
      const check = await checkProductHealth(product);
      checks.push(check);

      // ヘルス状態更新
      updateProductMetrics(product.id, {
        lastActive: check.status !== 'down' ? check.checkedAt : product.metrics.lastActive,
      });

      switch (check.status) {
        case 'healthy': healthy++; break;
        case 'degraded': degraded++; break;
        case 'down': down++; break;
      }
    }
  }

  setAgentStatus('dashboard', 'active', undefined);

  return {
    totalProducts: products.length,
    healthyProducts: healthy,
    degradedProducts: degraded,
    downProducts: down,
    totalRevenue: stats.totalRevenue,
    totalUsers: stats.totalUsers,
    checks,
  };
}

// ダッシュボード用サマリー取得
export function getDashboardSummary(): {
  products: Product[];
  stats: {
    totalProducts: number;
    activeProducts: number;
    totalRevenue: number;
    totalUsers: number;
  };
  agents: {
    director: { status: string; tasksCompleted: number };
    hunter: { status: string; opportunitiesFound: number; nextRun: string | null };
    builder: { status: string; productsBuilt: number };
  };
} {
  const { products, stats } = getProducts();

  // Agentの状態はstate.tsから取得するが、循環参照を避けるため簡略化
  return {
    products,
    stats,
    agents: {
      director: { status: 'idle', tasksCompleted: 0 },
      hunter: { status: 'idle', opportunitiesFound: 0, nextRun: null },
      builder: { status: 'idle', productsBuilt: 0 },
    },
  };
}

// アラート判定
export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  productId?: string;
  message: string;
  createdAt: string;
}

export function checkForAlerts(summary: MonitoringSummary): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  // ダウンしているプロダクトがある
  summary.checks.forEach(check => {
    if (check.status === 'down') {
      alerts.push({
        id: `alert-${Date.now()}-${check.productId}`,
        type: 'error',
        productId: check.productId,
        message: `プロダクト ${check.productId} がダウンしています: ${check.error}`,
        createdAt: now,
      });
    } else if (check.status === 'degraded') {
      alerts.push({
        id: `alert-${Date.now()}-${check.productId}`,
        type: 'warning',
        productId: check.productId,
        message: `プロダクト ${check.productId} のパフォーマンスが低下しています`,
        createdAt: now,
      });
    }
  });

  return alerts;
}

/**
 * システムヘルスチェックAPI
 * GET /api/health - 全サービスの状態を一括確認
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message?: string;
  latency?: number;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: ServiceStatus[];
  metrics: {
    stockCount: number;
    todayPosts: number;
    pendingPosts: number;
    lastPostTime: string | null;
    uptime: string;
  };
}

// 起動時刻を記録
const startTime = Date.now();

async function checkGeminiAPI(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { name: 'Gemini API', status: 'error', message: 'API key not configured' };
    }
    // 軽量なリクエストでAPIの疎通確認
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET', signal: AbortSignal.timeout(5000) }
    );
    const latency = Date.now() - start;
    if (res.ok) {
      return { name: 'Gemini API', status: 'ok', latency };
    }
    return { name: 'Gemini API', status: 'warning', message: `Status ${res.status}`, latency };
  } catch (error: any) {
    return { name: 'Gemini API', status: 'error', message: error.message };
  }
}

async function checkTwitterAPI(): Promise<ServiceStatus> {
  try {
    const hasCredentials = !!(
      process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_SECRET
    );
    if (!hasCredentials) {
      return { name: 'Twitter API', status: 'error', message: 'Credentials not configured' };
    }
    return { name: 'Twitter API', status: 'ok', message: 'Credentials configured' };
  } catch (error: any) {
    return { name: 'Twitter API', status: 'error', message: error.message };
  }
}

async function checkDiscordWebhook(): Promise<ServiceStatus> {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return { name: 'Discord Webhook', status: 'warning', message: 'Not configured (optional)' };
    }
    return { name: 'Discord Webhook', status: 'ok', message: 'Configured' };
  } catch (error: any) {
    return { name: 'Discord Webhook', status: 'error', message: error.message };
  }
}

function checkLocalStorage(): ServiceStatus {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const knowledgeDir = path.join(process.cwd(), 'knowledge');

    const dataExists = fs.existsSync(dataDir);
    const knowledgeExists = fs.existsSync(knowledgeDir);

    if (dataExists && knowledgeExists) {
      return { name: 'Local Storage', status: 'ok' };
    }
    return {
      name: 'Local Storage',
      status: 'warning',
      message: `Missing: ${!dataExists ? 'data/' : ''} ${!knowledgeExists ? 'knowledge/' : ''}`.trim()
    };
  } catch (error: any) {
    return { name: 'Local Storage', status: 'error', message: error.message };
  }
}

function getStockMetrics(): { stockCount: number; todayPosts: number; pendingPosts: number; lastPostTime: string | null } {
  try {
    const stockFile = path.join(process.cwd(), 'data', 'post_stock.json');
    const historyFile = path.join(process.cwd(), 'data', 'posts_history.json');

    let stockCount = 0;
    let todayPosts = 0;
    let pendingPosts = 0;
    let lastPostTime: string | null = null;

    // ストック数
    if (fs.existsSync(stockFile)) {
      const stockData = JSON.parse(fs.readFileSync(stockFile, 'utf-8'));
      stockCount = stockData.posts?.length || 0;
    }

    // 今日の投稿数
    if (fs.existsSync(historyFile)) {
      const historyData = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      const today = new Date().toISOString().split('T')[0];
      const posts = historyData.posts || [];

      todayPosts = posts.filter((p: any) => p.timestamp?.startsWith(today)).length;

      // 最終投稿時刻
      if (posts.length > 0) {
        const sorted = posts.sort((a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        lastPostTime = sorted[0]?.timestamp || null;
      }
    }

    // 残り投稿数（15 - 今日の投稿数）
    pendingPosts = Math.max(0, 15 - todayPosts);

    return { stockCount, todayPosts, pendingPosts, lastPostTime };
  } catch {
    return { stockCount: 0, todayPosts: 0, pendingPosts: 15, lastPostTime: null };
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export async function GET() {
  try {
    // 並列でサービスチェック
    const [gemini, twitter, discord] = await Promise.all([
      checkGeminiAPI(),
      checkTwitterAPI(),
      checkDiscordWebhook(),
    ]);

    const localStorage = checkLocalStorage();
    const services = [gemini, twitter, discord, localStorage];

    // メトリクス取得
    const metrics = getStockMetrics();
    const uptime = formatUptime(Date.now() - startTime);

    // 全体ステータス判定
    const errorCount = services.filter(s => s.status === 'error').length;
    const warningCount = services.filter(s => s.status === 'warning').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorCount > 0) {
      overallStatus = errorCount >= 2 ? 'unhealthy' : 'degraded';
    } else if (warningCount > 1) {
      overallStatus = 'degraded';
    }

    // ストック警告
    if (metrics.stockCount < 5) {
      services.push({
        name: 'Post Stock',
        status: metrics.stockCount === 0 ? 'error' : 'warning',
        message: `Only ${metrics.stockCount} posts in stock`
      });
      if (metrics.stockCount === 0) overallStatus = 'degraded';
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      metrics: {
        ...metrics,
        uptime,
      },
    };

    // ステータスに応じたHTTPコード
    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: [{ name: 'Health Check', status: 'error', message: error.message }],
      metrics: { stockCount: 0, todayPosts: 0, pendingPosts: 0, lastPostTime: null, uptime: '0s' },
    }, { status: 503 });
  }
}

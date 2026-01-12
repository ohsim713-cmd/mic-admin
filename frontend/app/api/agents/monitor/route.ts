import { NextResponse } from 'next/server';
import { runMonitoringCycle, getDashboardSummary, checkForAlerts, getAgentState, getProducts } from '@/lib/agents';

// GET: ダッシュボードサマリー取得
export async function GET() {
  try {
    const agentState = getAgentState();
    const { products, stats } = getProducts();

    return NextResponse.json({
      agents: agentState.agents,
      systemStatus: agentState.systemStatus,
      products,
      stats,
      lastUpdated: agentState.lastUpdated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get dashboard data', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: 監視サイクル実行
export async function POST() {
  try {
    const summary = await runMonitoringCycle();
    const alerts = checkForAlerts(summary);

    return NextResponse.json({
      success: true,
      message: `Monitored ${summary.totalProducts} products`,
      summary,
      alerts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Monitoring failed', details: String(error) },
      { status: 500 }
    );
  }
}

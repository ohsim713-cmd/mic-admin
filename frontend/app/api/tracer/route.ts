/**
 * Trigger Tracer API
 *
 * イベント因果関係の取得・管理
 */

import { NextRequest, NextResponse } from 'next/server';
import tracer from '@/lib/agent/trigger-tracer';

// GET: チェーン一覧・統計取得
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'chains';
  const chainId = searchParams.get('chainId');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    switch (type) {
      case 'chain':
        if (!chainId) {
          return NextResponse.json({ success: false, error: 'chainId required' }, { status: 400 });
        }
        const chain = tracer.getChain(chainId);
        if (!chain) {
          return NextResponse.json({ success: false, error: 'Chain not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, chain });

      case 'active':
        return NextResponse.json({
          success: true,
          chains: tracer.getActiveChains(),
        });

      case 'stats':
        return NextResponse.json({
          success: true,
          stats: tracer.getStats(),
        });

      case 'chains':
      default:
        return NextResponse.json({
          success: true,
          chains: tracer.getAllChains(limit),
          stats: tracer.getStats(),
        });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST: チェーン操作
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'start': {
        const { trigger, agent, data } = body;
        if (!trigger || !agent) {
          return NextResponse.json({ success: false, error: 'trigger and agent required' }, { status: 400 });
        }
        const chainId = tracer.startChain(trigger, agent, data);
        return NextResponse.json({ success: true, chainId });
      }

      case 'action': {
        const { chainId, actionName, agent, parentId, data } = body;
        if (!chainId || !actionName || !agent) {
          return NextResponse.json({ success: false, error: 'chainId, actionName, agent required' }, { status: 400 });
        }
        const eventId = tracer.addAction(chainId, actionName, agent, parentId, data);
        return NextResponse.json({ success: true, eventId });
      }

      case 'result': {
        const { chainId, eventId, status, result } = body;
        if (!chainId || !eventId || !status) {
          return NextResponse.json({ success: false, error: 'chainId, eventId, status required' }, { status: 400 });
        }
        tracer.addResult(chainId, eventId, status, result);
        return NextResponse.json({ success: true });
      }

      case 'end': {
        const { chainId, summary } = body;
        if (!chainId) {
          return NextResponse.json({ success: false, error: 'chainId required' }, { status: 400 });
        }
        tracer.endChain(chainId, summary);
        return NextResponse.json({ success: true });
      }

      case 'clear': {
        tracer.clear();
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

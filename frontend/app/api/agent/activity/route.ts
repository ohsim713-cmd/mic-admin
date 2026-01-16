/**
 * エージェントアクティビティAPI
 * ダッシュボードでリアルタイム表示するためのエンドポイント
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// アクティビティログファイル
const ACTIVITY_LOG_PATH = path.join(DATA_DIR, 'agent_activity.json');

export interface AgentActivity {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action: string;
  tool?: string;
  status: 'thinking' | 'executing' | 'success' | 'error';
  details?: string;
}

// アクティビティログを読み込み
function getActivities(limit: number = 50): AgentActivity[] {
  try {
    if (fs.existsSync(ACTIVITY_LOG_PATH)) {
      const data = JSON.parse(fs.readFileSync(ACTIVITY_LOG_PATH, 'utf-8'));
      return (data.activities || []).slice(-limit);
    }
  } catch (e) {
    console.error('Failed to read activity log:', e);
  }
  return [];
}

// アクティビティを追加
export function logActivity(activity: Omit<AgentActivity, 'id' | 'timestamp'>): AgentActivity {
  const newActivity: AgentActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...activity,
  };

  try {
    let data = { activities: [] as AgentActivity[] };
    if (fs.existsSync(ACTIVITY_LOG_PATH)) {
      data = JSON.parse(fs.readFileSync(ACTIVITY_LOG_PATH, 'utf-8'));
    }

    data.activities.push(newActivity);

    // 最大1000件まで保持
    if (data.activities.length > 1000) {
      data.activities = data.activities.slice(-1000);
    }

    fs.writeFileSync(ACTIVITY_LOG_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to write activity log:', e);
  }

  return newActivity;
}

// GET: アクティビティ一覧を取得
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const agentId = searchParams.get('agentId');

  let activities = getActivities(limit);

  if (agentId) {
    activities = activities.filter(a => a.agentId === agentId);
  }

  // 統計情報も計算
  const stats = {
    totalToday: activities.filter(a =>
      new Date(a.timestamp).toDateString() === new Date().toDateString()
    ).length,
    successRate: activities.length > 0
      ? Math.round(activities.filter(a => a.status === 'success').length / activities.length * 100)
      : 0,
    activeAgents: [...new Set(activities.slice(-20).map(a => a.agentId))].length,
  };

  return NextResponse.json({
    activities: activities.reverse(), // 新しい順
    stats,
  });
}

// POST: 新しいアクティビティを記録
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const activity = logActivity({
      agentId: body.agentId,
      agentName: body.agentName,
      action: body.action,
      tool: body.tool,
      status: body.status || 'executing',
      details: body.details,
    });

    return NextResponse.json({ success: true, activity });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

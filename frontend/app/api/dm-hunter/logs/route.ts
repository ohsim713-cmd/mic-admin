import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOGS_PATH = path.join(process.cwd(), 'knowledge', 'dm_hunter_logs.json');

export interface PostLog {
  id: string;
  timestamp: string;
  text: string;
  target: string;
  benefit: string;
  score: number;
  results: {
    platform: string;
    success: boolean;
    id?: string;
    error?: string;
  }[];
}

function loadLogs(): PostLog[] {
  try {
    if (fs.existsSync(LOGS_PATH)) {
      return JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load logs:', error);
  }
  return [];
}

function saveLogs(logs: PostLog[]) {
  try {
    // 最新100件のみ保持
    const trimmed = logs.slice(-100);
    fs.writeFileSync(LOGS_PATH, JSON.stringify(trimmed, null, 2));
  } catch (error) {
    console.error('Failed to save logs:', error);
  }
}

// GET: ログを取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const today = searchParams.get('today') === 'true';

  let logs = loadLogs();

  // 今日のログのみフィルタ
  if (today) {
    const todayStr = new Date().toISOString().split('T')[0];
    logs = logs.filter(log => log.timestamp.startsWith(todayStr));
  }

  // 最新から返す
  logs = logs.slice(-limit).reverse();

  // 統計
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = loadLogs().filter(log => log.timestamp.startsWith(todayStr));
  const stats = {
    todayPosts: todayLogs.length,
    todaySuccess: todayLogs.filter(log => log.results.some(r => r.success)).length,
    totalPosts: loadLogs().length,
  };

  return NextResponse.json({
    success: true,
    logs,
    stats,
  });
}

// POST: ログを追加
export async function POST(request: NextRequest) {
  try {
    const log: Omit<PostLog, 'id' | 'timestamp'> = await request.json();

    const logs = loadLogs();
    const newLog: PostLog = {
      ...log,
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    logs.push(newLog);
    saveLogs(logs);

    return NextResponse.json({
      success: true,
      log: newLog,
    });

  } catch (error: any) {
    console.error('Save log error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

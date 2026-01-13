/**
 * Auto Hub - 統合自動化ステータスAPI
 * テキスト・画像・動画の全自動システムの状態を一括取得
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SCHEDULES_PATH = path.join(process.cwd(), 'knowledge', 'auto_hub_schedules.json');
const LOGS_PATH = path.join(process.cwd(), 'knowledge', 'auto_hub_logs.json');

interface ContentStats {
  today: number;
  success: number;
  failed: number;
  lastRun: string | null;
}

interface AutoHubStatus {
  text: {
    enabled: boolean;
    accounts: string[];
    stats: ContentStats;
  };
  image: {
    enabled: boolean;
    style: string;
    stats: ContentStats;
  };
  video: {
    enabled: boolean;
    platform: string;
    stats: ContentStats;
  };
  schedules: {
    text: string[];
    image: string[];
    video: string[];
  };
  systemStatus: 'running' | 'paused' | 'error';
}

async function loadSchedules(): Promise<any> {
  try {
    const data = await fs.readFile(SCHEDULES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      text: { enabled: true, times: ['07:00', '12:00', '18:00', '20:00', '22:00', '24:00'] },
      image: { enabled: true, times: ['09:00', '15:00', '21:00'] },
      video: { enabled: true, times: ['10:00', '19:00'] },
    };
  }
}

async function loadLogs(): Promise<any> {
  try {
    const data = await fs.readFile(LOGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { text: [], image: [], video: [] };
  }
}

function getTodayStats(logs: any[], type: string): ContentStats {
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter((log: any) => log.timestamp?.startsWith(today));

  return {
    today: todayLogs.length,
    success: todayLogs.filter((log: any) => log.success).length,
    failed: todayLogs.filter((log: any) => !log.success).length,
    lastRun: logs[0]?.timestamp || null,
  };
}

export async function GET() {
  try {
    const [schedules, logs] = await Promise.all([
      loadSchedules(),
      loadLogs(),
    ]);

    const status: AutoHubStatus = {
      text: {
        enabled: schedules.text?.enabled ?? true,
        accounts: ['liver', 'chatre1', 'chatre2'],
        stats: getTodayStats(logs.text || [], 'text'),
      },
      image: {
        enabled: schedules.image?.enabled ?? true,
        style: 'nail_art',
        stats: getTodayStats(logs.image || [], 'image'),
      },
      video: {
        enabled: schedules.video?.enabled ?? true,
        platform: 'shorts',
        stats: getTodayStats(logs.video || [], 'video'),
      },
      schedules: {
        text: schedules.text?.times || ['07:00', '12:00', '18:00', '20:00', '22:00', '24:00'],
        image: schedules.image?.times || ['09:00', '15:00', '21:00'],
        video: schedules.video?.times || ['10:00', '19:00'],
      },
      systemStatus: 'running',
    };

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[Auto Hub] Status error:', error);
    return NextResponse.json({
      text: { enabled: false, accounts: [], stats: { today: 0, success: 0, failed: 0, lastRun: null } },
      image: { enabled: false, style: '', stats: { today: 0, success: 0, failed: 0, lastRun: null } },
      video: { enabled: false, platform: '', stats: { today: 0, success: 0, failed: 0, lastRun: null } },
      schedules: { text: [], image: [], video: [] },
      systemStatus: 'error',
      error: error.message,
    });
  }
}

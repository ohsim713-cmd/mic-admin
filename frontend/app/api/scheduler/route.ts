import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const SCHEDULES_FILE = path.join(process.cwd(), '..', 'knowledge', 'schedules.json');

type Schedule = {
  id: string;
  enabled: boolean;
  intervalHours: number;
  target: string;
  postType: string;
  keywords: string;
  lastRun?: string;
  nextRun?: string;
};

function loadSchedules(): Schedule[] {
  try {
    if (!fs.existsSync(SCHEDULES_FILE)) {
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify({ schedules: [] }, null, 2));
    }
    const data = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.schedules || [];
  } catch (e) {
    console.error('Failed to load schedules:', e);
    return [];
  }
}

function saveSchedules(schedules: Schedule[]) {
  try {
    const dir = path.dirname(SCHEDULES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify({ schedules }, null, 2));
  } catch (e) {
    console.error('Failed to save schedules:', e);
  }
}

// GET - スケジュール一覧取得
export async function GET() {
  const schedules = loadSchedules();
  return NextResponse.json({ schedules });
}

// POST - 新規スケジュール作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intervalHours, target, postType, keywords } = body;

    const schedules = loadSchedules();

    const now = new Date();
    const nextRun = new Date(now.getTime() + intervalHours * 60 * 60 * 1000);

    const newSchedule: Schedule = {
      id: uuidv4(),
      enabled: true,
      intervalHours,
      target,
      postType,
      keywords: keywords || '',
      nextRun: nextRun.toISOString()
    };

    schedules.push(newSchedule);
    saveSchedules(schedules);

    return NextResponse.json({ success: true, schedule: newSchedule });
  } catch (error) {
    console.error('Failed to create schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}

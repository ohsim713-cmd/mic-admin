import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const SCHEDULES_FILE = path.join(process.cwd(), 'knowledge', 'wordpress_schedules.json');

export type WordPressSchedule = {
  id: string;
  enabled: boolean;
  intervalHours: number;
  keywords: string;
  targetLength: string;
  tone: string;
  publishStatus: 'draft' | 'publish';
  generateThumbnail: boolean;
  lastRun?: string;
  nextRun?: string;
  lastPostId?: number;
  lastPostTitle?: string;
};

function loadSchedules(): WordPressSchedule[] {
  try {
    if (!fs.existsSync(SCHEDULES_FILE)) {
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify({ schedules: [] }, null, 2));
    }
    const data = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.schedules || [];
  } catch (e) {
    console.error('Failed to load WordPress schedules:', e);
    return [];
  }
}

function saveSchedules(schedules: WordPressSchedule[]) {
  try {
    const dir = path.dirname(SCHEDULES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify({ schedules }, null, 2));
  } catch (e) {
    console.error('Failed to save WordPress schedules:', e);
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
    const {
      intervalHours,
      keywords,
      targetLength = '2000-3000',
      tone = '親しみやすく、専門的',
      publishStatus = 'draft',
      generateThumbnail = false
    } = body;

    const schedules = loadSchedules();

    const now = new Date();
    const nextRun = new Date(now.getTime() + intervalHours * 60 * 60 * 1000);

    const newSchedule: WordPressSchedule = {
      id: uuidv4(),
      enabled: true,
      intervalHours,
      keywords: keywords || '',
      targetLength,
      tone,
      publishStatus,
      generateThumbnail,
      nextRun: nextRun.toISOString()
    };

    schedules.push(newSchedule);
    saveSchedules(schedules);

    return NextResponse.json({ success: true, schedule: newSchedule });
  } catch (error) {
    console.error('Failed to create WordPress schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}

// PUT - スケジュール更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    const schedules = loadSchedules();
    const index = schedules.findIndex(s => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    schedules[index] = { ...schedules[index], ...updates };
    saveSchedules(schedules);

    return NextResponse.json({ success: true, schedule: schedules[index] });
  } catch (error) {
    console.error('Failed to update WordPress schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

// DELETE - スケジュール削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    const schedules = loadSchedules();
    const filteredSchedules = schedules.filter(s => s.id !== id);

    if (filteredSchedules.length === schedules.length) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    saveSchedules(filteredSchedules);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete WordPress schedule:', error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}

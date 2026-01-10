import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SCHEDULES_FILE = path.join(process.cwd(), 'knowledge', 'schedules.json');

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
      return [];
    }
    const data = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.schedules || [];
  } catch (e) {
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

// PATCH - スケジュールの更新（有効/無効切り替え）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { enabled } = body;

    const schedules = loadSchedules();
    const scheduleIndex = schedules.findIndex(s => s.id === id);

    if (scheduleIndex === -1) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    schedules[scheduleIndex].enabled = enabled;

    // 再開時は次回実行時間を更新
    if (enabled) {
      const now = new Date();
      const nextRun = new Date(now.getTime() + schedules[scheduleIndex].intervalHours * 60 * 60 * 1000);
      schedules[scheduleIndex].nextRun = nextRun.toISOString();
    }

    saveSchedules(schedules);

    return NextResponse.json({ success: true, schedule: schedules[scheduleIndex] });
  } catch (error) {
    console.error('Failed to update schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

// DELETE - スケジュールの削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const schedules = loadSchedules();
    const filteredSchedules = schedules.filter(s => s.id !== id);

    if (filteredSchedules.length === schedules.length) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    saveSchedules(filteredSchedules);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete schedule:', error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}

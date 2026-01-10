import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

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
      return [];
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

async function executeSchedule(schedule: Schedule) {
  try {
    console.log(`Executing schedule ${schedule.id}...`);

    // APIエンドポイントを呼び出してXに投稿
    const response = await fetch('http://localhost:3000/api/post-to-x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: schedule.target,
        postType: schedule.postType,
        keywords: schedule.keywords
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`Successfully posted to X for schedule ${schedule.id}`);

      // スケジュールを更新
      const schedules = loadSchedules();
      const index = schedules.findIndex(s => s.id === schedule.id);

      if (index !== -1) {
        const now = new Date();
        schedules[index].lastRun = now.toISOString();
        const nextRun = new Date(now.getTime() + schedule.intervalHours * 60 * 60 * 1000);
        schedules[index].nextRun = nextRun.toISOString();
        saveSchedules(schedules);
      }
    } else {
      console.error(`Failed to post to X for schedule ${schedule.id}:`, result.error);
    }
  } catch (error) {
    console.error(`Error executing schedule ${schedule.id}:`, error);
  }
}

// 毎分実行して、実行すべきスケジュールをチェック
export function startScheduler() {
  console.log('Starting auto-post scheduler...');

  cron.schedule('* * * * *', () => {
    const now = new Date();
    const schedules = loadSchedules();

    schedules.forEach(schedule => {
      if (!schedule.enabled) return;

      if (schedule.nextRun) {
        const nextRunTime = new Date(schedule.nextRun);

        // 実行時刻を過ぎていたら実行
        if (now >= nextRunTime) {
          executeSchedule(schedule);
        }
      }
    });
  });

  console.log('Scheduler started. Checking every minute for scheduled posts.');
}

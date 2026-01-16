/**
 * MIC Backend - Cloud Run
 * 自動投稿の実務部隊
 */

import express from 'express';
import cron from 'node-cron';
import { autoPost } from './jobs/auto-post';
import { fetchImpressions } from './jobs/fetch-impressions';
import { autoLearn } from './jobs/auto-learn';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const VERCEL_URL = process.env.VERCEL_URL || 'https://frontend-kohl-eight-glnhg9tp79.vercel.app';

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mic-backend',
    version: '1.0.0',
    cronJobs: {
      autoPost: '15回/日 (07:00-23:00 JST)',
      fetchImpressions: '1回/日 (00:00 JST)',
      autoLearn: '1回/日 (00:30 JST)',
    },
  });
});

// 手動実行エンドポイント
app.post('/api/post', async (req, res) => {
  try {
    const result = await autoPost();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fetch-impressions', async (req, res) => {
  try {
    const result = await fetchImpressions();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/learn', async (req, res) => {
  try {
    const result = await autoLearn();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cron設定（JST = UTC+9）
// 投稿スケジュール: 07:00-23:00 JST → 22:00-14:00 UTC
const POST_TIMES_UTC = [
  '22:00', '23:00', // 07:00-08:00 JST
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', // 09:00-15:00 JST
  '07:00', '08:00', // 16:00-17:00 JST
  '09:00', // 18:00 JST
  '11:00', // 20:00 JST
  '13:00', '14:00', // 22:00-23:00 JST
];

// 毎時チェックして該当時間なら投稿
cron.schedule('0 * * * *', async () => {
  const now = new Date();
  const utcHour = now.getUTCHours().toString().padStart(2, '0');
  const currentTime = `${utcHour}:00`;

  if (POST_TIMES_UTC.includes(currentTime)) {
    console.log(`[CRON] Running auto-post at ${currentTime} UTC`);
    try {
      const result = await autoPost();
      console.log('[CRON] Auto-post result:', result);
    } catch (error) {
      console.error('[CRON] Auto-post error:', error);
    }
  }
});

// インプレッション取得: 毎日 15:00 UTC (00:00 JST)
cron.schedule('0 15 * * *', async () => {
  console.log('[CRON] Running fetch-impressions');
  try {
    const result = await fetchImpressions();
    console.log('[CRON] Fetch-impressions result:', result);
  } catch (error) {
    console.error('[CRON] Fetch-impressions error:', error);
  }
});

// 自動学習: 毎日 15:30 UTC (00:30 JST)
cron.schedule('30 15 * * *', async () => {
  console.log('[CRON] Running auto-learn');
  try {
    const result = await autoLearn();
    console.log('[CRON] Auto-learn result:', result);
  } catch (error) {
    console.error('[CRON] Auto-learn error:', error);
  }
});

app.listen(PORT, () => {
  console.log(`[MIC Backend] Running on port ${PORT}`);
  console.log(`[MIC Backend] Vercel URL: ${VERCEL_URL}`);
  console.log('[MIC Backend] Cron jobs scheduled:');
  console.log('  - Auto-post: 15x/day (07:00-23:00 JST)');
  console.log('  - Fetch impressions: 1x/day (00:00 JST)');
  console.log('  - Auto-learn: 1x/day (00:30 JST)');
});

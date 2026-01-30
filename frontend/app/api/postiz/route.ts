import { NextResponse } from 'next/server';
import { getModel } from '@/lib/vertex-ai';

// Postiz API configuration
const POSTIZ_API_URL = process.env.POSTIZ_API_URL || 'http://localhost:4007/api';
const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY || '';

// 1日15投稿スケジュール (JST)
const DAILY_SCHEDULE = [
  { time: '07:00', type: 'greeting', label: '朝の挨拶' },
  { time: '09:00', type: 'question', label: '朝の質問' },
  { time: '10:00', type: 'tips', label: '午前Tips' },
  { time: '11:00', type: 'achievement', label: '実績紹介' },
  { time: '12:00', type: 'casual', label: 'ランチ雑談' },
  { time: '14:00', type: 'empathy', label: '午後の共感' },
  { time: '16:00', type: 'tips', label: '夕方Tips' },
  { time: '18:00', type: 'recruitment', label: 'メイン宣伝' },
  { time: '19:00', type: 'story', label: 'ストーリー' },
  { time: '20:00', type: 'question', label: '夜の質問' },
  { time: '21:00', type: 'encouragement', label: '応援' },
  { time: '22:00', type: 'data', label: 'データ紹介' },
  { time: '23:00', type: 'casual', label: '夜の雑談' },
  { time: '00:00', type: 'closing', label: '1日の締め' },
  { time: '02:00', type: 'insight', label: '深夜インサイト' },
];

// Postiz APIヘルパー
async function postizFetch(endpoint: string, options: RequestInit = {}) {
  const apiKey = POSTIZ_API_KEY;
  if (!apiKey) {
    throw new Error('POSTIZ_API_KEY is not configured');
  }

  const response = await fetch(`${POSTIZ_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Postiz API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Postiz連携アカウントを取得
async function getPostizIntegrations() {
  return postizFetch('/public/v1/integrations');
}

// 投稿をスケジュール
async function schedulePost(integrationId: string, content: string, scheduledAt: Date) {
  return postizFetch('/public/v1/posts', {
    method: 'POST',
    body: JSON.stringify({
      integrationIds: [integrationId],
      content,
      scheduledAt: scheduledAt.toISOString(),
      type: 'schedule', // 'schedule' | 'now' | 'draft'
    }),
  });
}

// 次の利用可能なスロットを取得
async function findAvailableSlot(integrationId: string) {
  return postizFetch(`/public/v1/find-slot/${integrationId}`);
}

// charged-tysonから投稿を生成
async function generatePost(scheduleIndex: number, account: string = 'tt_liver') {
  const response = await fetch('http://localhost:3000/api/generate/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'single',
      scheduleIndex,
      account,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate post: ${response.status}`);
  }

  return response.json();
}

// JST時間をUTCに変換
function jstToUtc(timeStr: string, date: Date = new Date()): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const jstDate = new Date(date);
  jstDate.setHours(hours, minutes, 0, 0);
  // JST (UTC+9) → UTC
  return new Date(jstDate.getTime() - 9 * 60 * 60 * 1000);
}

// ===== API Endpoints =====

// GET: 連携状態を確認
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'integrations') {
      // Postiz連携アカウント一覧
      const integrations = await getPostizIntegrations();
      return NextResponse.json({ integrations });
    }

    if (action === 'check') {
      // 接続確認
      const result = await postizFetch('/public/v1/is-connected');
      return NextResponse.json({ connected: true, result });
    }

    // デフォルト: 設定状態を返す
    return NextResponse.json({
      configured: !!POSTIZ_API_KEY,
      apiUrl: POSTIZ_API_URL,
      schedule: DAILY_SCHEDULE,
      totalPosts: DAILY_SCHEDULE.length,
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      configured: !!POSTIZ_API_KEY,
    }, { status: 500 });
  }
}

// POST: 投稿を生成してPostizにスケジュール
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      mode = 'draft',  // 'draft' | 'schedule' | 'now'
      count = 1,       // 生成する投稿数
      integrationId,   // Postiz連携ID (X account)
      date,            // スケジュール日 (YYYY-MM-DD形式、省略時は翌日)
      account = 'tt_liver',
    } = body;

    // Postiz連携IDが必要
    if (!integrationId && mode !== 'draft') {
      // 自動で最初のX連携を取得
      const integrations = await getPostizIntegrations();
      const xIntegration = integrations.find((i: any) =>
        i.identifier === 'x' || i.provider === 'x' || i.type === 'x'
      );
      if (!xIntegration) {
        return NextResponse.json({
          error: 'No X integration found in Postiz. Please connect X first.',
        }, { status: 400 });
      }
      body.integrationId = xIntegration.id;
    }

    // スケジュール日を決定
    const scheduleDate = date ? new Date(date) : new Date();
    if (!date) {
      scheduleDate.setDate(scheduleDate.getDate() + 1); // 翌日
    }

    const results = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < Math.min(count, 15); i++) {
      // ランダムなスケジュールインデックスを選択（重複なし）
      let idx: number;
      do {
        idx = Math.floor(Math.random() * DAILY_SCHEDULE.length);
      } while (usedIndices.has(idx) && usedIndices.size < DAILY_SCHEDULE.length);
      usedIndices.add(idx);

      const scheduleItem = DAILY_SCHEDULE[idx];

      // 投稿を生成
      const generated = await generatePost(idx, account);

      // スケジュール時間を計算
      const scheduledAt = jstToUtc(scheduleItem.time, scheduleDate);

      let postizResult = null;
      if (mode === 'schedule' && body.integrationId) {
        // Postizにスケジュール
        postizResult = await schedulePost(
          body.integrationId,
          generated.text,
          scheduledAt
        );
      } else if (mode === 'now' && body.integrationId) {
        // 今すぐ投稿
        postizResult = await postizFetch('/public/v1/posts', {
          method: 'POST',
          body: JSON.stringify({
            integrationIds: [body.integrationId],
            content: generated.text,
            type: 'now',
          }),
        });
      }

      results.push({
        index: idx,
        scheduleItem,
        generated,
        scheduledAt: scheduledAt.toISOString(),
        postizResult,
        status: mode === 'draft' ? 'draft' : 'scheduled',
      });
    }

    return NextResponse.json({
      mode,
      date: scheduleDate.toISOString().split('T')[0],
      count: results.length,
      results,
    });

  } catch (error) {
    console.error('Postiz integration error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

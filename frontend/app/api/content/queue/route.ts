/**
 * コンテンツキュー管理 API
 *
 * GET: キュー全体を取得
 * PATCH: 特定アイテムのステータスを更新
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const QUEUE_FILE = path.join(KNOWLEDGE_DIR, 'content_queue.json');

interface ContentQueue {
  instagram: any[];
  tiktok: any[];
  updatedAt?: string | null;
}

function loadQueue(): ContentQueue {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('[Content Queue] Error loading queue:', error);
  }
  return { instagram: [], tiktok: [], updatedAt: null };
}

function saveQueue(queue: ContentQueue): void {
  try {
    queue.updatedAt = new Date().toISOString();
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Content Queue] Error saving queue:', error);
  }
}

// GET: キュー全体を取得
export async function GET() {
  const queue = loadQueue();

  // 新しいものが上に来るようにソート
  queue.instagram.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  queue.tiktok.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(queue);
}

// PATCH: ステータス更新
export async function PATCH(request: NextRequest) {
  try {
    const { id, status, platform } = await request.json();

    if (!id || !status || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: id, status, platform' },
        { status: 400 }
      );
    }

    if (!['pending', 'downloaded', 'posted'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    if (!['instagram', 'tiktok'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    const queue = loadQueue();
    const items = queue[platform as 'instagram' | 'tiktok'];
    const itemIndex = items.findIndex((item: any) => item.id === id);

    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    items[itemIndex].status = status;
    items[itemIndex].updatedAt = new Date().toISOString();

    saveQueue(queue);

    return NextResponse.json({
      success: true,
      item: items[itemIndex],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Content Queue] PATCH error:', error);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

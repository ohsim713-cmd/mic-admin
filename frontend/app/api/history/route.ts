import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'history.json');

// データディレクトリを確保
async function ensureDataDir() {
  const dataDir = path.dirname(HISTORY_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// 履歴を読み込む
async function readHistory() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// 履歴を書き込む
async function writeHistory(history: any[]) {
  await ensureDataDir();
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// GET: 履歴を取得
export async function GET() {
  try {
    const history = await readHistory();
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read history' }, { status: 500 });
  }
}

// POST: 履歴を追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target, atmosphere, perks, generatedPost } = body;

    const history = await readHistory();
    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      target,
      atmosphere,
      perks,
      generatedPost,
    };

    history.unshift(newEntry); // 最新を先頭に

    // 最大100件まで保存
    if (history.length > 100) {
      history.pop();
    }

    await writeHistory(history);
    return NextResponse.json({ success: true, entry: newEntry });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save history' }, { status: 500 });
  }
}

// DELETE: 履歴を削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const history = await readHistory();
    const filtered = history.filter((item: any) => item.id !== id);
    await writeHistory(filtered);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete history' }, { status: 500 });
  }
}

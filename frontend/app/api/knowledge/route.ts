import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const KNOWLEDGE_FILE = path.join(process.cwd(), 'knowledge', 'agency_knowledge.md');

// GET: ナレッジベースを取得
export async function GET() {
  try {
    const content = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read knowledge file' }, { status: 500 });
  }
}

// POST: ナレッジベースを更新
export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    await fs.writeFile(KNOWLEDGE_FILE, content, 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update knowledge file' }, { status: 500 });
  }
}

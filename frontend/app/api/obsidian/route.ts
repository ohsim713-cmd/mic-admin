/**
 * Obsidian Integration API
 *
 * GET  - Vault接続状態確認
 * POST - アイデア保存 / ダイジェスト生成
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getObsidianClient,
  checkVaultAccess,
  IdeaNote,
  DailyDigest,
  DEFAULT_CONFIG,
} from '@/lib/obsidian';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// GET: Vault接続状態確認
export async function GET() {
  const isAccessible = await checkVaultAccess();

  return NextResponse.json({
    status: isAccessible ? 'connected' : 'disconnected',
    vaultPath: process.env.OBSIDIAN_VAULT_PATH || DEFAULT_CONFIG.vaultPath,
    autoSaveEnabled: process.env.OBSIDIAN_AUTO_SAVE === 'true',
  });
}

// POST: アイデア保存 / ダイジェスト生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const isAccessible = await checkVaultAccess();
    if (!isAccessible) {
      return NextResponse.json(
        { error: 'Obsidian vault not accessible' },
        { status: 503 }
      );
    }

    const obsidian = getObsidianClient();

    switch (action) {
      case 'save_idea': {
        const idea: IdeaNote = {
          id: `idea-${Date.now()}`,
          title: body.title || 'Untitled Idea',
          content: body.content,
          source: body.source,
          relatedContent: body.relatedContent,
          tags: body.tags || ['idea'],
          createdAt: new Date().toISOString(),
        };

        const result = await obsidian.saveIdeaNote(idea);
        return NextResponse.json({
          success: result.success,
          filePath: result.filePath,
          error: result.error,
        });
      }

      case 'generate_digest': {
        const today = new Date().toISOString().split('T')[0];

        // ログとキューを読み込み
        let logs: { text?: any[]; image?: any[]; video?: any[] } = {};
        let queue: { instagram?: any[]; tiktok?: any[] } = {};

        try {
          const logsPath = path.join(KNOWLEDGE_DIR, 'auto_hub_logs.json');
          if (fs.existsSync(logsPath)) {
            logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8'));
          }
        } catch {}

        try {
          const queuePath = path.join(KNOWLEDGE_DIR, 'content_queue.json');
          if (fs.existsSync(queuePath)) {
            queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
          }
        } catch {}

        // 今日のコンテンツをカウント
        const todayInstagram = (queue.instagram || []).filter(
          (i: any) => i.createdAt?.startsWith(today)
        ).length;
        const todayTikTok = (queue.tiktok || []).filter(
          (i: any) => i.createdAt?.startsWith(today)
        ).length;
        const todayImages = (logs.image || []).filter(
          (i: any) => i.timestamp?.startsWith(today)
        ).length;

        const digest: DailyDigest = {
          date: today,
          contentGenerated: {
            instagram: todayInstagram,
            tiktok: todayTikTok,
            images: todayImages,
          },
          logs: (logs.image || []).slice(0, 20).map((l: any) => ({
            timestamp: l.timestamp,
            action: `Image: ${l.theme}`,
            success: l.success,
            error: l.error,
          })),
          highlights:
            todayInstagram + todayTikTok > 0
              ? [`${todayInstagram + todayTikTok} コンテンツを生成`]
              : undefined,
          issues: (logs.image || [])
            .filter((l: any) => !l.success && l.timestamp?.startsWith(today))
            .map((l: any) => l.error),
        };

        const result = await obsidian.saveDailyDigest(digest);
        return NextResponse.json({
          success: result.success,
          filePath: result.filePath,
          digest: {
            date: digest.date,
            contentGenerated: digest.contentGenerated,
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Obsidian API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

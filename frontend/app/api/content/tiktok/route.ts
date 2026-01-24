/**
 * TikTok コンテンツ生成 API
 *
 * 機能:
 * - テキストオーバーレイ動画用スクリプト生成
 * - 50:50戦略（self: 過去投稿リライト / transform: 他人投稿アレンジ）
 * - トレンドサウンド提案
 * - アカウント別スタイル対応
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';
import { getModel } from '@/lib/ai/model';
import { getImagenClient, toDataUrl } from '@/lib/imagen';
import { getObsidianClient, createTikTokContentNote, checkVaultAccess } from '@/lib/obsidian';

export const runtime = 'nodejs';
export const maxDuration = 60; // 画像生成を含むため延長

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ========== 型定義 ==========

interface TikTokContentRequest {
  mode: 'self' | 'transform';
  account: 'liver' | 'chatre';
  videoType: 'text_overlay';  // テキストオーバーレイ固定
}

interface TikTokContentResponse {
  caption: string;
  suggestedSound: string | null;
  textOverlays: string[];
  backgroundPrompt: string;
  generatedImage?: {
    dataUrl: string;
    base64: string;
    mimeType: string;
  };
  sourceInfo?: {
    type: 'past_post' | 'buzz_stock';
    originalText?: string;
  };
}

interface AccountStyle {
  name: string;
  tone: string;
  description: string;
  keywords: string[];
  contentThemes: string[];
}

interface BuzzStockItem {
  id: string;
  desc: string;
  author: string;
  type: string;
  engagementRate: number;
  music?: {
    title: string;
    author: string;
  };
}

// ========== ヘルパー関数 ==========

function loadAccountStyles(): Record<string, AccountStyle> {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'account_styles.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[TikTok Content] Error loading account styles:', error);
  }
  return {};
}

function loadBuzzStock(): BuzzStockItem[] {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'tiktok_buzz_stock.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[TikTok Content] Error loading buzz stock:', error);
  }
  return [];
}

function loadTrendingSounds(): { tiktok: Array<{ title: string; author: string }> } {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'trending_sounds.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[TikTok Content] Error loading trending sounds:', error);
  }
  return { tiktok: [] };
}

function loadContentQueue(): { tiktok: any[]; instagram: any[]; updatedAt?: string } {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'content_queue.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[TikTok Content] Error loading content queue:', error);
  }
  return { tiktok: [], instagram: [] };
}

function saveContentQueue(queue: any): void {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'content_queue.json');
    fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), 'utf-8');
  } catch (error) {
    console.error('[TikTok Content] Error saving content queue:', error);
  }
}

function selectRandomSound(sounds: Array<{ title: string; author: string }>): string | null {
  if (sounds.length === 0) return null;
  const sound = sounds[Math.floor(Math.random() * sounds.length)];
  return `${sound.title} - ${sound.author}`;
}

function selectBuzzPost(buzzStock: BuzzStockItem[], account: 'liver' | 'chatre'): BuzzStockItem | null {
  // アカウントタイプに合った投稿を優先
  const filtered = buzzStock.filter(item => item.type === account || item.type === 'general');
  if (filtered.length === 0) return null;

  // エンゲージメント率で重み付けしてランダム選択
  const sorted = filtered.sort((a, b) => b.engagementRate - a.engagementRate);
  const topPosts = sorted.slice(0, Math.min(10, sorted.length));
  return topPosts[Math.floor(Math.random() * topPosts.length)];
}

// ========== メイン処理 ==========

async function generateTikTokContent(
  mode: 'self' | 'transform',
  account: 'liver' | 'chatre'
): Promise<TikTokContentResponse> {
  const styles = loadAccountStyles();
  const style = styles[account];
  const buzzStock = loadBuzzStock();
  const trendingSounds = loadTrendingSounds();

  // トレンドサウンドを選択
  const suggestedSound = selectRandomSound(trendingSounds.tiktok || []);

  let systemPrompt = '';
  let sourceInfo: TikTokContentResponse['sourceInfo'] = undefined;

  if (mode === 'self') {
    // Self Mode: テーマから新規生成
    systemPrompt = `あなたは${style?.name || account}のTikTokコンテンツクリエイターです。
テキストオーバーレイ形式の動画用スクリプトを生成してください。

【アカウントの特徴】
- トーン: ${style?.tone || '明るくポジティブ'}
- ターゲット: ${style?.description || '副業に興味がある人'}
- キーワード: ${style?.keywords?.join('、') || '副業、在宅、収入'}

【タスク】
以下のテーマから1つ選んで、TikTok テキストオーバーレイ動画用のコンテンツを生成してください：
${style?.contentThemes?.map((t, i) => `${i + 1}. ${t}`).join('\n') || '- 収入公開\n- 働き方の魅力'}

【出力形式】
以下のJSON形式で出力してください：
{
  "caption": "動画の説明文（100-150文字、絵文字適度に）",
  "textOverlays": [
    "画面に表示するテキスト1（フック、興味を引く）",
    "テキスト2（問題提起または共感）",
    "テキスト3（解決策の提示）",
    "テキスト4（具体的なメリット）",
    "テキスト5（行動喚起CTA）"
  ],
  "backgroundPrompt": "背景画像/動画のプロンプト（英語、aesthetic、9:16縦長）"
}

【重要なルール】
- ハッシュタグは含めない
- textOverlaysは5〜7個、各テキストは15〜25文字
- 冒頭3秒で視聴者を掴む（フック重要）
- 最後にCTAを入れる
- 縦長動画を想定したレイアウト`;

    sourceInfo = { type: 'past_post' };

  } else {
    // Transform Mode: 他人の投稿をアレンジ
    const sourceBuzz = selectBuzzPost(buzzStock, account);

    if (sourceBuzz) {
      systemPrompt = `あなたは${style?.name || account}のTikTokコンテンツクリエイターです。
テキストオーバーレイ形式の動画用スクリプトを生成してください。

【アカウントの特徴】
- トーン: ${style?.tone || '明るくポジティブ'}
- ターゲット: ${style?.description || '副業に興味がある人'}
- キーワード: ${style?.keywords?.join('、') || '副業、在宅、収入'}

【参考にする投稿（他アカウント）】
"""
${sourceBuzz.desc.substring(0, 500)}
"""
${sourceBuzz.music ? `使用音楽: ${sourceBuzz.music.title}` : ''}

【タスク】
上記の投稿のテーマ・構成を参考に、${style?.name || account}のアカウント風にアレンジしたテキストオーバーレイ動画を生成してください。

【出力形式】
以下のJSON形式で出力してください：
{
  "caption": "動画の説明文（100-150文字、絵文字適度に）",
  "textOverlays": [
    "画面に表示するテキスト1（フック、興味を引く）",
    "テキスト2（問題提起または共感）",
    "テキスト3（解決策の提示）",
    "テキスト4（具体的なメリット）",
    "テキスト5（行動喚起CTA）"
  ],
  "backgroundPrompt": "背景画像/動画のプロンプト（英語、aesthetic、9:16縦長）"
}

【重要なルール】
- 元の投稿をそのままコピーしない、テーマだけ借りる
- 数字や具体例は自分のアカウント用に変更する
- ハッシュタグは含めない
- textOverlaysは5〜7個、各テキストは15〜25文字
- 冒頭3秒で視聴者を掴む（フック重要）`;

      sourceInfo = { type: 'buzz_stock', originalText: sourceBuzz.desc.substring(0, 100) };
    } else {
      // buzz_stockがない場合はselfモードと同様にテーマから生成
      return generateTikTokContent('self', account);
    }
  }

  // AI生成
  const model = getModel();
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: 'TikTok テキストオーバーレイ動画用のコンテンツを生成してください。',
  });

  // JSONをパース
  let parsed: any = {};
  try {
    // JSON部分を抽出
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[TikTok Content] JSON parse error:', error);
    // フォールバック
    parsed = {
      caption: result.text.substring(0, 150),
      textOverlays: ['これ知ってた？', '実は...', '詳しくはプロフィールから', 'DMで相談OK'],
      backgroundPrompt: 'aesthetic gradient background, soft colors, 9:16 vertical',
    };
  }

  // 背景画像を生成
  let generatedImage: TikTokContentResponse['generatedImage'] = undefined;
  try {
    const imagenClient = getImagenClient();
    const imageResult = await imagenClient.generateTextOverlayBackground(
      parsed.backgroundPrompt || 'aesthetic gradient background vertical',
      style?.name === 'チャトレ事務所' ? 'chatre' : 'liver',
      'tiktok'
    );

    if (imageResult.success && imageResult.images.length > 0) {
      const img = imageResult.images[0];
      generatedImage = {
        dataUrl: toDataUrl(img.base64, img.mimeType),
        base64: img.base64,
        mimeType: img.mimeType,
      };
      console.log('[TikTok Content] Background image generated successfully');
    }
  } catch (imageError) {
    console.error('[TikTok Content] Image generation failed:', imageError);
    // 画像生成に失敗してもコンテンツは返す
  }

  return {
    caption: parsed.caption || '',
    suggestedSound,
    textOverlays: parsed.textOverlays || [],
    backgroundPrompt: parsed.backgroundPrompt || 'aesthetic gradient background, 9:16 vertical',
    generatedImage,
    sourceInfo,
  };
}

// ========== API ハンドラ ==========

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: TikTokContentRequest = await request.json();
    const { mode, account, videoType } = body;

    // バリデーション
    if (!mode || !['self', 'transform'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    if (!account || !['liver', 'chatre'].includes(account)) {
      return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
    }

    console.log(`[TikTok Content] Generating ${mode} content for ${account}...`);

    const content = await generateTikTokContent(mode, account);

    // content_queue に追加（base64は除外して保存サイズを抑える）
    const queue = loadContentQueue();
    const newItem = {
      id: `tt_${Date.now()}`,
      status: 'pending',
      caption: content.caption,
      suggestedSound: content.suggestedSound,
      textOverlays: content.textOverlays,
      backgroundPrompt: content.backgroundPrompt,
      hasImage: !!content.generatedImage,
      createdAt: new Date().toISOString(),
      account,
      mode,
      videoType: 'text_overlay',
      source: mode === 'transform' ? 'buzz_stock' : 'original',
    };
    queue.tiktok.push(newItem);
    queue.updatedAt = new Date().toISOString();
    saveContentQueue(queue);

    // Obsidian 自動保存
    if (process.env.OBSIDIAN_AUTO_SAVE === 'true') {
      try {
        const isVaultAccessible = await checkVaultAccess();
        if (isVaultAccessible) {
          const obsidian = getObsidianClient();
          const contentNote = createTikTokContentNote(
            { queueId: newItem.id, content },
            account
          );
          const saveResult = await obsidian.saveContentWithImage(
            contentNote,
            content.generatedImage?.base64,
            content.generatedImage?.mimeType
          );
          await obsidian.appendToLog({
            timestamp: new Date().toISOString(),
            action: 'TikTok Content Saved',
            success: saveResult.contentResult.success,
            details: { contentId: newItem.id, account, mode },
            error: saveResult.contentResult.error,
          });
          console.log(`[TikTok Content] Saved to Obsidian: ${saveResult.contentResult.filePath}`);
        }
      } catch (obsidianError) {
        console.error('[TikTok Content] Obsidian save error (non-blocking):', obsidianError);
      }
    }

    console.log(`[TikTok Content] Generated in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      content,
      queueId: newItem.id,
      processingTime: Date.now() - startTime,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TikTok Content] Error:', error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

// GET: キュー状態確認
export async function GET() {
  const queue = loadContentQueue();
  const pendingCount = queue.tiktok.filter((item: any) => item.status === 'pending').length;

  return NextResponse.json({
    status: 'ok',
    totalCount: queue.tiktok.length,
    pendingCount,
    lastUpdated: queue.updatedAt,
  });
}

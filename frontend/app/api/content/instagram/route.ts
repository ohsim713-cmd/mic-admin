/**
 * Instagram コンテンツ生成 API
 *
 * 機能:
 * - リール用キャプション・スクリプト生成
 * - 50:50戦略（self: 過去投稿リライト / transform: 他人投稿アレンジ）
 * - トレンドBGM提案
 * - アカウント別スタイル対応
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';
import { getModel } from '@/lib/ai/model';
import { getImagenClient, toDataUrl } from '@/lib/imagen';

export const runtime = 'nodejs';
export const maxDuration = 60; // 画像生成を含むため延長

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ========== 型定義 ==========

interface InstagramContentRequest {
  mode: 'self' | 'transform';
  account: 'liver' | 'chatre';
  contentType: 'reel';  // リールメイン
}

interface InstagramContentResponse {
  caption: string;
  suggestedSound: string | null;
  textOverlays: string[];
  imagePrompt: string;
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
  caption: string;
  author: string;
  type: string;
  engagementScore: number;
  music?: {
    title: string;
    artist: string;
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
    console.error('[IG Content] Error loading account styles:', error);
  }
  return {};
}

function loadBuzzStock(): BuzzStockItem[] {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'instagram_buzz_stock.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[IG Content] Error loading buzz stock:', error);
  }
  return [];
}

function loadTrendingSounds(): { instagram: Array<{ title: string; artist: string }> } {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'trending_sounds.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[IG Content] Error loading trending sounds:', error);
  }
  return { instagram: [] };
}

function loadContentQueue(): { instagram: any[]; tiktok?: any[]; updatedAt?: string } {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'content_queue.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[IG Content] Error loading content queue:', error);
  }
  return { instagram: [], tiktok: [] };
}

function saveContentQueue(queue: any): void {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'content_queue.json');
    fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), 'utf-8');
  } catch (error) {
    console.error('[IG Content] Error saving content queue:', error);
  }
}

function selectRandomSound(sounds: Array<{ title: string; artist: string }>): string | null {
  if (sounds.length === 0) return null;
  const sound = sounds[Math.floor(Math.random() * sounds.length)];
  return `${sound.title} - ${sound.artist}`;
}

function selectBuzzPost(buzzStock: BuzzStockItem[], account: 'liver' | 'chatre'): BuzzStockItem | null {
  // アカウントタイプに合った投稿を優先
  const filtered = buzzStock.filter(item => item.type === account || item.type === 'general');
  if (filtered.length === 0) return null;

  // エンゲージメントスコアで重み付けしてランダム選択
  const sorted = filtered.sort((a, b) => b.engagementScore - a.engagementScore);
  const topPosts = sorted.slice(0, Math.min(10, sorted.length));
  return topPosts[Math.floor(Math.random() * topPosts.length)];
}

// ========== メイン処理 ==========

async function generateInstagramContent(
  mode: 'self' | 'transform',
  account: 'liver' | 'chatre'
): Promise<InstagramContentResponse> {
  const styles = loadAccountStyles();
  const style = styles[account];
  const buzzStock = loadBuzzStock();
  const trendingSounds = loadTrendingSounds();

  // トレンドサウンドを選択
  const suggestedSound = selectRandomSound(trendingSounds.instagram || []);

  let systemPrompt = '';
  let sourceInfo: InstagramContentResponse['sourceInfo'] = undefined;

  if (mode === 'self') {
    // Self Mode: 過去の成功投稿をリライト
    // 注意: 実際の過去投稿データがない場合はテーマから生成
    systemPrompt = `あなたは${style?.name || account}のInstagramリール用コンテンツクリエイターです。

【アカウントの特徴】
- トーン: ${style?.tone || '明るくポジティブ'}
- ターゲット: ${style?.description || '副業に興味がある人'}
- キーワード: ${style?.keywords?.join('、') || '副業、在宅、収入'}

【タスク】
以下のテーマから1つ選んで、Instagram リール用のコンテンツを生成してください：
${style?.contentThemes?.map((t, i) => `${i + 1}. ${t}`).join('\n') || '- 収入公開\n- 働き方の魅力'}

【出力形式】
以下のJSON形式で出力してください：
{
  "caption": "リールのキャプション（200-300文字、改行あり、絵文字適度に使用）",
  "textOverlays": ["画面に表示するテキスト1", "テキスト2", "テキスト3", "テキスト4", "テキスト5"],
  "imagePrompt": "背景画像生成用のプロンプト（英語、シンプルで明るい雰囲気）"
}

【重要なルール】
- ハッシュタグは含めない
- textOverlaysは5〜8個、各10〜20文字程度
- 視聴者の興味を引く冒頭にする
- CTAは自然に入れる（DMで相談、プロフィールのリンクなど）`;

    sourceInfo = { type: 'past_post' };

  } else {
    // Transform Mode: 他人の投稿をアレンジ
    const sourceBuzz = selectBuzzPost(buzzStock, account);

    if (sourceBuzz) {
      systemPrompt = `あなたは${style?.name || account}のInstagramリール用コンテンツクリエイターです。

【アカウントの特徴】
- トーン: ${style?.tone || '明るくポジティブ'}
- ターゲット: ${style?.description || '副業に興味がある人'}
- キーワード: ${style?.keywords?.join('、') || '副業、在宅、収入'}

【参考にする投稿（他アカウント）】
"""
${sourceBuzz.caption.substring(0, 500)}
"""

【タスク】
上記の投稿のテーマ・構成を参考に、${style?.name || account}のアカウント風にアレンジしたリールコンテンツを生成してください。

【出力形式】
以下のJSON形式で出力してください：
{
  "caption": "リールのキャプション（200-300文字、改行あり、絵文字適度に使用）",
  "textOverlays": ["画面に表示するテキスト1", "テキスト2", "テキスト3", "テキスト4", "テキスト5"],
  "imagePrompt": "背景画像生成用のプロンプト（英語、シンプルで明るい雰囲気）"
}

【重要なルール】
- 元の投稿をそのままコピーしない、テーマだけ借りる
- 数字や具体例は自分のアカウント用に変更する
- ハッシュタグは含めない
- textOverlaysは5〜8個、各10〜20文字程度
- CTAは自然に入れる`;

      sourceInfo = { type: 'buzz_stock', originalText: sourceBuzz.caption.substring(0, 100) };
    } else {
      // buzz_stockがない場合はselfモードと同様にテーマから生成
      return generateInstagramContent('self', account);
    }
  }

  // AI生成
  const model = getModel();
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: 'Instagram リール用のコンテンツを生成してください。',
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
    console.error('[IG Content] JSON parse error:', error);
    // フォールバック
    parsed = {
      caption: result.text.substring(0, 300),
      textOverlays: ['チェックしてね', '詳しくはプロフィールから', 'DMで相談OK'],
      imagePrompt: 'bright colorful background, modern aesthetic',
    };
  }

  // 背景画像を生成
  let generatedImage: InstagramContentResponse['generatedImage'] = undefined;
  try {
    const imagenClient = getImagenClient();
    const imageResult = await imagenClient.generateTextOverlayBackground(
      parsed.imagePrompt || 'bright colorful aesthetic background',
      style?.name === 'チャトレ事務所' ? 'chatre' : 'liver',
      'instagram'
    );

    if (imageResult.success && imageResult.images.length > 0) {
      const img = imageResult.images[0];
      generatedImage = {
        dataUrl: toDataUrl(img.base64, img.mimeType),
        base64: img.base64,
        mimeType: img.mimeType,
      };
      console.log('[IG Content] Background image generated successfully');
    }
  } catch (imageError) {
    console.error('[IG Content] Image generation failed:', imageError);
    // 画像生成に失敗してもコンテンツは返す
  }

  return {
    caption: parsed.caption || '',
    suggestedSound,
    textOverlays: parsed.textOverlays || [],
    imagePrompt: parsed.imagePrompt || 'bright colorful background',
    generatedImage,
    sourceInfo,
  };
}

// ========== API ハンドラ ==========

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: InstagramContentRequest = await request.json();
    const { mode, account, contentType } = body;

    // バリデーション
    if (!mode || !['self', 'transform'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    if (!account || !['liver', 'chatre'].includes(account)) {
      return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
    }

    console.log(`[IG Content] Generating ${mode} content for ${account}...`);

    const content = await generateInstagramContent(mode, account);

    // content_queue に追加（base64は除外して保存サイズを抑える）
    const queue = loadContentQueue();
    const newItem = {
      id: `ig_${Date.now()}`,
      status: 'pending',
      caption: content.caption,
      suggestedSound: content.suggestedSound,
      textOverlays: content.textOverlays,
      imagePrompt: content.imagePrompt,
      hasImage: !!content.generatedImage,
      createdAt: new Date().toISOString(),
      account,
      mode,
      source: mode === 'transform' ? 'buzz_stock' : 'original',
    };
    queue.instagram.push(newItem);
    queue.updatedAt = new Date().toISOString();
    saveContentQueue(queue);

    console.log(`[IG Content] Generated in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      content,
      queueId: newItem.id,
      processingTime: Date.now() - startTime,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[IG Content] Error:', error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

// GET: キュー状態確認
export async function GET() {
  const queue = loadContentQueue();
  const pendingCount = queue.instagram.filter((item: any) => item.status === 'pending').length;

  return NextResponse.json({
    status: 'ok',
    totalCount: queue.instagram.length,
    pendingCount,
    lastUpdated: queue.updatedAt,
  });
}

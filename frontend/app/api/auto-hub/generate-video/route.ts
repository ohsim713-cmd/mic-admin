/**
 * Auto Hub - 動画スクリプト自動生成API
 * ショート動画（TikTok/Reels/Shorts）用の台本を自動生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const LOGS_PATH = path.join(process.cwd(), 'knowledge', 'auto_hub_logs.json');
const VIDEO_STOCK_PATH = path.join(process.cwd(), 'knowledge', 'video_stock.json');

// 動画トピックのバリエーション
const VIDEO_TOPICS = [
  {
    id: 'success_story',
    topic: 'チャットレディで月収30万達成した主婦の話',
    mood: 'inspiring',
    hook: '実は、このやり方で...',
  },
  {
    id: 'tips',
    topic: '稼げるチャットレディになる3つのコツ',
    mood: 'informative',
    hook: '知らないと損する...',
  },
  {
    id: 'myth_busting',
    topic: 'チャットレディの誤解と真実',
    mood: 'honest',
    hook: 'よく聞かれるんですけど...',
  },
  {
    id: 'day_in_life',
    topic: 'チャットレディの1日のスケジュール',
    mood: 'casual',
    hook: '実際どんな感じで働いてるの？',
  },
  {
    id: 'beginner_guide',
    topic: '未経験からチャットレディを始めるには',
    mood: 'supportive',
    hook: '始めようか迷ってる人へ...',
  },
  {
    id: 'income_reveal',
    topic: 'チャットレディの収入ぶっちゃけ話',
    mood: 'honest',
    hook: 'ぶっちゃけいくら稼げるの？',
  },
];

async function generateScript(topic: string, mood: string, hook: string): Promise<string | null> {
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `あなたはショート動画（TikTok/Reels/Shorts）のプロ脚本家です。
以下のテーマに基づいて、15秒程度のショート動画の台本（セリフのみ）を作成してください。

【テーマ】: ${topic}
【ムード】: ${mood}
【冒頭フック】: ${hook}

【出力ルール】
- 15秒で話しきれる長さ（約60文字前後）にしてください
- 冒頭に「${hook}」を使った興味を引くフレーズを入れてください
- セリフのみを出力してください。ト書きや説明は不要です
- 視聴者が最後まで見たくなるような構成にしてください
- 最後に「詳しくはプロフをチェック」などのCTAを入れてください
- 文字数は厳守してください

出力例:
「実は、この方法を知るだけで月収が5万アップするんです。誰でもできる簡単なコツ、今から教えちゃいますね！詳しくはプロフのリンクをチェック！」`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[Auto Hub Video] Generation error:', error);
    return null;
  }
}

async function saveToStock(script: string, topicId: string): Promise<void> {
  let stock: any[] = [];
  try {
    const data = await fs.readFile(VIDEO_STOCK_PATH, 'utf-8');
    stock = JSON.parse(data);
  } catch {}

  stock.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    script,
    topicId,
    createdAt: new Date().toISOString(),
    used: false,
  });

  // 最新30本を保持
  if (stock.length > 30) {
    stock = stock.slice(-30);
  }

  const dir = path.dirname(VIDEO_STOCK_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(VIDEO_STOCK_PATH, JSON.stringify(stock, null, 2));
}

async function logGeneration(success: boolean, topicId: string, error?: string): Promise<void> {
  let logs: any = { text: [], image: [], video: [] };
  try {
    const data = await fs.readFile(LOGS_PATH, 'utf-8');
    logs = JSON.parse(data);
  } catch {}

  logs.video = logs.video || [];
  logs.video.unshift({
    id: `${Date.now()}`,
    timestamp: new Date().toISOString(),
    success,
    topicId,
    error,
  });

  // 最新100件を保持
  logs.video = logs.video.slice(0, 100);

  const dir = path.dirname(LOGS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(LOGS_PATH, JSON.stringify(logs, null, 2));
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { topicId, dryRun = false, saveToStockOnly = true } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEYが設定されていません' }, { status: 500 });
    }

    // トピックを選択（指定がなければランダム）
    const selectedTopic = topicId
      ? VIDEO_TOPICS.find(t => t.id === topicId) || VIDEO_TOPICS[0]
      : VIDEO_TOPICS[Math.floor(Math.random() * VIDEO_TOPICS.length)];

    console.log(`[Auto Hub Video] Generating script for: ${selectedTopic.id}`);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        topic: selectedTopic,
      });
    }

    // スクリプト生成
    const script = await generateScript(selectedTopic.topic, selectedTopic.mood, selectedTopic.hook);

    if (!script) {
      await logGeneration(false, selectedTopic.id, 'Script generation failed');
      return NextResponse.json({
        success: false,
        error: 'スクリプト生成に失敗しました',
      }, { status: 500 });
    }

    // ストックに保存
    if (saveToStockOnly) {
      await saveToStock(script, selectedTopic.id);
      await logGeneration(true, selectedTopic.id);

      return NextResponse.json({
        success: true,
        savedToStock: true,
        topicId: selectedTopic.id,
        script,
        processingTime: Date.now() - startTime,
      });
    }

    await logGeneration(true, selectedTopic.id);

    return NextResponse.json({
      success: true,
      script,
      topic: selectedTopic,
      processingTime: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error('[Auto Hub Video] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// GET: ストック状態を取得
export async function GET() {
  try {
    let stock: any[] = [];
    try {
      const data = await fs.readFile(VIDEO_STOCK_PATH, 'utf-8');
      stock = JSON.parse(data);
    } catch {}

    const unused = stock.filter(s => !s.used);
    const byTopic = VIDEO_TOPICS.reduce((acc, topic) => {
      acc[topic.id] = unused.filter(s => s.topicId === topic.id).length;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      total: stock.length,
      unused: unused.length,
      byTopic,
      topics: VIDEO_TOPICS,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

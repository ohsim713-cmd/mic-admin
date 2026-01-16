import { NextRequest, NextResponse } from 'next/server';
import fs from "fs";
import path from "path";
import crypto from 'crypto';
import { runPostGraph } from '@/lib/langgraph';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const SETTINGS_FILE = path.join(KNOWLEDGE_DIR, 'twitter_credentials.json');
const AUTO_POST_LOG = path.join(KNOWLEDGE_DIR, 'auto_post_log.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';

// 復号化
function decrypt(text: string): string {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

// Twitter認証情報読み込み
function loadCredentials() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      apiKey: parsed.apiKey ? decrypt(parsed.apiKey) : '',
      apiSecret: parsed.apiSecret ? decrypt(parsed.apiSecret) : '',
      accessToken: parsed.accessToken ? decrypt(parsed.accessToken) : '',
      accessSecret: parsed.accessSecret ? decrypt(parsed.accessSecret) : '',
    };
  } catch {
    return null;
  }
}

// JSONファイル読み込み
function loadJSON(filename: string) {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Failed to load ${filename}:`, e);
  }
  return null;
}

// 投稿ログ保存
function savePostLog(log: any) {
  try {
    let logs = [];
    if (fs.existsSync(AUTO_POST_LOG)) {
      logs = JSON.parse(fs.readFileSync(AUTO_POST_LOG, 'utf-8'));
    }
    logs.push(log);
    // 最新100件のみ保持
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }
    fs.writeFileSync(AUTO_POST_LOG, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('Failed to save post log:', e);
  }
}

// 今日の投稿数を取得
function getTodayPostCount(): number {
  try {
    if (!fs.existsSync(AUTO_POST_LOG)) return 0;
    const logs = JSON.parse(fs.readFileSync(AUTO_POST_LOG, 'utf-8'));
    const today = new Date().toISOString().split('T')[0];
    return logs.filter((log: any) => log.postedAt?.startsWith(today) && log.success).length;
  } catch {
    return 0;
  }
}

// 現在時刻に最適な投稿タイプを取得
function getCurrentPostType(): { type: string; slot: number; time: string } {
  const strategy = loadJSON('x_daily15_strategy.json');
  if (!strategy?.daily15PostStrategy?.schedule) {
    return { type: '求人', slot: 1, time: '20:00' };
  }

  const schedule = strategy.daily15PostStrategy.schedule;
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  // 現在時刻に最も近いスロットを探す
  let closestSlot = schedule[0];
  let minDiff = Infinity;

  for (const slot of schedule) {
    const [hour, minute] = slot.time.split(':').map(Number);
    const slotTime = hour * 60 + minute;
    const diff = Math.abs(slotTime - currentTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestSlot = slot;
    }
  }

  return {
    type: closestSlot.type,
    slot: closestSlot.slot,
    time: closestSlot.time
  };
}

// GET: 自動投稿の状態確認
export async function GET() {
  const todayCount = getTodayPostCount();
  const currentSlot = getCurrentPostType();
  const credentials = loadCredentials();

  // 最新のログを取得
  let recentLogs: any[] = [];
  try {
    if (fs.existsSync(AUTO_POST_LOG)) {
      const logs = JSON.parse(fs.readFileSync(AUTO_POST_LOG, 'utf-8'));
      recentLogs = logs.slice(-10).reverse();
    }
  } catch {}

  return NextResponse.json({
    status: 'active',
    mode: 'langgraph', // LangGraphモード
    todayPostCount: todayCount,
    maxDailyPosts: 15,
    currentSlot,
    credentialsConfigured: !!(credentials?.apiKey && credentials?.accessToken),
    recentLogs,
  });
}

// POST: LangGraphで自動投稿実行
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // URLパラメータでモード選択（legacy = 旧方式）
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'langgraph';

  // 1日15投稿の上限チェック
  const todayCount = getTodayPostCount();
  if (todayCount >= 15) {
    return NextResponse.json({
      success: false,
      message: '本日の投稿上限（15件）に達しました',
      todayCount
    });
  }

  // 現在の投稿タイプを取得
  const currentSlot = getCurrentPostType();

  // ========== LangGraph モード ==========
  if (mode === 'langgraph') {
    try {
      console.log('[LangGraph] Starting post flow...');

      // LangGraphでフロー実行
      const result = await runPostGraph({
        postType: currentSlot.type,
        slot: currentSlot.slot,
        targetAudience: '副業を探している20-40代女性',
        maxRevisions: 2,
      });

      // ログ保存
      const log = {
        postedAt: new Date().toISOString(),
        success: result.posted,
        tweetId: result.tweetId,
        error: result.error,
        slot: currentSlot.slot,
        type: currentSlot.type,
        postText: (result.revisedPost || result.generatedPost).substring(0, 100) + '...',
        processingTime: Date.now() - startTime,
        mode: 'langgraph',
        qualityScore: result.qualityScore?.overall,
        revisionCount: result.revisionCount,
        flowLogs: result.logs,
      };
      savePostLog(log);

      if (result.posted) {
        return NextResponse.json({
          success: true,
          message: `投稿完了 (${todayCount + 1}/15) [LangGraph]`,
          tweetId: result.tweetId,
          slot: currentSlot,
          postText: result.revisedPost || result.generatedPost,
          qualityScore: result.qualityScore,
          revisionCount: result.revisionCount,
          flowLogs: result.logs,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error,
          slot: currentSlot,
          generatedPost: result.generatedPost,
          flowLogs: result.logs,
        }, { status: 500 });
      }
    } catch (error: any) {
      console.error('[LangGraph] Error:', error);
      const log = {
        postedAt: new Date().toISOString(),
        success: false,
        error: `LangGraph error: ${error.message}`,
        slot: currentSlot.slot,
        type: currentSlot.type,
        mode: 'langgraph',
      };
      savePostLog(log);
      return NextResponse.json({ success: false, error: log.error }, { status: 500 });
    }
  }

  // ========== Legacy モード（フォールバック） ==========
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const { TwitterApi } = await import('twitter-api-v2');

  const apiKey = process.env.GEMINI_API_KEY || "";
  const genAI = new GoogleGenerativeAI(apiKey);

  // メリットリスト
  const benefits = [
    { label: '通勤ゼロ', desc: '家から一歩も出ずに稼げる' },
    { label: '時間自由', desc: '好きな時間に好きなだけ働ける' },
    { label: '顔出しなし', desc: '完全匿名で身バレの心配なし' },
    { label: '日払いOK', desc: '働いたらすぐお金になる' },
    { label: '高収入', desc: '月収10万〜50万、頑張り次第で青天井' },
  ];
  const benefit = benefits[Math.floor(Math.random() * benefits.length)];

  try {
    // 投稿生成
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const prompt = `あなたは在宅ワーク求人のプロコピーライターです。
【投稿タイプ】${currentSlot.type}
【強調メリット】${benefit.label} - ${benefit.desc}
ルール: 200-280文字、体験談風、数字入れる、ハッシュタグ禁止、2-3行ごと空行
投稿文のみ出力。`;

    const result = await model.generateContent(prompt);
    const generatedPost = result.response.text().trim();

    // X投稿
    const credentials = loadCredentials();
    if (!credentials?.apiKey) {
      throw new Error('X API credentials not configured');
    }

    const client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });

    const tweet = await client.v2.tweet(generatedPost);

    // ログ保存
    const log = {
      postedAt: new Date().toISOString(),
      success: true,
      tweetId: tweet.data.id,
      slot: currentSlot.slot,
      type: currentSlot.type,
      postText: generatedPost.substring(0, 100) + '...',
      processingTime: Date.now() - startTime,
      mode: 'legacy',
    };
    savePostLog(log);

    return NextResponse.json({
      success: true,
      message: `投稿完了 (${todayCount + 1}/15) [Legacy]`,
      tweetId: tweet.data.id,
      slot: currentSlot,
      postText: generatedPost,
    });
  } catch (error: any) {
    const log = {
      postedAt: new Date().toISOString(),
      success: false,
      error: error.message,
      slot: currentSlot.slot,
      type: currentSlot.type,
      mode: 'legacy',
    };
    savePostLog(log);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

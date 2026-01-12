import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import crypto from 'crypto';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

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

// 投稿テンプレートを取得
function getPostTemplate(postType: string): string {
  const strategy = loadJSON('x_daily15_strategy.json');
  const templates = strategy?.daily15PostStrategy?.templates;
  if (!templates || !templates[postType]) {
    return '';
  }
  const typeTemplates = templates[postType];
  return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
}

// AI投稿生成
async function generateAutoPost(postType: string, template: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // メリットリスト
  const benefits = [
    { label: '通勤ゼロ', desc: '家から一歩も出ずに稼げる' },
    { label: '時間自由', desc: '好きな時間に好きなだけ働ける' },
    { label: '人間関係なし', desc: '上司も同僚もいない' },
    { label: '顔出しなし', desc: '完全匿名で身バレの心配なし' },
    { label: '日払いOK', desc: '働いたらすぐお金になる' },
    { label: 'スマホ1台', desc: '初期費用ゼロで始められる' },
    { label: '年齢不問', desc: '30代40代でも需要がある' },
    { label: '高収入', desc: '月収10万〜50万、頑張り次第で青天井' },
  ];
  const benefit = benefits[Math.floor(Math.random() * benefits.length)];

  const prompt = `
あなたは在宅ワーク求人のプロコピーライターです。
以下の投稿タイプに合った投稿を作成してください。

【投稿タイプ】${postType}
【参考テンプレート】${template}
【強調メリット】${benefit.label} - ${benefit.desc}

### ルール
- 200-280文字（短く刺さる）
- 「私」視点のリアルな体験談風
- 数字を具体的に入れる（時間、金額、日数）
- ハッシュタグ禁止
- 2-3行ごとに空行
- ${postType === '求人' ? '最後に「気になる方はDMへ💬」のようなCTAを入れる' : 'CTAは軽めに、または省略'}
- テンプレートをそのまま使わず、新鮮な表現で

投稿文のみ出力。説明不要。
`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// Xに投稿
async function postToX(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const credentials = loadCredentials();
  if (!credentials?.apiKey || !credentials?.accessToken) {
    return { success: false, error: 'X API credentials not configured' };
  }

  try {
    const client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });

    const tweet = await client.v2.tweet(text);
    return { success: true, tweetId: tweet.data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
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
    todayPostCount: todayCount,
    maxDailyPosts: 15,
    currentSlot,
    credentialsConfigured: !!(credentials?.apiKey && credentials?.accessToken),
    recentLogs,
  });
}

// POST: 自動投稿実行
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Cron認証（オプション）
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // 認証ヘッダーがない場合は手動実行として許可（開発用）
    // 本番では必要に応じてコメントアウトを外す
    // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const template = getPostTemplate(currentSlot.type);

  // 投稿文を生成
  let generatedPost: string;
  try {
    generatedPost = await generateAutoPost(currentSlot.type, template);
  } catch (error: any) {
    const log = {
      postedAt: new Date().toISOString(),
      success: false,
      error: `Generation failed: ${error.message}`,
      slot: currentSlot.slot,
      type: currentSlot.type,
    };
    savePostLog(log);
    return NextResponse.json({ success: false, error: log.error }, { status: 500 });
  }

  // Xに投稿
  const result = await postToX(generatedPost);

  // ログ保存
  const log = {
    postedAt: new Date().toISOString(),
    success: result.success,
    tweetId: result.tweetId,
    error: result.error,
    slot: currentSlot.slot,
    type: currentSlot.type,
    postText: generatedPost.substring(0, 100) + '...',
    processingTime: Date.now() - startTime,
  };
  savePostLog(log);

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: `投稿完了 (${todayCount + 1}/15)`,
      tweetId: result.tweetId,
      slot: currentSlot,
      postText: generatedPost,
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error,
      slot: currentSlot,
      generatedPost,
    }, { status: 500 });
  }
}

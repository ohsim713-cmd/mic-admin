/**
 * 競合バズ投稿分析エージェント
 *
 * 競合アカウントのバズ投稿を収集し、
 * 型・教訓を抽出して自分の投稿に活かす
 */

import fs from 'fs';
import path from 'path';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const COMPETITOR_PATTERNS_FILE = path.join(KNOWLEDGE_DIR, 'competitor_patterns.json');

// ========================================
// 型定義
// ========================================

export interface CompetitorBuzzPost {
  id: string;
  text: string;
  account: string;
  accountName?: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  engagementRate: number;
  postedAt: string;
  collectedAt: string;
}

export interface ExtractedPattern {
  id: string;
  type: 'hook' | 'structure' | 'cta' | 'emotion' | 'benefit' | 'theme';
  pattern: string;
  example: string;
  lesson: string;
  liverExample?: string; // ライバー/チャトレ用にアレンジした例
  themeIdea?: string; // テーマ・話題のアレンジ案
  score: number; // 1-10
  sourcePost: string;
  sourceAccount: string;
  extractedAt: string;
}

export interface CompetitorPatternsDB {
  posts: CompetitorBuzzPost[];
  patterns: ExtractedPattern[];
  lastUpdated: string;
  totalAnalyzed: number;
}

// ========================================
// 参考アカウントリスト（業種問わずバズ投稿から学ぶ）
// ========================================

export const REFERENCE_ACCOUNTS = [
  // マーケティング・コピーライティング系（型が上手い）
  { handle: 'shota_ueyama', name: '上山翔太', category: 'marketing' as const },
  { handle: 'manaborinnn', name: 'まなぼりん', category: 'marketing' as const },
  // インフルエンサー系（エンゲージメント高い）
  { handle: 'and_and__', name: 'あんど', category: 'influencer' as const },
  // 副業・稼ぐ系（ターゲット層が近い）
  { handle: 'fukugyou_navi', name: '副業ナビ', category: 'side_job' as const },
  // 必要に応じて追加
];

// 旧名（互換性のため）
export const COMPETITOR_ACCOUNTS = REFERENCE_ACCOUNTS;

// ========================================
// DB操作
// ========================================

function loadPatternsDB(): CompetitorPatternsDB {
  try {
    if (fs.existsSync(COMPETITOR_PATTERNS_FILE)) {
      return JSON.parse(fs.readFileSync(COMPETITOR_PATTERNS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[CompetitorAnalyzer] Failed to load DB:', e);
  }
  return {
    posts: [],
    patterns: [],
    lastUpdated: '',
    totalAnalyzed: 0,
  };
}

function savePatternsDB(db: CompetitorPatternsDB): void {
  try {
    const dir = path.dirname(COMPETITOR_PATTERNS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db.lastUpdated = new Date().toISOString();
    fs.writeFileSync(COMPETITOR_PATTERNS_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('[CompetitorAnalyzer] Failed to save DB:', e);
  }
}

// ========================================
// X API でバズ投稿を取得
// ========================================

export async function fetchCompetitorBuzzPosts(
  usernames: string[],
  bearerToken: string,
  minEngagement: number = 100
): Promise<CompetitorBuzzPost[]> {
  const posts: CompetitorBuzzPost[] = [];

  for (const username of usernames) {
    try {
      // ユーザーID取得
      const userRes = await fetch(
        `https://api.twitter.com/2/users/by/username/${username}`,
        {
          headers: { Authorization: `Bearer ${bearerToken}` },
        }
      );

      if (!userRes.ok) continue;
      const userData = await userRes.json();
      const userId = userData.data?.id;
      if (!userId) continue;

      // 最近のツイート取得（メトリクス付き）
      const tweetsRes = await fetch(
        `https://api.twitter.com/2/users/${userId}/tweets?max_results=20&tweet.fields=created_at,public_metrics`,
        {
          headers: { Authorization: `Bearer ${bearerToken}` },
        }
      );

      if (!tweetsRes.ok) continue;
      const tweetsData = await tweetsRes.json();

      for (const tweet of tweetsData.data || []) {
        const metrics = tweet.public_metrics || {};
        const impressions = metrics.impression_count || 0;
        const likes = metrics.like_count || 0;
        const retweets = metrics.retweet_count || 0;
        const replies = metrics.reply_count || 0;
        const totalEngagement = likes + retweets + replies;

        // エンゲージメントが閾値以上のみ収集
        if (totalEngagement >= minEngagement) {
          posts.push({
            id: tweet.id,
            text: tweet.text,
            account: username,
            impressions,
            likes,
            retweets,
            replies,
            engagementRate: impressions > 0 ? (totalEngagement / impressions) * 100 : 0,
            postedAt: tweet.created_at || '',
            collectedAt: new Date().toISOString(),
          });
        }
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.error(`[CompetitorAnalyzer] Failed to fetch @${username}:`, e);
    }
  }

  return posts;
}

// ========================================
// AIで型・教訓を抽出
// ========================================

export async function extractPatterns(
  posts: CompetitorBuzzPost[],
  targetIndustry: 'liver' | 'chatlady' = 'liver'
): Promise<ExtractedPattern[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[CompetitorAnalyzer] GEMINI_API_KEY not set');
    return [];
  }

  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    temperature: 0.3,
    maxOutputTokens: 2048,
    apiKey,
  });

  const patterns: ExtractedPattern[] = [];

  // 投稿をまとめて分析
  const postsText = posts
    .map((p, i) => `【${i + 1}】@${p.account} (いいね${p.likes})\n${p.text}`)
    .join('\n\n---\n\n');

  const industryContext = targetIndustry === 'liver'
    ? 'ライバー事務所（配信者募集）'
    : 'チャットレディ事務所（在宅ワーク募集）';

  const prompt = `あなたはSNSマーケティングのプロです。
以下のバズ投稿（業種は様々）を分析し、**${industryContext}の投稿に応用できる「型」「教訓」「テーマ」**を抽出してください。

=== バズ投稿（参考） ===
${postsText}

=== あなたのタスク ===
上記の投稿は業種が異なりますが、「なぜバズったのか」の本質を抽出し、
**${industryContext}の募集投稿**に応用できる形でパターン化してください。

抽出する型（各1-3個ずつ、合計8-12個）:

1. **theme（テーマ・話題）**: バズった話題・切り口を${industryContext}版にアレンジ
   - 例: 「AIに仕事奪われる人の特徴」→「ライバーで稼げない人の特徴」
   - 例: 「年収1000万の人の朝習慣」→「月収30万ライバーの配信ルーティン」

2. hook（冒頭のフック）: 読者の目を止める最初の1文のパターン

3. structure（構成）: 投稿全体の流れ・構成パターン

4. cta（行動喚起）: DMや反応を促す部分のパターン

5. emotion（感情）: 刺さる感情トリガーのパターン

6. benefit（メリット）: 具体的な数字やメリットの見せ方

=== 出力形式（JSON配列） ===
[
  {
    "type": "theme",
    "pattern": "テーマの抽象化（例: 【○○な人の特徴N選】）",
    "example": "元投稿のテーマ・話題",
    "lesson": "なぜこのテーマがバズるのか",
    "themeIdea": "${industryContext}版のテーマ案（そのまま使える形で）",
    "liverExample": "このテーマで書く投稿の冒頭例",
    "score": 9,
    "sourceIndex": 1
  },
  {
    "type": "hook",
    "pattern": "パターンの抽象化",
    "example": "元投稿からの引用",
    "lesson": "なぜこれがバズるのか",
    "liverExample": "${industryContext}に応用した具体例（1文）",
    "score": 8,
    "sourceIndex": 2
  },
  ...
]

【重要】
- **themeは最優先で2-3個抽出する**（テーマのパクリが最も効果的）
- 元の投稿の業種に関係なく、「型」の本質を抽出する
- themeIdea/liverExampleは必ず${industryContext}向けの具体例を書く
- 必ず有効なJSONのみを出力`;

  try {
    const result = await model.invoke(prompt);
    const content = result.content as string;

    // JSON抽出
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[CompetitorAnalyzer] Failed to parse JSON');
      return [];
    }

    const extracted = JSON.parse(jsonMatch[0]);

    for (const item of extracted) {
      const sourcePost = posts[item.sourceIndex - 1];
      patterns.push({
        id: `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: item.type,
        pattern: item.pattern,
        example: item.example,
        lesson: item.lesson,
        liverExample: item.liverExample, // ライバー用にアレンジした例
        themeIdea: item.themeIdea, // テーマ・話題のアレンジ案
        score: item.score || 7,
        sourcePost: sourcePost?.text?.slice(0, 100) || '',
        sourceAccount: sourcePost?.account || '',
        extractedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('[CompetitorAnalyzer] AI extraction failed:', e);
  }

  return patterns;
}

// ========================================
// 競合分析フルサイクル
// ========================================

export async function runCompetitorAnalysis(
  bearerToken: string,
  customAccounts?: string[],
  targetIndustry: 'liver' | 'chatlady' = 'liver'
): Promise<{
  postsCollected: number;
  patternsExtracted: number;
  newPatterns: ExtractedPattern[];
}> {
  const db = loadPatternsDB();
  const existingPostIds = new Set(db.posts.map(p => p.id));

  // 参考アカウントからバズ投稿を取得（業種問わず）
  const accounts = customAccounts || REFERENCE_ACCOUNTS.map(a => a.handle);
  const newPosts = await fetchCompetitorBuzzPosts(accounts, bearerToken, 50);

  // 新規投稿のみフィルタ
  const uniqueNewPosts = newPosts.filter(p => !existingPostIds.has(p.id));

  if (uniqueNewPosts.length === 0) {
    return { postsCollected: 0, patternsExtracted: 0, newPatterns: [] };
  }

  // DBに投稿を追加
  db.posts.push(...uniqueNewPosts);

  // 最新投稿からパターン抽出（ライバー/チャトレ用にアレンジ）
  const newPatterns = await extractPatterns(uniqueNewPosts, targetIndustry);
  db.patterns.push(...newPatterns);
  db.totalAnalyzed += uniqueNewPosts.length;

  // 古いデータを削除（最新100投稿、50パターンを保持）
  db.posts = db.posts.slice(-100);
  db.patterns = db.patterns.slice(-50);

  savePatternsDB(db);

  console.log(`[CompetitorAnalyzer] Collected ${uniqueNewPosts.length} posts, extracted ${newPatterns.length} patterns`);

  return {
    postsCollected: uniqueNewPosts.length,
    patternsExtracted: newPatterns.length,
    newPatterns,
  };
}

// ========================================
// 投稿生成時に使うパターン取得
// ========================================

export function getTopPatterns(limit: number = 10): ExtractedPattern[] {
  const db = loadPatternsDB();
  return db.patterns
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getPatternsByType(type: ExtractedPattern['type']): ExtractedPattern[] {
  const db = loadPatternsDB();
  return db.patterns.filter(p => p.type === type);
}

// テーマ（話題・切り口）のアイデアを取得
export function getThemeIdeas(limit: number = 5): Array<{
  theme: string;
  example: string;
  lesson: string;
}> {
  const db = loadPatternsDB();
  return db.patterns
    .filter(p => p.type === 'theme' && p.themeIdea)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(p => ({
      theme: p.themeIdea!,
      example: p.liverExample || p.example,
      lesson: p.lesson,
    }));
}

// ランダムにテーマを1つ取得
export function getRandomTheme(): { theme: string; example: string } | null {
  const themes = getThemeIdeas(10);
  if (themes.length === 0) return null;
  const idx = Math.floor(Math.random() * themes.length);
  return { theme: themes[idx].theme, example: themes[idx].example };
}

export function getRandomPattern(): ExtractedPattern | null {
  const db = loadPatternsDB();
  if (db.patterns.length === 0) return null;
  const idx = Math.floor(Math.random() * db.patterns.length);
  return db.patterns[idx];
}

// ========================================
// 統計情報
// ========================================

export function getCompetitorStats(): {
  totalPosts: number;
  totalPatterns: number;
  patternsByType: Record<string, number>;
  topAccounts: Array<{ account: string; count: number }>;
  lastUpdated: string;
} {
  const db = loadPatternsDB();

  const patternsByType: Record<string, number> = {};
  for (const p of db.patterns) {
    patternsByType[p.type] = (patternsByType[p.type] || 0) + 1;
  }

  const accountCounts: Record<string, number> = {};
  for (const p of db.posts) {
    accountCounts[p.account] = (accountCounts[p.account] || 0) + 1;
  }

  const topAccounts = Object.entries(accountCounts)
    .map(([account, count]) => ({ account, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalPosts: db.posts.length,
    totalPatterns: db.patterns.length,
    patternsByType,
    topAccounts,
    lastUpdated: db.lastUpdated,
  };
}

export default {
  fetchCompetitorBuzzPosts,
  extractPatterns,
  runCompetitorAnalysis,
  getTopPatterns,
  getPatternsByType,
  getRandomPattern,
  getCompetitorStats,
  COMPETITOR_ACCOUNTS,
};

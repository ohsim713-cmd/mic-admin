/**
 * 成功パターン データベース
 * 高スコアの投稿パターンを自動蓄積・学習
 */

import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PATTERNS_FILE = path.join(DATA_DIR, 'success_patterns.json');

export interface SuccessPattern {
  id: string;
  pattern: string;           // 成功パターン（書き出しや表現）
  category: 'hook' | 'cta' | 'benefit' | 'empathy';
  score: number;             // 平均スコア
  usageCount: number;        // 使用回数
  dmRate?: number;           // DM獲得率（%）
  engagementRate?: number;   // エンゲージメント率（%）
  createdAt: string;
  updatedAt: string;
}

export interface SuccessPatternsDB {
  patterns: SuccessPattern[];
  lastUpdated: string;
  version: number;
}

// デフォルトパターン（初期値）
const DEFAULT_PATTERNS: SuccessPattern[] = [
  {
    id: '1',
    pattern: 'ぶっちゃけ、〜って思ってる人へ',
    category: 'hook',
    score: 8.5,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    pattern: '正直、〜だと思ってない？',
    category: 'hook',
    score: 8.2,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    pattern: '〜なんて無理って思ってた私が',
    category: 'hook',
    score: 8.0,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    pattern: '気になったらDMで💬',
    category: 'cta',
    score: 8.3,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    pattern: '気軽に話聞かせて',
    category: 'cta',
    score: 8.1,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '6',
    pattern: '月30万以上',
    category: 'benefit',
    score: 8.4,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '7',
    pattern: 'スマホ1台で',
    category: 'benefit',
    score: 8.2,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '8',
    pattern: '初月から稼げた',
    category: 'benefit',
    score: 8.6,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * データディレクトリを確保
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * DBを読み込み
 */
async function loadDB(): Promise<SuccessPatternsDB> {
  await ensureDataDir();

  try {
    const data = await fs.readFile(PATTERNS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // ファイルがなければデフォルトで初期化
    const defaultDB: SuccessPatternsDB = {
      patterns: DEFAULT_PATTERNS,
      lastUpdated: new Date().toISOString(),
      version: 1,
    };
    await saveDB(defaultDB);
    return defaultDB;
  }
}

/**
 * DBを保存
 */
async function saveDB(db: SuccessPatternsDB): Promise<void> {
  await ensureDataDir();
  db.lastUpdated = new Date().toISOString();
  await fs.writeFile(PATTERNS_FILE, JSON.stringify(db, null, 2));
}

/**
 * 成功パターン一覧を取得
 */
export async function getSuccessPatterns(
  category?: SuccessPattern['category']
): Promise<string[]> {
  const db = await loadDB();
  let patterns = db.patterns;

  if (category) {
    patterns = patterns.filter((p) => p.category === category);
  }

  // スコア順にソート
  patterns.sort((a, b) => b.score - a.score);

  return patterns.map((p) => p.pattern);
}

/**
 * 成功パターンの詳細を取得
 */
export async function getPatternDetails(): Promise<SuccessPattern[]> {
  const db = await loadDB();
  return db.patterns.sort((a, b) => b.score - a.score);
}

/**
 * 新しい成功パターンを追加
 */
export async function addSuccessPattern(
  pattern: string,
  category: SuccessPattern['category'],
  score: number
): Promise<SuccessPattern> {
  const db = await loadDB();

  // 既存パターンがあれば更新
  const existing = db.patterns.find(
    (p) => p.pattern.toLowerCase() === pattern.toLowerCase()
  );

  if (existing) {
    existing.score = (existing.score * existing.usageCount + score) / (existing.usageCount + 1);
    existing.usageCount += 1;
    existing.updatedAt = new Date().toISOString();
    await saveDB(db);
    return existing;
  }

  // 新規追加
  const newPattern: SuccessPattern = {
    id: Date.now().toString(),
    pattern,
    category,
    score,
    usageCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.patterns.push(newPattern);
  await saveDB(db);
  return newPattern;
}

/**
 * パターンのスコアを更新
 */
export async function updatePatternScore(
  patternId: string,
  newScore: number,
  dmRate?: number,
  engagementRate?: number
): Promise<void> {
  const db = await loadDB();
  const pattern = db.patterns.find((p) => p.id === patternId);

  if (pattern) {
    // 移動平均でスコアを更新
    pattern.score = (pattern.score * pattern.usageCount + newScore) / (pattern.usageCount + 1);
    pattern.usageCount += 1;

    if (dmRate !== undefined) {
      pattern.dmRate = dmRate;
    }
    if (engagementRate !== undefined) {
      pattern.engagementRate = engagementRate;
    }

    pattern.updatedAt = new Date().toISOString();
    await saveDB(db);
  }
}

/**
 * 投稿からパターンを抽出して学習
 */
export async function learnFromPost(
  postText: string,
  score: number,
  gotDM: boolean
): Promise<void> {
  // フック（書き出し）を抽出
  const hookPatterns = [
    /^(ぶっちゃけ[、,]?[^。\n]{0,20})/,
    /^(正直[、,]?[^。\n]{0,20})/,
    /^([^。\n]{0,15}って思ってる人)/,
    /^([^。\n]{0,15}だと思ってない？)/,
  ];

  for (const regex of hookPatterns) {
    const match = postText.match(regex);
    if (match && score >= 8.0) {
      await addSuccessPattern(match[1], 'hook', score);
    }
  }

  // CTA（最後の誘導）を抽出
  const ctaPatterns = [
    /(DM[でへ][^。\n]{0,10}[💬✨🌟]?)/,
    /(気軽に[^。\n]{0,15})/,
    /(話聞かせて[^。\n]{0,10}[💬✨]?)/,
  ];

  for (const regex of ctaPatterns) {
    const match = postText.match(regex);
    if (match && score >= 8.0) {
      await addSuccessPattern(match[1], 'cta', score);
    }
  }

  // ベネフィット表現を抽出
  const benefitPatterns = [
    /(月[0-9０-９]+万[円以上]{0,3})/,
    /(スマホ[0-9１]台[でで]{0,2})/,
    /(完全[在宅未経験]{2,4})/,
    /(初月から[^。\n]{0,10})/,
  ];

  for (const regex of benefitPatterns) {
    const match = postText.match(regex);
    if (match && score >= 8.0) {
      await addSuccessPattern(match[1], 'benefit', score);
    }
  }
}

/**
 * DB統計情報を取得
 */
export async function getDBStats(): Promise<{
  totalPatterns: number;
  byCategory: Record<string, number>;
  avgScore: number;
  lastUpdated: string;
}> {
  const db = await loadDB();

  const byCategory: Record<string, number> = {};
  let totalScore = 0;

  for (const pattern of db.patterns) {
    byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1;
    totalScore += pattern.score;
  }

  return {
    totalPatterns: db.patterns.length,
    byCategory,
    avgScore: db.patterns.length > 0 ? totalScore / db.patterns.length : 0,
    lastUpdated: db.lastUpdated,
  };
}

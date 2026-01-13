/**
 * DM Hunter - 成功パターンDB
 * 7点以上の投稿を蓄積し、次回生成時の参考にする
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AccountType } from './sns-adapter';

const DB_PATH = path.join(process.cwd(), 'knowledge', 'success_patterns.json');

export interface SuccessPattern {
  id: string;
  account: AccountType;
  text: string;
  score: number;
  target: string;
  benefit: string;
  pattern: string;
  createdAt: string;
}

interface SuccessPatternsDB {
  patterns: SuccessPattern[];
  stats: {
    totalSaved: number;
    avgScore: number;
    lastUpdated: string;
  };
}

/**
 * DBを読み込む
 */
async function loadDB(): Promise<SuccessPatternsDB> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      patterns: [],
      stats: {
        totalSaved: 0,
        avgScore: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

/**
 * DBを保存する
 */
async function saveDB(db: SuccessPatternsDB): Promise<void> {
  const dir = path.dirname(DB_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * 成功パターンを保存（7点以上のみ）
 */
export async function saveSuccessPattern(
  account: AccountType,
  text: string,
  score: number,
  target: string,
  benefit: string,
  pattern: string
): Promise<boolean> {
  // 7点未満は保存しない
  if (score < 7) {
    return false;
  }

  const db = await loadDB();

  // 重複チェック（同じテキストは保存しない）
  const isDuplicate = db.patterns.some(p => p.text === text);
  if (isDuplicate) {
    return false;
  }

  const newPattern: SuccessPattern = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    account,
    text,
    score,
    target,
    benefit,
    pattern,
    createdAt: new Date().toISOString(),
  };

  db.patterns.push(newPattern);

  // 各アカウントごとに最新20件を保持（古いものは削除）
  const accounts: AccountType[] = ['liver', 'chatre1', 'chatre2'];
  for (const acc of accounts) {
    const accPatterns = db.patterns
      .filter(p => p.account === acc)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (accPatterns.length > 20) {
      const toRemove = accPatterns.slice(20);
      db.patterns = db.patterns.filter(p => !toRemove.includes(p));
    }
  }

  // 統計更新
  db.stats.totalSaved = db.patterns.length;
  db.stats.avgScore = db.patterns.reduce((sum, p) => sum + p.score, 0) / db.patterns.length;
  db.stats.lastUpdated = new Date().toISOString();

  await saveDB(db);
  console.log(`[SuccessPatterns] Saved: ${account} score=${score}`);
  return true;
}

/**
 * アカウント別の成功パターンを取得
 */
export async function getSuccessPatterns(
  account: AccountType,
  limit: number = 5
): Promise<SuccessPattern[]> {
  const db = await loadDB();

  return db.patterns
    .filter(p => p.account === account)
    .sort((a, b) => b.score - a.score) // 高スコア順
    .slice(0, limit);
}

/**
 * 成功パターンからプロンプト用のサンプルを生成
 */
export async function getSuccessExamplesForPrompt(
  account: AccountType,
  limit: number = 3
): Promise<string> {
  const patterns = await getSuccessPatterns(account, limit);

  if (patterns.length === 0) {
    return '';
  }

  const examples = patterns.map((p, i) =>
    `### 例${i + 1}（スコア: ${p.score}/10）\n${p.text}`
  ).join('\n\n');

  return `## 過去の高評価投稿（参考にして）\n${examples}`;
}

/**
 * 統計情報を取得
 */
export async function getStats(): Promise<{
  total: number;
  avgScore: number;
  byAccount: Record<AccountType, number>;
}> {
  const db = await loadDB();

  const byAccount: Record<AccountType, number> = {
    liver: db.patterns.filter(p => p.account === 'liver').length,
    chatre1: db.patterns.filter(p => p.account === 'chatre1').length,
    chatre2: db.patterns.filter(p => p.account === 'chatre2').length,
  };

  return {
    total: db.stats.totalSaved,
    avgScore: Math.round(db.stats.avgScore * 10) / 10,
    byAccount,
  };
}

/**
 * DM Hunter - 投稿ストック管理
 * 各アカウントに3件ずつの投稿を常にストックしておく
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AccountType } from './sns-adapter';
import { generateDMPostForAccount, GeneratedPost } from './generator';
import { checkQuality, QualityScore } from './quality-checker';

const STOCK_PATH = path.join(process.cwd(), 'data', 'post_stock.json');

// ストック設定
export const STOCK_CONFIG = {
  minStockPerAccount: 3,  // 各アカウントの最小ストック数
  maxStockPerAccount: 5,  // 各アカウントの最大ストック数
  minQualityScore: 7,     // ストックに入れる最低品質スコア
};

export interface StockedPost {
  id: string;
  account: AccountType;
  text: string;
  target: string;
  benefit: string;
  pattern: string;
  score: number;
  createdAt: string;
  usedAt?: string;
}

interface PostStockDB {
  stocks: StockedPost[];
  stats: {
    totalGenerated: number;
    totalUsed: number;
    lastRefill: string;
  };
}

/**
 * DBを読み込む
 */
async function loadDB(): Promise<PostStockDB> {
  try {
    const data = await fs.readFile(STOCK_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      stocks: [],
      stats: {
        totalGenerated: 0,
        totalUsed: 0,
        lastRefill: new Date().toISOString(),
      },
    };
  }
}

/**
 * DBを保存する
 */
async function saveDB(db: PostStockDB): Promise<void> {
  const dir = path.dirname(STOCK_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STOCK_PATH, JSON.stringify(db, null, 2));
}

// Twitterアカウントのみの型（内部名）
export type TwitterAccountType = 'liver' | 'chatre1' | 'chatre2';

// 内部名 → AccountType のマッピング
const TWITTER_TO_ACCOUNT: Record<TwitterAccountType, AccountType> = {
  liver: 'tt_liver',
  chatre1: 'chatre1',
  chatre2: 'chatre2',
};

/**
 * アカウント別のストック数を取得
 */
export async function getStockCounts(): Promise<Record<TwitterAccountType, number>> {
  const db = await loadDB();

  const counts: Record<TwitterAccountType, number> = {
    liver: 0,
    chatre1: 0,
    chatre2: 0,
  };

  for (const stock of db.stocks) {
    if (!stock.usedAt && stock.account !== 'wordpress') {
      counts[stock.account as TwitterAccountType]++;
    }
  }

  return counts;
}

/**
 * ストック状況を取得
 */
export async function getStockStatus(): Promise<{
  counts: Record<TwitterAccountType, number>;
  needsRefill: TwitterAccountType[];
  stocks: StockedPost[];
  stats: PostStockDB['stats'];
}> {
  const db = await loadDB();
  const counts = await getStockCounts();

  const needsRefill: TwitterAccountType[] = [];
  for (const account of ['liver', 'chatre1', 'chatre2'] as const) {
    if (counts[account] < STOCK_CONFIG.minStockPerAccount) {
      needsRefill.push(account);
    }
  }

  // 未使用のストックのみ返す
  const availableStocks = db.stocks.filter(s => !s.usedAt);

  return {
    counts,
    needsRefill,
    stocks: availableStocks,
    stats: db.stats,
  };
}

/**
 * 1件の投稿をストックに追加
 */
async function addToStock(
  account: AccountType,
  post: GeneratedPost,
  score: number
): Promise<StockedPost> {
  const db = await loadDB();

  const stockedPost: StockedPost = {
    id: `stock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    account,
    text: post.text,
    target: post.target.label,
    benefit: post.benefit.label,
    pattern: post.pattern.label,
    score,
    createdAt: new Date().toISOString(),
  };

  db.stocks.push(stockedPost);
  db.stats.totalGenerated++;
  db.stats.lastRefill = new Date().toISOString();

  // アカウントごとに最大数を超えたら古いものを削除
  const accountStocks = db.stocks
    .filter(s => s.account === account && !s.usedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (accountStocks.length > STOCK_CONFIG.maxStockPerAccount) {
    const toRemove = accountStocks.slice(STOCK_CONFIG.maxStockPerAccount);
    db.stocks = db.stocks.filter(s => !toRemove.includes(s));
  }

  await saveDB(db);
  console.log(`[PostStock] Added: ${account} score=${score}`);

  return stockedPost;
}

/**
 * ストックから投稿を取得して使用済みにする
 */
export async function useFromStock(account: AccountType): Promise<StockedPost | null> {
  const db = await loadDB();

  // 未使用で最もスコアが高いものを取得
  const available = db.stocks
    .filter(s => s.account === account && !s.usedAt)
    .sort((a, b) => b.score - a.score);

  if (available.length === 0) {
    return null;
  }

  const post = available[0];
  post.usedAt = new Date().toISOString();
  db.stats.totalUsed++;

  await saveDB(db);
  console.log(`[PostStock] Used: ${post.id} for ${account}`);

  return post;
}

/**
 * 指定アカウントのストックを補充
 */
export async function refillStock(account: TwitterAccountType): Promise<{
  added: number;
  failed: number;
  currentStock: number;
}> {
  const counts = await getStockCounts();
  const currentCount = counts[account];
  const needed = STOCK_CONFIG.minStockPerAccount - currentCount;

  if (needed <= 0) {
    return { added: 0, failed: 0, currentStock: currentCount };
  }

  let added = 0;
  let failed = 0;

  for (let i = 0; i < needed + 1; i++) { // 1つ余分に生成（品質チェックで落ちる可能性があるため）
    try {
      // 内部アカウント名をAccountTypeに変換
      const accountType = TWITTER_TO_ACCOUNT[account];
      const post = await generateDMPostForAccount(accountType);
      const score = checkQuality(post.text);

      if (score.total >= STOCK_CONFIG.minQualityScore) {
        await addToStock(accountType, post, score.total);
        added++;

        // 目標数に達したら終了
        if (added >= needed) break;
      } else {
        console.log(`[PostStock] Rejected: ${account} score=${score.total}`);
        failed++;
      }
    } catch (error) {
      console.error(`[PostStock] Generation error for ${account}:`, error);
      failed++;
    }
  }

  const newCounts = await getStockCounts();
  return { added, failed, currentStock: newCounts[account] };
}

/**
 * 全アカウントのストックを補充
 */
export async function refillAllStocks(): Promise<{
  results: Record<TwitterAccountType, { added: number; failed: number; currentStock: number }>;
  totalAdded: number;
}> {
  const accounts: TwitterAccountType[] = ['liver', 'chatre1', 'chatre2'];
  const results: Record<TwitterAccountType, { added: number; failed: number; currentStock: number }> = {} as any;
  let totalAdded = 0;

  // 並列で補充
  await Promise.all(
    accounts.map(async (account) => {
      const result = await refillStock(account);
      results[account] = result;
      totalAdded += result.added;
    })
  );

  console.log(`[PostStock] Refill complete: +${totalAdded} posts`);
  return { results, totalAdded };
}

/**
 * ストックから投稿を取得、なければ新規生成
 */
export async function getPostForAccount(account: TwitterAccountType): Promise<{
  post: StockedPost | GeneratedPost;
  fromStock: boolean;
  stockRemaining: number;
}> {
  // 内部アカウント名をAccountTypeに変換
  const accountType = TWITTER_TO_ACCOUNT[account];

  // まずストックから取得を試みる
  const stockedPost = await useFromStock(accountType);

  if (stockedPost) {
    const counts = await getStockCounts();
    return {
      post: stockedPost,
      fromStock: true,
      stockRemaining: counts[account],
    };
  }

  // ストックがなければ新規生成
  console.log(`[PostStock] No stock for ${account}, generating new...`);
  const newPost = await generateDMPostForAccount(accountType);
  const counts = await getStockCounts();

  return {
    post: newPost,
    fromStock: false,
    stockRemaining: counts[account],
  };
}

/**
 * ストックの詳細を取得（プレビュー用）
 */
export async function getStockDetails(account?: AccountType): Promise<StockedPost[]> {
  const db = await loadDB();

  let stocks = db.stocks.filter(s => !s.usedAt);

  if (account) {
    stocks = stocks.filter(s => s.account === account);
  }

  return stocks.sort((a, b) => b.score - a.score);
}

/**
 * 特定のストックを削除
 */
export async function deleteStock(stockId: string): Promise<boolean> {
  const db = await loadDB();
  const index = db.stocks.findIndex(s => s.id === stockId);

  if (index === -1) return false;

  db.stocks.splice(index, 1);
  await saveDB(db);

  console.log(`[PostStock] Deleted: ${stockId}`);
  return true;
}

/**
 * ストックが不足しているかチェック
 */
export async function checkStockLevels(): Promise<{
  isLow: boolean;
  lowAccounts: TwitterAccountType[];
  message: string;
}> {
  const counts = await getStockCounts();
  const lowAccounts: TwitterAccountType[] = [];

  for (const account of ['liver', 'chatre1', 'chatre2'] as const) {
    if (counts[account] < STOCK_CONFIG.minStockPerAccount) {
      lowAccounts.push(account);
    }
  }

  const isLow = lowAccounts.length > 0;
  const message = isLow
    ? `ストック不足: ${lowAccounts.join(', ')} (各${STOCK_CONFIG.minStockPerAccount}件必要)`
    : 'ストック十分';

  return { isLow, lowAccounts, message };
}

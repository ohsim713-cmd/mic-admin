/**
 * 投稿ストック - Firestore版
 * 既存の post-stock.ts を Firestore に移行
 */

import { getDB, COLLECTIONS, StockedPostDoc, nowTimestamp, timestampToISO } from './firestore';
import { AccountType } from '../dm-hunter/sns-adapter';
import { generateDMPostForAccount, GeneratedPost } from '../dm-hunter/generator';
import { checkQuality } from '../dm-hunter/quality-checker';

// ストック設定
export const STOCK_CONFIG = {
  minStockPerAccount: 3,
  maxStockPerAccount: 5,
  minQualityScore: 7,
};

// Twitterアカウントのみの型（内部名）
type TwitterAccountType = 'liver' | 'chatre1' | 'chatre2';

// 内部名 → AccountType のマッピング
const TWITTER_TO_ACCOUNT: Record<TwitterAccountType, AccountType> = {
  liver: 'tt_liver',
  chatre1: 'chatre1',
  chatre2: 'chatre2',
};

// 外部向けの型（ISO文字列）
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

/**
 * Firestore ドキュメントを外部向け型に変換
 */
function docToStockedPost(doc: StockedPostDoc): StockedPost {
  return {
    id: doc.id,
    account: doc.account as AccountType,
    text: doc.text,
    target: doc.target,
    benefit: doc.benefit,
    pattern: doc.pattern,
    score: doc.score,
    createdAt: timestampToISO(doc.createdAt) || new Date().toISOString(),
    usedAt: timestampToISO(doc.usedAt),
  };
}

/**
 * アカウント別のストック数を取得
 */
export async function getStockCounts(): Promise<Record<TwitterAccountType, number>> {
  const db = getDB();
  const counts: Record<TwitterAccountType, number> = {
    liver: 0,
    chatre1: 0,
    chatre2: 0,
  };

  // 未使用のストックをカウント
  const snapshot = await db
    .collection(COLLECTIONS.POST_STOCK)
    .where('usedAt', '==', null)
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data() as StockedPostDoc;
    if (data.account !== 'wordpress' && data.account in counts) {
      counts[data.account as TwitterAccountType]++;
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
  stats: { totalGenerated: number; totalUsed: number; lastRefill: string };
}> {
  const db = getDB();
  const counts = await getStockCounts();

  // 補充が必要なアカウント
  const needsRefill: TwitterAccountType[] = [];
  for (const account of ['liver', 'chatre1', 'chatre2'] as const) {
    if (counts[account] < STOCK_CONFIG.minStockPerAccount) {
      needsRefill.push(account);
    }
  }

  // 未使用のストックを取得
  const snapshot = await db
    .collection(COLLECTIONS.POST_STOCK)
    .where('usedAt', '==', null)
    .orderBy('createdAt', 'desc')
    .get();

  const stocks = snapshot.docs.map(doc => docToStockedPost(doc.data() as StockedPostDoc));

  // 統計情報（別コレクションまたは集計）
  const totalSnapshot = await db.collection(COLLECTIONS.POST_STOCK).count().get();
  const usedSnapshot = await db
    .collection(COLLECTIONS.POST_STOCK)
    .where('usedAt', '!=', null)
    .count()
    .get();

  return {
    counts,
    needsRefill,
    stocks,
    stats: {
      totalGenerated: totalSnapshot.data().count,
      totalUsed: usedSnapshot.data().count,
      lastRefill: new Date().toISOString(),
    },
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
  const db = getDB();
  const id = `stock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const stockDoc: StockedPostDoc = {
    id,
    account,
    text: post.text,
    target: post.target.label,
    benefit: post.benefit.label,
    pattern: post.pattern.label,
    score,
    createdAt: nowTimestamp(),
  };

  await db.collection(COLLECTIONS.POST_STOCK).doc(id).set(stockDoc);
  console.log(`[PostStock] Added: ${account} score=${score}`);

  // アカウントごとに最大数を超えたら古いものを削除
  const accountStocks = await db
    .collection(COLLECTIONS.POST_STOCK)
    .where('account', '==', account)
    .where('usedAt', '==', null)
    .orderBy('createdAt', 'desc')
    .get();

  if (accountStocks.docs.length > STOCK_CONFIG.maxStockPerAccount) {
    const toDelete = accountStocks.docs.slice(STOCK_CONFIG.maxStockPerAccount);
    const batch = db.batch();
    for (const doc of toDelete) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  return docToStockedPost(stockDoc);
}

/**
 * ストックから投稿を取得して使用済みにする
 */
export async function useFromStock(account: AccountType): Promise<StockedPost | null> {
  const db = getDB();

  // 未使用で最もスコアが高いものを取得
  const snapshot = await db
    .collection(COLLECTIONS.POST_STOCK)
    .where('account', '==', account)
    .where('usedAt', '==', null)
    .orderBy('score', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as StockedPostDoc;

  // 使用済みにマーク
  await doc.ref.update({
    usedAt: nowTimestamp(),
  });

  console.log(`[PostStock] Used: ${data.id} for ${account}`);

  return docToStockedPost({
    ...data,
    usedAt: nowTimestamp(),
  });
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

  for (let i = 0; i < needed + 1; i++) {
    try {
      // 内部アカウント名をAccountTypeに変換
      const accountType = TWITTER_TO_ACCOUNT[account];
      const post = await generateDMPostForAccount(accountType);
      const score = checkQuality(post.text);

      if (score.total >= STOCK_CONFIG.minQualityScore) {
        await addToStock(accountType, post, score.total);
        added++;

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
  const stockedPost = await useFromStock(accountType);

  if (stockedPost) {
    const counts = await getStockCounts();
    return {
      post: stockedPost,
      fromStock: true,
      stockRemaining: counts[account],
    };
  }

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
  const db = getDB();

  let query = db
    .collection(COLLECTIONS.POST_STOCK)
    .where('usedAt', '==', null)
    .orderBy('score', 'desc');

  if (account) {
    query = db
      .collection(COLLECTIONS.POST_STOCK)
      .where('account', '==', account)
      .where('usedAt', '==', null)
      .orderBy('score', 'desc');
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => docToStockedPost(doc.data() as StockedPostDoc));
}

/**
 * 特定のストックを削除
 */
export async function deleteStock(stockId: string): Promise<boolean> {
  const db = getDB();
  const docRef = db.collection(COLLECTIONS.POST_STOCK).doc(stockId);
  const doc = await docRef.get();

  if (!doc.exists) return false;

  await docRef.delete();
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

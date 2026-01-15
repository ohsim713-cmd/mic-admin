/**
 * Firebase/Firestore エクスポート
 *
 * 使用方法:
 * import { getStockCounts, refillStock } from '@/lib/firebase';
 */

// Firestore 接続
export { getDB, COLLECTIONS } from './firestore';
export type { StockedPostDoc, SuccessPatternDoc, PostHistoryDoc } from './firestore';

// 投稿ストック
export {
  STOCK_CONFIG,
  getStockCounts,
  getStockStatus,
  useFromStock,
  refillStock,
  refillAllStocks,
  getPostForAccount,
  getStockDetails,
  deleteStock,
  checkStockLevels,
} from './post-stock-db';
export type { StockedPost } from './post-stock-db';

// 成功パターン
export {
  getSuccessPatterns,
  getPatternDetails,
  addSuccessPattern,
  updatePatternScore,
  learnFromPost,
  getDBStats,
} from './success-patterns-db';
export type { SuccessPattern } from './success-patterns-db';

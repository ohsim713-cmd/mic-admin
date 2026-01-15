/**
 * Firestore データベース接続
 * Google Cloud Firestore を使用してデータを永続化
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App | undefined;
let db: Firestore | undefined;

/**
 * Firestore インスタンスを取得
 * 環境変数から認証情報を読み込み
 */
export function getDB(): Firestore {
  if (db) {
    return db;
  }

  // 既存のアプリがあれば再利用
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    // 環境変数から認証情報を取得
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

    // Cloud Run では自動的に認証される（サービスアカウント）
    // ローカル開発では GOOGLE_APPLICATION_CREDENTIALS 環境変数を設定
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // ローカル開発: サービスアカウントキーファイルを使用
      app = initializeApp({
        credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        projectId,
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // 環境変数にJSON文字列として認証情報がある場合
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } else {
      // Cloud Run: デフォルト認証（ADC）を使用
      app = initializeApp({
        projectId,
      });
    }
  }

  db = getFirestore(app);

  // 設定（オプション）
  db.settings({
    ignoreUndefinedProperties: true,
  });

  return db;
}

// ========================================
// コレクション名の定義
// ========================================
export const COLLECTIONS = {
  POST_STOCK: 'post_stock',
  SUCCESS_PATTERNS: 'success_patterns',
  POSTS_HISTORY: 'posts_history',
  GENERATED_POSTS: 'generated_posts',
  SCHEDULES: 'schedules',
  INQUIRIES: 'inquiries',
  LEARNING_LOG: 'learning_log',
  AUTOMATION_CONFIG: 'automation_config',
} as const;

// ========================================
// 型定義
// ========================================

// 投稿ストック
export interface StockedPostDoc {
  id: string;
  account: string;
  text: string;
  target: string;
  benefit: string;
  pattern: string;
  score: number;
  createdAt: FirebaseFirestore.Timestamp;
  usedAt?: FirebaseFirestore.Timestamp;
}

// 成功パターン
export interface SuccessPatternDoc {
  id: string;
  pattern: string;
  category: 'hook' | 'cta' | 'benefit' | 'empathy';
  score: number;
  usageCount: number;
  dmRate?: number;
  engagementRate?: number;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// 投稿履歴
export interface PostHistoryDoc {
  id: string;
  account: string;
  text: string;
  postedAt: FirebaseFirestore.Timestamp;
  tweetId?: string;
  impressions?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
}

// ========================================
// ユーティリティ関数
// ========================================

/**
 * Timestamp を ISO文字列に変換
 */
export function timestampToISO(timestamp: FirebaseFirestore.Timestamp | undefined): string | undefined {
  if (!timestamp) return undefined;
  return timestamp.toDate().toISOString();
}

/**
 * ISO文字列を Timestamp に変換
 */
export function isoToTimestamp(isoString: string): FirebaseFirestore.Timestamp {
  const { Timestamp } = require('firebase-admin/firestore');
  return Timestamp.fromDate(new Date(isoString));
}

/**
 * 現在時刻の Timestamp を取得
 */
export function nowTimestamp(): FirebaseFirestore.Timestamp {
  const { Timestamp } = require('firebase-admin/firestore');
  return Timestamp.now();
}

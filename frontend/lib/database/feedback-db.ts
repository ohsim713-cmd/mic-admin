/**
 * フィードバック データベース
 * ユーザーのコメントを保存し、ナレッジベースに反映
 */

import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback_history.json');
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// フィードバックの種類
export type FeedbackType =
  | 'good'          // 良い投稿（成功パターンに追加）
  | 'bad'           // 悪い投稿（NGパターンに追加）
  | 'improve'       // 改善提案（プロンプト改善に活用）
  | 'style'         // スタイル指定（トーン・表現の調整）
  | 'delete';       // 削除（DBから除外）

export interface Feedback {
  id: string;
  postId: string;
  postText: string;
  type: FeedbackType;
  comment: string;
  createdAt: string;
  applied: boolean; // ナレッジに反映済みか
}

export interface FeedbackDB {
  feedbacks: Feedback[];
  lastUpdated: string;
}

/**
 * データディレクトリを確保
 */
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * DBを読み込み
 */
async function loadDB(): Promise<FeedbackDB> {
  await ensureDir(DATA_DIR);

  try {
    const data = await fs.readFile(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    const defaultDB: FeedbackDB = {
      feedbacks: [],
      lastUpdated: new Date().toISOString(),
    };
    await saveDB(defaultDB);
    return defaultDB;
  }
}

/**
 * DBを保存
 */
async function saveDB(db: FeedbackDB): Promise<void> {
  await ensureDir(DATA_DIR);
  db.lastUpdated = new Date().toISOString();
  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(db, null, 2));
}

/**
 * フィードバックを追加
 */
export async function addFeedback(
  postId: string,
  postText: string,
  type: FeedbackType,
  comment: string
): Promise<Feedback> {
  const db = await loadDB();

  const feedback: Feedback = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    postId,
    postText,
    type,
    comment,
    createdAt: new Date().toISOString(),
    applied: false,
  };

  db.feedbacks.push(feedback);
  await saveDB(db);

  // 即座にナレッジに反映
  await applyFeedbackToKnowledge(feedback);

  return feedback;
}

/**
 * フィードバックをナレッジベースに反映
 */
async function applyFeedbackToKnowledge(feedback: Feedback): Promise<void> {
  await ensureDir(KNOWLEDGE_DIR);

  try {
    switch (feedback.type) {
      case 'good':
        // 成功パターンに追加
        await addToSuccessPatterns(feedback.postText, feedback.comment);
        break;

      case 'bad':
        // NGパターンに追加
        await addToNgPatterns(feedback.postText, feedback.comment);
        break;

      case 'improve':
        // 改善提案を記録
        await addToImprovementLog(feedback.comment);
        break;

      case 'style':
        // スタイル指定を記録
        await addToStyleGuide(feedback.comment);
        break;

      case 'delete':
        // 何もしない（投稿削除は別途処理）
        break;
    }

    // 反映済みフラグを更新
    const db = await loadDB();
    const fb = db.feedbacks.find(f => f.id === feedback.id);
    if (fb) {
      fb.applied = true;
      await saveDB(db);
    }
  } catch (error) {
    console.error('フィードバック反映エラー:', error);
  }
}

/**
 * 成功パターンに追加
 */
async function addToSuccessPatterns(postText: string, comment: string): Promise<void> {
  const filePath = path.join(KNOWLEDGE_DIR, 'success_patterns.json');

  let patterns: any = { patterns: [], hooks: [], phrases: [] };
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    patterns = JSON.parse(data);
  } catch {
    // 新規作成
  }

  // 投稿全体を成功パターンとして追加
  if (!patterns.patterns) patterns.patterns = [];
  patterns.patterns.push({
    text: postText,
    reason: comment,
    addedAt: new Date().toISOString(),
  });

  // フックパターンを抽出（最初の1行）
  const firstLine = postText.split('\n')[0].trim();
  if (firstLine && firstLine.length < 50) {
    if (!patterns.hooks) patterns.hooks = [];
    if (!patterns.hooks.includes(firstLine)) {
      patterns.hooks.push(firstLine);
    }
  }

  await fs.writeFile(filePath, JSON.stringify(patterns, null, 2));
}

/**
 * NGパターンに追加
 */
async function addToNgPatterns(postText: string, comment: string): Promise<void> {
  const filePath = path.join(KNOWLEDGE_DIR, 'ng_patterns.json');

  let ngPatterns: any = { patterns: [], phrases: [] };
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    ngPatterns = JSON.parse(data);
  } catch {
    // 新規作成
  }

  if (!ngPatterns.patterns) ngPatterns.patterns = [];
  ngPatterns.patterns.push({
    text: postText,
    reason: comment,
    addedAt: new Date().toISOString(),
  });

  await fs.writeFile(filePath, JSON.stringify(ngPatterns, null, 2));
}

/**
 * 改善提案を記録
 */
async function addToImprovementLog(comment: string): Promise<void> {
  const filePath = path.join(KNOWLEDGE_DIR, 'improvement_log.json');

  let log: any = { improvements: [] };
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    log = JSON.parse(data);
  } catch {
    // 新規作成
  }

  if (!log.improvements) log.improvements = [];
  log.improvements.push({
    suggestion: comment,
    addedAt: new Date().toISOString(),
    implemented: false,
  });

  await fs.writeFile(filePath, JSON.stringify(log, null, 2));
}

/**
 * スタイルガイドに追加
 */
async function addToStyleGuide(comment: string): Promise<void> {
  const filePath = path.join(KNOWLEDGE_DIR, 'style_guide.json');

  let guide: any = { rules: [] };
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    guide = JSON.parse(data);
  } catch {
    // 新規作成
  }

  if (!guide.rules) guide.rules = [];
  guide.rules.push({
    rule: comment,
    addedAt: new Date().toISOString(),
  });

  await fs.writeFile(filePath, JSON.stringify(guide, null, 2));
}

/**
 * フィードバック履歴を取得
 */
export async function getFeedbacks(options?: {
  type?: FeedbackType;
  limit?: number;
}): Promise<Feedback[]> {
  const db = await loadDB();
  let feedbacks = [...db.feedbacks];

  if (options?.type) {
    feedbacks = feedbacks.filter(f => f.type === options.type);
  }

  // 新しい順にソート
  feedbacks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (options?.limit) {
    feedbacks = feedbacks.slice(0, options.limit);
  }

  return feedbacks;
}

/**
 * 統計情報を取得
 */
export async function getFeedbackStats(): Promise<{
  total: number;
  byType: Record<FeedbackType, number>;
  appliedCount: number;
}> {
  const db = await loadDB();

  const byType: Record<FeedbackType, number> = {
    good: 0,
    bad: 0,
    improve: 0,
    style: 0,
    delete: 0,
  };

  let appliedCount = 0;

  for (const fb of db.feedbacks) {
    byType[fb.type]++;
    if (fb.applied) appliedCount++;
  }

  return {
    total: db.feedbacks.length,
    byType,
    appliedCount,
  };
}

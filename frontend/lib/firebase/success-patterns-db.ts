/**
 * 成功パターン - Firestore版
 * 既存の success-patterns.ts を Firestore に移行
 */

import { getDB, COLLECTIONS, SuccessPatternDoc, nowTimestamp, timestampToISO } from './firestore';

export interface SuccessPattern {
  id: string;
  pattern: string;
  category: 'hook' | 'cta' | 'benefit' | 'empathy';
  score: number;
  usageCount: number;
  dmRate?: number;
  engagementRate?: number;
  createdAt: string;
  updatedAt: string;
}

// デフォルトパターン（初期値）
const DEFAULT_PATTERNS: Omit<SuccessPattern, 'createdAt' | 'updatedAt'>[] = [
  { id: '1', pattern: 'ぶっちゃけ、〜って思ってる人へ', category: 'hook', score: 8.5, usageCount: 0 },
  { id: '2', pattern: '正直、〜だと思ってない？', category: 'hook', score: 8.2, usageCount: 0 },
  { id: '3', pattern: '〜なんて無理って思ってた私が', category: 'hook', score: 8.0, usageCount: 0 },
  { id: '4', pattern: '気になったらDMで💬', category: 'cta', score: 8.3, usageCount: 0 },
  { id: '5', pattern: '気軽に話聞かせて', category: 'cta', score: 8.1, usageCount: 0 },
  { id: '6', pattern: '月30万以上', category: 'benefit', score: 8.4, usageCount: 0 },
  { id: '7', pattern: 'スマホ1台で', category: 'benefit', score: 8.2, usageCount: 0 },
  { id: '8', pattern: '初月から稼げた', category: 'benefit', score: 8.6, usageCount: 0 },
];

/**
 * Firestore ドキュメントを外部向け型に変換
 */
function docToPattern(doc: SuccessPatternDoc): SuccessPattern {
  return {
    id: doc.id,
    pattern: doc.pattern,
    category: doc.category,
    score: doc.score,
    usageCount: doc.usageCount,
    dmRate: doc.dmRate,
    engagementRate: doc.engagementRate,
    createdAt: timestampToISO(doc.createdAt) || new Date().toISOString(),
    updatedAt: timestampToISO(doc.updatedAt) || new Date().toISOString(),
  };
}

/**
 * 初期データを投入（コレクションが空の場合）
 */
async function ensureDefaultPatterns(): Promise<void> {
  const db = getDB();
  const collection = db.collection(COLLECTIONS.SUCCESS_PATTERNS);
  const snapshot = await collection.limit(1).get();

  if (snapshot.empty) {
    console.log('[SuccessPatterns] Initializing with default patterns...');
    const batch = db.batch();
    const now = nowTimestamp();

    for (const pattern of DEFAULT_PATTERNS) {
      const docRef = collection.doc(pattern.id);
      batch.set(docRef, {
        ...pattern,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    console.log('[SuccessPatterns] Default patterns created');
  }
}

/**
 * 成功パターン一覧を取得
 */
export async function getSuccessPatterns(
  category?: SuccessPattern['category']
): Promise<string[]> {
  await ensureDefaultPatterns();

  const db = getDB();
  let query = db.collection(COLLECTIONS.SUCCESS_PATTERNS).orderBy('score', 'desc');

  if (category) {
    query = db
      .collection(COLLECTIONS.SUCCESS_PATTERNS)
      .where('category', '==', category)
      .orderBy('score', 'desc');
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => (doc.data() as SuccessPatternDoc).pattern);
}

/**
 * 成功パターンの詳細を取得
 */
export async function getPatternDetails(): Promise<SuccessPattern[]> {
  await ensureDefaultPatterns();

  const db = getDB();
  const snapshot = await db
    .collection(COLLECTIONS.SUCCESS_PATTERNS)
    .orderBy('score', 'desc')
    .get();

  return snapshot.docs.map(doc => docToPattern(doc.data() as SuccessPatternDoc));
}

/**
 * 新しい成功パターンを追加
 */
export async function addSuccessPattern(
  pattern: string,
  category: SuccessPattern['category'],
  score: number
): Promise<SuccessPattern> {
  const db = getDB();
  const collection = db.collection(COLLECTIONS.SUCCESS_PATTERNS);

  // 既存パターンがあれば更新
  const existing = await collection
    .where('pattern', '==', pattern)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    const data = doc.data() as SuccessPatternDoc;

    const newScore = (data.score * data.usageCount + score) / (data.usageCount + 1);
    const newUsageCount = data.usageCount + 1;

    await doc.ref.update({
      score: newScore,
      usageCount: newUsageCount,
      updatedAt: nowTimestamp(),
    });

    return docToPattern({
      ...data,
      score: newScore,
      usageCount: newUsageCount,
      updatedAt: nowTimestamp(),
    });
  }

  // 新規追加
  const id = Date.now().toString();
  const now = nowTimestamp();

  const newDoc: SuccessPatternDoc = {
    id,
    pattern,
    category,
    score,
    usageCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  await collection.doc(id).set(newDoc);
  return docToPattern(newDoc);
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
  const db = getDB();
  const docRef = db.collection(COLLECTIONS.SUCCESS_PATTERNS).doc(patternId);
  const doc = await docRef.get();

  if (!doc.exists) return;

  const data = doc.data() as SuccessPatternDoc;
  const updatedScore = (data.score * data.usageCount + newScore) / (data.usageCount + 1);

  const updates: Partial<SuccessPatternDoc> = {
    score: updatedScore,
    usageCount: data.usageCount + 1,
    updatedAt: nowTimestamp(),
  };

  if (dmRate !== undefined) {
    updates.dmRate = dmRate;
  }
  if (engagementRate !== undefined) {
    updates.engagementRate = engagementRate;
  }

  await docRef.update(updates);
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
  await ensureDefaultPatterns();

  const db = getDB();
  const snapshot = await db.collection(COLLECTIONS.SUCCESS_PATTERNS).get();

  const byCategory: Record<string, number> = {};
  let totalScore = 0;
  let lastUpdated: string = new Date(0).toISOString();

  for (const doc of snapshot.docs) {
    const data = doc.data() as SuccessPatternDoc;
    byCategory[data.category] = (byCategory[data.category] || 0) + 1;
    totalScore += data.score;

    const updatedAt = timestampToISO(data.updatedAt) || '';
    if (updatedAt > lastUpdated) {
      lastUpdated = updatedAt;
    }
  }

  return {
    totalPatterns: snapshot.size,
    byCategory,
    avgScore: snapshot.size > 0 ? totalScore / snapshot.size : 0,
    lastUpdated,
  };
}

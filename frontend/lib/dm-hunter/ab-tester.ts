/**
 * DM Hunter - 自動A/Bテストシステム
 * ターゲット × ベネフィットの組み合わせを自動的にテストし最適化
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AccountType, ACCOUNTS } from './sns-adapter';
import { ACCOUNT_CONFIG } from './generator';

const AB_TEST_PATH = path.join(process.cwd(), 'data', 'ab_tests.json');

interface TestVariant {
  id: string;
  target: string;
  benefit: string;
  posts: number;
  dms: number;
  conversions: number;
  avgScore: number;
}

interface ABTest {
  id: string;
  account: AccountType;
  status: 'running' | 'completed' | 'paused';
  startedAt: string;
  completedAt?: string;
  variantA: TestVariant;
  variantB: TestVariant;
  winner?: 'A' | 'B' | 'tie';
  confidence?: number;
  minPostsPerVariant: number;
}

interface ABTestDB {
  activeTests: ABTest[];
  completedTests: ABTest[];
  learnings: {
    bestCombinations: {
      account: AccountType;
      target: string;
      benefit: string;
      successRate: number;
      testCount: number;
    }[];
    lastUpdated: string;
  };
}

/**
 * DBを読み込む
 */
async function loadDB(): Promise<ABTestDB> {
  try {
    const data = await fs.readFile(AB_TEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      activeTests: [],
      completedTests: [],
      learnings: {
        bestCombinations: [],
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

/**
 * DBを保存する
 */
async function saveDB(db: ABTestDB): Promise<void> {
  const dir = path.dirname(AB_TEST_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(AB_TEST_PATH, JSON.stringify(db, null, 2));
}

/**
 * 新しいA/Bテストを開始
 */
export async function startABTest(params: {
  account: AccountType;
  variantA: { target: string; benefit: string };
  variantB: { target: string; benefit: string };
  minPostsPerVariant?: number;
}): Promise<ABTest> {
  const db = await loadDB();

  // 既存のアクティブテストをチェック
  const existingTest = db.activeTests.find(t => t.account === params.account);
  if (existingTest) {
    throw new Error(`Account ${params.account} already has an active test`);
  }

  const test: ABTest = {
    id: `ab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    account: params.account,
    status: 'running',
    startedAt: new Date().toISOString(),
    variantA: {
      id: 'A',
      target: params.variantA.target,
      benefit: params.variantA.benefit,
      posts: 0,
      dms: 0,
      conversions: 0,
      avgScore: 0,
    },
    variantB: {
      id: 'B',
      target: params.variantB.target,
      benefit: params.variantB.benefit,
      posts: 0,
      dms: 0,
      conversions: 0,
      avgScore: 0,
    },
    minPostsPerVariant: params.minPostsPerVariant || 10,
  };

  db.activeTests.push(test);
  await saveDB(db);

  console.log(`[ABTester] Started test ${test.id} for ${params.account}`);
  return test;
}

/**
 * テスト結果を記録
 */
export async function recordTestResult(params: {
  account: AccountType;
  variant: 'A' | 'B';
  dm?: boolean;
  conversion?: boolean;
  score?: number;
}): Promise<ABTest | null> {
  const db = await loadDB();

  const test = db.activeTests.find(t => t.account === params.account);
  if (!test) return null;

  const variantData = params.variant === 'A' ? test.variantA : test.variantB;

  variantData.posts++;
  if (params.dm) variantData.dms++;
  if (params.conversion) variantData.conversions++;
  if (params.score !== undefined) {
    // 平均スコアを更新
    variantData.avgScore = (variantData.avgScore * (variantData.posts - 1) + params.score) / variantData.posts;
  }

  // テスト完了条件をチェック
  if (test.variantA.posts >= test.minPostsPerVariant &&
      test.variantB.posts >= test.minPostsPerVariant) {
    await evaluateAndCompleteTest(db, test);
  }

  await saveDB(db);
  return test;
}

/**
 * テストを評価して完了
 */
async function evaluateAndCompleteTest(db: ABTestDB, test: ABTest): Promise<void> {
  const rateA = test.variantA.posts > 0 ? test.variantA.dms / test.variantA.posts : 0;
  const rateB = test.variantB.posts > 0 ? test.variantB.dms / test.variantB.posts : 0;

  const diff = Math.abs(rateA - rateB);
  const avgRate = (rateA + rateB) / 2;

  // 信頼度計算（簡易版）
  const minPosts = Math.min(test.variantA.posts, test.variantB.posts);
  const confidence = Math.min(
    (minPosts / 20) * 0.6 + (diff / (avgRate || 0.01)) * 0.4,
    1
  ) * 100;

  let winner: 'A' | 'B' | 'tie' = 'tie';
  if (diff > 0.05 && confidence > 70) {
    winner = rateA > rateB ? 'A' : 'B';
  }

  test.status = 'completed';
  test.completedAt = new Date().toISOString();
  test.winner = winner;
  test.confidence = Math.round(confidence);

  // アクティブから完了へ移動
  db.activeTests = db.activeTests.filter(t => t.id !== test.id);
  db.completedTests.push(test);

  // 学習を更新
  await updateLearnings(db, test);

  console.log(`[ABTester] Completed test ${test.id}: Winner=${winner}, Confidence=${test.confidence}%`);
}

/**
 * 学習結果を更新
 */
async function updateLearnings(db: ABTestDB, test: ABTest): Promise<void> {
  const winnerVariant = test.winner === 'A' ? test.variantA :
                        test.winner === 'B' ? test.variantB : null;

  if (!winnerVariant) return;

  const successRate = winnerVariant.posts > 0 ? winnerVariant.dms / winnerVariant.posts : 0;

  // 既存の学習を検索
  const existing = db.learnings.bestCombinations.find(
    c => c.account === test.account &&
         c.target === winnerVariant.target &&
         c.benefit === winnerVariant.benefit
  );

  if (existing) {
    existing.successRate = (existing.successRate * existing.testCount + successRate) / (existing.testCount + 1);
    existing.testCount++;
  } else {
    db.learnings.bestCombinations.push({
      account: test.account,
      target: winnerVariant.target,
      benefit: winnerVariant.benefit,
      successRate,
      testCount: 1,
    });
  }

  // 上位10件のみ保持
  db.learnings.bestCombinations = db.learnings.bestCombinations
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 10);

  db.learnings.lastUpdated = new Date().toISOString();
}

/**
 * 次にテストすべき組み合わせを提案
 */
export async function suggestNextTest(account: AccountType): Promise<{
  variantA: { target: string; benefit: string };
  variantB: { target: string; benefit: string };
  reason: string;
}> {
  const db = await loadDB();

  // WordPressはA/Bテスト対象外
  if (account === 'wordpress') {
    return {
      variantA: { target: 'general', benefit: 'info' },
      variantB: { target: 'general', benefit: 'info' },
      reason: 'WordPressはA/Bテスト対象外',
    };
  }

  const config = ACCOUNT_CONFIG[account];

  // テスト済みの組み合わせを取得
  const testedCombos = new Set<string>();
  for (const test of [...db.activeTests, ...db.completedTests]) {
    if (test.account === account) {
      testedCombos.add(`${test.variantA.target}|${test.variantA.benefit}`);
      testedCombos.add(`${test.variantB.target}|${test.variantB.benefit}`);
    }
  }

  // 未テストの組み合わせを見つける
  const untestedCombos: { target: string; benefit: string }[] = [];
  for (const target of config.targets) {
    for (const benefit of config.benefits) {
      const key = `${target.label}|${benefit.label}`;
      if (!testedCombos.has(key)) {
        untestedCombos.push({ target: target.label, benefit: benefit.label });
      }
    }
  }

  // 未テストがあれば優先
  if (untestedCombos.length >= 2) {
    return {
      variantA: untestedCombos[0],
      variantB: untestedCombos[1],
      reason: '未テストの組み合わせを試します',
    };
  }

  // 既知の最良の組み合わせ vs ランダム
  const best = db.learnings.bestCombinations.find(c => c.account === account);

  if (best) {
    const randomTarget = config.targets[Math.floor(Math.random() * config.targets.length)];
    const randomBenefit = config.benefits[Math.floor(Math.random() * config.benefits.length)];

    return {
      variantA: { target: best.target, benefit: best.benefit },
      variantB: { target: randomTarget.label, benefit: randomBenefit.label },
      reason: 'ベストパターン vs 新しい組み合わせ',
    };
  }

  // 完全ランダム
  const targets = config.targets;
  const benefits = config.benefits;

  return {
    variantA: {
      target: targets[0].label,
      benefit: benefits[0].label,
    },
    variantB: {
      target: targets[1]?.label || targets[0].label,
      benefit: benefits[1]?.label || benefits[0].label,
    },
    reason: 'ランダムな組み合わせでテスト開始',
  };
}

/**
 * 現在のテストを取得（次の投稿でどちらのバリアントを使うか決定）
 */
export async function getCurrentVariant(account: AccountType): Promise<{
  test: ABTest | null;
  variant: 'A' | 'B' | null;
  target: string | null;
  benefit: string | null;
}> {
  const db = await loadDB();

  const test = db.activeTests.find(t => t.account === account);
  if (!test) {
    return { test: null, variant: null, target: null, benefit: null };
  }

  // 投稿数が少ない方を選択
  const variant = test.variantA.posts <= test.variantB.posts ? 'A' : 'B';
  const variantData = variant === 'A' ? test.variantA : test.variantB;

  return {
    test,
    variant,
    target: variantData.target,
    benefit: variantData.benefit,
  };
}

/**
 * テスト状況サマリーを取得
 */
export async function getTestSummary(): Promise<{
  activeTests: ABTest[];
  recentCompleted: ABTest[];
  bestCombinations: ABTestDB['learnings']['bestCombinations'];
  stats: {
    totalTests: number;
    completedTests: number;
    avgConfidence: number;
  };
}> {
  const db = await loadDB();

  const recentCompleted = db.completedTests
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
    .slice(0, 5);

  const completedWithConfidence = db.completedTests.filter(t => t.confidence);
  const avgConfidence = completedWithConfidence.length > 0
    ? completedWithConfidence.reduce((sum, t) => sum + (t.confidence || 0), 0) / completedWithConfidence.length
    : 0;

  return {
    activeTests: db.activeTests,
    recentCompleted,
    bestCombinations: db.learnings.bestCombinations,
    stats: {
      totalTests: db.activeTests.length + db.completedTests.length,
      completedTests: db.completedTests.length,
      avgConfidence: Math.round(avgConfidence),
    },
  };
}

/**
 * テストを手動で完了
 */
export async function completeTest(testId: string): Promise<ABTest | null> {
  const db = await loadDB();

  const test = db.activeTests.find(t => t.id === testId);
  if (!test) return null;

  await evaluateAndCompleteTest(db, test);
  await saveDB(db);

  return test;
}

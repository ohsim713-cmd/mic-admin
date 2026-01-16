/**
 * 失敗パターンDB
 * 低スコア（6点以下）の投稿パターンを記録し、同じ失敗を繰り返さない
 */

import fs from 'fs';
import path from 'path';

const BAD_PATTERNS_FILE = path.join(process.cwd(), 'knowledge', 'bad_patterns.json');

export interface BadPattern {
  id: string;
  text: string;
  score: number;
  target: string;
  benefit: string;
  reason: string;  // なぜ失敗したか
  timestamp: string;
  account: string;
}

interface BadPatternsData {
  patterns: BadPattern[];
  lastUpdated: string;
}

// 失敗パターンを読み込み
export function loadBadPatterns(): BadPattern[] {
  try {
    if (!fs.existsSync(BAD_PATTERNS_FILE)) {
      return [];
    }
    const data = JSON.parse(fs.readFileSync(BAD_PATTERNS_FILE, 'utf-8')) as BadPatternsData;
    return data.patterns || [];
  } catch {
    return [];
  }
}

// 失敗パターンを保存
export function saveBadPattern(pattern: Omit<BadPattern, 'id' | 'timestamp'>): void {
  try {
    const patterns = loadBadPatterns();

    // 重複チェック（同じテキストは追加しない）
    const exists = patterns.some(p => p.text === pattern.text);
    if (exists) return;

    const newPattern: BadPattern = {
      ...pattern,
      id: `bad_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    patterns.push(newPattern);

    // 最大100件まで保持（古いものを削除）
    const trimmedPatterns = patterns.slice(-100);

    const data: BadPatternsData = {
      patterns: trimmedPatterns,
      lastUpdated: new Date().toISOString(),
    };

    fs.writeFileSync(BAD_PATTERNS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[BadPatterns] Saved: score=${pattern.score}, reason=${pattern.reason}`);
  } catch (error) {
    console.error('[BadPatterns] Save error:', error);
  }
}

// 失敗パターンの特徴を抽出（生成時の回避チェック用）
export function extractBadFeatures(): {
  badWords: string[];
  badOpenings: string[];
  badTargetBenefitCombos: string[];
} {
  const patterns = loadBadPatterns();

  // 失敗した投稿の冒頭20文字を収集
  const badOpenings = patterns
    .map(p => p.text.substring(0, 20))
    .filter((v, i, a) => a.indexOf(v) === i);

  // 失敗したターゲット×メリットの組み合わせ
  const badTargetBenefitCombos = patterns
    .map(p => `${p.target}:${p.benefit}`)
    .filter((v, i, a) => a.indexOf(v) === i);

  // 頻出する失敗ワード（簡易的に抽出）
  const badWords: string[] = [];
  const wordCount: Record<string, number> = {};

  for (const pattern of patterns) {
    const words = pattern.text.split(/\s|、|。|！|？/).filter(w => w.length >= 2);
    for (const word of words) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  }

  // 3回以上出現した単語を「避けるべき単語」として抽出
  for (const [word, count] of Object.entries(wordCount)) {
    if (count >= 3) {
      badWords.push(word);
    }
  }

  return { badWords, badOpenings, badTargetBenefitCombos };
}

// 生成された投稿が失敗パターンに類似していないかチェック
export function checkAgainstBadPatterns(text: string, target: string, benefit: string): {
  isSimilar: boolean;
  warnings: string[];
} {
  const { badWords, badOpenings, badTargetBenefitCombos } = extractBadFeatures();
  const warnings: string[] = [];

  // 冒頭チェック
  const opening = text.substring(0, 20);
  for (const badOpening of badOpenings) {
    if (opening.includes(badOpening.substring(0, 10))) {
      warnings.push(`冒頭が失敗パターンに類似: "${badOpening}"`);
    }
  }

  // ターゲット×メリット組み合わせチェック
  const combo = `${target}:${benefit}`;
  if (badTargetBenefitCombos.includes(combo)) {
    warnings.push(`失敗した組み合わせ: ${target} × ${benefit}`);
  }

  // 失敗ワードチェック
  for (const badWord of badWords) {
    if (text.includes(badWord)) {
      warnings.push(`失敗頻出ワード検出: "${badWord}"`);
    }
  }

  return {
    isSimilar: warnings.length > 0,
    warnings,
  };
}

// 統計情報
export function getBadPatternsStats(): {
  totalCount: number;
  byAccount: Record<string, number>;
  averageScore: number;
  commonReasons: string[];
} {
  const patterns = loadBadPatterns();

  const byAccount: Record<string, number> = {};
  let totalScore = 0;
  const reasonCount: Record<string, number> = {};

  for (const p of patterns) {
    byAccount[p.account] = (byAccount[p.account] || 0) + 1;
    totalScore += p.score;
    reasonCount[p.reason] = (reasonCount[p.reason] || 0) + 1;
  }

  const commonReasons = Object.entries(reasonCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason]) => reason);

  return {
    totalCount: patterns.length,
    byAccount,
    averageScore: patterns.length > 0 ? totalScore / patterns.length : 0,
    commonReasons,
  };
}

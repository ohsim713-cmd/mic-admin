/**
 * DM Hunter - 品質チェックロジック
 * DMにつながる投稿かどうかを判定
 */

export interface QualityScore {
  total: number;        // 合計スコア (10点満点、7点以上で投稿OK)
  passed: boolean;      // 7点以上かどうか
  breakdown: {
    empathy: number;    // 共感ポイント (0-3点)
    benefit: number;    // メリット明確さ (0-2点)
    cta: number;        // CTA強度 (0-2点)
    urgency: number;    // 緊急性 (0-1点)
    trust: number;      // 信頼性 (0-2点)
  };
  issues: string[];     // 問題点
  suggestions: string[];// 改善提案
}

// 共感パターン
const EMPATHY_PATTERNS = [
  /ぶっちゃけ|正直|本当は|実は/,
  /わかる|あるある|そうだよね/,
  /悩んで|困って|辛い|しんどい|疲れ/,
  /思ってない？|感じてない？/,
];

// メリットパターン
const BENEFIT_PATTERNS = [
  /時給\d|月\d+万|週\d日|1日\d時間/,
  /通勤ゼロ|在宅|顔出しなし|匿名/,
  /日払い|即日|翌日/,
  /自由|好きな時間/,
];

// CTAパターン
const CTA_PATTERNS = [
  /DM|メッセージ/i,
  /気軽に|相談だけ|質問だけ|話だけ/,
  /興味あ|知りたい|詳しく/,
  /プロフ|リンク/,
];

// 緊急性パターン
const URGENCY_PATTERNS = [
  /今なら|今月|期間限定/,
  /残り|あと\d/,
  /急募|募集中/,
];

// 信頼性パターン
const TRUST_PATTERNS = [
  /所属の子|うちの子|在籍/,
  /実際に|本当に|リアルに/,
  /\d+人|実績|達成/,
  /サポート|教える|一緒に/,
];

// NGパターン（即却下）
const NG_PATTERNS = [
  { pattern: /絶対|100%|確実|必ず/, reason: '誇大広告' },
  { pattern: /稼げる！！|儲かる！！/, reason: '過度な煽り' },
  { pattern: /エロ|セクシー|裸|脱/, reason: '直接的表現' },
  { pattern: /LINE@|LINE追加/, reason: '別媒体誘導' },
  { pattern: /http|https|\.com|\.jp/, reason: 'リンク含有' },
];

/**
 * 投稿の品質をチェック
 */
export function checkQuality(text: string): QualityScore {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // NGチェック（先に行う）
  for (const ng of NG_PATTERNS) {
    if (ng.pattern.test(text)) {
      return {
        total: 0,
        passed: false,
        breakdown: { empathy: 0, benefit: 0, cta: 0, urgency: 0, trust: 0 },
        issues: [`NG: ${ng.reason}`],
        suggestions: ['NGパターンを含むため却下'],
      };
    }
  }

  // 文字数チェック
  if (text.length < 100) {
    issues.push('文字数が少なすぎる（100文字未満）');
    suggestions.push('もう少し具体的な内容を追加');
  } else if (text.length > 300) {
    issues.push('文字数が多すぎる（300文字超）');
    suggestions.push('もう少し簡潔に');
  }

  // 各スコアを計算
  let empathy = 0;
  for (const pattern of EMPATHY_PATTERNS) {
    if (pattern.test(text)) empathy++;
  }
  empathy = Math.min(empathy, 3);

  let benefit = 0;
  for (const pattern of BENEFIT_PATTERNS) {
    if (pattern.test(text)) benefit++;
  }
  benefit = Math.min(benefit, 2);

  let cta = 0;
  for (const pattern of CTA_PATTERNS) {
    if (pattern.test(text)) cta++;
  }
  cta = Math.min(cta, 2);

  let urgency = 0;
  for (const pattern of URGENCY_PATTERNS) {
    if (pattern.test(text)) {
      urgency = 1;
      break;
    }
  }

  let trust = 0;
  for (const pattern of TRUST_PATTERNS) {
    if (pattern.test(text)) trust++;
  }
  trust = Math.min(trust, 2);

  // 問題点と改善提案を追加
  if (empathy === 0) {
    issues.push('共感ポイントが弱い');
    suggestions.push('「ぶっちゃけ」「正直」などの本音フレーズを追加');
  }
  if (benefit === 0) {
    issues.push('メリットが不明確');
    suggestions.push('具体的な数字（月○万円、週○日など）を追加');
  }
  if (cta === 0) {
    issues.push('CTAがない');
    suggestions.push('「興味あったらDMで」などの誘導を追加');
  }
  if (trust === 0) {
    issues.push('信頼性が低い');
    suggestions.push('「所属の子は〜」など実績ベースの表現を追加');
  }

  const total = empathy + benefit + cta + urgency + trust;

  return {
    total,
    passed: total >= 7,
    breakdown: { empathy, benefit, cta, urgency, trust },
    issues,
    suggestions,
  };
}

/**
 * 複数投稿から最も品質の高いものを選択
 */
export function selectBestPost<T extends { text: string }>(posts: T[]): { post: T; score: QualityScore } | null {
  if (posts.length === 0) return null;

  let best: { post: T; score: QualityScore } | null = null;

  for (const post of posts) {
    const score = checkQuality(post.text);
    if (!best || score.total > best.score.total) {
      best = { post, score };
    }
  }

  return best;
}

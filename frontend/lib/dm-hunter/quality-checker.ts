/**
 * DM Hunter - 品質チェックロジック v2
 * DMにつながる高品質な投稿かどうかを厳格に判定
 */

export interface QualityScore {
  total: number;        // 合計スコア (10点満点、8点以上で投稿OK)
  passed: boolean;      // 8点以上かどうか
  breakdown: {
    empathy: number;    // 共感ポイント (0-3点)
    benefit: number;    // メリット明確さ (0-2点)
    cta: number;        // CTA強度 (0-2点)
    urgency: number;    // 緊急性 (0-1点)
    trust: number;      // 信頼性 (0-2点)
  };
  issues: string[];     // 問題点
  suggestions: string[];// 改善提案
  readability: number;  // 読みやすさスコア (0-100)
}

// 共感パターン（強化版）
const EMPATHY_PATTERNS = [
  // 本音系
  /ぶっちゃけ|正直|本当は|実は|マジで/,
  // 共感系
  /わかる|あるある|そうだよね|だよね|それな/,
  // 悩み系
  /悩んで|困って|辛い|しんどい|疲れ|不安|心配/,
  // 問いかけ系
  /思ってない？|感じてない？|ない？|よね？/,
  // 状況理解系
  /〜したい|〜ほしい|〜が欲しい/,
];

// メリットパターン（強化版）
const BENEFIT_PATTERNS = [
  // 金額系（より具体的に）
  /時給\d{4}|月\d{1,2}万|週\d日|1日\d時間/,
  /\d万円|年収\d{3}万/,
  // 環境系
  /通勤ゼロ|在宅|顔出しなし|完全匿名|身バレなし/,
  /スマホだけ|スマホ1台|パソコン不要/,
  // 支払い系
  /日払い|即日払い|翌日振込|週払い/,
  // 自由系
  /シフト自由|時間自由|好きな時間|いつでも/,
  /ノルマなし|強制なし/,
];

// CTAパターン（強化版）
const CTA_PATTERNS = [
  // DM誘導（明確な）
  /DMで|DMして|DMください|DM待ってます/i,
  /メッセージして|メッセージで/,
  // ハードル下げ
  /気軽に|相談だけでも|質問だけでも|話だけでも|聞くだけでも/,
  /興味あったら|気になったら|知りたかったら/,
  // アクション促進
  /今すぐ|まずは|とりあえず/,
];

// 緊急性パターン（強化版）
const URGENCY_PATTERNS = [
  /今なら|今だけ|今月|今週|期間限定/,
  /残り\d|あと\d人|限定\d/,
  /急募|募集中|追加募集/,
  /〆切|締め切り|枠/,
];

// 信頼性パターン（強化版）
const TRUST_PATTERNS = [
  // 実績系
  /所属の子|うちの子|うちで働いてる|在籍してる/,
  /実際に|本当に|リアルに|ガチで/,
  /\d+人|何人も|たくさんの子/,
  // サポート系
  /サポート|教える|一緒に|フォロー|相談乗る/,
  /未経験OK|初心者歓迎|丁寧に教える/,
  // 事務所感
  /事務所|スタッフ|担当/,
];

// NGパターン（即却下）- 厳格化
const NG_PATTERNS = [
  { pattern: /絶対|100%|確実|必ず|間違いなく/, reason: '誇大広告' },
  { pattern: /！！|！！！|!!|!!!/, reason: '過度な煽り（連続感嘆符）' },
  { pattern: /エロ|セクシー|裸|脱|アダルト/, reason: '直接的表現' },
  { pattern: /LINE@|LINE追加|公式LINE/, reason: '別媒体誘導' },
  { pattern: /http|https|\.com|\.jp|\.net/, reason: 'リンク含有' },
  { pattern: /詐欺|違法|闇|裏/, reason: '不適切表現' },
  { pattern: /クリック|タップして|ここから/, reason: 'スパム的表現' },
];

/**
 * 読みやすさスコアを計算
 */
function calculateReadability(text: string): number {
  let score = 100;

  // 改行の適切さ（2-4行ごとに空行があると良い）
  const lines = text.split('\n').filter(l => l.trim());
  const paragraphs = text.split(/\n\s*\n/);

  if (paragraphs.length < 2) {
    score -= 15; // 段落分けがない
  }

  // 一文の長さ（40文字以上の文が多いと読みにくい）
  const sentences = text.split(/[。！？\n]/);
  const longSentences = sentences.filter(s => s.length > 40).length;
  score -= longSentences * 10;

  // 絵文字の適度な使用（1-3個が理想）
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount === 0) {
    score -= 5;
  } else if (emojiCount > 5) {
    score -= 10;
  }

  // 漢字の割合（20-35%が読みやすい）
  const kanjiCount = (text.match(/[\u4E00-\u9FAF]/g) || []).length;
  const kanjiRatio = kanjiCount / text.length;
  if (kanjiRatio > 0.4) {
    score -= 15; // 漢字が多すぎる
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 投稿の品質をチェック（強化版）
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
        readability: 0,
      };
    }
  }

  // 文字数チェック（より厳格に）
  if (text.length < 120) {
    issues.push('文字数が少なすぎる（120文字未満）');
    suggestions.push('もう少し具体的なメリットや実績を追加');
  } else if (text.length > 280) {
    issues.push('文字数が多すぎる（280文字超）');
    suggestions.push('Twitter制限に収まるよう簡潔に');
  }

  // 段落チェック
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  if (paragraphs.length < 2) {
    issues.push('段落分けがない');
    suggestions.push('2-3段落に分けて読みやすく');
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

  // 読みやすさスコア
  const readability = calculateReadability(text);

  // 問題点と改善提案を追加（より具体的に）
  if (empathy === 0) {
    issues.push('共感ポイントが弱い');
    suggestions.push('冒頭に「ぶっちゃけ」「正直」「〜って思ってない？」を追加');
  } else if (empathy === 1) {
    suggestions.push('共感フレーズをもう1つ追加するとより刺さる');
  }

  if (benefit === 0) {
    issues.push('メリットが不明確');
    suggestions.push('「月○万円」「週○日」「時給○円」など具体的数字を追加');
  }

  if (cta === 0) {
    issues.push('CTAがない');
    suggestions.push('最後に「興味あったらDMで」「気軽にメッセージして」を追加');
  } else if (cta === 1) {
    suggestions.push('「相談だけでもOK」などハードルを下げる表現を追加');
  }

  if (trust === 0) {
    issues.push('信頼性が低い');
    suggestions.push('「うちで働いてる子は〜」「所属の子で〜」など実績を追加');
  }

  if (urgency === 0) {
    suggestions.push('「今なら」「募集中」など緊急性を追加するとより効果的');
  }

  if (readability < 60) {
    issues.push('読みにくい文章構成');
    suggestions.push('文を短く、段落を分けて読みやすく');
  }

  const total = empathy + benefit + cta + urgency + trust;

  return {
    total,
    passed: total >= 8, // 基準を7点から8点に引き上げ
    breakdown: { empathy, benefit, cta, urgency, trust },
    issues,
    suggestions,
    readability,
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

/**
 * 人間化フィルター
 * AI臭を消し、自然な人間らしさを付与
 *
 * 3つの防衛ライン:
 * 1. 文章の「人間化」処理
 * 2. 投稿パターンの「不規則化」
 * 3. AI検出の自己チェック
 */

// 文体バリエーション
const TONE_VARIATIONS = [
  { id: 'high_energy', name: 'テンション高め', markers: ['！！', 'めっちゃ', 'ガチで', 'マジで', 'やばい'] },
  { id: 'calm', name: '落ち着き', markers: ['〜だよ', '〜かな', '〜ね', '実は', 'ちなみに'] },
  { id: 'empathy', name: '共感重視', markers: ['わかる', '同じ', '私も', 'そうそう', '〜って思うよね'] },
  { id: 'casual', name: 'カジュアル', markers: ['〜なんだよね', '〜じゃん', '〜でしょ', 'ぶっちゃけ', '〜かも'] },
  { id: 'friendly', name: 'フレンドリー', markers: ['〜だよ！', '〜してみて', '気軽に', '一緒に', '応援'] },
];

// 口語表現のプール
const COLLOQUIAL_EXPRESSIONS = {
  very: ['めっちゃ', 'ガチで', 'マジで', 'かなり', 'すごく', 'ほんとに'],
  think: ['思う', '思うんだよね', '感じる', '思ってる'],
  good: ['いい', '良い', 'いいかも', '良さそう', 'アリ'],
  bad: ['きつい', 'しんどい', '大変', 'つらい'],
  want: ['したい', 'してみたい', '欲しい', '気になる'],
  please: ['ね', 'よ', 'かな', 'かも'],
};

// 絵文字のプール（使いすぎ注意）
const EMOJI_POOLS = {
  positive: ['✨', '💕', '🌟', '💪', '🙌', '😊', '🎉'],
  question: ['🤔', '💭', '❓'],
  money: ['💰', '💵', '📈'],
  casual: ['〜', '♪', '！', 'w'],
};

/**
 * 人間化フィルター - メイン処理
 */
export function humanizeText(text: string, options?: {
  tone?: string;
  emojiLevel?: 'none' | 'low' | 'medium' | 'high';
}): string {
  let result = text;

  // 1. ランダムなトーンを選択（指定がなければ）
  const toneId = options?.tone || TONE_VARIATIONS[Math.floor(Math.random() * TONE_VARIATIONS.length)].id;
  const tone = TONE_VARIATIONS.find(t => t.id === toneId) || TONE_VARIATIONS[0];

  // 2. 文章の揺らぎを追加
  result = addTextVariation(result);

  // 3. 口語表現を追加
  result = addColloquialExpressions(result, tone);

  // 4. 絵文字の調整
  const emojiLevel = options?.emojiLevel || (['none', 'low', 'medium'][Math.floor(Math.random() * 3)] as 'none' | 'low' | 'medium');
  result = adjustEmojis(result, emojiLevel);

  // 5. 句読点の揺らぎ
  result = addPunctuationVariation(result);

  return result;
}

/**
 * 文章の揺らぎを追加
 */
function addTextVariation(text: string): string {
  let result = text;

  // たまに「。」を抜く（文末のみ）
  if (Math.random() < 0.2) {
    const sentences = result.split(/(?<=[。！？])/);
    if (sentences.length > 2) {
      const randomIndex = Math.floor(Math.random() * (sentences.length - 1));
      sentences[randomIndex] = sentences[randomIndex].replace(/。$/, '');
      result = sentences.join('');
    }
  }

  // 「！」の数をランダムに（1〜2個）
  result = result.replace(/！+/g, () => {
    const count = Math.random() < 0.7 ? 1 : 2;
    return '！'.repeat(count);
  });

  return result;
}

/**
 * 口語表現を追加
 */
function addColloquialExpressions(text: string, tone: typeof TONE_VARIATIONS[0]): string {
  let result = text;

  // 「とても」→ 口語化
  if (Math.random() < 0.6) {
    const replacement = COLLOQUIAL_EXPRESSIONS.very[Math.floor(Math.random() * COLLOQUIAL_EXPRESSIONS.very.length)];
    result = result.replace(/とても|非常に|大変/, replacement);
  }

  // トーンに合わせたマーカーを追加（低確率で）
  if (Math.random() < 0.3 && tone.markers.length > 0) {
    const marker = tone.markers[Math.floor(Math.random() * tone.markers.length)];
    // 文中に自然に挿入（最初の「、」の後など）
    const firstComma = result.indexOf('、');
    if (firstComma > 0 && firstComma < 30) {
      result = result.slice(0, firstComma + 1) + marker + result.slice(firstComma + 1);
    }
  }

  return result;
}

/**
 * 絵文字の調整
 */
function adjustEmojis(text: string, level: 'none' | 'low' | 'medium' | 'high'): string {
  // まず既存の絵文字をカウント
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const existingEmojis = text.match(emojiRegex) || [];

  if (level === 'none') {
    // 全絵文字削除（極端すぎるので1個だけ残す）
    let count = 0;
    return text.replace(emojiRegex, (match) => {
      count++;
      return count <= 1 ? match : '';
    });
  }

  const targetCount = level === 'low' ? 1 : level === 'medium' ? 2 : 3;

  if (existingEmojis.length > targetCount) {
    // 多すぎる場合は削減
    let count = 0;
    return text.replace(emojiRegex, (match) => {
      count++;
      return count <= targetCount ? match : '';
    });
  }

  // 足りない場合は追加しない（過剰な絵文字はAI臭）
  return text;
}

/**
 * 句読点の揺らぎ
 */
function addPunctuationVariation(text: string): string {
  let result = text;

  // 「〜」をたまに追加
  if (Math.random() < 0.2) {
    result = result.replace(/です([。！])/, 'です〜$1');
  }

  // 「...」を「…」に統一
  result = result.replace(/\.\.\./g, '…');

  // 文末の「。」をたまに「！」に
  if (Math.random() < 0.15) {
    const sentences = result.split(/(?<=[。])/);
    if (sentences.length > 1) {
      const randomIndex = Math.floor(Math.random() * (sentences.length - 1));
      sentences[randomIndex] = sentences[randomIndex].replace(/。$/, '！');
      result = sentences.join('');
    }
  }

  return result;
}

/**
 * 投稿時間のランダム化
 * 指定時間の±15分以内でランダムなオフセットを返す
 */
export function getRandomizedPostTime(baseHour: number, baseMinute: number = 0): {
  hour: number;
  minute: number;
  offsetMinutes: number;
} {
  // ±15分のオフセット
  const offsetMinutes = Math.floor(Math.random() * 31) - 15; // -15 to +15

  let totalMinutes = baseHour * 60 + baseMinute + offsetMinutes;

  // 0-1440分（24時間）の範囲に収める
  if (totalMinutes < 0) totalMinutes += 1440;
  if (totalMinutes >= 1440) totalMinutes -= 1440;

  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return { hour, minute, offsetMinutes };
}

/**
 * 投稿頻度の揺らぎ
 * 1日の投稿数をランダム化（基準値±20%）
 */
export function getRandomizedDailyPostCount(baseCount: number): number {
  const variance = Math.floor(baseCount * 0.2); // ±20%
  const offset = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
  return Math.max(1, baseCount + offset);
}

/**
 * 「休み」の判定
 * 週に1回程度、半日投稿しない時間を作る
 */
export function shouldTakeBreak(): boolean {
  // 約14%の確率で休む（1/7 = 週1回程度）
  return Math.random() < 0.14;
}

/**
 * AI検出スコアのシミュレーション
 * 実際にはGPTZero APIなどを使用
 * 今は簡易的なヒューリスティックで判定
 */
export function estimateAIScore(text: string): {
  score: number; // 0-100（高いほどAI臭い）
  flags: string[];
} {
  const flags: string[] = [];
  let score = 30; // ベーススコア

  // 1. 文章の長さが均一すぎる
  const sentences = text.split(/[。！？]/);
  const lengths = sentences.filter(s => s.trim()).map(s => s.length);
  if (lengths.length >= 3) {
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
    if (variance < 50) {
      score += 15;
      flags.push('文の長さが均一すぎる');
    }
  }

  // 2. 丁寧すぎる表現
  const politePatterns = [
    /させていただ/,
    /いただければ/,
    /ございます/,
    /存じます/,
  ];
  for (const pattern of politePatterns) {
    if (pattern.test(text)) {
      score += 10;
      flags.push('丁寧すぎる表現');
      break;
    }
  }

  // 3. 接続詞の多用
  const connectors = ['また', 'さらに', 'そして', 'つまり', 'なぜなら', '一方で'];
  let connectorCount = 0;
  for (const c of connectors) {
    if (text.includes(c)) connectorCount++;
  }
  if (connectorCount >= 3) {
    score += 15;
    flags.push('接続詞の多用');
  }

  // 4. 箇条書き的な構造
  if (/[①②③④⑤]|[１２３４５]|[・].*[・].*[・]/.test(text)) {
    score += 10;
    flags.push('箇条書き的構造');
  }

  // 5. 絵文字が少なすぎ or 多すぎ
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiCount = (text.match(emojiRegex) || []).length;
  if (emojiCount === 0) {
    score += 5;
    flags.push('絵文字なし');
  } else if (emojiCount > 5) {
    score += 10;
    flags.push('絵文字過多');
  }

  // 6. 口語表現の不足
  const colloquialPatterns = ['めっちゃ', 'ガチ', 'マジ', 'やば', 'ぶっちゃけ', '〜なんだよね', '〜じゃん'];
  let hasColloquial = false;
  for (const p of colloquialPatterns) {
    if (text.includes(p)) {
      hasColloquial = true;
      break;
    }
  }
  if (!hasColloquial) {
    score += 10;
    flags.push('口語表現なし');
  }

  return {
    score: Math.min(100, score),
    flags,
  };
}

/**
 * AI検出スコアが高い場合の再人間化
 */
export function rehumanizeIfNeeded(text: string, threshold: number = 60): {
  text: string;
  wasRehumanized: boolean;
  originalScore: number;
  newScore: number;
} {
  const initial = estimateAIScore(text);

  if (initial.score < threshold) {
    return {
      text,
      wasRehumanized: false,
      originalScore: initial.score,
      newScore: initial.score,
    };
  }

  // スコアが高い場合は人間化処理を適用
  const humanized = humanizeText(text, {
    emojiLevel: 'low',
  });

  const final = estimateAIScore(humanized);

  return {
    text: humanized,
    wasRehumanized: true,
    originalScore: initial.score,
    newScore: final.score,
  };
}

// ========================================
// CTA自動挿入（DM誘導）
// ========================================

// CTAバリエーション（自然なDM誘導）
const CTA_VARIATIONS = [
  // カジュアル系
  '気になったらDMで💬',
  'DMで気軽に聞いてね✨',
  '質問あればDMどうぞ！',
  'DM待ってます💕',
  '詳しくはDMで🙌',
  // 問いかけ系
  '気になる？DMで話そ💬',
  '興味ある人はDMしてね！',
  'もっと知りたい人はDMへ✨',
  // 安心感系
  '相談だけでも大丈夫！DM開放中💬',
  '強引な勧誘ナシ！気軽にDMしてね',
  'まずはDMで話してみない？😊',
  // 緊急性系
  '今ならDMで詳しくお伝えできます！',
  '枠が埋まる前にDMしてね💨',
];

/**
 * CTAが含まれているかチェック
 */
export function hasCTA(text: string): boolean {
  const ctaPatterns = [
    /DM/i,
    /ディーエム/,
    /メッセージ/,
    /連絡/,
    /問い合わせ/,
    /相談/,
    /聞いて/,
    /お気軽に/,
  ];

  return ctaPatterns.some(pattern => pattern.test(text));
}

/**
 * ランダムなCTAを取得
 */
export function getRandomCTA(): string {
  return CTA_VARIATIONS[Math.floor(Math.random() * CTA_VARIATIONS.length)];
}

/**
 * CTAが弱い/ない場合に自動挿入
 */
export function ensureCTA(text: string): {
  text: string;
  ctaAdded: boolean;
  cta?: string;
} {
  // 既にCTAがあればそのまま返す
  if (hasCTA(text)) {
    return { text, ctaAdded: false };
  }

  // CTAを選択
  const cta = getRandomCTA();

  // 末尾に追加（改行して追加）
  let result = text.trim();

  // 最後の文字が絵文字や記号でない場合は改行を追加
  if (!/[！!？?。\n]$/.test(result)) {
    result += '。';
  }

  result += '\n\n' + cta;

  return {
    text: result,
    ctaAdded: true,
    cta,
  };
}

/**
 * CTAの強さを評価（0-10）
 */
export function evaluateCTAStrength(text: string): {
  score: number;
  feedback: string;
} {
  let score = 0;
  const feedback: string[] = [];

  // DMへの誘導があるか
  if (/DM|ディーエム/i.test(text)) {
    score += 4;
    feedback.push('DM誘導あり');
  }

  // 絵文字でCTAを強調しているか
  if (/DM.*[💬✨💕🙌😊]/i.test(text) || /[💬✨💕🙌😊].*DM/i.test(text)) {
    score += 2;
    feedback.push('絵文字で強調');
  }

  // 問いかけ形式か
  if (/気になる？|興味ある？|知りたい？|してみない？/.test(text)) {
    score += 2;
    feedback.push('問いかけ形式');
  }

  // 安心感の提示
  if (/強引|ナシ|大丈夫|気軽|相談だけ/.test(text)) {
    score += 1;
    feedback.push('安心感あり');
  }

  // 緊急性
  if (/今なら|枠|限定|残り/.test(text)) {
    score += 1;
    feedback.push('緊急性あり');
  }

  return {
    score: Math.min(10, score),
    feedback: feedback.length > 0 ? feedback.join(', ') : 'CTA弱い',
  };
}

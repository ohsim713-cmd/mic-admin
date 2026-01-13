/**
 * DM Hunter - 投稿生成ロジック
 * 3アカウント対応版（ライバー/チャトレ）
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AccountType } from './sns-adapter';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// アカウント種別ごとの設定
export const ACCOUNT_CONFIG = {
  liver: {
    jobType: 'ライバー',
    jobDescription: 'ライブ配信アプリでのライバー活動',
    stance: 'ライバー事務所のスタッフ',
    targets: [
      { id: 'beginner', label: '完全未経験', concerns: '配信って難しくない？', desires: '楽しく稼ぎたい' },
      { id: 'young', label: '10〜20代', concerns: 'フォロワー少なくても大丈夫？', desires: 'インフルエンサーになりたい' },
      { id: 'side-job', label: '副業希望者', concerns: '顔バレしない？', desires: '空き時間で月5-10万' },
      { id: 'talent', label: '歌・ダンス特技', concerns: '特技を活かせる？', desires: 'パフォーマンスで稼ぎたい' },
    ],
    benefits: [
      { id: 'fun', label: '楽しく稼げる', hook: 'ファンと話すだけで報酬', proof: '雑談配信だけで月10万稼いでる子もいる' },
      { id: 'no-quota', label: 'ノルマなし', hook: '好きな時に好きなだけ', proof: '週1配信でも全然OK' },
      { id: 'support', label: '事務所サポート', hook: '配信のコツ教えます', proof: '未経験から3ヶ月で月30万達成' },
      { id: 'gift', label: '投げ銭収入', hook: 'ファンからギフトもらえる', proof: '1配信で5万円分のギフトもらった子も' },
      { id: 'fame', label: '知名度UP', hook: 'SNSのフォロワー増える', proof: 'ライバーきっかけでインフルエンサーになった子も' },
    ],
  },
  chatre1: {
    jobType: 'チャットレディ',
    jobDescription: 'メールやビデオ通話でのお仕事',
    stance: 'チャトレ事務所のスタッフ',
    targets: [
      { id: 'beginner', label: '完全未経験', concerns: '本当に稼げる？難しくない？', desires: '安心して始めたい' },
      { id: 'housewife', label: '主婦・ママ', concerns: '子育てと両立できる？', desires: '空き時間で稼ぎたい' },
      { id: 'side-job', label: '副業希望者', concerns: '本業バレしない？', desires: '月5-10万の副収入' },
      { id: 'age-30s', label: '30代', concerns: '年齢的に需要ある？', desires: '年齢を活かして稼ぎたい' },
    ],
    benefits: [
      { id: 'no-commute', label: '通勤ゼロ', hook: '家から一歩も出ずに稼げる', proof: '所属の子、通勤ゼロで月20万稼いでます' },
      { id: 'time-free', label: '時間自由', hook: '好きな時間に好きなだけ', proof: '子供が寝た後の2時間だけで月8万' },
      { id: 'no-face', label: '顔出しなし', hook: '完全匿名でOK', proof: '顔出しなしで月30万稼いでる子いる' },
      { id: 'daily-pay', label: '日払い対応', hook: '働いた翌日に振込', proof: '日払いで昨日5万受け取った子も' },
      { id: 'high-income', label: '高収入', hook: '時給3000円〜', proof: '本業の2倍稼いでる子、珍しくない' },
    ],
  },
  chatre2: {
    jobType: 'チャットレディ',
    jobDescription: 'ビデオ通話メインのお仕事',
    stance: 'チャトレ事務所のスタッフ',
    targets: [
      { id: 'night-job', label: '夜職経験者', concerns: '対面より稼げる？', desires: '非接触で高収入' },
      { id: 'age-30s', label: '30代', concerns: '年齢的に需要ある？', desires: '年齢を活かして稼ぎたい' },
      { id: 'age-40s', label: '40代以上', concerns: '若い子に勝てる？', desires: '大人の魅力で稼ぐ' },
      { id: 'experienced', label: '経験者', concerns: '今の事務所より稼げる？', desires: 'もっと稼ぎたい' },
    ],
    benefits: [
      { id: 'high-income', label: '高収入', hook: '時給5000円〜', proof: '本業の3倍稼いでる子もいる' },
      { id: 'age-ok', label: '年齢不問', hook: '30代40代が主力', proof: '40代から始めて月50万になった子もいる' },
      { id: 'safe', label: '非接触で安全', hook: '誰とも会わない', proof: '画面越しだから100%安全' },
      { id: 'no-face', label: '顔出しなし', hook: '完全匿名でOK', proof: '顔出しなしで月30万稼いでる子いる' },
      { id: 'daily-pay', label: '日払い対応', hook: '働いた翌日に振込', proof: '日払いで昨日5万受け取った子も' },
    ],
  },
};

// 旧形式との互換性用
export const TARGETS = ACCOUNT_CONFIG.chatre1.targets;
export const BENEFITS = ACCOUNT_CONFIG.chatre1.benefits;

// 投稿パターン
export const POST_PATTERNS = [
  { id: 'empathy-solution', label: '共感→解決', structure: '悩み共感→解決策提示→CTA' },
  { id: 'result-method', label: '実績→方法', structure: '成果紹介→やり方説明→CTA' },
  { id: 'qa-style', label: 'Q&A形式', structure: '質問→回答→CTA' },
  { id: 'story', label: 'ストーリー', structure: 'Before→After→CTA' },
];

// ランダム選択ヘルパー
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GenerateOptions {
  target?: string;
  benefit?: string;
  pattern?: string;
  account?: AccountType;
}

export interface GeneratedPost {
  text: string;
  target: { id: string; label: string; concerns: string; desires: string };
  benefit: { id: string; label: string; hook: string; proof: string };
  pattern: typeof POST_PATTERNS[0];
  account?: AccountType;
}

/**
 * アカウント別のDM獲得投稿を生成
 */
export async function generateDMPostForAccount(account: AccountType): Promise<GeneratedPost> {
  const config = ACCOUNT_CONFIG[account];
  const target = randomPick(config.targets);
  const benefit = randomPick(config.benefits);
  const pattern = randomPick(POST_PATTERNS);

  const prompt = `あなたは${config.stance}です。
${config.jobType}の求人で、DMからの問い合わせを獲得するための投稿を書いてください。

## お仕事内容
${config.jobDescription}

## ターゲット
${target.label}
- 不安: ${target.concerns}
- 欲求: ${target.desires}

## 伝えるメリット
${benefit.label}: ${benefit.hook}
実績例: ${benefit.proof}

## 投稿構成
${pattern.label}: ${pattern.structure}

## ルール
- 200-280文字（短く刺さる）
- 事務所スタッフの視点（「所属の子は〜」「うちで働くと〜」）
- 具体的な数字を入れる（金額、時間、日数）
- 2-3行ごとに空行
- 最後に「興味ある方はDMで」などCTAを入れる
- ハッシュタグ禁止
- 過度な煽りNG（「絶対」「確実」「100%」禁止）

投稿文のみ出力。説明不要。`;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  return {
    text,
    target,
    benefit,
    pattern,
    account,
  };
}

/**
 * 3アカウント分の投稿を一括生成
 */
export async function generatePostsForAllAccounts(): Promise<{
  account: AccountType;
  post: GeneratedPost;
}[]> {
  const accounts: AccountType[] = ['liver', 'chatre1', 'chatre2'];

  const results = await Promise.all(
    accounts.map(async (account) => {
      const post = await generateDMPostForAccount(account);
      return { account, post };
    })
  );

  return results;
}

/**
 * DM獲得特化の投稿を生成（旧形式互換）
 */
export async function generateDMPost(options: GenerateOptions = {}): Promise<GeneratedPost> {
  // アカウント指定があればそれを使用
  if (options.account) {
    return generateDMPostForAccount(options.account);
  }

  // 旧形式: chatre1のデフォルト設定を使用
  const target = options.target
    ? TARGETS.find(t => t.id === options.target) || randomPick(TARGETS)
    : randomPick(TARGETS);

  const benefit = options.benefit
    ? BENEFITS.find(b => b.id === options.benefit) || randomPick(BENEFITS)
    : randomPick(BENEFITS);

  const pattern = options.pattern
    ? POST_PATTERNS.find(p => p.id === options.pattern) || randomPick(POST_PATTERNS)
    : randomPick(POST_PATTERNS);

  const prompt = `あなたはチャットレディ事務所の求人担当です。
DMからの問い合わせを獲得するための投稿を書いてください。

## ターゲット
${target.label}
- 不安: ${target.concerns}
- 欲求: ${target.desires}

## 伝えるメリット
${benefit.label}: ${benefit.hook}
実績例: ${benefit.proof}

## 投稿構成
${pattern.label}: ${pattern.structure}

## ルール
- 200-280文字（短く刺さる）
- 事務所スタッフの視点（「所属の子は〜」「うちで働くと〜」）
- 具体的な数字を入れる（金額、時間、日数）
- 2-3行ごとに空行
- 最後に「興味ある方はDMで」などCTAを入れる
- ハッシュタグ禁止
- 過度な煽りNG（「絶対」「確実」「100%」禁止）

投稿文のみ出力。説明不要。`;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  return {
    text,
    target,
    benefit,
    pattern,
  };
}

/**
 * 3パターンの投稿を生成
 */
export async function generateMultiplePosts(count: number = 3): Promise<GeneratedPost[]> {
  const posts: GeneratedPost[] = [];

  // 異なるターゲット・メリットの組み合わせで生成
  const usedTargets = new Set<string>();
  const usedBenefits = new Set<string>();

  for (let i = 0; i < count; i++) {
    let target = randomPick(TARGETS);
    let benefit = randomPick(BENEFITS);

    // なるべく重複を避ける
    let attempts = 0;
    while (usedTargets.has(target.id) && attempts < 5) {
      target = randomPick(TARGETS);
      attempts++;
    }
    attempts = 0;
    while (usedBenefits.has(benefit.id) && attempts < 5) {
      benefit = randomPick(BENEFITS);
      attempts++;
    }

    usedTargets.add(target.id);
    usedBenefits.add(benefit.id);

    const post = await generateDMPost({
      target: target.id,
      benefit: benefit.id,
    });
    posts.push(post);
  }

  return posts;
}

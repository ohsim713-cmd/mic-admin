/**
 * DM Hunter - 投稿生成ロジック v3
 * 3アカウント対応版（ライバー/チャトレ）
 * 知識データベース統合版
 */

import { GoogleGenAI } from "@google/genai";
import { AccountType } from './sns-adapter';
import { checkQuality, QualityScore } from './quality-checker';
import { saveSuccessPattern, getSuccessExamplesForPrompt } from './success-patterns';
import * as fs from 'fs';
import * as path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey });

// 知識データベースのキャッシュ
let recruitmentCopyCache: any = null;
let xTemplatesCache: any = null;
let chatladyTrendsCache: any = null;
let postHistoryCache: any[] | null = null;

/**
 * 知識データベースを読み込む
 */
async function loadKnowledgeDB() {
  if (!recruitmentCopyCache) {
    try {
      const rcPath = path.join(process.cwd(), 'knowledge', 'recruitment_copy.json');
      if (fs.existsSync(rcPath)) {
        recruitmentCopyCache = JSON.parse(fs.readFileSync(rcPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('[Generator] recruitment_copy.json load failed:', e);
    }
  }

  if (!xTemplatesCache) {
    try {
      const xtPath = path.join(process.cwd(), 'knowledge', 'x_templates.json');
      if (fs.existsSync(xtPath)) {
        xTemplatesCache = JSON.parse(fs.readFileSync(xtPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('[Generator] x_templates.json load failed:', e);
    }
  }

  // chatlady_trends.json を読み込み
  if (!chatladyTrendsCache) {
    try {
      const ctPath = path.join(process.cwd(), 'knowledge', 'chatlady_trends.json');
      if (fs.existsSync(ctPath)) {
        chatladyTrendsCache = JSON.parse(fs.readFileSync(ctPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('[Generator] chatlady_trends.json load failed:', e);
    }
  }

  // 過去の投稿履歴を読み込み
  if (!postHistoryCache) {
    try {
      const historyPath = path.join(process.cwd(), 'data', 'history.json');
      if (fs.existsSync(historyPath)) {
        postHistoryCache = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('[Generator] history.json load failed:', e);
    }
  }

  return {
    recruitmentCopy: recruitmentCopyCache,
    xTemplates: xTemplatesCache,
    chatladyTrends: chatladyTrendsCache,
    postHistory: postHistoryCache
  };
}

/**
 * 知識DBからランダムなテンプレートやテクニックを取得
 */
function getKnowledgeSnippets(
  recruitmentCopy: any,
  xTemplates: any,
  chatladyTrends: any,
  postHistory: any[] | null,
  accountType: string
) {
  const snippets: string[] = [];

  // recruitment_copy.json から説得テクニック
  if (recruitmentCopy?.persuasionTechniques) {
    const techniques = recruitmentCopy.persuasionTechniques;
    if (techniques.socialProof?.examples) {
      const example = randomPick(techniques.socialProof.examples);
      snippets.push(`【社会的証明の例】${example}`);
    }
    if (techniques.authority?.examples) {
      const example = randomPick(techniques.authority.examples);
      snippets.push(`【権威性の例】${example}`);
    }
  }

  // recruitment_copy.json から感情トリガー
  if (recruitmentCopy?.emotionalTriggers?.desire) {
    const desires = recruitmentCopy.emotionalTriggers.desire;
    const categories = Object.keys(desires);
    if (categories.length > 0) {
      const category = randomPick(categories);
      const desireData = desires[category];
      if (desireData?.phrases) {
        const phrase = randomPick(desireData.phrases);
        snippets.push(`【欲求トリガー】${phrase}`);
      }
    }
  }

  // recruitment_copy.json からCTAパターン
  if (recruitmentCopy?.ctaPatterns?.lowBarrier) {
    const cta = randomPick(recruitmentCopy.ctaPatterns.lowBarrier) as { text: string; psychology: string };
    snippets.push(`【低ハードルCTA】${cta.text}（${cta.psychology}）`);
  }

  // x_templates.json から投稿テンプレート
  if (xTemplates?.postByGoal?.['問い合わせ獲得']?.templates) {
    const template = randomPick(xTemplates.postByGoal['問い合わせ獲得'].templates);
    snippets.push(`【問い合わせ獲得テンプレ参考】${template}`);
  }

  // x_templates.json からバイラルフォーミュラ
  if (xTemplates?.viralFormulas) {
    const formulas = Object.values(xTemplates.viralFormulas) as any[];
    if (formulas.length > 0) {
      const formula = randomPick(formulas);
      snippets.push(`【バイラル公式】${formula.formula} → 例: ${formula.example}`);
    }
  }

  // x_templates.json からフックパターン
  if (xTemplates?.postingPatterns?.openingHooks) {
    const hooks = xTemplates.postingPatterns.openingHooks.slice(0, 10);
    const hook = randomPick(hooks);
    snippets.push(`【フック例】${hook}`);
  }

  // チャトレ系アカウントの場合、chatlady_trends.json から情報を追加
  if ((accountType === 'chatre1' || accountType === 'chatre2') && chatladyTrends) {
    // 業界トレンドから
    if (chatladyTrends.industryTrends?.latestTrends) {
      const trend = randomPick(chatladyTrends.industryTrends.latestTrends);
      snippets.push(`【業界トレンド】${trend}`);
    }

    // 収入実績から
    if (chatladyTrends.industryTrends?.averageIncome) {
      const incomes = chatladyTrends.industryTrends.averageIncome;
      const levels = Object.keys(incomes);
      const level = randomPick(levels);
      snippets.push(`【収入目安(${level})】${incomes[level]}`);
    }

    // プラットフォーム情報から
    if (chatladyTrends.platformAnalysis) {
      const platforms = Object.keys(chatladyTrends.platformAnalysis);
      const platform = randomPick(platforms);
      const info = chatladyTrends.platformAnalysis[platform];
      if (info?.pros) {
        const pro = randomPick(info.pros);
        snippets.push(`【${platform}の強み】${pro}`);
      }
    }

    // ターゲット分析から効果的なメッセージ
    if (chatladyTrends.targetAudienceAnalysis?.primaryTargets) {
      const target = randomPick(chatladyTrends.targetAudienceAnalysis.primaryTargets) as {
        persona?: string;
        effectiveMessages?: string[];
      };
      if (target?.effectiveMessages) {
        const msg = randomPick(target.effectiveMessages);
        snippets.push(`【${target.persona}向けメッセージ例】${msg}`);
      }
    }

    // コピーライティング公式から
    if (chatladyTrends.copywritingFormulas?.headlines?.powerWords) {
      const words = chatladyTrends.copywritingFormulas.headlines.powerWords.slice(0, 8);
      snippets.push(`【パワーワード】${words.join('、')}`);
    }

    // 異議対応から
    if (chatladyTrends.copywritingFormulas?.objectionHandling) {
      const obj = randomPick(chatladyTrends.copywritingFormulas.objectionHandling) as { objection: string; response: string };
      snippets.push(`【異議対応】「${obj.objection}」→「${obj.response}」`);
    }

    // 求人訴求ポイントから
    if (chatladyTrends.recruitmentAppealPoints) {
      const categories = Object.keys(chatladyTrends.recruitmentAppealPoints);
      const category = randomPick(categories);
      const points = chatladyTrends.recruitmentAppealPoints[category];
      if (Array.isArray(points) && points.length > 0) {
        const point = randomPick(points);
        snippets.push(`【求人訴求(${category})】${point}`);
      }
    }
  }

  // 過去の投稿履歴から参考例（重複しないよう3件まで）
  if (postHistory && postHistory.length > 0) {
    const recentPosts = postHistory.slice(0, 10);
    const sample = randomPick(recentPosts);
    if (sample?.generatedPost) {
      // 長すぎる場合は最初の200文字だけ
      const excerpt = sample.generatedPost.length > 200
        ? sample.generatedPost.substring(0, 200) + '...'
        : sample.generatedPost;
      snippets.push(`【過去投稿参考】${excerpt}`);
    }
  }

  return snippets;
}

// ライバーアカウント共通設定
const LIVER_CONFIG = {
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
};

// アカウント種別ごとの設定
export const ACCOUNT_CONFIG: Record<string, typeof LIVER_CONFIG> = {
  // ライバーアカウント
  tt_liver: LIVER_CONFIG,
  litz_grp: LIVER_CONFIG,
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
 * アカウント別のDM獲得投稿を生成（自動品質改善付き）
 * 8点未満なら最大5回まで自動リトライ
 * 8点以上なら成功パターンDBに保存
 * 知識データベースを活用してより効果的な投稿を生成
 */
export async function generateDMPostForAccount(account: AccountType): Promise<GeneratedPost & { score?: QualityScore }> {
  // WordPressは対象外
  if (account === 'wordpress') {
    return {
      text: '',
      target: { id: '', label: '', concerns: '', desires: '' },
      benefit: { id: '', label: '', hook: '', proof: '' },
      pattern: POST_PATTERNS[0],
      account,
      score: {
        total: 0,
        passed: false,
        breakdown: { empathy: 0, benefit: 0, cta: 0, urgency: 0, trust: 0 },
        issues: ['WordPressは対象外'],
        suggestions: [],
        readability: 0,
      },
    };
  }

  const config = ACCOUNT_CONFIG[account];
  const target = randomPick(config.targets);
  const benefit = randomPick(config.benefits);
  const pattern = randomPick(POST_PATTERNS);

  // 過去の成功例を取得
  const successExamples = await getSuccessExamplesForPrompt(account, 3);

  // 知識データベースを読み込み
  const { recruitmentCopy, xTemplates, chatladyTrends, postHistory } = await loadKnowledgeDB();
  const knowledgeSnippets = getKnowledgeSnippets(recruitmentCopy, xTemplates, chatladyTrends, postHistory, account);

  let bestPost: { text: string; score: QualityScore } | null = null;
  let feedback = '';

  // 最大5回まで試行（品質基準を高く）
  for (let attempt = 0; attempt < 5; attempt++) {
    const prompt = buildPrompt(config, target, benefit, pattern, feedback, successExamples, knowledgeSnippets);

    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    const text = result.text?.trim() || "";
    const score = checkQuality(text);

    console.log(`[Generator] ${account} attempt ${attempt + 1}: score=${score.total}/10 readability=${score.readability}`);

    // 8点以上なら即採用 & 成功パターンに保存
    if (score.passed && score.total >= 8) {
      await saveSuccessPattern(
        account,
        text,
        score.total,
        target.label,
        benefit.label,
        pattern.label
      );
      return { text, target, benefit, pattern, account, score };
    }

    // 最高スコアを保持
    if (!bestPost || score.total > bestPost.score.total) {
      bestPost = { text, score };
    }

    // 次回用のフィードバックを構築（より詳細に）
    feedback = buildFeedback(score);
  }

  // 5回試しても8点未満なら最高スコアのものを返す（保存はしない）
  return {
    text: bestPost!.text,
    target,
    benefit,
    pattern,
    account,
    score: bestPost!.score,
  };
}

/**
 * プロンプト生成（高品質版v3 - 知識DB統合）
 */
function buildPrompt(
  config: typeof ACCOUNT_CONFIG.liver,
  target: typeof ACCOUNT_CONFIG.liver.targets[0],
  benefit: typeof ACCOUNT_CONFIG.liver.benefits[0],
  pattern: typeof POST_PATTERNS[0],
  feedback: string,
  successExamples: string,
  knowledgeSnippets: string[] = []
): string {
  let prompt = `あなたはプロのSNSコピーライターであり、${config.stance}として働いています。
${config.jobType}の求人で、TwitterからDMでの問い合わせを獲得するための投稿を作成してください。

## 目的
- ターゲットの心に刺さる投稿を書く
- DMで問い合わせしたいと思わせる
- 怪しさを感じさせず、信頼感を与える

## お仕事内容
${config.jobDescription}

## ターゲット
${target.label}
- 抱えている不安: ${target.concerns}
- 本当の欲求: ${target.desires}

## 伝えるメリット
${benefit.label}
- フック: ${benefit.hook}
- 証拠: ${benefit.proof}

## 投稿構成パターン
${pattern.label}: ${pattern.structure}

## 必須要素（8点以上の高品質投稿に必要）

### 1. 共感フレーズ（冒頭で引き込む）
- 「ぶっちゃけ」「正直」「本当は」「マジで」
- 「〜って思ってない？」「〜だよね？」
- 「わかる」「あるある」
※ターゲットの悩みに寄り添う表現で始める

### 2. 具体的な数字（説得力を出す）
- 金額: 「月○万円」「時給○円」
- 時間: 「週○日」「1日○時間」「○分だけ」
- 実績: 「○人が」「○ヶ月で」
※曖昧な表現は避ける

### 3. 信頼性（事務所スタッフ感を出す）
- 「うちで働いてる子は〜」
- 「所属の子で〜」
- 「実際に〜した子がいて」
※第三者の成功体験として語る

### 4. CTA（ハードル低く誘導）
- 「興味あったらDMで」
- 「気軽にメッセージして」
- 「質問だけでも全然OK」
- 「相談乗るよ」
※最後に必ず入れる

### 5. 緊急性（あれば加点）
- 「今なら」「募集中」「今月限定」

## 文章構成ルール

### 形式
- 200-270文字（API制限280文字以内で最大限伝える）
- 2-3段落に分ける（空行で区切る）
- 1文は短く（30文字以内が理想）

### 絵文字
- 1-2個だけ使う（最後のCTAに1つ程度：💬✨など）

### 禁止事項
- 連続感嘆符（「！！」「！！！」）は使わない
- 誇大表現（「絶対」「確実」「100%」「必ず」）
- 直接的な表現
- リンク・ハッシュタグ
- 「LINE追加」などの別媒体誘導

## 高評価の投稿例（200-300文字）

例1（共感→解決パターン）:
ぶっちゃけ「副業したいけど何やればいいかわからない」って子、多いよね。

うちで働いてる主婦の子、子供が寝た後の2時間だけで月8万稼いでる。
顔出しなし、通勤ゼロ。

気になったらDMで💬

例2（実績→方法パターン）:
正直、夜のお仕事って聞くと不安だよね。

でも所属の子、画面越しだから誰とも会わないし
週3日で月20万超えてる子もいるんだよね。

興味あったら気軽にDMして✨

例3（Q&A形式パターン）:
「顔出しなしでも稼げるの？」ってよく聞かれる。

うちの子、顔出しなしで月30万いってる。
むしろ顔出しなしの方が気楽って言ってた。

気になったら相談だけでもDMして💬`;

  // 過去の成功例があれば追加
  if (successExamples) {
    prompt += `

## 参考：過去の高評価投稿（8点以上）
${successExamples}

※上記は実績のある投稿です。構成・トーン・表現を参考に、新しいオリジナルの投稿を作成してください。`;
  }

  // 知識データベースからのインスピレーション
  if (knowledgeSnippets.length > 0) {
    prompt += `

## 参考：マーケティング知識DB
以下は効果的な投稿を作成するための参考情報です。適宜活用してください：

${knowledgeSnippets.join('\n')}

※これらは参考例です。そのまま使わず、自然な文章に組み込んでください。`;
  }

  if (feedback) {
    prompt += `

## 前回の問題点（必ず改善してください）
${feedback}`;
  }

  prompt += `

---
投稿文のみを出力してください。
説明や補足は不要です。
必ず2-3段落に分け、空行で区切ってください。`;

  return prompt;
}

/**
 * 品質スコアからフィードバックを生成（詳細版）
 */
function buildFeedback(score: QualityScore): string {
  const feedbacks: string[] = [];

  if (score.breakdown.empathy < 2) {
    feedbacks.push('【共感が不足】冒頭に「ぶっちゃけ」「正直」「〜って思ってない？」「〜だよね？」を追加してください。ターゲットの悩みに寄り添う表現が必要です。');
  }

  if (score.breakdown.benefit < 2) {
    feedbacks.push('【具体的な数字がない】「月○万円」「週○日」「時給○円」「1日○時間」など、具体的な数字を入れてください。曖昧な表現は説得力がありません。');
  }

  if (score.breakdown.cta < 2) {
    feedbacks.push('【CTAが弱い】最後に「興味あったらDMで💬」「気軽にメッセージして✨」など、明確なDM誘導を入れてください。「相談だけでもOK」などハードルを下げる表現も効果的です。');
  }

  if (score.breakdown.trust < 2) {
    feedbacks.push('【信頼性が低い】「うちで働いてる子は〜」「所属の子で〜」「実際に〜した子がいて」など、第三者の成功体験として語ってください。事務所スタッフ感を出すことが重要です。');
  }

  if (score.breakdown.urgency < 1) {
    feedbacks.push('【緊急性がない】「今なら」「募集中」「今月限定」など、今行動する理由を追加すると効果的です。');
  }

  // 読みやすさのフィードバック
  if (score.readability && score.readability < 60) {
    feedbacks.push('【文章が読みにくい】2-3段落に分けて空行で区切ってください。1文は30文字以内が理想です。漢字が多すぎる場合はひらがなを増やしてください。');
  }

  return feedbacks.join('\n\n');
}

/**
 * 3アカウント分の投稿を一括生成
 */
export async function generatePostsForAllAccounts(): Promise<{
  account: AccountType;
  post: GeneratedPost;
}[]> {
  const accounts: AccountType[] = ['tt_liver', 'chatre1', 'chatre2'];

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
- 200-270文字（API制限280文字以内）
- 事務所スタッフの視点（「所属の子は〜」「うちで働くと〜」）
- 具体的な数字を入れる（金額、時間、日数）
- 2-3段落に分ける
- 最後に「興味ある方はDMで」などCTAを入れる
- ハッシュタグ禁止
- 過度な煽りNG（「絶対」「確実」「100%」禁止）

投稿文のみ出力。説明不要。`;

  const result = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  const text = result.text?.trim() || "";

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

/**
 * Persistent Post Generator
 * Claude Code風の「粘り強い」投稿生成システム
 *
 * 特徴:
 * 1. 失敗診断 - なぜスコアが低いかを分類
 * 2. 戦略切り替え - 失敗タイプに応じてアプローチ変更
 * 3. フィードバック引継ぎ - 前回の失敗を次に活かす
 * 4. 粘りレベル設定 - 諦めずに複数戦略を試す
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { QualityScore } from './state';
import { generateSinglePost, generateBestPost } from './post-generator';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const analyzerModel = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  temperature: 0.2,
  apiKey,
});

// ========================================
// 失敗タイプ定義
// ========================================

export type FailureType =
  | 'empathy_weak'      // 共感が弱い
  | 'cta_weak'          // CTAが弱い
  | 'not_credible'      // 信頼性が低い
  | 'too_generic'       // 独自性がない
  | 'ai_detected'       // AI臭い
  | 'low_engagement'    // エンゲージメント予測が低い
  | 'weak_opening'      // 冒頭が弱い
  | 'multiple_issues';  // 複合問題

export interface FailureDiagnosis {
  primaryFailure: FailureType;
  secondaryFailures: FailureType[];
  severity: 'mild' | 'moderate' | 'severe';
  specificIssues: string[];
  recommendedStrategy: GenerationStrategy;
}

// ========================================
// 生成戦略定義
// ========================================

export type GenerationStrategy =
  | 'story_driven'      // ストーリー重視
  | 'benefit_focused'   // ベネフィット強調
  | 'urgency_boost'     // 緊急性強調
  | 'social_proof'      // 社会的証明
  | 'question_hook'     // 質問型フック
  | 'confession'        // 告白型
  | 'contrast'          // ビフォーアフター
  | 'default';          // 通常

const STRATEGY_TEMPLATES: Record<GenerationStrategy, {
  description: string;
  temperatureBoost: number;
  promptModifier: string;
  bestFor: FailureType[];
}> = {
  story_driven: {
    description: 'ストーリーで共感を引き出す',
    temperatureBoost: 0.1,
    promptModifier: `
【必須】実際のエピソードやストーリーを含めること
- 「私も最初は〜」「ある人は〜」のような語り口
- 具体的な状況描写を入れる
- 感情の変化を表現する`,
    bestFor: ['empathy_weak', 'too_generic'],
  },
  benefit_focused: {
    description: '具体的なメリットを前面に',
    temperatureBoost: 0,
    promptModifier: `
【必須】具体的な数字とメリットを冒頭に
- 「月○○万」「週○時間で」など具体的な数字
- 抽象的な表現は禁止
- 「できる」ではなく「実際に○○した」`,
    bestFor: ['not_credible', 'low_engagement'],
  },
  urgency_boost: {
    description: '今すぐ行動したくなる緊急性',
    temperatureBoost: 0,
    promptModifier: `
【必須】緊急性を自然に演出
- 「今月限定」「残り○枠」などの限定感
- ただし煽りすぎない自然な表現
- 「今」行動する理由を提示`,
    bestFor: ['cta_weak', 'low_engagement'],
  },
  social_proof: {
    description: '社会的証明で信頼性UP',
    temperatureBoost: 0,
    promptModifier: `
【必須】他の人の成功例を含める
- 「○○さんは3ヶ月で〜」のような実例
- 「多くの人が」「先輩ライバーも」
- 具体的な事例で信頼性を高める`,
    bestFor: ['not_credible', 'empathy_weak'],
  },
  question_hook: {
    description: '質問で引き込む',
    temperatureBoost: 0.1,
    promptModifier: `
【必須】冒頭を質問で始める
- 「〜って思ったことない？」
- 「〜で悩んでない？」
- 読者が「自分のことだ」と思う質問`,
    bestFor: ['weak_opening', 'low_engagement'],
  },
  confession: {
    description: '告白型で本音感を出す',
    temperatureBoost: 0.15,
    promptModifier: `
【必須】「ぶっちゃけ」「正直」で始める
- 本音トーンで書く
- 「実は〜」「ここだけの話〜」
- 親しみやすい語り口`,
    bestFor: ['ai_detected', 'too_generic', 'empathy_weak'],
  },
  contrast: {
    description: 'ビフォーアフターで変化を強調',
    temperatureBoost: 0,
    promptModifier: `
【必須】変化のストーリーを含める
- 「○○だった私が、今では〜」
- before/afterの対比を明確に
- 変化の過程も少し触れる`,
    bestFor: ['not_credible', 'weak_opening'],
  },
  default: {
    description: '通常の生成',
    temperatureBoost: 0,
    promptModifier: '',
    bestFor: [],
  },
};

// ========================================
// 失敗診断
// ========================================

export async function diagnoseFailure(
  score: QualityScore,
  text: string
): Promise<FailureDiagnosis> {
  const failures: FailureType[] = [];
  const specificIssues: string[] = [];

  // スコアベースの診断
  if (score.empathy < 2) {
    failures.push('empathy_weak');
    specificIssues.push(`共感スコア${score.empathy}/3 - ターゲットの気持ちに寄り添えていない`);
  }
  if (score.cta < 1) {
    failures.push('cta_weak');
    specificIssues.push(`CTAスコア${score.cta}/2 - 行動を促す要素が弱い`);
  }
  if (score.credibility < 1) {
    failures.push('not_credible');
    specificIssues.push(`信頼性スコア${score.credibility}/2 - 具体的な根拠がない`);
  }
  if (score.originality < 1) {
    failures.push('too_generic');
    specificIssues.push(`独自性スコア${score.originality}/2 - テンプレート的`);
  }
  if (score.engagement < 1) {
    failures.push('low_engagement');
    specificIssues.push(`エンゲージメント${score.engagement}/2 - 反応を引き出せない`);
  }
  if (score.scrollStop < 1) {
    failures.push('weak_opening');
    specificIssues.push(`冒頭の引き${score.scrollStop}/1 - スクロールを止められない`);
  }

  // AI検出チェック（テキストベース）
  const aiIndicators = [
    text.includes('させていただ'),
    text.includes('ございます'),
    (text.match(/また、|さらに、|そして、/g) || []).length >= 3,
    text.split('。').every(s => s.length > 20 && s.length < 40), // 均一な文長
  ];
  if (aiIndicators.filter(Boolean).length >= 2) {
    failures.push('ai_detected');
    specificIssues.push('AI特有のパターンが検出された');
  }

  // 重複を除去
  const uniqueFailures = [...new Set(failures)];

  // 重症度判定
  const severity: 'mild' | 'moderate' | 'severe' =
    score.total >= 10 ? 'mild' :
    score.total >= 7 ? 'moderate' : 'severe';

  // 主要な失敗を特定
  const primaryFailure = uniqueFailures[0] || 'multiple_issues';

  // 推奨戦略を決定
  const recommendedStrategy = selectStrategy(primaryFailure, uniqueFailures);

  return {
    primaryFailure,
    secondaryFailures: uniqueFailures.slice(1),
    severity,
    specificIssues,
    recommendedStrategy,
  };
}

function selectStrategy(
  primary: FailureType,
  allFailures: FailureType[]
): GenerationStrategy {
  // 各戦略のスコアを計算
  const scores: Record<GenerationStrategy, number> = {
    story_driven: 0,
    benefit_focused: 0,
    urgency_boost: 0,
    social_proof: 0,
    question_hook: 0,
    confession: 0,
    contrast: 0,
    default: 0,
  };

  for (const [strategy, config] of Object.entries(STRATEGY_TEMPLATES)) {
    for (const failure of allFailures) {
      if (config.bestFor.includes(failure)) {
        scores[strategy as GenerationStrategy] += failure === primary ? 3 : 1;
      }
    }
  }

  // 最高スコアの戦略を返す
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] as GenerationStrategy : 'default';
}

// ========================================
// 粘り強い生成
// ========================================

export interface PersistentGenerationConfig {
  minScore: number;           // 最低スコア（デフォルト: 10）
  maxAttempts: number;        // 最大試行回数（デフォルト: 5）
  maxStrategies: number;      // 試す戦略の最大数（デフォルト: 3）
  candidatesPerAttempt: number; // 1回あたりの候補数（デフォルト: 3）
  escalateCandidates: boolean;  // 失敗時に候補数を増やすか
  verbose: boolean;           // 詳細ログ
}

export interface PersistentGenerationResult {
  success: boolean;
  text: string;
  target: string;
  benefit: string;
  score: QualityScore;
  attempts: number;
  strategiesUsed: GenerationStrategy[];
  totalCandidates: number;
  failureHistory: Array<{
    attempt: number;
    score: number;
    diagnosis: FailureDiagnosis;
    strategy: GenerationStrategy;
  }>;
  finalDiagnosis?: FailureDiagnosis;
}

const DEFAULT_CONFIG: PersistentGenerationConfig = {
  minScore: 10,
  maxAttempts: 5,
  maxStrategies: 3,
  candidatesPerAttempt: 3,
  escalateCandidates: true,
  verbose: true,
};

/**
 * 粘り強い投稿生成
 * 失敗しても諦めずに戦略を変えて再挑戦
 */
export async function generateWithPersistence(
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  target?: string,
  benefit?: string,
  config: Partial<PersistentGenerationConfig> = {}
): Promise<PersistentGenerationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const log = cfg.verbose ? console.log : () => {};

  let attempts = 0;
  let totalCandidates = 0;
  let candidateCount = cfg.candidatesPerAttempt;
  const strategiesUsed: GenerationStrategy[] = [];
  const failureHistory: PersistentGenerationResult['failureHistory'] = [];
  const triedStrategies = new Set<GenerationStrategy>();

  let currentStrategy: GenerationStrategy = 'default';
  let previousFeedback = '';

  log(`\n[Persistent] Starting generation (minScore: ${cfg.minScore}, maxAttempts: ${cfg.maxAttempts})`);

  while (attempts < cfg.maxAttempts) {
    attempts++;
    log(`\n[Persistent] === Attempt ${attempts}/${cfg.maxAttempts} ===`);
    log(`[Persistent] Strategy: ${currentStrategy}, Candidates: ${candidateCount}`);

    if (previousFeedback) {
      log(`[Persistent] Previous feedback: ${previousFeedback.slice(0, 100)}...`);
    }

    try {
      // 候補生成
      const result = await generateBestPost(
        account,
        accountType,
        target,
        benefit,
        candidateCount
      );
      totalCandidates += candidateCount;

      const bestScore = result.best.score.total;
      log(`[Persistent] Best score: ${bestScore} (target: ${cfg.minScore})`);

      // 成功判定
      if (bestScore >= cfg.minScore) {
        log(`[Persistent] ✅ Success! Score ${bestScore} >= ${cfg.minScore}`);
        strategiesUsed.push(currentStrategy);

        return {
          success: true,
          text: result.best.text,
          target: result.best.target,
          benefit: result.best.benefit,
          score: result.best.score,
          attempts,
          strategiesUsed,
          totalCandidates,
          failureHistory,
        };
      }

      // 失敗 → 診断
      const diagnosis = await diagnoseFailure(result.best.score, result.best.text);
      log(`[Persistent] ❌ Failed. Primary issue: ${diagnosis.primaryFailure}`);
      log(`[Persistent] Issues: ${diagnosis.specificIssues.join(', ')}`);

      failureHistory.push({
        attempt: attempts,
        score: bestScore,
        diagnosis,
        strategy: currentStrategy,
      });

      // フィードバック構築（次回に引き継ぐ）
      previousFeedback = buildFeedbackForNextAttempt(diagnosis, result.best.score);

      // 戦略更新
      strategiesUsed.push(currentStrategy);
      triedStrategies.add(currentStrategy);

      // 新しい戦略を選択（まだ試してないもの優先）
      const nextStrategy = diagnosis.recommendedStrategy;
      if (!triedStrategies.has(nextStrategy) && strategiesUsed.length < cfg.maxStrategies) {
        currentStrategy = nextStrategy;
      } else {
        // 試してない戦略からランダム選択
        const untried = Object.keys(STRATEGY_TEMPLATES).filter(
          s => !triedStrategies.has(s as GenerationStrategy) && s !== 'default'
        ) as GenerationStrategy[];

        if (untried.length > 0) {
          currentStrategy = untried[Math.floor(Math.random() * untried.length)];
        }
      }

      // 候補数エスカレーション
      if (cfg.escalateCandidates && diagnosis.severity === 'severe') {
        candidateCount = Math.min(candidateCount + 2, 7);
        log(`[Persistent] Escalating candidates to ${candidateCount}`);
      }

    } catch (error) {
      log(`[Persistent] Error in attempt ${attempts}:`, error);
    }
  }

  // 最大試行回数到達 → 最後のベストを返す
  log(`\n[Persistent] ⚠️ Max attempts reached. Returning best available.`);

  const finalResult = await generateBestPost(account, accountType, target, benefit, 5);
  totalCandidates += 5;

  const finalDiagnosis = await diagnoseFailure(finalResult.best.score, finalResult.best.text);

  return {
    success: finalResult.best.score.total >= cfg.minScore,
    text: finalResult.best.text,
    target: finalResult.best.target,
    benefit: finalResult.best.benefit,
    score: finalResult.best.score,
    attempts,
    strategiesUsed,
    totalCandidates,
    failureHistory,
    finalDiagnosis,
  };
}

/**
 * 次の試行に向けたフィードバックを構築
 */
function buildFeedbackForNextAttempt(
  diagnosis: FailureDiagnosis,
  score: QualityScore
): string {
  const lines: string[] = [
    `【前回の問題点】`,
  ];

  // 主要な問題
  switch (diagnosis.primaryFailure) {
    case 'empathy_weak':
      lines.push('- 共感が足りない → ターゲットの具体的な悩みに言及すること');
      break;
    case 'cta_weak':
      lines.push('- CTAが弱い → 「気になったらDMで💬」等、自然な行動喚起を入れる');
      break;
    case 'not_credible':
      lines.push('- 信頼性が低い → 具体的な数字や実例を入れる');
      break;
    case 'too_generic':
      lines.push('- 独自性がない → テンプレート表現を避け、具体的なエピソードを');
      break;
    case 'ai_detected':
      lines.push('- AI臭い → 「させていただく」等の丁寧すぎる表現を避け、話し言葉で');
      break;
    case 'low_engagement':
      lines.push('- 反応を引き出せない → 質問や問いかけを入れる');
      break;
    case 'weak_opening':
      lines.push('- 冒頭が弱い → 最初の3-5文字で「え？」と思わせる');
      break;
  }

  // 二次的な問題
  for (const failure of diagnosis.secondaryFailures.slice(0, 2)) {
    lines.push(`- ${failure}も改善が必要`);
  }

  // 良かった点（維持すべき）
  if (score.strengths && score.strengths.length > 0) {
    lines.push(`【維持すべき良い点】`);
    lines.push(`- ${score.strengths[0]}`);
  }

  return lines.join('\n');
}

// ========================================
// 便利なラッパー関数
// ========================================

/**
 * 高品質モード（粘り強く高スコアを狙う）
 */
export async function generateHighQualityPost(
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  target?: string,
  benefit?: string
): Promise<PersistentGenerationResult> {
  return generateWithPersistence(account, accountType, target, benefit, {
    minScore: 12,       // 80%以上
    maxAttempts: 7,
    maxStrategies: 4,
    candidatesPerAttempt: 3,
    escalateCandidates: true,
  });
}

/**
 * 通常モード（バランス重視）
 */
export async function generateNormalPost(
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  target?: string,
  benefit?: string
): Promise<PersistentGenerationResult> {
  return generateWithPersistence(account, accountType, target, benefit, {
    minScore: 10,
    maxAttempts: 5,
    maxStrategies: 3,
    candidatesPerAttempt: 3,
    escalateCandidates: true,
  });
}

/**
 * 高速モード（速度優先）
 */
export async function generateQuickPost(
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  target?: string,
  benefit?: string
): Promise<PersistentGenerationResult> {
  return generateWithPersistence(account, accountType, target, benefit, {
    minScore: 8,
    maxAttempts: 3,
    maxStrategies: 2,
    candidatesPerAttempt: 3,
    escalateCandidates: false,
  });
}

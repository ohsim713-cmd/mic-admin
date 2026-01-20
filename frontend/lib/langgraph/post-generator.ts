/**
 * LangGraph 投稿生成ワークフロー
 * RESEARCH → DRAFT → REVIEW → REVISE → POLISH
 */

import { StateGraph, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  PostGeneratorState,
  PostGeneratorStateType,
  TARGETS,
  BENEFITS,
  QualityScore,
  WorkflowStep,
} from './state';
import { getSuccessPatterns, getWeightedPatternsByCategory, selectWeighted } from '../database/success-patterns-db';
import { getRandomHook, buildEnrichedKnowledgeContextWithGoogle, buildChatladyKnowledgeContextWithGoogle, getRandomInsight } from './knowledge-loader';
import { initPhoenix, tracePostGeneration, recordQualityScore } from '../phoenix/client';
import { saveBadPattern, checkAgainstBadPatterns, extractBadFeatures } from '../database/bad-patterns-db';
import { humanizeText, estimateAIScore, rehumanizeIfNeeded, ensureCTA, evaluateCTAStrength } from './humanizer';
import { getTopPatterns, getRandomPattern, getRandomTheme, getThemeIdeas } from '../agent/competitor-analyzer';
import {
  buildTrendingPostContext,
  containsProhibitedPhrase,
  shouldIncludeCTA,
  getRandomAllowedCTA,
  PROHIBITED_PHRASES,
} from './trending-posts-loader';

// 遅延読み込み（クライアントサイドエラー回避）
let enhancedScout: typeof import('../agent/sub-agents/enhanced-scout').default | null = null;
async function getEnhancedScout() {
  if (!enhancedScout) {
    try {
      const mod = await import('../agent/sub-agents/enhanced-scout');
      enhancedScout = mod.default;
    } catch {
      // サーバーサイド以外では使えない
    }
  }
  return enhancedScout;
}

// Phoenix 初期化（サーバー起動時に1回だけ）
try {
  initPhoenix();
} catch {
  // Phoenix が起動していない場合は無視
}

// Gemini モデル初期化（GEMINI_API_KEY を使用）
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-3-flash-preview',
  temperature: 0.8,
  maxOutputTokens: 1024,  // 文章が途切れないよう十分な長さを確保
  apiKey,
});

const reviewModel = new ChatGoogleGenerativeAI({
  model: 'gemini-3-flash-preview',
  temperature: 0.3,
  maxOutputTokens: 1024,
  apiKey,
});

// ========== ノード関数 ==========

/**
 * RESEARCH: メリットをメイン軸にし、ターゲットをサブ要素として選定
 * 強化版Scout + 成功パターンDBから重み付けで高スコアパターンを優先選択
 */
async function researchNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  // 業種判定（stateから取得、デフォルトはliver）
  const industry = (state as { industry?: 'liver' | 'chatlady' }).industry || 'liver';

  // 強化版Scoutからトレンド・実績ベースの素材を取得
  let scoutData: { topHooks: string[]; topBenefits: string[]; topTargets: string[] } | null = null;
  try {
    const scout = await getEnhancedScout();
    if (scout) {
      scoutData = await scout.quickScout(industry);
      console.log('[Research] 🔍 Scout data loaded:', {
        hooks: scoutData.topHooks.length,
        benefits: scoutData.topBenefits.length,
        targets: scoutData.topTargets.length,
      });
    }
  } catch (error) {
    console.warn('[Research] Scout failed, using defaults:', error);
  }

  // メリットをメイン軸として使用（Scout推奨 > state指定 > ランダム）
  const benefit = state.benefit
    || (scoutData?.topBenefits[Math.floor(Math.random() * Math.min(3, scoutData.topBenefits.length))])
    || BENEFITS[Math.floor(Math.random() * BENEFITS.length)];

  // ターゲットはサブ要素（Scout推奨 > state指定 > ランダム）
  const target = state.target
    || (scoutData?.topTargets[Math.floor(Math.random() * Math.min(3, scoutData.topTargets.length))])
    || TARGETS[Math.floor(Math.random() * TARGETS.length)];

  // 成功パターンをDBから重み付けで取得
  let successPatterns: string[] = [];
  let selectedHook: string | null = null;
  let selectedCta: string | null = null;
  let selectedBenefit: string | null = null;

  try {
    // カテゴリ別に重み付けパターンを取得
    const { hooks, ctas, benefits } = await getWeightedPatternsByCategory();

    // 各カテゴリから重み付けで1つずつ選択（スコアが高いほど選ばれやすい）
    const hookPattern = selectWeighted(hooks);
    const ctaPattern = selectWeighted(ctas);
    const benefitPattern = selectWeighted(benefits);

    if (hookPattern) {
      selectedHook = hookPattern.text;
      successPatterns.push(`【フック】${hookPattern.text}（スコア${hookPattern.score.toFixed(1)}）`);
    }
    if (ctaPattern) {
      selectedCta = ctaPattern.text;
      successPatterns.push(`【CTA】${ctaPattern.text}（スコア${ctaPattern.score.toFixed(1)}）`);
    }
    if (benefitPattern) {
      selectedBenefit = benefitPattern.text;
      successPatterns.push(`【メリット表現】${benefitPattern.text}（スコア${benefitPattern.score.toFixed(1)}）`);
    }

    // パターンが足りない場合はフォールバック
    if (successPatterns.length === 0) {
      const patterns = await getSuccessPatterns();
      successPatterns = patterns.slice(0, 3);
    }
  } catch {
    // DBがない場合はデフォルトパターン
    successPatterns = [
      '【フック】ぶっちゃけ〜って思ってる人へ',
      '【CTA】気になったらDMで💬',
      '【メリット表現】月30万以上',
    ];
  }

  // Scoutからのトレンドフックを追加
  if (scoutData?.topHooks && scoutData.topHooks.length > 0) {
    const scoutHook = scoutData.topHooks[Math.floor(Math.random() * Math.min(3, scoutData.topHooks.length))];
    if (scoutHook && !selectedHook) {
      selectedHook = scoutHook;
      successPatterns.push(`【トレンドフック】${scoutHook}（実績/Tavily推奨）`);
    }
  }

  // ナレッジベースからフックパターンを追加（補完）
  if (!selectedHook) {
    try {
      const hook = await getRandomHook();
      if (hook) {
        selectedHook = hook;
        successPatterns.push(`【フック候補】${hook}`);
      }
    } catch {
      // エラーは無視
    }
  }

  // バズ投稿から学んだパターンを追加（業種問わず → ライバー用にアレンジ済み）
  let competitorPatterns: string[] = [];
  let suggestedTheme: string | null = null;
  try {
    // テーマ（話題・切り口）を取得 - 最も効果的
    const themeIdeas = getThemeIdeas(3);
    if (themeIdeas.length > 0) {
      // ランダムに1つ選んで今回のテーマとして提案
      const randomIdx = Math.floor(Math.random() * themeIdeas.length);
      const selectedTheme = themeIdeas[randomIdx];
      suggestedTheme = selectedTheme.theme;
      competitorPatterns.push(`🔥【今回使えるテーマ案】${selectedTheme.theme}\n   例: ${selectedTheme.example}\n   なぜバズる: ${selectedTheme.lesson}`);
      console.log('[Research] 🎯 Theme idea:', suggestedTheme);
    }

    // 型（hook, structure等）を取得
    const topPatterns = getTopPatterns(3).filter(p => p.type !== 'theme');
    if (topPatterns.length > 0) {
      for (const p of topPatterns) {
        const example = p.liverExample || p.example;
        competitorPatterns.push(`【${p.type}の型】${p.pattern}\n   ライバー用例: ${example}`);
      }
      console.log('[Research] 📊 Buzz patterns loaded:', topPatterns.length);
    }
  } catch {
    // パターンがない場合は無視
  }

  // 失敗パターンから回避すべき特徴を抽出
  let avoidPatterns: string[] = [];
  try {
    const badFeatures = extractBadFeatures();
    if (badFeatures.badOpenings.length > 0) {
      avoidPatterns.push(`冒頭を避ける: ${badFeatures.badOpenings.slice(0, 3).map(o => `「${o.substring(0, 10)}...」`).join(', ')}`);
    }
    if (badFeatures.badWords.length > 0) {
      avoidPatterns.push(`使用を避けるワード: ${badFeatures.badWords.slice(0, 5).join(', ')}`);
    }
    const currentCombo = `${target}:${benefit}`;
    if (badFeatures.badTargetBenefitCombos.includes(currentCombo)) {
      avoidPatterns.push(`⚠️ この組み合わせ（${target}×${benefit}）は過去に低スコア。特に工夫が必要`);
    }
  } catch {
    // エラーは無視
  }

  return {
    target,
    benefit,
    successPatterns,
    avoidPatterns,
    competitorPatterns,
    currentStep: 'draft' as WorkflowStep,
  };
}

// 文章スタイルのバリエーション（幅広い文章を生成するため）
const WRITING_STYLES = [
  { id: 'empathy', name: '共感型', instruction: '読者の悩みに深く寄り添い、「分かるよ」「私もそうだった」という姿勢で書く。感情に訴えかける。' },
  { id: 'story', name: 'ストーリー型', instruction: '具体的な人物のエピソード・体験談を中心に構成。「うちの30代のライバーさんが〜」のように臨場感を出す。' },
  { id: 'question', name: '質問型', instruction: '冒頭から読者に問いかけ、考えさせる。「〜って思ってない？」「〜じゃないですか？」で興味を引く。' },
  { id: 'benefit_first', name: 'ベネフィット先行型', instruction: '冒頭でメリット・結果を明示。「週3日で月20万」など数字を最初に出して興味を引く。' },
  { id: 'contrast', name: '対比型', instruction: 'ビフォーアフター、過去と現在の対比で変化を見せる。「前は〜だったけど、今は〜」構成。' },
  { id: 'casual', name: 'カジュアル型', instruction: '友達にLINEするようなフランクなトーン。敬語控えめ、タメ口寄り。「〜なんだよね」「〜してみない？」' },
  { id: 'professional', name: 'プロ型', instruction: '事務所としての信頼感・専門性を強調。実績データや具体的なサポート体制を前面に。' },
  { id: 'secret', name: '秘密共有型', instruction: '「ここだけの話」「実は」感を出す。読者だけに特別な情報を教える雰囲気。' },
  { id: 'urgent', name: '緊急性型', instruction: '「今なら」「今月限定」「枠が残りわずか」など、今すぐ行動を促す要素を入れる。' },
  { id: 'social_proof', name: '社会的証明型', instruction: '他の人がやっている・成功している事実を示す。「〇〇人が応募」「最近増えてる」など。' },
];

/**
 * DRAFT: 投稿文を生成（ナレッジベース活用 + スタイルバリエーション + お手本参照）
 */
async function draftNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const { target, benefit, accountType, successPatterns, avoidPatterns, competitorPatterns, feedback } = state;

  // ランダムにスタイルを選択（幅広い文章を生成するため）
  const selectedStyle = WRITING_STYLES[Math.floor(Math.random() * WRITING_STYLES.length)];

  // お手本投稿を取得（他業界からも参照してバリエーション向上）
  let trendingPostContext = '';
  try {
    trendingPostContext = await buildTrendingPostContext();
    if (trendingPostContext) {
      console.log('[Draft] 📝 Trending post context loaded');
    }
  } catch {
    // 取得失敗は無視
  }

  // CTAを入れるかどうか判定（10%の確率）
  const includeCTA = shouldIncludeCTA();
  const ctaInstruction = includeCTA
    ? `★CTAを入れる回: 最後に「${getRandomAllowedCTA()}」を自然に入れる`
    : '★今回はCTAなし: 最後にDMや問い合わせを促す文言は入れない（自然な締めくくりで終わる）';

  // ナレッジコンテキストを取得（毎回新鮮な情報を使う - バリエーション向上のため）
  // Google検索で収集したナレッジも自動的に活用
  let knowledgeContext = '';
  try {
    if (accountType === 'ライバー') {
      // ライバー用はリッチなコンテキスト + Google検索ナレッジ
      knowledgeContext = await buildEnrichedKnowledgeContextWithGoogle();
    } else {
      // チャトレ用はリッチコンテキスト + Google検索ナレッジ
      knowledgeContext = await buildChatladyKnowledgeContextWithGoogle();
    }
  } catch {
    // ナレッジ取得失敗は無視
  }

  // ユーザーの気づきを取得（壁打ちで保存した内容を反映）
  let insightContext = '';
  try {
    const insight = await getRandomInsight();
    if (insight) {
      insightContext = `\n\n${insight}`;
    }
  } catch {
    // 気づき取得失敗は無視
  }

  const patternsText = successPatterns.length > 0
    ? `\n\n【参考にする成功パターン】\n${successPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  // 競合バズ投稿から学んだ型・教訓（オリジナリティ向上用）
  const competitorText = competitorPatterns && competitorPatterns.length > 0
    ? `\n\n【🔥 競合のバズ投稿から学んだ型】\n${competitorPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n※上記の「型」を参考にしつつ、自分のオリジナルな表現で書く！丸パクリはNG、エッセンスだけ取り入れる。`
    : '';

  const avoidText = avoidPatterns && avoidPatterns.length > 0
    ? `\n\n【⚠️ 回避すべきパターン（過去の失敗学習）】\n${avoidPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n※上記は過去に低スコアだった投稿の特徴。必ず違うアプローチを取ること！`
    : '';

  const feedbackText = feedback
    ? `\n\n【前回のフィードバック（必ず改善すること）】\n${feedback}`
    : '';

  // 禁止ワードリストをプロンプト用に整形
  const prohibitedText = `\n\n【🚫 使用禁止ワード・フレーズ】\n${PROHIBITED_PHRASES.map(p => `・「${p}」`).join('\n')}\n※これらは存在しないサービスや過大な約束のため、絶対に使わない！`;

  const prompt = `あなたは${accountType}事務所のSNS担当者です。DMでの問い合わせ獲得を目的とした投稿文を作成してください。

【ターゲット】${target}
【訴求ポイント】${benefit}

★★★【今回の文章スタイル: ${selectedStyle.name}】★★★
${selectedStyle.instruction}
※このスタイルに沿って書くこと！他の投稿と差別化するため、このスタイル特有の表現を使う。
${trendingPostContext}
${knowledgeContext}${insightContext}
${patternsText}${competitorText}${avoidText}${prohibitedText}
${feedbackText}

【絶対に守るルール】
- 一人称は「事務所」「当事務所」「うち」など事務所視点で書く
- ※「私」「僕」など個人の一人称は絶対に使わない（事務所が発信している文章）
- 所属ライバーの実績を紹介する形で書く（「うちのライバーさんが〜」「所属メンバーの○○さんは〜」など）

【CTA（行動喚起）ルール】
${ctaInstruction}
※「無料診断」「カウンセリング」「説明会」など存在しないサービスは絶対に書かない！

【重要な条件】
- ★★冒頭は必ず【今回使う冒頭フレーズ】をそのまま使う（「ぶっちゃけ」で始めない）
- ★★【${selectedStyle.name}】のスタイルに従って書く
- ★★お手本投稿がある場合はその「構造・言い回し・テンション」を参考にアレンジする
- 280〜320文字（中長文で深く刺す）
- ★上記の【今回使う具体的な情報】を必ず1つ以上盛り込む（実例、年齢戦略、収入シミュレーション、統計など）
- 具体的な数字を入れる（バリエーションを持たせて毎回違う数字を使う）
  例: 月20万〜50万、週2〜4日、初月10万、3ヶ月で月収○万円達成 など
- ※「時給16,500円」は使用禁止（他の表現で収入を伝える）
- ※「初月25万、4ヶ月で95万」は使用頻度が高すぎるので別の数字を使う
- 実績や事例を自然に盛り込む（「うちの30代のライバーさんが3ヶ月で〜」「40代で始めた方が今では〜」など具体的に）
- プラットフォーム名（Pococha、17LIVE、IRIAM等）を自然に入れる
- 絵文字は1-2個程度
- ハッシュタグは不要
- 2-3行ごとに空行を入れて読みやすく

投稿文のみを出力してください:`;

  const response = await model.invoke(prompt);
  const draftText = response.content as string;

  return {
    draftText,
    currentStep: 'review' as WorkflowStep,
  };
}

/**
 * REVIEW: 品質スコアを評価（LLM as a Judge - 15点満点）
 */
async function reviewNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const { draftText, target, benefit } = state;

  const prompt = `あなたは「SNSマーケティングの厳格な批評家」です。

【あなたの役割】
- 100件以上の募集投稿を分析してきたプロの目線で評価
- 甘い評価は禁止。「まあまあ」「普通」は存在しない
- ターゲットの立場になって「本当にDMしたくなるか？」を厳しく判断

【評価の哲学】
- 「見慣れた表現」は即減点
- 「具体性のない約束」は信用しない
- 「押しつけがましいCTA」は逆効果と判断
- タイムライン上で「1秒で目に留まるか」を重視

---

【評価対象の投稿文】
${draftText}

【ターゲット】${target}
【訴求ポイント】${benefit}

---

以下の基準で厳格に採点してください。甘い評価は禁止です。

=== 既存評価項目（10点満点） ===

1. empathy (共感・本音感): 0-3点
   - 0点: 機械的、宣伝臭い
   - 1点: 多少の共感要素があるが表面的
   - 2点: ターゲットの悩みに寄り添っている
   - 3点: 「この人、分かってる」と思わせる深い共感

2. benefit (メリット提示): 0-2点
   - 0点: 抽象的な約束のみ
   - 1点: 数字はあるが具体性に欠ける
   - 2点: 具体的で信憑性のあるメリット提示

3. cta (行動喚起): 0-2点
   - 0点: CTAがない、または押しつけがましい
   - 1点: CTAはあるがありきたり
   - 2点: 自然にDMしたくなる導線

4. credibility (信頼性): 0-2点
   - 0点: 怪しい、詐欺っぽい
   - 1点: 事務所としての信頼感が薄い
   - 2点: 実績・事例があり信頼できる

5. urgency (緊急性): 0-1点
   - 0点: 「いつでもいい」感
   - 1点: 「今」行動したくなる要素がある

=== 新規評価項目（5点満点）===

6. originality (独自性・差別化): 0-2点
   - 0点: 「どこかで見た」感がある、テンプレート的
   - 1点: 部分的に新しい要素がある
   - 2点: 明確に差別化、独自の視点・エピソード

7. engagement (エンゲージメント予測): 0-2点
   - 0点: 一方的な宣伝、問いかけなし
   - 1点: 共感要素あり、ただし会話誘発は弱い
   - 2点: 「自分のことだ」と思わせる、リプしたくなる

8. scrollStop (スクロール停止力): 0-1点
   - 0点: 冒頭が平凡、タイムラインで流される
   - 1点: 冒頭3-5文字で「え？」と思わせる

---

=== 出力形式（JSONのみ） ===

{
  "empathy": 数値,
  "benefit": 数値,
  "cta": 数値,
  "credibility": 数値,
  "urgency": 数値,
  "originality": 数値,
  "engagement": 数値,
  "scrollStop": 数値,
  "total": 合計値(0-15),
  "feedback": "12点未満の場合の具体的な改善指示",
  "strengths": ["良い点1", "良い点2", "良い点3"],
  "weaknesses": ["改善点1", "改善点2", "改善点3"]
}

【重要】
- 各項目を独立して厳格に評価
- 「なんとなく良い」は禁止。根拠を持って採点
- feedbackは具体的に（「〇〇を△△に変えると良い」）`;

  const response = await reviewModel.invoke(prompt);
  const content = response.content as string;

  // JSON部分を抽出
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      score: {
        empathy: 2, benefit: 1, cta: 1, credibility: 1, urgency: 0,
        originality: 0, engagement: 0, scrollStop: 0, total: 5,
        strengths: [], weaknesses: ['評価の解析に失敗']
      },
      feedback: '評価の解析に失敗しました。再生成が必要です。',
      currentStep: 'revise' as WorkflowStep,
    };
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    const score: QualityScore = {
      empathy: result.empathy || 0,
      benefit: result.benefit || 0,
      cta: result.cta || 0,
      credibility: result.credibility || 0,
      urgency: result.urgency || 0,
      originality: result.originality || 0,
      engagement: result.engagement || 0,
      scrollStop: result.scrollStop || 0,
      total: result.total || 0,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
    };

    // 合格ライン: 12点以上（15点満点の80%）
    return {
      score,
      feedback: result.feedback || '',
      currentStep: score.total >= 12 ? 'polish' as WorkflowStep : 'revise' as WorkflowStep,
    };
  } catch {
    return {
      score: {
        empathy: 2, benefit: 1, cta: 1, credibility: 1, urgency: 0,
        originality: 0, engagement: 0, scrollStop: 0, total: 5,
        strengths: [], weaknesses: ['JSONパースエラー']
      },
      feedback: 'JSONパースエラー。再生成が必要です。',
      currentStep: 'revise' as WorkflowStep,
    };
  }
}

/**
 * REVISE: フィードバックに基づいて修正（最大3回）
 */
async function reviseNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const newRevisionCount = state.revisionCount + 1;

  // 3回以上リビジョンしたら強制的にPOLISHへ
  if (newRevisionCount >= 3) {
    return {
      revisionCount: newRevisionCount,
      currentStep: 'polish' as WorkflowStep,
    };
  }

  return {
    revisionCount: newRevisionCount,
    currentStep: 'draft' as WorkflowStep,
  };
}

/**
 * POLISH: 最終調整 + 人間化フィルター（AI臭対策）
 */
async function polishNode(
  state: PostGeneratorStateType
): Promise<Partial<PostGeneratorStateType>> {
  const { draftText } = state;

  const prompt = `以下の投稿文を最終調整してください。

【投稿文】
${draftText}

【調整ポイント】
- 280〜320文字に収める（短すぎず長すぎず）
- 2-3行ごとに空行を入れて読みやすく
- CTAが弱ければ「気になったらDMで💬」を追加
- 絵文字は1-2個に調整
- 全角/半角の統一
- 宣伝臭さを消して自然な語り口に
- 「めっちゃ」「ガチで」「マジで」などの口語を自然に入れる
- 文章が完璧すぎないように、たまに「〜」や「！」を使う

調整後の投稿文のみを出力:`;

  const response = await model.invoke(prompt);
  let polishedText = (response.content as string).trim();

  // === AI臭対策: 人間化フィルター適用 ===
  // 1. AI検出スコアをチェック
  const aiScore = estimateAIScore(polishedText);
  console.log(`[PostGenerator] AI検出スコア: ${aiScore.score}, フラグ: ${aiScore.flags.join(', ')}`);

  // 2. スコアが60以上の場合は人間化処理を適用
  if (aiScore.score >= 60) {
    const { text: humanizedText, newScore } = rehumanizeIfNeeded(polishedText, 60);
    console.log(`[PostGenerator] 人間化処理適用: ${aiScore.score} → ${newScore}`);
    polishedText = humanizedText;
  } else {
    // スコアが低くても軽い人間化処理を適用（揺らぎを追加）
    polishedText = humanizeText(polishedText, { emojiLevel: 'low' });
  }

  // === 禁止ワードチェック ===
  const prohibitedCheck = containsProhibitedPhrase(polishedText);
  if (prohibitedCheck.contains) {
    console.log(`[PostGenerator] ⚠️ 禁止ワード検出: ${prohibitedCheck.phrases.join(', ')}`);
    // 禁止ワードを含む文を削除または置換
    for (const phrase of prohibitedCheck.phrases) {
      // 禁止フレーズを含む行全体を削除
      const lines = polishedText.split('\n');
      polishedText = lines.filter(line => !line.includes(phrase)).join('\n');
    }
    console.log(`[PostGenerator] 禁止ワードを含む行を削除しました`);
  }

  // === CTA自動挿入（10%の確率でのみ） ===
  // 注意: draftNodeでshouldIncludeCTA()がtrueの場合のみCTAが入っているはず
  // ここでは既にCTAがない場合も無理に追加しない（10回に1回方針を維持）
  const ctaStrength = evaluateCTAStrength(polishedText);
  console.log(`[PostGenerator] CTA強度: ${ctaStrength.score}/10, ${ctaStrength.feedback}`);

  // CTAが弱い場合でも、10%の確率でのみ追加（常に追加しない）
  // 既にCTAがある場合は何もしない
  // CTAがなくてもOK（10回に1回方針）

  return {
    finalText: polishedText,
    currentStep: 'complete' as WorkflowStep,
  };
}

// ========== ルーティング ==========

function routeAfterReview(state: PostGeneratorStateType): string {
  if (state.currentStep === 'polish') {
    return 'polish';
  }
  return 'revise';
}

function routeAfterRevise(state: PostGeneratorStateType): string {
  if (state.currentStep === 'polish') {
    return 'polish';
  }
  return 'draft';
}

// ========== グラフ構築 ==========

export function createPostGeneratorGraph() {
  const workflow = new StateGraph(PostGeneratorState)
    .addNode('research', researchNode)
    .addNode('draft', draftNode)
    .addNode('review', reviewNode)
    .addNode('revise', reviseNode)
    .addNode('polish', polishNode)
    .addEdge('__start__', 'research')
    .addEdge('research', 'draft')
    .addEdge('draft', 'review')
    .addConditionalEdges('review', routeAfterReview, {
      polish: 'polish',
      revise: 'revise',
    })
    .addConditionalEdges('revise', routeAfterRevise, {
      polish: 'polish',
      draft: 'draft',
    })
    .addEdge('polish', END);

  return workflow.compile();
}

// ========== 実行ヘルパー ==========

export interface GenerationProgress {
  postNumber: number;
  totalPosts: number;
  currentStep: WorkflowStep;
  score?: QualityScore;
  revisionCount: number;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

/**
 * 単一投稿を生成（Phoenix トレース付き）
 */
export async function generateSinglePost(
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  target?: string,
  benefit?: string,
  onProgress?: (step: WorkflowStep, score?: QualityScore) => void
): Promise<{
  text: string;
  target: string;
  benefit: string;
  score: QualityScore;
  revisionCount: number;
}> {
  return tracePostGeneration(
    'generate',
    { account, target, benefit },
    async () => {
      const graph = createPostGeneratorGraph();

      const initialState = {
        account,
        accountType,
        target: target || '',
        benefit: benefit || '',
      };

      // ストリーミング実行 - 状態を累積
      let accumulatedState: Partial<PostGeneratorStateType> = { ...initialState };

      for await (const event of await graph.stream(initialState)) {
        const nodeStates = Object.values(event) as Partial<PostGeneratorStateType>[];
        if (nodeStates.length > 0) {
          // 各ノードの出力を累積
          accumulatedState = { ...accumulatedState, ...nodeStates[0] };
          if (onProgress && accumulatedState.currentStep) {
            onProgress(accumulatedState.currentStep, accumulatedState.score);
          }
        }
      }

      if (!accumulatedState.currentStep) {
        throw new Error('生成に失敗しました');
      }

      const finalState = accumulatedState as PostGeneratorStateType;

      // デフォルトスコア（scoreがundefinedの場合）
      const defaultScore: QualityScore = {
        empathy: 0,
        benefit: 0,
        cta: 0,
        credibility: 0,
        urgency: 0,
        originality: 0,
        engagement: 0,
        scrollStop: 0,
        total: 0,
        strengths: [],
        weaknesses: [],
      };

      const result = {
        text: finalState.finalText || finalState.draftText || '',
        target: finalState.target || '',
        benefit: finalState.benefit || '',
        score: finalState.score || defaultScore,
        revisionCount: finalState.revisionCount || 0,
      };

      // 品質スコアをPhoenixに記録
      if (result.score) {
        recordQualityScore('quality-score', result.score);
      }

      // 低スコア（6点以下）の場合、失敗パターンとして記録
      if (result.score.total <= 6) {
        const weaknesses = result.score.weaknesses || [];
        saveBadPattern({
          text: result.text,
          score: result.score.total,
          target: result.target,
          benefit: result.benefit,
          reason: weaknesses.join(', ') || '低スコア',
          account,
        });
        console.log(`[PostGenerator] Bad pattern recorded: score=${result.score.total}`);
      }

      return result;
    }
  );
}

/**
 * 複数投稿を一括生成（メリットベース - 15投稿で全メリット網羅）
 */
export async function generateMultiplePosts(
  count: number,
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  onProgress?: ProgressCallback
): Promise<Array<{
  text: string;
  target: string;
  benefit: string;
  score: QualityScore;
  revisionCount: number;
}>> {
  const results: Array<{
    text: string;
    target: string;
    benefit: string;
    score: QualityScore;
    revisionCount: number;
  }> = [];

  // メリットをメイン軸として使用（15投稿 = 15メリット重複なし）
  const shuffledBenefits = [...BENEFITS].sort(() => Math.random() - 0.5);
  // ターゲットはサブ要素としてランダム付与
  const shuffledTargets = [...TARGETS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    // メリットは重複なしで順番に使用
    const benefit = shuffledBenefits[i % shuffledBenefits.length];
    // ターゲットはランダムに付与
    const target = shuffledTargets[Math.floor(Math.random() * shuffledTargets.length)];

    try {
      const result = await generateSinglePost(
        account,
        accountType,
        target,
        benefit,
        (step, score) => {
          if (onProgress) {
            onProgress({
              postNumber: i + 1,
              totalPosts: count,
              currentStep: step,
              score,
              revisionCount: 0,
            });
          }
        }
      );

      results.push(result);

      if (onProgress) {
        onProgress({
          postNumber: i + 1,
          totalPosts: count,
          currentStep: 'complete',
          score: result.score,
          revisionCount: result.revisionCount,
        });
      }
    } catch (error) {
      console.error(`投稿 ${i + 1} の生成に失敗:`, error);
      // 失敗しても続行
    }
  }

  return results;
}

/**
 * 複数候補を生成してベストを選択（品質向上用）
 * 3案生成して最高スコアを返す
 */
export async function generateBestPost(
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  target?: string,
  benefit?: string,
  candidateCount: number = 3
): Promise<{
  best: {
    text: string;
    target: string;
    benefit: string;
    score: QualityScore;
    revisionCount: number;
  };
  candidates: Array<{
    text: string;
    score: number;
    selected: boolean;
  }>;
  stats: {
    avgScore: number;
    maxScore: number;
    minScore: number;
    improvement: number; // ベスト選択による改善率
  };
}> {
  console.log(`[BestPost] Generating ${candidateCount} candidates...`);

  // 並列で複数候補を生成
  const promises = Array.from({ length: candidateCount }, () =>
    generateSinglePost(account, accountType, target, benefit)
      .catch(error => {
        console.error('[BestPost] Candidate generation failed:', error);
        return null;
      })
  );

  const results = await Promise.all(promises);
  const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);

  if (validResults.length === 0) {
    throw new Error('All candidates failed to generate');
  }

  // スコアで降順ソート
  const sorted = validResults.sort((a, b) => b.score.total - a.score.total);
  const best = sorted[0];

  // 統計計算
  const scores = validResults.map(r => r.score.total);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const improvement = ((maxScore - avgScore) / avgScore) * 100;

  console.log(`[BestPost] Best: ${maxScore.toFixed(1)}, Avg: ${avgScore.toFixed(1)}, Improvement: ${improvement.toFixed(1)}%`);

  return {
    best,
    candidates: sorted.map((r, i) => ({
      text: r.text,
      score: r.score.total,
      selected: i === 0,
    })),
    stats: {
      avgScore,
      maxScore,
      minScore,
      improvement,
    },
  };
}

/**
 * 品質保証付き投稿生成
 * スコアが閾値未満の場合、候補を増やして再試行
 */
export async function generateQualityAssuredPost(
  account: string,
  accountType: 'ライバー' | 'チャトレ',
  target?: string,
  benefit?: string,
  minScore: number = 8,
  maxAttempts: number = 3
): Promise<{
  text: string;
  target: string;
  benefit: string;
  score: QualityScore;
  attempts: number;
  candidatesGenerated: number;
}> {
  let attempts = 0;
  let candidatesGenerated = 0;
  let candidateCount = 3;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[QualityAssured] Attempt ${attempts}/${maxAttempts}, generating ${candidateCount} candidates`);

    try {
      const result = await generateBestPost(account, accountType, target, benefit, candidateCount);
      candidatesGenerated += candidateCount;

      if (result.best.score.total >= minScore) {
        console.log(`[QualityAssured] Success! Score: ${result.best.score.total}`);
        return {
          ...result.best,
          attempts,
          candidatesGenerated,
        };
      }

      console.log(`[QualityAssured] Score ${result.best.score.total} < ${minScore}, retrying...`);
      // 次回は候補数を増やす
      candidateCount = Math.min(candidateCount + 2, 7);
    } catch (error) {
      console.error(`[QualityAssured] Attempt ${attempts} failed:`, error);
    }
  }

  // 最後の試行でベストを返す
  console.log(`[QualityAssured] Max attempts reached, returning best available`);
  const finalResult = await generateBestPost(account, accountType, target, benefit, 5);
  candidatesGenerated += 5;

  return {
    ...finalResult.best,
    attempts: maxAttempts + 1,
    candidatesGenerated,
  };
}

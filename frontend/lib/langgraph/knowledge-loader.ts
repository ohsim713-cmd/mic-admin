/**
 * ナレッジベースローダー
 * liver_trends.json, liver_recruitment_copy.json 等から情報を取得
 */

import { promises as fs } from 'fs';
import path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

interface LiverTrends {
  industryTrends: {
    marketSize: string;
    mainPlatforms: Array<{
      name: string;
      bestFor: string;
      features: string[];
      incomeExpectation: string;
    }>;
    latestTrends: string[];
  };
  recruitmentAppealPoints: {
    forBeginners: string[];
    forIncome: string[];
    forSafety: string[];
  };
}

interface LiverRecruitmentCopy {
  objectionHandling: Array<{
    objection: string;
    response: string;
  }>;
  ctaPatterns: {
    direct: string[];
    soft: string[];
  };
  hookPatterns: string[];
}

/**
 * JSONファイルを読み込み
 */
async function loadJson<T>(filename: string): Promise<T | null> {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * テキストファイルを読み込み
 */
async function loadText(filename: string): Promise<string | null> {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * ライバー用のナレッジコンテキストを構築
 */
export async function buildLiverKnowledgeContext(): Promise<string> {
  const trends = await loadJson<LiverTrends>('liver_trends.json');
  const copy = await loadJson<LiverRecruitmentCopy>('liver_recruitment_copy.json');
  const internalData = await loadText('liver_agency_internal_data.txt');

  let context = '';

  // トレンド情報
  if (trends) {
    context += `
【ライバー業界最新トレンド】
市場: ${trends.industryTrends.marketSize}

主要プラットフォーム:
${trends.industryTrends.mainPlatforms.map(p =>
  `- ${p.name}: ${p.bestFor} / ${p.incomeExpectation}`
).join('\n')}

最新トレンド:
${trends.industryTrends.latestTrends.map(t => `- ${t}`).join('\n')}

求人訴求ポイント:
- 未経験向け: ${trends.recruitmentAppealPoints.forBeginners.join('、')}
- 収入面: ${trends.recruitmentAppealPoints.forIncome.join('、')}
- 安全面: ${trends.recruitmentAppealPoints.forSafety.join('、')}
`;
  }

  // 不安解消パターン
  if (copy) {
    context += `
【よくある不安への回答】
${copy.objectionHandling.map(o =>
  `「${o.objection}」→ ${o.response}`
).join('\n')}

【効果的なフックパターン】
${copy.hookPatterns.map(h => `- ${h}`).join('\n')}

【CTAパターン】
ソフト: ${copy.ctaPatterns.soft.join(' / ')}
`;
  }

  // 内部ノウハウ
  if (internalData) {
    // 重要な部分のみ抽出
    const lines = internalData.split('\n').filter(l => l.trim());
    const highlights = lines.slice(0, 15).join('\n');
    context += `
【事務所の強み・ノウハウ】
${highlights}
`;
  }

  return context;
}

/**
 * チャトレ用のナレッジコンテキストを構築（基本）
 */
async function buildChatladyBaseContext(): Promise<string> {
  const trends = await loadJson<any>('chatlady_trends.json');
  const internalData = await loadText('chat_lady_internal_data.txt');

  let context = '';

  if (trends?.recruitmentAppealPoints) {
    context += `
【チャトレ訴求ポイント】
- 未経験向け: ${trends.recruitmentAppealPoints.forBeginners?.slice(0, 3).join('、')}
- 収入面: ${trends.recruitmentAppealPoints.forIncome?.slice(0, 3).join('、')}
- 安全面: ${trends.recruitmentAppealPoints.forSafety?.slice(0, 3).join('、')}
`;
  }

  if (internalData) {
    const lines = internalData.split('\n').filter(l => l.trim());
    const highlights = lines.slice(0, 10).join('\n');
    context += `
【事務所の強み】
${highlights}
`;
  }

  return context;
}

/**
 * チャトレ用のランダムフックを取得
 */
async function getChatladyRandomHook(): Promise<string | null> {
  const copy = await loadJson<{ hookPatterns: string[] }>('chatlady_recruitment_copy.json');
  if (copy && copy.hookPatterns.length > 0) {
    return copy.hookPatterns[Math.floor(Math.random() * copy.hookPatterns.length)];
  }
  return null;
}

/**
 * チャトレ用のランダム成功事例を取得
 */
async function getChatladyRandomSuccessStory(): Promise<string | null> {
  const data = await loadJson<{ successStories: LiverSuccessStory[] }>('chatlady_success_stories.json');
  if (!data || data.successStories.length === 0) return null;

  const story = data.successStories[Math.floor(Math.random() * data.successStories.length)];
  return `【実例】${story.persona}が${story.platform}で${story.period}後に${story.results.thirdMonth}達成。${story.workStyle.daysPerWeek}・${story.workStyle.hoursPerDay}配信。「${story.quote}」`;
}

/**
 * チャトレ用のランダム収入シミュレーションを取得
 */
async function getChatladyRandomIncomeSimulation(): Promise<string | null> {
  const data = await loadJson<{ incomeSimulations: Record<string, IncomeSimulation[]> }>('chatlady_income_simulation.json');
  if (!data) return null;

  const categories = Object.keys(data.incomeSimulations);
  const category = categories[Math.floor(Math.random() * categories.length)];
  const simulations = data.incomeSimulations[category];
  if (!simulations || simulations.length === 0) return null;

  const sim = simulations[Math.floor(Math.random() * simulations.length)];
  const levels = ['beginner', 'intermediate', 'experienced'] as const;
  const level = levels[Math.floor(Math.random() * levels.length)];
  const income = sim.estimatedIncome[level];

  const levelNames = { beginner: '初心者', intermediate: '中級者', experienced: '経験者' };
  return `${sim.pattern}（月${sim.monthlyHours}時間）で${levelNames[level]}なら${income.average}程度。${sim.tips}`;
}

/**
 * チャトレ用のランダム年齢別戦略を取得
 */
async function getChatladyRandomAgeStrategy(): Promise<string | null> {
  const data = await loadJson<{ ageStrategies: Record<string, AgeStrategy> }>('chatlady_age_strategies.json');
  if (!data) return null;

  const ageGroups = Object.keys(data.ageStrategies);
  const ageGroup = ageGroups[Math.floor(Math.random() * ageGroups.length)];
  const strategy = data.ageStrategies[ageGroup];
  if (!strategy) return null;

  const randomStrategy = strategy.strategies[Math.floor(Math.random() * strategy.strategies.length)];
  const income = strategy.incomeExpectation;

  let result = `【${ageGroup}向け】${randomStrategy.strategy}：${randomStrategy.detail}。初月${income.初月}→3ヶ月後${income['3ヶ月後']}`;
  if (strategy.realVoice) {
    result += `「${strategy.realVoice}」`;
  }
  return result;
}

/**
 * チャトレ用の成功統計を取得
 */
async function getChatladySuccessStatistics(): Promise<string | null> {
  const data = await loadJson<{ statistics: { successRateFactors: Record<string, string> } }>('chatlady_success_stories.json');
  if (!data?.statistics?.successRateFactors) return null;

  const factors = Object.entries(data.statistics.successRateFactors);
  const factor = factors[Math.floor(Math.random() * factors.length)];
  return `【統計】${factor[1]}`;
}

/**
 * チャトレ用のリッチなナレッジコンテキストを構築
 */
export async function buildChatladyKnowledgeContext(): Promise<string> {
  const baseContext = await buildChatladyBaseContext();

  // ランダムなフック（冒頭の掴み）を取得
  const hook = await getChatladyRandomHook();

  // 追加のランダム情報を収集
  const additionalInfo: (string | null)[] = await Promise.all([
    getChatladyRandomSuccessStory(),
    getChatladyRandomIncomeSimulation(),
    getChatladyRandomAgeStrategy(),
    getChatladySuccessStatistics(),
  ]);

  // nullでないものをフィルタしてシャッフル
  const validInfo = additionalInfo.filter((info): info is string => info !== null);
  const shuffled = validInfo.sort(() => Math.random() - 0.5);

  // 2-3個をランダムに選択
  const selected = shuffled.slice(0, Math.floor(Math.random() * 2) + 2);

  let enrichedContext = baseContext;

  // フックを最初に追加
  if (hook) {
    enrichedContext += `

【今回使う冒頭フレーズ（必ずこれを冒頭に使う）】
${hook}
`;
  }

  if (selected.length > 0) {
    enrichedContext += `
【今回使う具体的な情報（これらを自然に盛り込んで）】
${selected.join('\n')}
`;
  }

  return enrichedContext;
}

/**
 * アカウントタイプに応じたナレッジを取得
 */
export async function getKnowledgeContext(accountType: 'ライバー' | 'チャトレ'): Promise<string> {
  if (accountType === 'ライバー') {
    return buildLiverKnowledgeContext();
  } else {
    return buildChatladyKnowledgeContext();
  }
}

/**
 * ランダムなフックパターンを取得
 */
export async function getRandomHook(): Promise<string | null> {
  const copy = await loadJson<LiverRecruitmentCopy>('liver_recruitment_copy.json');
  if (copy && copy.hookPatterns.length > 0) {
    return copy.hookPatterns[Math.floor(Math.random() * copy.hookPatterns.length)];
  }
  return null;
}

/**
 * 収入情報を取得
 */
export async function getIncomeInfo(): Promise<string | null> {
  const trends = await loadJson<LiverTrends>('liver_trends.json');
  if (trends) {
    const platform = trends.industryTrends.mainPlatforms[
      Math.floor(Math.random() * trends.industryTrends.mainPlatforms.length)
    ];
    return `${platform.name}では${platform.incomeExpectation}`;
  }
  return null;
}

// ========================================
// 拡張ナレッジローダー（より具体的な情報用）
// ========================================

interface SuccessStory {
  persona: string;
  site: string;
  period: string;
  results: {
    initialMonth: string;
    thirdMonth: string;
    peakMonth: string;
  };
  workStyle: {
    hoursPerDay: string;
    daysPerWeek: string;
    timeSlot: string;
  };
  keyFactors: string[];
  quote: string;
}

interface IncomeSimulation {
  pattern: string;
  weeklyHours: number;
  monthlyHours: number;
  estimatedIncome: {
    beginner: { min: string; max: string; average: string };
    intermediate: { min: string; max: string; average: string };
    experienced: { min: string; max: string; average: string };
  };
  suitableFor: string;
  tips: string;
}

interface AgeStrategy {
  advantages: string[];
  challenges: string[];
  strategies: Array<{ strategy: string; detail: string; reason: string }>;
  incomeExpectation: { 初月: string; '3ヶ月後': string; '6ヶ月後': string };
  realVoice?: string;
}

interface StreamingTip {
  tip: string;
  detail: string;
  impact: string;
}

interface LiverSuccessStory {
  persona: string;
  platform: string;
  period: string;
  results: {
    initialMonth: string;
    thirdMonth: string;
    peakMonth: string;
  };
  workStyle: {
    hoursPerDay: string;
    daysPerWeek: string;
    timeSlot: string;
  };
  keyFactors: string[];
  quote: string;
}

/**
 * ランダムなライバー成功事例を取得
 */
export async function getRandomSuccessStory(): Promise<string | null> {
  const data = await loadJson<{ successStories: LiverSuccessStory[] }>('liver_success_stories.json');
  if (!data || data.successStories.length === 0) return null;

  const story = data.successStories[Math.floor(Math.random() * data.successStories.length)];
  return `【実例】${story.persona}が${story.platform}で${story.period}後に${story.results.thirdMonth}達成。${story.workStyle.daysPerWeek}・${story.workStyle.hoursPerDay}配信。「${story.quote}」`;
}

/**
 * ランダムなライバー収入シミュレーションを取得
 */
export async function getRandomIncomeSimulation(): Promise<string | null> {
  const data = await loadJson<{ incomeSimulations: Record<string, IncomeSimulation[]> }>('liver_income_simulation.json');
  if (!data) return null;

  const categories = Object.keys(data.incomeSimulations);
  const category = categories[Math.floor(Math.random() * categories.length)];
  const simulations = data.incomeSimulations[category];
  if (!simulations || simulations.length === 0) return null;

  const sim = simulations[Math.floor(Math.random() * simulations.length)];
  const levels = ['beginner', 'intermediate', 'experienced'] as const;
  const level = levels[Math.floor(Math.random() * levels.length)];
  const income = sim.estimatedIncome[level];

  const levelNames = { beginner: '初心者', intermediate: '中級者', experienced: '経験者' };
  return `${sim.pattern}（月${sim.monthlyHours}時間）で${levelNames[level]}なら${income.average}程度。${sim.tips}`;
}

/**
 * ランダムなライバー年齢別戦略を取得
 */
export async function getRandomAgeStrategy(): Promise<string | null> {
  const data = await loadJson<{ ageStrategies: Record<string, AgeStrategy> }>('liver_age_strategies.json');
  if (!data) return null;

  const ageGroups = Object.keys(data.ageStrategies);
  const ageGroup = ageGroups[Math.floor(Math.random() * ageGroups.length)];
  const strategy = data.ageStrategies[ageGroup];
  if (!strategy) return null;

  const randomStrategy = strategy.strategies[Math.floor(Math.random() * strategy.strategies.length)];
  const income = strategy.incomeExpectation;

  let result = `【${ageGroup}向け】${randomStrategy.strategy}：${randomStrategy.detail}。初月${income.初月}→3ヶ月後${income['3ヶ月後']}`;
  if (strategy.realVoice) {
    result += `「${strategy.realVoice}」`;
  }
  return result;
}

/**
 * ランダムな配信テクニックを取得
 */
export async function getRandomStreamingTip(): Promise<string | null> {
  const data = await loadJson<{ streamingTechniques: { beginner: { firstWeek: StreamingTip[]; firstMonth: StreamingTip[] } } }>('streaming_techniques.json');
  if (!data) return null;

  const tips = [...data.streamingTechniques.beginner.firstWeek, ...data.streamingTechniques.beginner.firstMonth];
  if (tips.length === 0) return null;

  const tip = tips[Math.floor(Math.random() * tips.length)];
  return `【ノウハウ】${tip.tip}：${tip.detail}（${tip.impact}）`;
}

/**
 * ライバー成功統計を取得
 */
export async function getSuccessStatistics(): Promise<string | null> {
  const data = await loadJson<{ statistics: { successRateFactors: Record<string, string> } }>('liver_success_stories.json');
  if (!data?.statistics?.successRateFactors) return null;

  const factors = Object.entries(data.statistics.successRateFactors);
  const factor = factors[Math.floor(Math.random() * factors.length)];
  return `【統計】${factor[1]}`;
}

/**
 * ライバー収入成長パスを取得
 */
export async function getIncomeGrowthPath(): Promise<string | null> {
  const data = await loadJson<{ incomeGrowthPath: { phases: Array<{ phase: string; goal: string; income: string; focus: string[] }> } }>('liver_income_simulation.json');
  if (!data?.incomeGrowthPath?.phases) return null;

  const phase = data.incomeGrowthPath.phases[Math.floor(Math.random() * data.incomeGrowthPath.phases.length)];
  return `【成長】${phase.phase}：目標は${phase.goal}、収入${phase.income}、${phase.focus.slice(0, 2).join('・')}がポイント`;
}

/**
 * 配信ジャンル情報を取得
 */
interface StreamingGenre {
  description: string;
  target_streamer: string;
  advantages: string[];
  content_examples?: string[];
  tips?: string[];
}

interface StreamingGenresData {
  streaming_genres: Record<string, StreamingGenre>;
  age_group_success_stories: Record<string, {
    why_successful: string[];
    recommended_genres: string[];
    success_examples: string[];
    key_message: string;
  }>;
  content_ideas_by_situation: Record<string, string[]>;
  pococha_specific: {
    ranking_tips: string[];
    fan_engagement: string[];
    avoid_mistakes: string[];
  };
}

export async function getRandomStreamingGenreInfo(): Promise<string | null> {
  const data = await loadJson<StreamingGenresData>('liver_streaming_genres.json');
  if (!data) return null;

  const genres = Object.entries(data.streaming_genres);
  const [genreName, genre] = genres[Math.floor(Math.random() * genres.length)];

  const advantages = genre.advantages.slice(0, 2).join('、');
  return `【配信ジャンル】${genreName}：${genre.description}。${advantages}`;
}

export async function getAgeGroupSuccessInfo(): Promise<string | null> {
  const data = await loadJson<StreamingGenresData>('liver_streaming_genres.json');
  if (!data?.age_group_success_stories) return null;

  const ageGroups = Object.entries(data.age_group_success_stories);
  const [ageGroup, info] = ageGroups[Math.floor(Math.random() * ageGroups.length)];

  const example = info.success_examples[Math.floor(Math.random() * info.success_examples.length)];
  return `【${ageGroup.replace('_', '')}の強み】${info.key_message}。実例：${example}`;
}

export async function getContentIdea(): Promise<string | null> {
  const data = await loadJson<StreamingGenresData>('liver_streaming_genres.json');
  if (!data?.content_ideas_by_situation) return null;

  const situations = Object.entries(data.content_ideas_by_situation);
  const [situation, ideas] = situations[Math.floor(Math.random() * situations.length)];

  const selectedIdeas = ideas.slice(0, 3).join('、');
  return `【${situation}】${selectedIdeas}`;
}

export async function getPocochaSpecificTip(): Promise<string | null> {
  const data = await loadJson<StreamingGenresData>('liver_streaming_genres.json');
  if (!data?.pococha_specific) return null;

  const allTips = [
    ...data.pococha_specific.ranking_tips,
    ...data.pococha_specific.fan_engagement,
  ];

  const tip = allTips[Math.floor(Math.random() * allTips.length)];
  return `【Pocochaコツ】${tip}`;
}

/**
 * マーケットマスターから具体的な数字情報を取得
 */
interface MarketMasterData {
  platform_comparison: Record<string, {
    overview: string;
    strengths: string[];
    hourly_wage?: string;
    hourly_rate?: string;
    rank_system?: {
      stages: string;
      hourly_rates: Record<string, string>;
      bonus: string;
    };
  }>;
  income_statistics: {
    average_monthly: Record<string, string>;
    by_experience: Record<string, string>;
  };
  recruitment_talking_points: {
    hourly_wage: Record<string, string>;
    beginner_friendly: string[];
    flexibility: string[];
    support: string[];
  };
  success_tips: {
    streaming_schedule: Record<string, string>;
    fan_building: Record<string, string>;
    profile_optimization: Record<string, string>;
    mindset: Record<string, string>;
  };
}

export async function getMarketPlatformInfo(): Promise<string | null> {
  const data = await loadJson<MarketMasterData>('liver_market_master.json');
  if (!data?.platform_comparison) return null;

  const platforms = Object.entries(data.platform_comparison);
  const [name, platform] = platforms[Math.floor(Math.random() * platforms.length)];

  const strength = platform.strengths[Math.floor(Math.random() * platform.strengths.length)];
  const wage = platform.hourly_wage || platform.hourly_rate || '';

  return `【${name}】${platform.overview}。${strength}${wage ? `。${wage}` : ''}`;
}

export async function getIncomeStatistic(): Promise<string | null> {
  const data = await loadJson<MarketMasterData>('liver_market_master.json');
  if (!data?.income_statistics) return null;

  const byExp = Object.entries(data.income_statistics.by_experience);
  const [level, income] = byExp[Math.floor(Math.random() * byExp.length)];

  const levelMap: Record<string, string> = {
    casual_beginner: 'カジュアル初心者',
    daily_streamer: '毎日配信者',
    official_with_fans: '公式ライバー（ファン付き）',
    top_100: 'トップ100',
  };

  return `【収入目安】${levelMap[level] || level}：${income}`;
}

export async function getRecruitmentTalkingPoint(): Promise<string | null> {
  const data = await loadJson<MarketMasterData>('liver_market_master.json');
  if (!data?.recruitment_talking_points) return null;

  const categories = [
    data.recruitment_talking_points.beginner_friendly,
    data.recruitment_talking_points.flexibility,
    data.recruitment_talking_points.support,
  ];

  const category = categories[Math.floor(Math.random() * categories.length)];
  const point = category[Math.floor(Math.random() * category.length)];

  return `【訴求】${point}`;
}

export async function getSuccessTip(): Promise<string | null> {
  const data = await loadJson<MarketMasterData>('liver_market_master.json');
  if (!data?.success_tips) return null;

  const categories = Object.entries(data.success_tips);
  const [category, tips] = categories[Math.floor(Math.random() * categories.length)];
  const tipEntries = Object.entries(tips);
  const [key, value] = tipEntries[Math.floor(Math.random() * tipEntries.length)];

  const categoryMap: Record<string, string> = {
    streaming_schedule: '配信スケジュール',
    fan_building: 'ファン作り',
    profile_optimization: 'プロフィール',
    mindset: 'マインドセット',
  };

  return `【${categoryMap[category] || category}】${value}`;
}

/**
 * リッチなナレッジコンテキストを構築（ランダムに2-3個の追加情報を含む）
 */
export async function buildEnrichedKnowledgeContext(): Promise<string> {
  const baseContext = await buildLiverKnowledgeContext();

  // ランダムなフック（冒頭の掴み）を取得
  const hook = await getRandomHook();

  // 追加のランダム情報を収集（配信ジャンル情報 + マーケット情報を追加）
  const additionalInfo: (string | null)[] = await Promise.all([
    getRandomSuccessStory(),
    getRandomIncomeSimulation(),
    getRandomAgeStrategy(),
    getRandomStreamingTip(),
    getSuccessStatistics(),
    getIncomeGrowthPath(),
    getRandomStreamingGenreInfo(),
    getAgeGroupSuccessInfo(),
    getContentIdea(),
    getPocochaSpecificTip(),
    getMarketPlatformInfo(),
    getIncomeStatistic(),
    getRecruitmentTalkingPoint(),
    getSuccessTip(),
  ]);

  // nullでないものをフィルタしてシャッフル
  const validInfo = additionalInfo.filter((info): info is string => info !== null);
  const shuffled = validInfo.sort(() => Math.random() - 0.5);

  // 2-3個をランダムに選択
  const selected = shuffled.slice(0, Math.floor(Math.random() * 2) + 2);

  let enrichedContext = baseContext;

  // フックを最初に追加
  if (hook) {
    enrichedContext += `

【今回使う冒頭フレーズ（必ずこれを冒頭に使う）】
${hook}
`;
  }

  if (selected.length > 0) {
    enrichedContext += `
【今回使う具体的な情報（これらを自然に盛り込んで）】
${selected.join('\n')}
`;
  }

  return enrichedContext;
}

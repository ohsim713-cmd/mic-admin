import fs from 'fs';
import path from 'path';

// knowledge フォルダのパス
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

/**
 * JSONナレッジファイルを読み込む
 */
export function loadJsonKnowledge(filename: string): any {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Failed to load ${filename}:`, e);
    return null;
  }
}

/**
 * テキスト/Markdownナレッジファイルを読み込む
 */
export function loadTextKnowledge(filename: string): string | null {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error(`Failed to load ${filename}:`, e);
    return null;
  }
}

/**
 * フィードバックルールを読み込む
 */
export function loadFeedbackRules(businessType: string): any[] {
  const rules = loadJsonKnowledge('feedback_rules.json');
  if (!rules) return [];
  return rules.filter((r: any) => r.businessType === businessType || r.businessType === 'all');
}

/**
 * 良い投稿例を読み込む
 */
export function loadGoodExamples(businessType: string, limit: number = 3): any[] {
  const examples = loadJsonKnowledge('good_examples.json');
  if (!examples) return [];
  const filtered = examples.filter((e: any) => e.businessType === businessType || e.businessType === 'all');
  return filtered.slice(-limit);
}

/**
 * ランダムな投稿をピックアップ
 */
export function getRandomPost(rawText: string): string {
  if (!rawText) return "";
  const lines = rawText.split("\n");
  const processed = lines
    .map(line => {
      const parts = line.split("\t");
      let content = parts.length > 1 ? parts[1] : parts[0];
      content = content.replace(/^"|"$/g, "").trim();
      return content;
    })
    .filter(text => text.length > 30 && text.length < 280);

  if (processed.length === 0) return "";
  return processed[Math.floor(Math.random() * processed.length)];
}

/**
 * チャットレディ用のナレッジコンテキストを構築
 */
export function buildChatladyKnowledgeContext(): string {
  let context = '';

  // 事務所情報
  const agencyKnowledge = loadTextKnowledge('agency_knowledge.md');
  if (agencyKnowledge) {
    context += `\n【事務所情報（Mignon Group）】\n${agencyKnowledge.substring(0, 3000)}\n`;
  }

  // 業界トレンド
  const chatladyTrends = loadJsonKnowledge('chatlady_trends.json');
  if (chatladyTrends) {
    const industryTrends = chatladyTrends.industryTrends;

    // 収入情報
    const incomeInfo = industryTrends?.averageIncome;
    if (incomeInfo) {
      context += `\n【収入目安】\n`;
      context += `- 初心者: ${incomeInfo.beginner || '5-15万円/月'}\n`;
      context += `- 中級者: ${incomeInfo.intermediate || '20-40万円/月'}\n`;
      context += `- 上級者: ${incomeInfo.expert || '50-100万円/月'}\n`;
    }

    // ゴールデンタイム
    const goldenTime = industryTrends?.goldenTime;
    if (goldenTime) {
      context += `\n【稼ぎやすい時間帯】\n`;
      context += `- 平日: ${goldenTime.weekday || '22:00-02:00'}\n`;
      context += `- 週末: ${goldenTime.weekend || '20:00-03:00'}\n`;
    }

    // グローバル統計
    const globalStats = chatladyTrends.globalIndustryStats;
    if (globalStats) {
      context += `\n【業界統計データ】\n`;
      context += `- 世界市場規模: ${globalStats.marketSize?.value || '16億ドル'}\n`;
      context += `- 平均時給（海外）: ${globalStats.earnings?.hourlyAverage?.overall || '$58.77'}\n`;
      context += `- トップ10%年収: ${globalStats.earnings?.annualEarnings?.top10percent || '$100,000以上'}\n`;
    }

    // 求人訴求ポイント
    const appealPoints = chatladyTrends.recruitmentAppealPoints;
    if (appealPoints) {
      context += `\n【求人訴求ポイント】\n`;
      context += `- 未経験者向け: ${appealPoints.forBeginners?.slice(0, 2).join('、') || ''}\n`;
      context += `- 収入面: ${appealPoints.forIncome?.slice(0, 2).join('、') || ''}\n`;
      context += `- 安全面: ${appealPoints.forSafety?.slice(0, 2).join('、') || ''}\n`;
    }
  }

  // 成功事例
  const successStories = loadJsonKnowledge('success_stories.json');
  if (successStories?.successStories) {
    const stories = successStories.successStories.slice(0, 3);
    context += `\n【成功事例】\n`;
    stories.forEach((story: any) => {
      context += `- ${story.persona}: ${story.period}で${story.results.peakMonth}達成（${story.site}）\n`;
    });
  }

  // FAQ（よくある質問）
  const faq = loadJsonKnowledge('faq.json');
  if (faq?.quickAnswers) {
    context += `\n【よくある質問への回答】\n`;
    Object.entries(faq.quickAnswers).slice(0, 5).forEach(([key, value]) => {
      context += `- ${key}: ${value}\n`;
    });
  }

  return context;
}

/**
 * X投稿用の成長ナレッジを取得
 */
export function getXGrowthKnowledge(): any {
  const themeOptions = loadJsonKnowledge('theme_options.json');
  return themeOptions?.xGrowthKnowledge || {};
}

/**
 * ターゲットプロファイルを取得
 */
export function getTargetProfiles(): any[] {
  const themeOptions = loadJsonKnowledge('theme_options.json');
  return themeOptions?.targetProfiles || [];
}

/**
 * フックパターンを取得
 */
export function getHookPatterns(): string[] {
  const themeOptions = loadJsonKnowledge('theme_options.json');
  return themeOptions?.hookPatterns || [];
}

/**
 * テーマオプションを取得（フラット化）
 */
export function getThemeOptions(): string[] {
  const themeOptions = loadJsonKnowledge('theme_options.json');
  const themeCategories = themeOptions?.themeOptions || {};
  return Object.values(themeCategories).flat() as string[];
}

/**
 * ランダムな記事トピックを取得
 */
export function getRandomArticleTopic(): any {
  const topics = loadJsonKnowledge('article_topics.json');
  if (!topics?.categories) return null;

  const categories = Object.keys(topics.categories);
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const categoryTopics = topics.categories[randomCategory].topics;
  const randomTopic = categoryTopics[Math.floor(Math.random() * categoryTopics.length)];

  return {
    ...randomTopic,
    category: randomCategory
  };
}

/**
 * ビジネスタイプに応じた用語を取得
 */
export function getBusinessTerms(businessType: string): {
  industry: string;
  role: string;
  person: string;
  audience: string;
} {
  switch (businessType) {
    case 'liver-agency':
      return {
        industry: 'ライブ配信業界',
        role: 'ライバー事務所',
        person: 'ライバー',
        audience: 'リスナー'
      };
    case 'nail-salon':
      return {
        industry: '美容業界',
        role: 'ネイルサロン',
        person: 'ネイリスト',
        audience: 'お客様'
      };
    case 'chat-lady':
    default:
      return {
        industry: 'チャトレ業界',
        role: 'チャットレディ事務所',
        person: 'キャスト',
        audience: 'お客様'
      };
  }
}

/**
 * Tavily Agent - AI検索によるトレンド・競合分析
 *
 * 月1000クレジット無料枠を活用
 * 1検索 = 1クレジット
 */

// Tavily API Types
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;
  response_time: number;
}

interface TrendInsight {
  keyword: string;
  hooks: string[];
  benefits: string[];
  emotions: string[];
  examples: string[];
  source_urls: string[];
}

interface CompetitorPost {
  content: string;
  source: string;
  engagement_hints: string[];
  hooks: string[];
}

// Tavily API呼び出し
async function tavilySearch(
  query: string,
  options: {
    search_depth?: 'basic' | 'advanced';
    max_results?: number;
    include_answer?: boolean;
  } = {}
): Promise<TavilySearchResponse | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[Tavily] API key not configured');
    return null;
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: options.search_depth || 'basic',
        max_results: options.max_results || 10,
        include_answer: options.include_answer ?? true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily API error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('[Tavily] Search failed:', error);
    return null;
  }
}

// バズワード・トレンド検出
export async function detectTrends(industry: 'liver' | 'chatlady'): Promise<TrendInsight[]> {
  const queries = industry === 'liver'
    ? [
        'ライバー 稼げる 2025',
        'ライバー事務所 募集 バズ',
        '配信 副業 人気',
      ]
    : [
        'チャットレディ 在宅 2025',
        '高収入 副業 女性',
        'チャットレディ 安全 始め方',
      ];

  const insights: TrendInsight[] = [];

  for (const query of queries) {
    const result = await tavilySearch(query, { max_results: 5 });
    if (!result) continue;

    const insight: TrendInsight = {
      keyword: query,
      hooks: [],
      benefits: [],
      emotions: [],
      examples: [],
      source_urls: [],
    };

    // 検索結果からパターン抽出
    for (const r of result.results) {
      insight.source_urls.push(r.url);

      // フック検出（冒頭のキャッチーな表現）
      const hookPatterns = r.content.match(/^.{0,50}[。！？]/gm) || [];
      insight.hooks.push(...hookPatterns.slice(0, 3));

      // メリット検出
      const benefitPatterns = r.content.match(/月\d+万|時給\d{4}|在宅|顔出しなし|自由|サポート/g) || [];
      insight.benefits.push(...benefitPatterns);

      // 感情トリガー検出
      const emotionPatterns = r.content.match(/不安|悩み|夢|理想|自由|安心|簡単/g) || [];
      insight.emotions.push(...emotionPatterns);
    }

    // 重複除去
    insight.hooks = [...new Set(insight.hooks)].slice(0, 5);
    insight.benefits = [...new Set(insight.benefits)].slice(0, 5);
    insight.emotions = [...new Set(insight.emotions)].slice(0, 5);

    if (insight.hooks.length > 0 || insight.benefits.length > 0) {
      insights.push(insight);
    }
  }

  return insights;
}

// 競合投稿リサーチ（X以外のソースから）
export async function researchCompetitorContent(industry: 'liver' | 'chatlady'): Promise<CompetitorPost[]> {
  const query = industry === 'liver'
    ? 'ライバー事務所 募集 SNS投稿 例文'
    : 'チャットレディ 求人 SNS 投稿文';

  const result = await tavilySearch(query, {
    search_depth: 'advanced',
    max_results: 10,
  });

  if (!result) return [];

  const posts: CompetitorPost[] = [];

  for (const r of result.results) {
    // 投稿っぽいコンテンツを抽出
    const contentChunks = r.content.split(/\n\n|\n/).filter(c => {
      const len = c.length;
      return len >= 50 && len <= 300;
    });

    for (const chunk of contentChunks.slice(0, 2)) {
      posts.push({
        content: chunk,
        source: r.url,
        engagement_hints: extractEngagementHints(chunk),
        hooks: extractHooks(chunk),
      });
    }
  }

  return posts.slice(0, 10);
}

// エンゲージメントのヒント抽出
function extractEngagementHints(text: string): string[] {
  const hints: string[] = [];

  if (text.includes('？') || text.includes('?')) {
    hints.push('質問形式で反応促進');
  }
  if (/\d+万|時給\d+/.test(text)) {
    hints.push('具体的な数字で信頼性');
  }
  if (/ぶっちゃけ|正直|マジで/.test(text)) {
    hints.push('本音感で共感');
  }
  if (/DM|問い合わせ|気軽に/.test(text)) {
    hints.push('明確なCTA');
  }
  if (/未経験|初心者|ゼロから/.test(text)) {
    hints.push('ハードル下げ');
  }

  return hints;
}

// フック抽出
function extractHooks(text: string): string[] {
  const hooks: string[] = [];

  // 冒頭の強い表現
  const opening = text.slice(0, 30);
  if (/^(ぶっちゃけ|正直|実は|マジで|え、)/.test(opening)) {
    hooks.push(opening.split(/[。！？\n]/)[0]);
  }

  // 数字入りフック
  const numberHook = text.match(/月\d+万[^\n。]*|時給\d{4}[^\n。]*/);
  if (numberHook) {
    hooks.push(numberHook[0]);
  }

  return hooks;
}

// 投稿改善のための分析
export async function analyzeForImprovement(
  currentPost: string,
  industry: 'liver' | 'chatlady'
): Promise<{
  suggestions: string[];
  missingElements: string[];
  trendKeywords: string[];
}> {
  // トレンドを取得
  const trends = await detectTrends(industry);

  const suggestions: string[] = [];
  const missingElements: string[] = [];
  const trendKeywords: string[] = [];

  // トレンドからキーワード抽出
  for (const trend of trends) {
    trendKeywords.push(...trend.benefits);
    trendKeywords.push(...trend.emotions);
  }

  // 現在の投稿に足りない要素を検出
  const hasBenefit = /月\d+万|時給\d{4}|在宅/.test(currentPost);
  const hasEmotion = /不安|悩み|自由|安心/.test(currentPost);
  const hasHook = /^(ぶっちゃけ|正直|実は|マジで)/.test(currentPost);
  const hasCTA = /DM|問い合わせ|気軽/.test(currentPost);
  const hasNumber = /\d+/.test(currentPost);

  if (!hasBenefit) {
    missingElements.push('具体的な収入/メリット');
    suggestions.push('月○万、時給○円などの具体的数字を追加');
  }
  if (!hasEmotion) {
    missingElements.push('感情トリガー');
    suggestions.push('「不安」「自由」などの感情に訴える言葉を追加');
  }
  if (!hasHook) {
    missingElements.push('強いフック');
    suggestions.push('「ぶっちゃけ」「正直」など本音感のある冒頭に');
  }
  if (!hasCTA) {
    missingElements.push('行動喚起');
    suggestions.push('「気軽にDM」などCTAを追加');
  }
  if (!hasNumber) {
    missingElements.push('具体的な数字');
    suggestions.push('数字を入れて信頼性を高める');
  }

  return {
    suggestions,
    missingElements,
    trendKeywords: [...new Set(trendKeywords)].slice(0, 10),
  };
}

// メイン関数: 投稿生成用のコンテキスト取得
export async function getEnhancedContext(industry: 'liver' | 'chatlady'): Promise<{
  trends: TrendInsight[];
  competitorPosts: CompetitorPost[];
  recommendedHooks: string[];
  recommendedBenefits: string[];
}> {
  const [trends, competitorPosts] = await Promise.all([
    detectTrends(industry),
    researchCompetitorContent(industry),
  ]);

  // 推奨フック抽出
  const allHooks = [
    ...trends.flatMap(t => t.hooks),
    ...competitorPosts.flatMap(p => p.hooks),
  ];
  const recommendedHooks = [...new Set(allHooks)].slice(0, 10);

  // 推奨メリット抽出
  const allBenefits = trends.flatMap(t => t.benefits);
  const recommendedBenefits = [...new Set(allBenefits)].slice(0, 10);

  return {
    trends,
    competitorPosts,
    recommendedHooks,
    recommendedBenefits,
  };
}

export default {
  tavilySearch,
  detectTrends,
  researchCompetitorContent,
  analyzeForImprovement,
  getEnhancedContext,
};

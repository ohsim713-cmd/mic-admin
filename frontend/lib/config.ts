/**
 * AI生成関連の設定
 */
export const AI_CONFIG = {
  // 使用するGeminiモデル
  models: {
    default: 'gemini-2.0-flash',
    fast: 'gemini-2.0-flash',
    advanced: 'gemini-2.5-flash-preview-04-17',
  },

  // 生成設定
  generation: {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
  },

  // X投稿の設定
  xPost: {
    minLength: 100,
    maxLength: 280,
    hashtagLimit: 1,
  },

  // WordPress記事の設定
  wordpress: {
    defaultLength: '2000-2500',
    lengths: {
      short: '1000-1500',
      medium: '2000-2500',
      long: '3000-4000',
      veryLong: '5000-6000',
    },
  },
};

/**
 * ナレッジ関連の設定
 */
export const KNOWLEDGE_CONFIG = {
  // コンテキストに含める最大文字数
  maxContextLength: {
    agencyKnowledge: 3000,
    internalData: 1000,
    successStories: 3,
    faqItems: 5,
  },

  // 読み込むファイル
  files: {
    agencyKnowledge: 'agency_knowledge.md',
    internalData: 'internal_data.txt',
    chatladyTrends: 'chatlady_trends.json',
    recruitmentCopy: 'recruitment_copy.json',
    themeOptions: 'theme_options.json',
    successStories: 'success_stories.json',
    faq: 'faq.json',
    articleTopics: 'article_topics.json',
    feedbackRules: 'feedback_rules.json',
    goodExamples: 'good_examples.json',
  },
};

/**
 * 投稿タイプの定義
 */
export const POST_TYPES = {
  xPost: [
    { id: 'knowledge', label: 'ノウハウ・知識共有' },
    { id: 'success', label: '成功事例・実績' },
    { id: 'mindset', label: 'マインドセット' },
    { id: 'lifestyle', label: '働き方・ライフスタイル' },
    { id: 'safety', label: '安心・安全について' },
    { id: 'beginner', label: '未経験・初心者向け' },
    { id: 'income', label: '収入・報酬について' },
    { id: 'trend', label: 'トレンド・最新情報' },
  ],
  wordpress: [
    { id: 'howto', label: 'ハウツー記事' },
    { id: 'comparison', label: '比較記事' },
    { id: 'guide', label: '完全ガイド' },
    { id: 'faq', label: 'よくある質問' },
    { id: 'interview', label: 'インタビュー記事' },
    { id: 'news', label: 'ニュース・トレンド' },
  ],
};

/**
 * ビジネスタイプの定義
 */
export const BUSINESS_TYPES = {
  'chat-lady': {
    id: 'chat-lady',
    label: '配信事務所',
    description: 'チャットレディ事務所向け',
  },
  'liver-agency': {
    id: 'liver-agency',
    label: 'ライバー事務所',
    description: 'ライバー事務所向け',
  },
  'nail-salon': {
    id: 'nail-salon',
    label: 'サロン',
    description: 'ネイルサロン・美容サロン向け',
  },
};

// Brave Search API クライアント
// Docs: https://api.search.brave.com/app/documentation/web-search/get-started

const BRAVE_SEARCH_API = 'https://api.search.brave.com/res/v1/web/search';

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  thumbnail?: {
    src: string;
  };
}

interface BraveSearchResponse {
  query: {
    original: string;
  };
  web?: {
    results: BraveSearchResult[];
  };
  news?: {
    results: BraveSearchResult[];
  };
}

interface SearchOptions {
  count?: number;        // 結果数 (default: 10, max: 20)
  country?: string;      // 国コード (jp, us, etc.)
  searchLang?: string;   // 検索言語 (ja, en, etc.)
  freshness?: 'pd' | 'pw' | 'pm' | 'py';  // pd=24h, pw=week, pm=month, py=year
  safesearch?: 'off' | 'moderate' | 'strict';
}

export async function braveSearch(
  query: string,
  options: SearchOptions = {}
): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY is not set');
  }

  const params = new URLSearchParams({
    q: query,
    count: String(options.count || 10),
    country: options.country || 'jp',
    search_lang: options.searchLang || 'ja',
    safesearch: options.safesearch || 'moderate',
  });

  if (options.freshness) {
    params.append('freshness', options.freshness);
  }

  const response = await fetch(`${BRAVE_SEARCH_API}?${params}`, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
  }

  const data: BraveSearchResponse = await response.json();
  return data.web?.results || [];
}

// トレンド検索用ヘルパー
export async function searchTrends(topic: string): Promise<BraveSearchResult[]> {
  return braveSearch(`${topic} トレンド 2026`, {
    count: 10,
    freshness: 'pw', // 過去1週間
    country: 'jp',
    searchLang: 'ja',
  });
}

// 競合調査用
export async function searchCompetitors(keyword: string): Promise<BraveSearchResult[]> {
  return braveSearch(`${keyword} 求人 事務所`, {
    count: 15,
    country: 'jp',
    searchLang: 'ja',
  });
}

// ニュース検索用
export async function searchNews(topic: string): Promise<BraveSearchResult[]> {
  return braveSearch(`${topic} ニュース`, {
    count: 10,
    freshness: 'pd', // 過去24時間
    country: 'jp',
    searchLang: 'ja',
  });
}

// フォーマット済み結果を返す
export async function searchFormatted(query: string): Promise<string> {
  try {
    const results = await braveSearch(query, { count: 5 });

    if (results.length === 0) {
      return '検索結果が見つかりませんでした。';
    }

    let formatted = `🔍 **「${query}」の検索結果**\n\n`;

    for (const result of results) {
      formatted += `**${result.title}**\n`;
      formatted += `${result.description?.slice(0, 150) || ''}...\n`;
      formatted += `🔗 ${result.url}\n\n`;
    }

    return formatted;
  } catch (error: any) {
    return `検索エラー: ${error.message}`;
  }
}

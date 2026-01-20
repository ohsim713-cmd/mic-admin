/**
 * Twitter241 API Client (RapidAPI)
 * 競合アカウントのツイートを取得してお手本投稿に追加するためのクライアント
 */

const RAPIDAPI_HOST = 'twitter241.p.rapidapi.com';

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  author?: {
    username: string;
    name: string;
    followers_count: number;
  };
}

interface UserTweetsResponse {
  result: {
    timeline: {
      instructions: Array<{
        entries?: Array<{
          content?: {
            itemContent?: {
              tweet_results?: {
                result?: {
                  legacy?: {
                    id_str: string;
                    full_text: string;
                    created_at: string;
                    retweet_count: number;
                    reply_count: number;
                    favorite_count: number;
                    quote_count: number;
                  };
                };
              };
            };
          };
        }>;
      }>;
    };
  };
}

interface SearchResponse {
  result?: {
    timeline?: {
      instructions?: Array<{
        entries?: Array<{
          content?: {
            itemContent?: {
              tweet_results?: {
                result?: {
                  legacy?: {
                    id_str: string;
                    full_text: string;
                    created_at: string;
                    retweet_count: number;
                    reply_count: number;
                    favorite_count: number;
                    quote_count: number;
                  };
                  core?: {
                    user_results?: {
                      result?: {
                        legacy?: {
                          screen_name: string;
                          name: string;
                          followers_count: number;
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }>;
      }>;
    };
  };
}

export class Twitter241Client {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.RAPIDAPI_KEY || '';
    if (!this.apiKey) {
      console.warn('[Twitter241] RAPIDAPI_KEY not set');
    }
  }

  /**
   * APIが使用可能かチェック
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * ユーザーのツイートを取得
   */
  async getUserTweets(username: string, count: number = 20): Promise<Tweet[]> {
    if (!this.apiKey) {
      throw new Error('RAPIDAPI_KEY is not set');
    }

    try {
      // まずユーザーIDを取得
      const userResponse = await fetch(
        `https://${RAPIDAPI_HOST}/user?username=${encodeURIComponent(username)}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': this.apiKey,
          },
        }
      );

      if (!userResponse.ok) {
        throw new Error(`Failed to get user: ${userResponse.status}`);
      }

      const userData = await userResponse.json();
      const userId = userData.result?.data?.user?.result?.rest_id;

      if (!userId) {
        throw new Error(`User not found: ${username}`);
      }

      // ユーザーのツイートを取得
      const tweetsResponse = await fetch(
        `https://${RAPIDAPI_HOST}/user-tweets?user=${userId}&count=${count}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': this.apiKey,
          },
        }
      );

      if (!tweetsResponse.ok) {
        throw new Error(`Failed to get tweets: ${tweetsResponse.status}`);
      }

      const tweetsData: UserTweetsResponse = await tweetsResponse.json();
      return this.parseUserTweets(tweetsData, username);
    } catch (error) {
      console.error('[Twitter241] getUserTweets error:', error);
      throw error;
    }
  }

  /**
   * キーワードでツイートを検索
   */
  async searchTweets(query: string, count: number = 20): Promise<Tweet[]> {
    if (!this.apiKey) {
      throw new Error('RAPIDAPI_KEY is not set');
    }

    try {
      const response = await fetch(
        `https://${RAPIDAPI_HOST}/search?query=${encodeURIComponent(query)}&count=${count}&type=Top`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data: SearchResponse = await response.json();
      return this.parseSearchResults(data);
    } catch (error) {
      console.error('[Twitter241] searchTweets error:', error);
      throw error;
    }
  }

  /**
   * ユーザーツイートレスポンスをパース
   */
  private parseUserTweets(data: UserTweetsResponse, username: string): Tweet[] {
    const tweets: Tweet[] = [];

    const instructions = data.result?.timeline?.instructions || [];
    for (const instruction of instructions) {
      const entries = instruction.entries || [];
      for (const entry of entries) {
        const tweetResult = entry.content?.itemContent?.tweet_results?.result;
        const legacy = tweetResult?.legacy;

        if (legacy && legacy.full_text) {
          // RTは除外
          if (legacy.full_text.startsWith('RT @')) continue;

          tweets.push({
            id: legacy.id_str,
            text: legacy.full_text,
            created_at: legacy.created_at,
            public_metrics: {
              retweet_count: legacy.retweet_count || 0,
              reply_count: legacy.reply_count || 0,
              like_count: legacy.favorite_count || 0,
              quote_count: legacy.quote_count || 0,
            },
            author: {
              username,
              name: username,
              followers_count: 0,
            },
          });
        }
      }
    }

    return tweets;
  }

  /**
   * 検索結果をパース
   */
  private parseSearchResults(data: SearchResponse): Tweet[] {
    const tweets: Tweet[] = [];

    const instructions = data.result?.timeline?.instructions || [];
    for (const instruction of instructions) {
      const entries = instruction.entries || [];
      for (const entry of entries) {
        const tweetResult = entry.content?.itemContent?.tweet_results?.result;
        const legacy = tweetResult?.legacy;
        const userLegacy = tweetResult?.core?.user_results?.result?.legacy;

        if (legacy && legacy.full_text) {
          // RTは除外
          if (legacy.full_text.startsWith('RT @')) continue;

          tweets.push({
            id: legacy.id_str,
            text: legacy.full_text,
            created_at: legacy.created_at,
            public_metrics: {
              retweet_count: legacy.retweet_count || 0,
              reply_count: legacy.reply_count || 0,
              like_count: legacy.favorite_count || 0,
              quote_count: legacy.quote_count || 0,
            },
            author: userLegacy ? {
              username: userLegacy.screen_name,
              name: userLegacy.name,
              followers_count: userLegacy.followers_count || 0,
            } : undefined,
          });
        }
      }
    }

    return tweets;
  }

  /**
   * エンゲージメントスコアを計算
   */
  calculateEngagement(tweet: Tweet): number {
    const { like_count, retweet_count, reply_count, quote_count } = tweet.public_metrics;
    // 重み付け: いいね1, RT3, リプライ2, 引用RT4
    return like_count + (retweet_count * 3) + (reply_count * 2) + (quote_count * 4);
  }

  /**
   * 伸びてるツイートを取得（エンゲージメント順）
   */
  async getTopTweets(username: string, count: number = 20, minEngagement: number = 100): Promise<Tweet[]> {
    const tweets = await this.getUserTweets(username, Math.max(count * 2, 40));

    return tweets
      .map(tweet => ({ ...tweet, engagement: this.calculateEngagement(tweet) }))
      .filter(tweet => tweet.engagement >= minEngagement)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, count);
  }

  /**
   * 検索で伸びてるツイートを取得
   */
  async searchTopTweets(query: string, count: number = 20, minEngagement: number = 50): Promise<Tweet[]> {
    const tweets = await this.searchTweets(query, Math.max(count * 2, 40));

    return tweets
      .map(tweet => ({ ...tweet, engagement: this.calculateEngagement(tweet) }))
      .filter(tweet => tweet.engagement >= minEngagement)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, count);
  }
}

// シングルトンインスタンス
let clientInstance: Twitter241Client | null = null;

export function getTwitter241Client(): Twitter241Client {
  if (!clientInstance) {
    clientInstance = new Twitter241Client();
  }
  return clientInstance;
}

export default Twitter241Client;

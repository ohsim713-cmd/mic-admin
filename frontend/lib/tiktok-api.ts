/**
 * TikTok Scraper API クライアント
 *
 * API: tiktok-scraper7.p.rapidapi.com (TIKWM)
 * 用途: トレンド動画、ユーザー投稿、トレンドサウンド取得
 */

const RAPID_API_HOST = 'tiktok-scraper7.p.rapidapi.com';
const BASE_URL = `https://${RAPID_API_HOST}`;

const getApiKey = () => process.env.RAPID_API_KEY || '';

// ========== 型定義 ==========

export interface TikTokVideo {
  id: string;
  desc: string;           // キャプション
  createTime: number;     // 投稿日時（Unix timestamp）
  author: {
    uniqueId: string;     // ユーザー名
    nickname: string;     // 表示名
    avatarUrl?: string;
  };
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  };
  video: {
    playUrl?: string;     // 動画URL（ウォーターマークあり）
    downloadUrl?: string; // ダウンロードURL（ウォーターマークなし）
    coverUrl?: string;    // サムネイル
    duration: number;     // 秒数
  };
  music?: {
    id: string;
    title: string;
    author: string;
    playUrl?: string;
  };
}

export interface TikTokSound {
  id: string;
  title: string;
  author: string;
  playUrl?: string;
  coverUrl?: string;
  playCount?: number;
  videoCount?: number;
}

export interface TikTokUser {
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  bio?: string;
}

// ========== API関数 ==========

/**
 * トレンド動画を取得
 * @param region 地域コード（JP, US など）
 * @param count 取得件数
 */
export async function fetchTrendingVideos(
  region: string = 'JP',
  count: number = 20
): Promise<TikTokVideo[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[TikTok API] API key is missing');
    return [];
  }

  try {
    const response = await fetch(`${BASE_URL}/feed/list?region=${region}&count=${count}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': RAPID_API_HOST,
      },
    });

    if (!response.ok) {
      throw new Error(`TikTok API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // APIレスポンスをパース
    if (data.data?.videos) {
      return data.data.videos.map(parseVideoData);
    }

    return [];
  } catch (error) {
    console.error('[TikTok API] fetchTrendingVideos error:', error);
    return [];
  }
}

/**
 * ユーザーの動画一覧を取得
 * @param username ユーザー名（@なし）
 * @param count 取得件数
 */
export async function fetchUserVideos(
  username: string,
  count: number = 20
): Promise<TikTokVideo[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[TikTok API] API key is missing');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/user/posts?unique_id=${encodeURIComponent(username)}&count=${count}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TikTok API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data?.videos) {
      return data.data.videos.map(parseVideoData);
    }

    return [];
  } catch (error) {
    console.error('[TikTok API] fetchUserVideos error:', error);
    return [];
  }
}

/**
 * ハッシュタグで動画を検索
 * @param hashtag ハッシュタグ（#なし）
 * @param count 取得件数
 */
export async function fetchHashtagVideos(
  hashtag: string,
  count: number = 20
): Promise<TikTokVideo[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[TikTok API] API key is missing');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/challenge/posts?challenge_name=${encodeURIComponent(hashtag)}&count=${count}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TikTok API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data?.videos) {
      return data.data.videos.map(parseVideoData);
    }

    return [];
  } catch (error) {
    console.error('[TikTok API] fetchHashtagVideos error:', error);
    return [];
  }
}

/**
 * トレンドサウンドを取得
 * @param region 地域コード
 * @param count 取得件数
 */
export async function fetchTrendingSounds(
  region: string = 'JP',
  count: number = 20
): Promise<TikTokSound[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[TikTok API] API key is missing');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/music/trending?region=${region}&count=${count}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TikTok API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data?.music_list) {
      return data.data.music_list.map(parseSoundData);
    }

    return [];
  } catch (error) {
    console.error('[TikTok API] fetchTrendingSounds error:', error);
    return [];
  }
}

/**
 * 動画の詳細情報を取得
 * @param videoId 動画ID または URL
 */
export async function fetchVideoDetails(
  videoId: string
): Promise<TikTokVideo | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[TikTok API] API key is missing');
    return null;
  }

  try {
    // URLの場合はIDを抽出
    const id = extractVideoId(videoId);

    const response = await fetch(
      `${BASE_URL}/video/info?video_id=${id}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TikTok API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data) {
      return parseVideoData(data.data);
    }

    return null;
  } catch (error) {
    console.error('[TikTok API] fetchVideoDetails error:', error);
    return null;
  }
}

/**
 * ウォーターマークなしの動画URLを取得
 * @param videoUrl 動画URL
 */
export async function getDownloadUrl(
  videoUrl: string
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[TikTok API] API key is missing');
    return null;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/video/download?url=${encodeURIComponent(videoUrl)}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TikTok API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return data.data?.play || data.data?.wmplay || null;
  } catch (error) {
    console.error('[TikTok API] getDownloadUrl error:', error);
    return null;
  }
}

/**
 * ユーザー情報を取得
 * @param username ユーザー名
 */
export async function fetchUserProfile(
  username: string
): Promise<TikTokUser | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[TikTok API] API key is missing');
    return null;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/user/info?unique_id=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TikTok API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data?.user) {
      const user = data.data.user;
      const stats = data.data.stats || {};
      return {
        uniqueId: user.uniqueId || username,
        nickname: user.nickname || '',
        avatarUrl: user.avatarLarger || user.avatarMedium,
        followerCount: stats.followerCount || 0,
        followingCount: stats.followingCount || 0,
        videoCount: stats.videoCount || 0,
        bio: user.signature || '',
      };
    }

    return null;
  } catch (error) {
    console.error('[TikTok API] fetchUserProfile error:', error);
    return null;
  }
}

// ========== ヘルパー関数 ==========

/**
 * APIレスポンスをTikTokVideo型にパース
 */
function parseVideoData(item: any): TikTokVideo {
  return {
    id: item.id || item.video_id || '',
    desc: item.desc || item.title || '',
    createTime: item.createTime || item.create_time || 0,
    author: {
      uniqueId: item.author?.uniqueId || item.author?.unique_id || '',
      nickname: item.author?.nickname || '',
      avatarUrl: item.author?.avatarLarger || item.author?.avatar,
    },
    stats: {
      playCount: item.stats?.playCount || item.play_count || 0,
      likeCount: item.stats?.diggCount || item.digg_count || 0,
      commentCount: item.stats?.commentCount || item.comment_count || 0,
      shareCount: item.stats?.shareCount || item.share_count || 0,
    },
    video: {
      playUrl: item.video?.playAddr || item.play,
      downloadUrl: item.video?.downloadAddr || item.hdplay,
      coverUrl: item.video?.cover || item.cover,
      duration: item.video?.duration || item.duration || 0,
    },
    music: item.music ? {
      id: item.music.id || '',
      title: item.music.title || '',
      author: item.music.author || '',
      playUrl: item.music.playUrl || item.music.play_url,
    } : undefined,
  };
}

/**
 * APIレスポンスをTikTokSound型にパース
 */
function parseSoundData(item: any): TikTokSound {
  return {
    id: item.id || '',
    title: item.title || '',
    author: item.author || '',
    playUrl: item.playUrl || item.play_url,
    coverUrl: item.coverLarge || item.cover,
    playCount: item.stats?.playCount || 0,
    videoCount: item.stats?.videoCount || 0,
  };
}

/**
 * TikTok URLから動画IDを抽出
 */
function extractVideoId(input: string): string {
  // すでにIDの場合
  if (/^\d+$/.test(input)) {
    return input;
  }

  // URLからIDを抽出
  const patterns = [
    /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
    /vm\.tiktok\.com\/(\w+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return input;
}

/**
 * エンゲージメント率を計算
 */
export function calculateEngagementRate(video: TikTokVideo): number {
  const { playCount, likeCount, commentCount, shareCount } = video.stats;
  if (playCount === 0) return 0;

  const engagements = likeCount + commentCount + shareCount;
  return (engagements / playCount) * 100;
}

/**
 * 動画をエンゲージメント率でソート
 */
export function sortByEngagement(videos: TikTokVideo[]): TikTokVideo[] {
  return [...videos].sort((a, b) => {
    return calculateEngagementRate(b) - calculateEngagementRate(a);
  });
}

/**
 * Instagram Scraper Stable API クライアント
 *
 * API: instagram-scraper-stable-api.p.rapidapi.com (RockSolid)
 * 用途: ユーザー投稿、リール、プロフィール情報取得
 */

const RAPID_API_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';
const BASE_URL = `https://${RAPID_API_HOST}`;

const getApiKey = () => process.env.RAPID_API_KEY || '';

// ========== 型定義 ==========

export interface InstagramPost {
  id: string;
  shortcode: string;         // 投稿の短縮コード（URLに使用）
  caption: string;           // キャプション
  timestamp: number;         // 投稿日時（Unix timestamp）
  mediaType: 'image' | 'video' | 'carousel' | 'reel';
  author: {
    username: string;
    fullName: string;
    profilePicUrl?: string;
  };
  stats: {
    likeCount: number;
    commentCount: number;
    viewCount?: number;      // 動画の場合
    playCount?: number;      // リールの場合
  };
  media: {
    imageUrl?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    carouselMedia?: Array<{
      imageUrl?: string;
      videoUrl?: string;
    }>;
  };
  music?: {
    title: string;
    artist: string;
    audioUrl?: string;
  };
  location?: string;
  hashtags: string[];
}

export interface InstagramUser {
  username: string;
  fullName: string;
  bio: string;
  profilePicUrl?: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isVerified: boolean;
  isPrivate: boolean;
  externalUrl?: string;
}

export interface InstagramReel {
  id: string;
  shortcode: string;
  caption: string;
  timestamp: number;
  author: {
    username: string;
    fullName: string;
    profilePicUrl?: string;
  };
  stats: {
    likeCount: number;
    commentCount: number;
    playCount: number;
    shareCount?: number;
  };
  video: {
    url: string;
    thumbnailUrl?: string;
    duration: number;
  };
  music?: {
    title: string;
    artist: string;
    audioUrl?: string;
  };
}

export interface InstagramAudio {
  id: string;
  title: string;
  artist: string;
  audioUrl?: string;
  coverUrl?: string;
  useCount?: number;
}

// ========== API関数 ==========

/**
 * ユーザープロフィールを取得
 * @param username ユーザー名（@なし）
 */
export async function fetchUserProfile(
  username: string
): Promise<InstagramUser | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Instagram API] API key is missing');
    return null;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/user/info?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Instagram API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data) {
      return parseUserData(data.data);
    }

    return null;
  } catch (error) {
    console.error('[Instagram API] fetchUserProfile error:', error);
    return null;
  }
}

/**
 * ユーザーの投稿一覧を取得
 * @param username ユーザー名
 * @param count 取得件数
 */
export async function fetchUserPosts(
  username: string,
  count: number = 20
): Promise<InstagramPost[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Instagram API] API key is missing');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/user/posts?username=${encodeURIComponent(username)}&count=${count}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Instagram API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data?.items) {
      return data.data.items.map(parsePostData);
    }

    return [];
  } catch (error) {
    console.error('[Instagram API] fetchUserPosts error:', error);
    return [];
  }
}

/**
 * ユーザーのリール一覧を取得
 * @param username ユーザー名
 * @param count 取得件数
 */
export async function fetchUserReels(
  username: string,
  count: number = 20
): Promise<InstagramReel[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Instagram API] API key is missing');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/user/reels?username=${encodeURIComponent(username)}&count=${count}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Instagram API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data?.items) {
      return data.data.items.map(parseReelData);
    }

    return [];
  } catch (error) {
    console.error('[Instagram API] fetchUserReels error:', error);
    return [];
  }
}

/**
 * ハッシュタグで投稿を検索
 * @param hashtag ハッシュタグ（#なし）
 * @param count 取得件数
 */
export async function fetchHashtagPosts(
  hashtag: string,
  count: number = 20
): Promise<InstagramPost[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Instagram API] API key is missing');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/hashtag/posts?hashtag=${encodeURIComponent(hashtag)}&count=${count}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Instagram API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data?.items) {
      return data.data.items.map(parsePostData);
    }

    return [];
  } catch (error) {
    console.error('[Instagram API] fetchHashtagPosts error:', error);
    return [];
  }
}

/**
 * 投稿の詳細を取得
 * @param shortcode 投稿のショートコード or URL
 */
export async function fetchPostDetails(
  shortcode: string
): Promise<InstagramPost | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Instagram API] API key is missing');
    return null;
  }

  try {
    // URLからショートコードを抽出
    const code = extractShortcode(shortcode);

    const response = await fetch(
      `${BASE_URL}/media/info?shortcode=${code}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Instagram API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data) {
      return parsePostData(data.data);
    }

    return null;
  } catch (error) {
    console.error('[Instagram API] fetchPostDetails error:', error);
    return null;
  }
}

/**
 * トレンドオーディオを取得（リール用BGM）
 * 注意: このエンドポイントはAPIによって異なる場合があります
 */
export async function fetchTrendingAudio(
  count: number = 20
): Promise<InstagramAudio[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Instagram API] API key is missing');
    return [];
  }

  try {
    // トレンドリールから音楽情報を抽出する代替アプローチ
    const response = await fetch(
      `${BASE_URL}/reels/trending?count=${count}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      // エンドポイントがない場合は空配列を返す
      console.warn('[Instagram API] Trending audio endpoint may not be available');
      return [];
    }

    const data = await response.json();

    // トレンドリールから音楽情報を抽出
    if (data.data?.items) {
      const audioSet = new Map<string, InstagramAudio>();

      for (const item of data.data.items) {
        if (item.music_info || item.clips_music_attribution_info) {
          const music = item.music_info || item.clips_music_attribution_info;
          const id = music.audio_id || music.id || '';

          if (id && !audioSet.has(id)) {
            audioSet.set(id, {
              id,
              title: music.title || music.song_name || '',
              artist: music.artist_name || music.artist || '',
              audioUrl: music.audio_url,
              coverUrl: music.cover_artwork_uri || music.cover,
              useCount: music.use_count,
            });
          }
        }
      }

      return Array.from(audioSet.values());
    }

    return [];
  } catch (error) {
    console.error('[Instagram API] fetchTrendingAudio error:', error);
    return [];
  }
}

/**
 * キーワードでユーザーを検索
 * @param query 検索キーワード
 * @param count 取得件数
 */
export async function searchUsers(
  query: string,
  count: number = 10
): Promise<InstagramUser[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Instagram API] API key is missing');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/search/users?query=${encodeURIComponent(query)}&count=${count}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Instagram API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data?.users) {
      return data.data.users.map(parseUserData);
    }

    return [];
  } catch (error) {
    console.error('[Instagram API] searchUsers error:', error);
    return [];
  }
}

// ========== ヘルパー関数 ==========

/**
 * APIレスポンスをInstagramUser型にパース
 */
function parseUserData(item: any): InstagramUser {
  return {
    username: item.username || '',
    fullName: item.full_name || item.fullName || '',
    bio: item.biography || item.bio || '',
    profilePicUrl: item.profile_pic_url || item.profilePicUrl,
    followerCount: item.follower_count || item.followers || 0,
    followingCount: item.following_count || item.following || 0,
    postCount: item.media_count || item.posts || 0,
    isVerified: item.is_verified || false,
    isPrivate: item.is_private || false,
    externalUrl: item.external_url,
  };
}

/**
 * APIレスポンスをInstagramPost型にパース
 */
function parsePostData(item: any): InstagramPost {
  // メディアタイプを判定
  let mediaType: InstagramPost['mediaType'] = 'image';
  if (item.product_type === 'clips' || item.media_type === 'reel') {
    mediaType = 'reel';
  } else if (item.media_type === 2 || item.is_video) {
    mediaType = 'video';
  } else if (item.media_type === 8 || item.carousel_media) {
    mediaType = 'carousel';
  }

  // キャプションからハッシュタグを抽出
  const caption = item.caption?.text || item.caption || '';
  const hashtags = extractHashtags(caption);

  return {
    id: item.id || item.pk || '',
    shortcode: item.code || item.shortcode || '',
    caption,
    timestamp: item.taken_at || item.timestamp || 0,
    mediaType,
    author: {
      username: item.user?.username || item.owner?.username || '',
      fullName: item.user?.full_name || '',
      profilePicUrl: item.user?.profile_pic_url,
    },
    stats: {
      likeCount: item.like_count || item.likes || 0,
      commentCount: item.comment_count || item.comments || 0,
      viewCount: item.view_count || item.video_view_count,
      playCount: item.play_count,
    },
    media: {
      imageUrl: item.image_versions2?.candidates?.[0]?.url || item.display_url || item.thumbnail_url,
      videoUrl: item.video_url || item.video_versions?.[0]?.url,
      thumbnailUrl: item.thumbnail_url || item.display_url,
      carouselMedia: item.carousel_media?.map((m: any) => ({
        imageUrl: m.image_versions2?.candidates?.[0]?.url,
        videoUrl: m.video_url || m.video_versions?.[0]?.url,
      })),
    },
    music: item.music_info ? {
      title: item.music_info.title || '',
      artist: item.music_info.artist_name || '',
      audioUrl: item.music_info.audio_url,
    } : undefined,
    location: item.location?.name,
    hashtags,
  };
}

/**
 * APIレスポンスをInstagramReel型にパース
 */
function parseReelData(item: any): InstagramReel {
  const caption = item.caption?.text || item.caption || '';

  return {
    id: item.id || item.pk || '',
    shortcode: item.code || item.shortcode || '',
    caption,
    timestamp: item.taken_at || item.timestamp || 0,
    author: {
      username: item.user?.username || '',
      fullName: item.user?.full_name || '',
      profilePicUrl: item.user?.profile_pic_url,
    },
    stats: {
      likeCount: item.like_count || 0,
      commentCount: item.comment_count || 0,
      playCount: item.play_count || item.view_count || 0,
      shareCount: item.share_count,
    },
    video: {
      url: item.video_url || item.video_versions?.[0]?.url || '',
      thumbnailUrl: item.thumbnail_url || item.image_versions2?.candidates?.[0]?.url,
      duration: item.video_duration || 0,
    },
    music: item.music_info || item.clips_music_attribution_info ? {
      title: (item.music_info || item.clips_music_attribution_info)?.title || '',
      artist: (item.music_info || item.clips_music_attribution_info)?.artist_name || '',
      audioUrl: (item.music_info || item.clips_music_attribution_info)?.audio_url,
    } : undefined,
  };
}

/**
 * Instagram URLからショートコードを抽出
 */
function extractShortcode(input: string): string {
  // すでにショートコードの場合
  if (/^[\w-]{11}$/.test(input)) {
    return input;
  }

  // URLからショートコードを抽出
  const patterns = [
    /instagram\.com\/p\/([\w-]+)/,
    /instagram\.com\/reel\/([\w-]+)/,
    /instagram\.com\/tv\/([\w-]+)/,
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
 * テキストからハッシュタグを抽出
 */
function extractHashtags(text: string): string[] {
  const regex = /#([\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+)/g;
  const hashtags: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    hashtags.push(match[1]);
  }

  return hashtags;
}

/**
 * エンゲージメント率を計算
 */
export function calculateEngagementRate(post: InstagramPost, followerCount: number): number {
  if (followerCount === 0) return 0;

  const engagements = post.stats.likeCount + post.stats.commentCount;
  return (engagements / followerCount) * 100;
}

/**
 * リールのエンゲージメント率を計算
 */
export function calculateReelEngagementRate(reel: InstagramReel): number {
  if (reel.stats.playCount === 0) return 0;

  const engagements = reel.stats.likeCount + reel.stats.commentCount;
  return (engagements / reel.stats.playCount) * 100;
}

/**
 * 投稿をエンゲージメント数でソート
 */
export function sortByEngagement(posts: InstagramPost[]): InstagramPost[] {
  return [...posts].sort((a, b) => {
    const aEngagement = a.stats.likeCount + a.stats.commentCount;
    const bEngagement = b.stats.likeCount + b.stats.commentCount;
    return bEngagement - aEngagement;
  });
}

/**
 * リールをプレイ数でソート
 */
export function sortReelsByPlayCount(reels: InstagramReel[]): InstagramReel[] {
  return [...reels].sort((a, b) => b.stats.playCount - a.stats.playCount);
}

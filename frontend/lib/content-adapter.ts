/**
 * クロスプラットフォーム コンテンツ変換
 *
 * 機能:
 * - X(Twitter)投稿 → Instagram リール用に変換
 * - X(Twitter)投稿 → TikTok テキストオーバーレイ用に変換
 * - 伸びた投稿の自動検出・変換
 */

import { generateText } from 'ai';
import { getModel } from '@/lib/ai/model';
import fs from 'fs';
import path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ========== 型定義 ==========

export interface TwitterPost {
  id: string;
  text: string;
  account: string;
  impressions?: number;
  likes?: number;
  retweets?: number;
  engagementRate?: number;
  timestamp?: string;
}

export interface InstagramReelContent {
  caption: string;
  textOverlays: string[];
  imagePrompt: string;
  suggestedSound: string | null;
}

export interface TikTokOverlayContent {
  caption: string;
  textOverlays: string[];
  backgroundPrompt: string;
  suggestedSound: string | null;
}

interface AccountStyle {
  name: string;
  tone: string;
  description: string;
  keywords: string[];
}

// ========== ヘルパー関数 ==========

function loadAccountStyles(): Record<string, AccountStyle> {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'account_styles.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[Content Adapter] Error loading account styles:', error);
  }
  return {};
}

function loadTrendingSounds(): {
  tiktok: Array<{ title: string; author: string }>;
  instagram: Array<{ title: string; artist: string }>;
} {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, 'trending_sounds.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('[Content Adapter] Error loading trending sounds:', error);
  }
  return { tiktok: [], instagram: [] };
}

function selectRandomSound(sounds: Array<{ title: string; author?: string; artist?: string }>): string | null {
  if (sounds.length === 0) return null;
  const sound = sounds[Math.floor(Math.random() * sounds.length)];
  const artist = sound.author || sound.artist || '';
  return `${sound.title}${artist ? ` - ${artist}` : ''}`;
}

function getAccountType(account: string): 'liver' | 'chatre' {
  if (account.includes('liver') || account === 'liver') {
    return 'liver';
  }
  return 'chatre';
}

// ========== 変換関数 ==========

/**
 * X投稿をInstagramリール用に変換
 */
export async function adaptTwitterToInstagramReel(
  post: TwitterPost
): Promise<InstagramReelContent> {
  const styles = loadAccountStyles();
  const accountType = getAccountType(post.account);
  const style = styles[accountType];
  const sounds = loadTrendingSounds();

  const systemPrompt = `あなたはSNSコンテンツ変換の専門家です。
X(Twitter)の投稿をInstagram リール用のコンテンツに変換してください。

【元のX投稿】
"""
${post.text}
"""

【アカウントスタイル】
- トーン: ${style?.tone || '明るくポジティブ'}
- 特徴: ${style?.description || '副業に興味がある人向け'}

【タスク】
この投稿のメッセージを活かして、Instagram リール用のコンテンツに拡張してください。

【出力形式】
以下のJSON形式で出力してください：
{
  "caption": "リールのキャプション（200-300文字、改行あり、絵文字適度に使用）",
  "textOverlays": ["画面に表示するテキスト1", "テキスト2", "テキスト3", "テキスト4", "テキスト5"],
  "imagePrompt": "背景画像生成用のプロンプト（英語）"
}

【ルール】
- 元の投稿の核となるメッセージは維持
- 文字数が増えるので、より詳しい説明や具体例を追加
- ハッシュタグは含めない
- textOverlaysは5〜7個、各10〜20文字`;

  const model = getModel();
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: 'X投稿をInstagramリール用に変換してください。',
  });

  let parsed: any = {};
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Content Adapter] JSON parse error:', error);
    parsed = {
      caption: post.text + '\n\n詳しくはプロフィールのリンクから',
      textOverlays: ['チェックしてね', '詳しくはプロフィールから'],
      imagePrompt: 'bright colorful background',
    };
  }

  return {
    caption: parsed.caption || '',
    textOverlays: parsed.textOverlays || [],
    imagePrompt: parsed.imagePrompt || 'bright aesthetic background',
    suggestedSound: selectRandomSound(sounds.instagram || []),
  };
}

/**
 * X投稿をTikTokテキストオーバーレイ用に変換
 */
export async function adaptTwitterToTikTokOverlay(
  post: TwitterPost
): Promise<TikTokOverlayContent> {
  const styles = loadAccountStyles();
  const accountType = getAccountType(post.account);
  const style = styles[accountType];
  const sounds = loadTrendingSounds();

  const systemPrompt = `あなたはSNSコンテンツ変換の専門家です。
X(Twitter)の投稿をTikTok テキストオーバーレイ動画用のコンテンツに変換してください。

【元のX投稿】
"""
${post.text}
"""

【アカウントスタイル】
- トーン: ${style?.tone || '明るくポジティブ'}
- 特徴: ${style?.description || '副業に興味がある人向け'}

【タスク】
この投稿のメッセージを、TikTokのテキストオーバーレイ動画形式に変換してください。
テキストが順番に表示される動画を想定します。

【出力形式】
以下のJSON形式で出力してください：
{
  "caption": "動画の説明文（100-150文字、絵文字適度に）",
  "textOverlays": [
    "画面に表示するテキスト1（フック）",
    "テキスト2（本題）",
    "テキスト3（詳細）",
    "テキスト4（まとめ）",
    "テキスト5（CTA）"
  ],
  "backgroundPrompt": "背景画像/動画のプロンプト（英語、9:16縦長）"
}

【ルール】
- 元の投稿の核となるメッセージは維持
- TikTokは短尺なので、インパクト重視で簡潔に
- ハッシュタグは含めない
- textOverlaysは5〜7個、各15〜25文字
- 冒頭でフック、最後にCTA`;

  const model = getModel();
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: 'X投稿をTikTokテキストオーバーレイ用に変換してください。',
  });

  let parsed: any = {};
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Content Adapter] JSON parse error:', error);
    parsed = {
      caption: post.text.substring(0, 150),
      textOverlays: ['これ知ってた？', '詳しくはプロフィールから'],
      backgroundPrompt: 'aesthetic gradient background, 9:16 vertical',
    };
  }

  return {
    caption: parsed.caption || '',
    textOverlays: parsed.textOverlays || [],
    backgroundPrompt: parsed.backgroundPrompt || 'aesthetic gradient, 9:16',
    suggestedSound: selectRandomSound(sounds.tiktok || []),
  };
}

/**
 * 伸びた投稿かどうかを判定
 */
export function isHighPerformingPost(post: TwitterPost): boolean {
  // エンゲージメント率が4%以上、またはインプレッションが1000以上
  if (post.engagementRate && post.engagementRate >= 4) {
    return true;
  }
  if (post.impressions && post.impressions >= 1000) {
    return true;
  }
  // いいね数が20以上
  if (post.likes && post.likes >= 20) {
    return true;
  }
  return false;
}

/**
 * 投稿履歴から伸びた投稿を抽出
 */
export function extractHighPerformingPosts(
  posts: TwitterPost[],
  limit: number = 10
): TwitterPost[] {
  return posts
    .filter(isHighPerformingPost)
    .sort((a, b) => {
      // エンゲージメント率でソート
      const rateA = a.engagementRate || 0;
      const rateB = b.engagementRate || 0;
      return rateB - rateA;
    })
    .slice(0, limit);
}

/**
 * 投稿が既に変換済みかチェック
 */
export function isAlreadyConverted(
  postId: string,
  contentQueue: { instagram: any[]; tiktok: any[] }
): { instagram: boolean; tiktok: boolean } {
  const inInstagram = contentQueue.instagram.some(
    item => item.sourcePostId === postId
  );
  const inTiktok = contentQueue.tiktok.some(
    item => item.sourcePostId === postId
  );
  return { instagram: inInstagram, tiktok: inTiktok };
}

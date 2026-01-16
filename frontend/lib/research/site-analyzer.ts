// サイト分析ツール（Stripchat, DXLive等）

export interface PerformerProfile {
  id: string;
  platform: 'stripchat' | 'dxlive' | 'chaturbate' | 'livejasmin' | 'other';
  username: string;
  displayName: string;
  profileUrl: string;

  // 基本情報
  bio: string;
  age?: number;
  location?: string;
  languages: string[];
  tags: string[];

  // メトリクス
  metrics: {
    followers: number;
    totalViews?: number;
    rating?: number;
    lastOnline?: string;
  };

  // コンテンツ設定
  tipMenu?: { name: string; price: number }[];
  schedule?: string;

  // 分析結果
  analysis?: ProfileAnalysis;

  scrapedAt: string;
}

export interface ProfileAnalysis {
  strengths: string[];
  improvements: string[];
  keywordsUsed: string[];
  emotionalTone: 'friendly' | 'sexy' | 'mysterious' | 'playful' | 'professional';
  targetAudience: string;
  uniqueSellingPoints: string[];
}

export interface StreamAnalysis {
  performerId: string;
  streamUrl: string;
  analyzedAt: string;

  // 配信内容
  topics: string[];
  interactionStyle: string;
  engagementTechniques: string[];

  // 視聴者反応
  viewerCount: number;
  chatActivity: 'low' | 'medium' | 'high';
  tipFrequency: 'low' | 'medium' | 'high';

  // 改善ポイント
  whatWorksWell: string[];
  areasToImprove: string[];
}

// プロフィール分析プロンプト生成
export function generateProfileAnalysisPrompt(profile: PerformerProfile): string {
  return `以下のライブ配信者のプロフィールを分析してください。

## プロフィール情報
- プラットフォーム: ${profile.platform}
- 名前: ${profile.displayName}
- 自己紹介: ${profile.bio}
- タグ: ${profile.tags.join(', ')}
- フォロワー: ${profile.metrics.followers}

## 分析してほしい点
1. **強み**: このプロフィールの良い点は何か
2. **改善点**: どこを改善すればもっと良くなるか
3. **キーワード**: 使われている効果的なキーワード
4. **雰囲気**: 全体的なトーン（フレンドリー/セクシー/ミステリアス等）
5. **ターゲット層**: どんな視聴者をターゲットにしているか
6. **差別化ポイント**: 他の配信者と何が違うか

## 回答形式
JSON形式で返してください:
{
  "strengths": ["強み1", "強み2"],
  "improvements": ["改善点1", "改善点2"],
  "keywordsUsed": ["キーワード1", "キーワード2"],
  "emotionalTone": "friendly",
  "targetAudience": "ターゲット説明",
  "uniqueSellingPoints": ["USP1", "USP2"]
}`;
}

// 配信分析プロンプト生成
export function generateStreamAnalysisPrompt(context: {
  performer: string;
  platform: string;
  observations: string;
}): string {
  return `以下のライブ配信の内容を分析してください。

## 配信情報
- 配信者: ${context.performer}
- プラットフォーム: ${context.platform}

## 観察内容
${context.observations}

## 分析してほしい点
1. **話題**: どんな話題で盛り上がっているか
2. **インタラクション**: 視聴者との交流スタイル
3. **テクニック**: エンゲージメントを高める工夫
4. **うまくいっている点**: 真似したいポイント
5. **改善できそうな点**: 自分ならこうする

配信ネタとして使えるアイデアも提案してください。`;
}

// プロフィール改善提案生成
export function generateProfileImprovementPrompt(
  myProfile: {
    bio: string;
    tags: string[];
    tipMenu?: { name: string; price: number }[];
  },
  competitorProfiles: PerformerProfile[]
): string {
  const competitorSummary = competitorProfiles
    .slice(0, 5)
    .map(p => `- ${p.displayName}: ${p.bio.slice(0, 100)}...`)
    .join('\n');

  return `私のプロフィールを改善するアドバイスをください。

## 私の現在のプロフィール
自己紹介: ${myProfile.bio || '(未設定)'}
タグ: ${myProfile.tags.join(', ') || '(未設定)'}
チップメニュー: ${myProfile.tipMenu?.map(t => `${t.name}: ${t.price}tk`).join(', ') || '(未設定)'}

## 参考: 人気配信者のプロフィール
${competitorSummary}

## 教えてほしいこと
1. **自己紹介文の改善案**: 具体的な文章で提案
2. **効果的なタグ**: 追加すべきタグ
3. **チップメニューの最適化**: 価格設定とアイテム
4. **差別化のアイデア**: 私だけの特徴をどう打ち出すか

実際に使える文章・設定を具体的に提案してください。`;
}

// 配信ネタ提案
export interface StreamIdea {
  title: string;
  description: string;
  duration: string;
  props?: string[];
  talkingPoints: string[];
  interactionIdeas: string[];
  tipGoalSuggestion?: number;
}

export function generateStreamIdeasPrompt(context: {
  performerStyle: string;
  recentTopics?: string[];
  upcomingEvents?: string[];
  season?: string;
}): string {
  return `配信のネタ・企画を提案してください。

## 私のスタイル
${context.performerStyle}

## 最近やった配信
${context.recentTopics?.join(', ') || '特になし'}

## 今後のイベント・季節
${context.upcomingEvents?.join(', ') || '特になし'}
季節: ${context.season || new Date().toLocaleDateString('ja-JP', { month: 'long' })}

## 提案してほしいこと
1. **すぐできる配信ネタ** (5個)
2. **イベント企画** (3個)
3. **季節に合わせた特別配信** (2個)
4. **視聴者参加型企画** (3個)

それぞれ以下の形式で:
- タイトル
- 概要
- 必要な準備
- 話すこと・やること
- チップゴール案`;
}

// イベントカレンダー
export interface UpcomingEvent {
  date: string;
  name: string;
  type: 'holiday' | 'platform' | 'personal' | 'trend';
  suggestions: string[];
}

export function getUpcomingEvents(): UpcomingEvent[] {
  const now = new Date();
  const events: UpcomingEvent[] = [];

  // 日本の祝日・イベント
  const jpEvents = [
    { month: 1, day: 1, name: '元旦', suggestions: ['新年配信', '初詣トーク', '今年の目標'] },
    { month: 1, day: 14, name: 'バレンタイン2週間前', suggestions: ['チョコ作り配信', 'バレンタイン企画予告'] },
    { month: 2, day: 14, name: 'バレンタインデー', suggestions: ['バレンタイン特別配信', 'チョコレート企画'] },
    { month: 3, day: 14, name: 'ホワイトデー', suggestions: ['お返し企画', '感謝配信'] },
    { month: 4, day: 1, name: 'エイプリルフール', suggestions: ['ドッキリ企画', '仮装配信'] },
    { month: 5, day: 5, name: 'こどもの日', suggestions: ['コスプレ配信', 'ゲーム配信'] },
    { month: 7, day: 7, name: '七夕', suggestions: ['願い事企画', '浴衣配信'] },
    { month: 10, day: 31, name: 'ハロウィン', suggestions: ['仮装配信', 'ホラー企画'] },
    { month: 12, day: 24, name: 'クリスマスイブ', suggestions: ['クリスマス特別配信', 'プレゼント企画'] },
    { month: 12, day: 31, name: '大晦日', suggestions: ['年越し配信', '1年振り返り'] },
  ];

  jpEvents.forEach(event => {
    const eventDate = new Date(now.getFullYear(), event.month - 1, event.day);
    if (eventDate < now) {
      eventDate.setFullYear(eventDate.getFullYear() + 1);
    }
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil <= 30) {
      events.push({
        date: eventDate.toISOString().split('T')[0],
        name: event.name,
        type: 'holiday',
        suggestions: event.suggestions,
      });
    }
  });

  // 毎月のイベント
  const monthlyEvents = [
    { day: 1, name: '月初め', suggestions: ['月間目標発表', '先月振り返り'] },
    { day: 15, name: '月の半ば', suggestions: ['中間報告', 'ファン感謝'] },
    { day: 25, name: '給料日付近', suggestions: ['特別配信', 'ゴール高め設定'] },
  ];

  monthlyEvents.forEach(event => {
    const eventDate = new Date(now.getFullYear(), now.getMonth(), event.day);
    if (eventDate < now) {
      eventDate.setMonth(eventDate.getMonth() + 1);
    }
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil <= 7) {
      events.push({
        date: eventDate.toISOString().split('T')[0],
        name: event.name,
        type: 'personal',
        suggestions: event.suggestions,
      });
    }
  });

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

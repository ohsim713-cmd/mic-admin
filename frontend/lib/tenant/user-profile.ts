// 個人ユーザープロフィール（チャットレディ/ライバー個人向け）

export interface UserProfile {
  id: string;
  // 基本情報
  displayName: string;
  avatarUrl?: string;
  bio?: string;

  // 活動プラットフォーム
  platforms: Platform[];

  // パーソナル設定
  personality: PersonalityConfig;

  // AIエージェント設定
  agentConfig: AgentConfig;

  // 目標設定
  goals: GoalConfig;

  // ナレッジ（個人のノウハウ）
  knowledgeIds: string[];

  createdAt: string;
  updatedAt: string;
}

export interface Platform {
  type: 'stripchat' | 'chaturbate' | 'livejasmin' | 'twitter' | 'instagram' | 'tiktok' | 'other';
  username: string;
  profileUrl?: string;
  isMain: boolean; // メインプラットフォームかどうか
  credentials?: {
    // 暗号化された認証情報
    accessToken?: string;
    apiKey?: string;
  };
}

export interface PersonalityConfig {
  // キャラクター設定
  characterType: 'cute' | 'sexy' | 'cool' | 'natural' | 'custom';
  customTraits?: string[];

  // コミュニケーションスタイル
  toneOfVoice: 'casual' | 'polite' | 'playful' | 'professional';

  // 自己紹介テンプレート
  introTemplate?: string;

  // 禁止ワード・NG設定
  blockedWords: string[];
  blockedTopics: string[];
}

export interface AgentConfig {
  // AIの自律度
  autonomyLevel: 'low' | 'medium' | 'high';

  // 自動返信設定
  autoReply: {
    enabled: boolean;
    responseDelay: number; // 秒
    templates: string[];
  };

  // SNS自動投稿設定
  autoPost: {
    enabled: boolean;
    platforms: string[];
    frequency: 'low' | 'medium' | 'high'; // 日1-3回 / 日3-5回 / 日5-10回
    preferredTimes: string[]; // "09:00", "21:00" など
  };

  // コンテンツ生成設定
  contentGeneration: {
    style: string;
    hashtags: string[];
    callToActions: string[];
  };
}

export interface GoalConfig {
  // 月間目標
  monthlyTarget: {
    earnings?: number;      // 目標収入
    followers?: number;     // 目標フォロワー増
    streamHours?: number;   // 配信時間
    posts?: number;         // 投稿数
  };

  // 現在の進捗
  currentProgress: {
    earnings: number;
    followers: number;
    streamHours: number;
    posts: number;
  };
}

// デフォルトプロファイル
export const DEFAULT_USER_PROFILE: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  displayName: '',
  platforms: [],
  personality: {
    characterType: 'natural',
    toneOfVoice: 'casual',
    blockedWords: [],
    blockedTopics: [],
  },
  agentConfig: {
    autonomyLevel: 'medium',
    autoReply: {
      enabled: false,
      responseDelay: 30,
      templates: [],
    },
    autoPost: {
      enabled: false,
      platforms: [],
      frequency: 'medium',
      preferredTimes: ['12:00', '20:00'],
    },
    contentGeneration: {
      style: '',
      hashtags: [],
      callToActions: [],
    },
  },
  goals: {
    monthlyTarget: {},
    currentProgress: {
      earnings: 0,
      followers: 0,
      streamHours: 0,
      posts: 0,
    },
  },
  knowledgeIds: [],
};

// Stripchat専用設定
export interface StripchatUserConfig extends UserProfile {
  stripchatSpecific: {
    roomSettings: {
      tipMenuEnabled: boolean;
      tipMenuItems: { name: string; price: number }[];
      goalAmount?: number;
      goalDescription?: string;
    };
    fanClub: {
      enabled: boolean;
      price?: number;
      benefits: string[];
    };
    schedule: {
      regularHours: { day: string; startTime: string; endTime: string }[];
      timezone: string;
    };
  };
}

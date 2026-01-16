// マルチテナント型定義

export interface Tenant {
  id: string;
  name: string;
  slug: string; // URL用スラッグ
  industry: 'stripchat' | 'chatlady' | 'liver' | 'custom';
  theme: ThemeConfig;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'operator';
  avatarUrl?: string;
  createdAt: string;
}

export interface ThemeConfig {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;    // メインカラー（例: #8b5cf6）
  secondaryColor: string;  // セカンダリカラー（例: #ec4899）
  accentColor: string;     // アクセントカラー
  backgroundColor: string; // 背景色
  textColor: string;       // テキスト色
}

// 業界別プリセットテーマ
export const INDUSTRY_THEMES: Record<Tenant['industry'], ThemeConfig> = {
  stripchat: {
    brandName: 'Stripchat Manager',
    primaryColor: '#e91e63',
    secondaryColor: '#ff5722',
    accentColor: '#f44336',
    backgroundColor: '#0a0a0a',
    textColor: '#ffffff',
  },
  chatlady: {
    brandName: 'Chat Manager',
    primaryColor: '#ec4899',
    secondaryColor: '#8b5cf6',
    accentColor: '#f472b6',
    backgroundColor: '#0a0a0a',
    textColor: '#ffffff',
  },
  liver: {
    brandName: 'Liver Manager',
    primaryColor: '#8b5cf6',
    secondaryColor: '#6366f1',
    accentColor: '#a78bfa',
    backgroundColor: '#0a0a0a',
    textColor: '#ffffff',
  },
  custom: {
    brandName: 'AI Manager',
    primaryColor: '#3b82f6',
    secondaryColor: '#10b981',
    accentColor: '#06b6d4',
    backgroundColor: '#0a0a0a',
    textColor: '#ffffff',
  },
};

// Stripchatモデル管理用
export interface StripchatModel {
  id: string;
  tenantId: string;
  name: string;
  displayName: string;
  profileUrl: string;
  status: 'active' | 'inactive' | 'vacation';
  // パフォーマンス指標
  metrics: {
    totalEarnings: number;
    monthlyEarnings: number;
    avgViewers: number;
    totalHours: number;
    conversionRate: number; // 視聴者→投げ銭率
  };
  // スケジュール
  schedule: {
    preferredHours: string[];
    timezone: string;
  };
  // SNSアカウント
  socialAccounts: {
    twitter?: string;
    instagram?: string;
    tiktok?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// セッション情報
export interface TenantSession {
  user: User;
  tenant: Tenant;
  theme: ThemeConfig;
}

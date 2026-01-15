/**
 * Supabase クライアント（遅延初期化）
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    }

    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// 後方互換性のためのエクスポート（使用箇所で getSupabase() に移行推奨）
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  }
});

// 型定義
export interface ScheduleRecord {
  id: string;
  account: string;
  scheduled_time: string;
  slot: string;
  status: 'pending' | 'ready' | 'posted' | 'failed' | 'skipped';
  stock_id?: string;
  text?: string;
  target?: string;
  benefit?: string;
  score?: number;
  posted_at?: string;
  tweet_id?: string;
  impressions?: number;
  engagements?: number;
  error?: string;
  date: string;
  created_at?: string;
}

export interface SuccessPattern {
  id?: number;
  text: string;
  target?: string;
  benefit?: string;
  score?: number;
  impressions?: number;
  engagement_rate?: number;
  account?: string;
  created_at?: string;
}

export interface PostStock {
  id: string;
  account: string;
  text: string;
  target?: string;
  benefit?: string;
  score?: number;
  status: 'available' | 'used' | 'expired';
  used_at?: string;
  created_at?: string;
}

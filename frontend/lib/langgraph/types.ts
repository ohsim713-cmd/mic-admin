// LangGraph 投稿フロー用の型定義
import { z } from 'zod';

// 投稿の品質評価スキーマ
export const QualityScoreSchema = z.object({
  overall: z.number().min(1).max(10).describe('総合スコア (1-10)'),
  hook: z.number().min(1).max(10).describe('フック（書き出し）の強さ'),
  clarity: z.number().min(1).max(10).describe('わかりやすさ'),
  cta: z.number().min(1).max(10).describe('CTA（行動喚起）の効果'),
  authenticity: z.number().min(1).max(10).describe('リアルさ・信頼性'),
  issues: z.array(z.string()).describe('改善が必要な点'),
  suggestions: z.array(z.string()).describe('改善案'),
});

export type QualityScore = z.infer<typeof QualityScoreSchema>;

// 投稿の状態
export interface PostState {
  // 入力
  postType: string;
  slot: number;
  targetAudience: string;
  account?: string; // 投稿先アカウント（liver, chatre1, chatre2）

  // 生成結果
  generatedPost: string;
  revisedPost?: string;

  // 品質評価
  qualityScore?: QualityScore;
  passedQualityCheck: boolean;

  // 改善ループ
  revisionCount: number;
  maxRevisions: number;

  // 投稿結果
  posted: boolean;
  tweetId?: string;
  error?: string;

  // メタ情報
  startTime: number;
  logs: string[];
}

// ノードの戻り値
export type NodeOutput = Partial<PostState>;

// 投稿タイプの定義
export const POST_TYPES = [
  'おはよう', 'ノウハウ', 'Q&A', '体験談', '共感',
  '軽い話題', '実績', '不安解消', 'メリット', '求人',
  '成功事例', '本音', 'クロージング', '夜向け'
] as const;

export type PostType = typeof POST_TYPES[number];

// 品質チェックの閾値
export const QUALITY_THRESHOLD = {
  minimum: 6,      // 最低スコア（これ以下は再生成）
  good: 7,         // 良好スコア
  excellent: 8,    // 優秀スコア
};

/**
 * LangGraph 状態定義
 * 投稿生成ワークフローの状態管理
 */

import { Annotation } from '@langchain/langgraph';

// ターゲット層（サブ要素として使用）
export const TARGETS = [
  '完全未経験',
  '副業希望',
  '主婦・ママ',
  '学生',
  '転職検討中',
  'フリーター',
  '在宅ワーク希望',
] as const;

// メリット（メイン軸として使用 - 1日15投稿で重複なし）
export const BENEFITS = [
  // 収入系
  '月30万以上可能',
  '初月から稼げる',
  '時給換算1万円超え',
  '日払い対応',
  'ボーナス制度あり',
  // 働き方系
  'スマホ1台でOK',
  '完全在宅',
  'ノルマなし',
  '好きな時間に働ける',
  'シフト自由',
  // サポート系
  'サポート充実',
  '未経験でも安心',
  '顔出しなしOK',
  '機材無料貸出',
  'マンツーマン指導',
] as const;

// 品質スコアの詳細
export interface QualityScore {
  empathy: number;      // 共感 (0-3)
  benefit: number;      // メリット (0-2)
  cta: number;          // CTA (0-2)
  credibility: number;  // 信頼性 (0-2)
  urgency: number;      // 緊急性 (0-1)
  total: number;        // 合計 (0-10)
}

// 生成された投稿
export interface GeneratedPost {
  id: string;
  text: string;
  target: string;
  benefit: string;
  score: QualityScore;
  account: string;
  createdAt: string;
  status: 'draft' | 'pending' | 'approved' | 'posted';
  revisionCount: number;
  feedback?: string;
}

// ワークフローのステップ
export type WorkflowStep =
  | 'research'
  | 'draft'
  | 'review'
  | 'revise'
  | 'polish'
  | 'complete';

// LangGraph状態定義
export const PostGeneratorState = Annotation.Root({
  // 入力
  account: Annotation<string>({
    reducer: (_, y) => y,
    default: () => 'liver',
  }),
  accountType: Annotation<'ライバー' | 'チャトレ'>({
    reducer: (_, y) => y,
    default: () => 'ライバー',
  }),

  // 生成パラメータ
  target: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  benefit: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),

  // 生成結果
  draftText: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  finalText: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),

  // 品質スコア
  score: Annotation<QualityScore>({
    reducer: (_, y) => y,
    default: () => ({
      empathy: 0,
      benefit: 0,
      cta: 0,
      credibility: 0,
      urgency: 0,
      total: 0,
    }),
  }),

  // レビューフィードバック
  feedback: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),

  // リビジョン回数
  revisionCount: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),

  // 現在のステップ
  currentStep: Annotation<WorkflowStep>({
    reducer: (_, y) => y,
    default: () => 'research',
  }),

  // 成功パターン（学習データから）
  successPatterns: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),

  // エラー
  error: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
});

export type PostGeneratorStateType = typeof PostGeneratorState.State;

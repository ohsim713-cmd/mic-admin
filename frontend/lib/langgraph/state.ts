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

// メリット（メイン軸として使用 - 多様なテーマで投稿）
export const BENEFITS = [
  // 収入系
  '月30万以上可能',
  '初月から稼げる',
  '時給換算高い',
  '日払い対応',
  // 働き方系
  'スマホ1台でOK',
  '完全在宅',
  '好きな時間に働ける',
  '人間関係ストレスなし',
  // サポート系
  'サポート充実',
  '未経験でも安心',
  '顔出しなしOK',
  '機材無料貸出',
  // ライフスタイル系
  '子育てと両立',
  '本業との両立',
  '自分のペースで',
  // 成長・やりがい系
  'ファンができる喜び',
  'コミュニケーション力UP',
  '自己表現の場',
  // 不安解消系
  '身バレ対策万全',
  '初めてでも大丈夫',
  '辞めたい時に辞められる',
  // 具体的シーン系
  '子供が寝た後に',
  '通勤時間ゼロ',
  'パート代わりに',
] as const;

// 品質スコアの詳細（15点満点に拡張）
export interface QualityScore {
  // 既存項目（10点）
  empathy: number;      // 共感・本音感 (0-3)
  benefit: number;      // メリット提示 (0-2)
  cta: number;          // 行動喚起 (0-2)
  credibility: number;  // 信頼性 (0-2)
  urgency: number;      // 緊急性 (0-1)

  // 新規項目（5点）- LLM as a Judge 強化
  originality: number;  // 独自性・差別化 (0-2)
  engagement: number;   // エンゲージメント予測 (0-2)
  scrollStop: number;   // スクロール停止力 (0-1)

  // 合計
  total: number;        // 合計 (0-15)

  // 詳細フィードバック
  strengths?: string[];   // 良い点（最大3つ）
  weaknesses?: string[];  // 改善点（最大3つ）
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

  // 品質スコア（15点満点）
  score: Annotation<QualityScore>({
    reducer: (_, y) => y,
    default: () => ({
      empathy: 0,
      benefit: 0,
      cta: 0,
      credibility: 0,
      urgency: 0,
      originality: 0,
      engagement: 0,
      scrollStop: 0,
      total: 0,
      strengths: [],
      weaknesses: [],
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

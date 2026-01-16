/**
 * 目標管理 API
 *
 * GET: 目標一覧・進捗サマリーを取得
 * POST: 目標を設定 / 進捗を更新 / 戦略を生成
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  setGoal,
  updateProgress,
  incrementProgress,
  getGoalsSummary,
  getActiveGoals,
  generateGoalDrivenStrategy,
  getStrategyAdjustments,
  parseGoalFromText,
  Goal,
} from '@/lib/agent/goal-engine';

export const maxDuration = 120;

export async function GET() {
  try {
    const summary = getGoalsSummary();
    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, type, target, period, value, increment, text } = body;

    // 自然言語から目標を設定
    if (action === 'parse_and_set' && text) {
      const parsed = parseGoalFromText(text);
      if (!parsed) {
        return NextResponse.json({
          success: false,
          error: '目標を解析できませんでした。例: "今月30件DM"',
        });
      }
      const goal = setGoal(parsed.type, parsed.target, parsed.period);
      return NextResponse.json({
        success: true,
        goal,
        message: `目標を設定しました: ${parsed.period === 'daily' ? '今日' : parsed.period === 'weekly' ? '今週' : '今月'}${parsed.target}件の${getGoalTypeLabel(parsed.type)}`,
      });
    }

    // 目標を設定
    if (action === 'set' && type && target) {
      const goal = setGoal(type, target, period || 'monthly');
      return NextResponse.json({
        success: true,
        goal,
      });
    }

    // 進捗を更新
    if (action === 'update' && type && value !== undefined) {
      const goal = updateProgress(type, value);
      if (!goal) {
        return NextResponse.json({
          success: false,
          error: `${type}の目標が見つかりません`,
        });
      }
      return NextResponse.json({
        success: true,
        goal,
      });
    }

    // 進捗をインクリメント
    if (action === 'increment' && type) {
      const goal = incrementProgress(type, increment || 1);
      if (!goal) {
        return NextResponse.json({
          success: false,
          error: `${type}の目標が見つかりません`,
        });
      }
      return NextResponse.json({
        success: true,
        goal,
      });
    }

    // 戦略を生成
    if (action === 'strategy') {
      const strategy = await generateGoalDrivenStrategy();
      return NextResponse.json({
        success: true,
        strategy,
      });
    }

    // 戦略調整を取得
    if (action === 'adjustments') {
      const adjustments = await getStrategyAdjustments();
      return NextResponse.json({
        success: true,
        adjustments,
      });
    }

    return NextResponse.json(
      { error: 'action が必要です (set, update, increment, strategy, adjustments, parse_and_set)' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Goals API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function getGoalTypeLabel(type: Goal['type']): string {
  const labels: Record<Goal['type'], string> = {
    dm: 'DM問い合わせ',
    impression: 'インプレッション',
    engagement: 'エンゲージメント',
    follower: 'フォロワー',
    post: '投稿数',
  };
  return labels[type] || type;
}

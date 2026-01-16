/**
 * SNS Agent Chat API
 * Gemini API + Function Calling でSNSマーケティングエージェントと対話
 */

import { NextRequest, NextResponse } from 'next/server';
import { chat, generateDailyReport, runAutoAnalysis, AgentMessage } from '@/lib/agent/sns-agent';

// チャット履歴をメモリに保持（本番ではDBに保存すべき）
let chatHistory: AgentMessage[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { message, action } = body;

    // 特殊アクション
    if (action === 'daily_report') {
      console.log('[Agent Chat] Generating daily report...');
      const report = await generateDailyReport();
      return NextResponse.json({
        success: true,
        response: report,
        type: 'report',
      });
    }

    if (action === 'auto_analysis') {
      console.log('[Agent Chat] Running auto analysis...');
      const analysis = await runAutoAnalysis();
      return NextResponse.json({
        success: true,
        response: analysis,
        type: 'analysis',
      });
    }

    if (action === 'clear_history') {
      chatHistory = [];
      return NextResponse.json({
        success: true,
        message: '履歴をクリアしました',
      });
    }

    // 通常のチャット
    if (!message) {
      return NextResponse.json(
        { error: 'message が必要です' },
        { status: 400 }
      );
    }

    console.log('[Agent Chat] Processing message:', message.slice(0, 50));
    const result = await chat(message, chatHistory);
    chatHistory = result.history;

    console.log('[Agent Chat] Response generated, tools used:', result.toolsUsed);

    return NextResponse.json({
      success: true,
      response: result.response,
      toolsUsed: result.toolsUsed,
      historyLength: chatHistory.length,
    });
  } catch (error: any) {
    console.error('[Agent Chat] Error:', error);
    console.error('[Agent Chat] Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'チャットに失敗しました',
        details: error.message,
        hint: 'GEMINI_API_KEYが正しく設定されているか確認してください'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    history: chatHistory.slice(-20), // 最新20件
    historyLength: chatHistory.length,
  });
}

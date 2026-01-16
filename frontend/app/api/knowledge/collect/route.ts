/**
 * ナレッジ収集API
 * Gemini + Google検索でナレッジベースを自動収集
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runKnowledgeCollection,
  collectLiverKnowledge,
  collectChatladyKnowledge,
  saveKnowledgeToFile,
  convertToPostKnowledge,
} from '@/lib/knowledge/google-search-collector';

export const maxDuration = 300; // 5分

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category = 'both', customTopics } = body;

    console.log(`[Knowledge API] Starting collection for: ${category}`);

    let results;

    if (customTopics && Array.isArray(customTopics)) {
      // カスタムトピックで検索
      if (category === 'liver') {
        const liverResults = await collectLiverKnowledge(customTopics);
        const savedPath = await saveKnowledgeToFile(liverResults, 'liver');
        results = { liver: { results: liverResults, savedPath } };
      } else if (category === 'chatlady') {
        const chatladyResults = await collectChatladyKnowledge(customTopics);
        const savedPath = await saveKnowledgeToFile(chatladyResults, 'chatlady');
        results = { chatlady: { results: chatladyResults, savedPath } };
      } else {
        const liverResults = await collectLiverKnowledge(customTopics);
        const liverPath = await saveKnowledgeToFile(liverResults, 'liver');
        const chatladyResults = await collectChatladyKnowledge(customTopics);
        const chatladyPath = await saveKnowledgeToFile(chatladyResults, 'chatlady');
        results = {
          liver: { results: liverResults, savedPath: liverPath },
          chatlady: { results: chatladyResults, savedPath: chatladyPath },
        };
      }
    } else {
      // デフォルトトピックで収集
      results = await runKnowledgeCollection(category);
    }

    // 投稿生成用のナレッジに変換
    const postKnowledge: Record<string, ReturnType<typeof convertToPostKnowledge>> = {};
    if (results.liver) {
      postKnowledge.liver = convertToPostKnowledge(results.liver.results);
    }
    if (results.chatlady) {
      postKnowledge.chatlady = convertToPostKnowledge(results.chatlady.results);
    }

    // 統計情報
    const stats = {
      liver: results.liver
        ? {
            topicsCollected: results.liver.results.length,
            totalInsights: results.liver.results.reduce(
              (sum, r) => sum + r.insights.length,
              0
            ),
            totalStatistics: results.liver.results.reduce(
              (sum, r) => sum + r.statistics.length,
              0
            ),
            savedPath: results.liver.savedPath,
          }
        : null,
      chatlady: results.chatlady
        ? {
            topicsCollected: results.chatlady.results.length,
            totalInsights: results.chatlady.results.reduce(
              (sum, r) => sum + r.insights.length,
              0
            ),
            totalStatistics: results.chatlady.results.reduce(
              (sum, r) => sum + r.statistics.length,
              0
            ),
            savedPath: results.chatlady.savedPath,
          }
        : null,
    };

    return NextResponse.json({
      success: true,
      message: 'ナレッジ収集完了',
      stats,
      postKnowledge,
    });
  } catch (error: any) {
    console.error('[Knowledge API] Error:', error);
    return NextResponse.json(
      { error: 'ナレッジ収集に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Knowledge Collector',
    description: 'Gemini + Google検索でナレッジベースを自動収集',
    usage: {
      method: 'POST',
      body: {
        category: '"liver" | "chatlady" | "both"（デフォルト: both）',
        customTopics:
          '検索トピックの配列（オプション）例: ["ライバー 稼ぎ方", "配信 コツ"]',
      },
    },
    defaultTopics: {
      liver: [
        'ライブ配信 始め方 2024 収入',
        'Pococha ライバー 稼ぎ方 コツ',
        '17LIVE 新人ライバー 月収',
      ],
      chatlady: [
        'チャットレディ 在宅 始め方 2024',
        'チャットレディ 稼げる時間帯',
        '主婦 副業 在宅 高収入 体験談',
      ],
    },
  });
}

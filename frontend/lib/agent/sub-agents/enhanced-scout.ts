/**
 * Enhanced Scout Agent - 強化版スカウトエージェント
 *
 * Tavily + Feedback + 既存知識を統合して
 * 「今刺さる」素材を収集・優先順位付け
 */

import tavilyAgent from './tavily-agent';
import feedbackAgent from './feedback-agent';

// Types
interface ScoutedMaterial {
  type: 'hook' | 'benefit' | 'emotion' | 'example';
  content: string;
  source: 'tavily' | 'feedback' | 'knowledge' | 'trend';
  score: number; // 0-10: 推奨度
  reason: string;
}

interface ScoutReport {
  industry: 'liver' | 'chatlady';
  timestamp: string;
  materials: ScoutedMaterial[];
  recommendedStrategy: string;
  topHooks: string[];
  topBenefits: string[];
  topTargets: string[];
  avoidPatterns: string[];
}

// キャッシュ（API呼び出し節約）
let cachedReport: ScoutReport | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30分

/**
 * フルスカウト実行
 * Tavily + Feedback + 知識DBを統合
 */
export async function fullScout(industry: 'liver' | 'chatlady'): Promise<ScoutReport> {
  // キャッシュチェック
  if (cachedReport && (Date.now() - cacheTime) < CACHE_TTL && cachedReport.industry === industry) {
    console.log('[Scout] 📦 Using cached report');
    return cachedReport;
  }

  console.log(`[Scout] 🔍 Starting full scout for ${industry}...`);

  const materials: ScoutedMaterial[] = [];

  // 1. Tavilyからトレンド取得
  try {
    const tavilyContext = await tavilyAgent.getEnhancedContext(industry);

    // フック追加
    for (const hook of tavilyContext.recommendedHooks) {
      materials.push({
        type: 'hook',
        content: hook,
        source: 'tavily',
        score: 8,
        reason: 'Tavilyトレンド検索で検出',
      });
    }

    // メリット追加
    for (const benefit of tavilyContext.recommendedBenefits) {
      materials.push({
        type: 'benefit',
        content: benefit,
        source: 'tavily',
        score: 7,
        reason: 'Tavilyで頻出のメリット表現',
      });
    }

    // 競合投稿からの例
    for (const post of tavilyContext.competitorPosts.slice(0, 5)) {
      for (const hint of post.engagement_hints) {
        materials.push({
          type: 'example',
          content: hint,
          source: 'tavily',
          score: 6,
          reason: '競合投稿のエンゲージメント要因',
        });
      }
    }
  } catch (error) {
    console.warn('[Scout] Tavily failed, continuing:', error);
  }

  // 2. Feedbackから学習パターン取得
  try {
    const feedbackContext = feedbackAgent.getLearnedContext();

    // 成功フック
    for (const hook of feedbackContext.recommendedHooks) {
      materials.push({
        type: 'hook',
        content: hook,
        source: 'feedback',
        score: 10, // 実績ベースは最高スコア
        reason: '過去投稿で高エンゲージメント',
      });
    }

    // 成功メリット
    for (const benefit of feedbackContext.recommendedBenefits) {
      materials.push({
        type: 'benefit',
        content: benefit,
        source: 'feedback',
        score: 10,
        reason: '過去投稿で反応良好',
      });
    }

    // 回避パターン
    for (const avoid of feedbackContext.avoidPatterns) {
      materials.push({
        type: 'hook',
        content: `【避ける】${avoid}`,
        source: 'feedback',
        score: -5,
        reason: '過去投稿で低エンゲージメント',
      });
    }
  } catch (error) {
    console.warn('[Scout] Feedback failed, continuing:', error);
  }

  // 3. 静的知識ベースから追加
  const staticMaterials = getStaticMaterials(industry);
  materials.push(...staticMaterials);

  // スコア順にソート
  materials.sort((a, b) => b.score - a.score);

  // トップ素材を抽出
  const topHooks = materials
    .filter(m => m.type === 'hook' && m.score > 0)
    .slice(0, 10)
    .map(m => m.content);

  const topBenefits = materials
    .filter(m => m.type === 'benefit' && m.score > 0)
    .slice(0, 10)
    .map(m => m.content);

  const avoidPatterns = materials
    .filter(m => m.score < 0)
    .map(m => m.content.replace('【避ける】', ''));

  // 推奨戦略生成
  const recommendedStrategy = generateStrategy(materials, industry);

  // フィードバック統計からトップターゲット取得
  const stats = feedbackAgent.getStats();
  const topTargets = stats.topTarget ? [stats.topTarget] : getDefaultTargets(industry);

  const report: ScoutReport = {
    industry,
    timestamp: new Date().toISOString(),
    materials,
    recommendedStrategy,
    topHooks,
    topBenefits,
    topTargets,
    avoidPatterns,
  };

  // キャッシュ更新
  cachedReport = report;
  cacheTime = Date.now();

  console.log(`[Scout] ✅ Scout complete: ${materials.length} materials collected`);
  return report;
}

/**
 * 静的知識ベースから素材取得
 */
function getStaticMaterials(industry: 'liver' | 'chatlady'): ScoutedMaterial[] {
  const materials: ScoutedMaterial[] = [];

  if (industry === 'liver') {
    // ライバー向け定番フック
    const hooks = [
      'ぶっちゃけ、配信未経験でも',
      '正直、顔出しなしで稼ぐの不安だった',
      '実は、週3日で月20万超えてる子がいて',
      'マジで、スマホ1台で始められるんです',
    ];
    for (const hook of hooks) {
      materials.push({
        type: 'hook',
        content: hook,
        source: 'knowledge',
        score: 5,
        reason: 'ライバー業界定番フック',
      });
    }

    // メリット
    const benefits = ['月30万以上可能', '完全在宅OK', '顔出しなし', 'ノルマなし', 'シフト自由'];
    for (const benefit of benefits) {
      materials.push({
        type: 'benefit',
        content: benefit,
        source: 'knowledge',
        score: 5,
        reason: 'ライバー業界定番メリット',
      });
    }
  } else {
    // チャトレ向け
    const hooks = [
      'ぶっちゃけ、在宅で稼ぎたいなら',
      '正直、通勤ゼロで月20万は現実的',
      '実は、顔出しなしでも高収入',
      'マジで、スマホだけで月10万いける',
    ];
    for (const hook of hooks) {
      materials.push({
        type: 'hook',
        content: hook,
        source: 'knowledge',
        score: 5,
        reason: 'チャトレ業界定番フック',
      });
    }

    const benefits = ['完全在宅', '時給3000円以上', '日払いOK', '顔出し不要', '週1からOK'];
    for (const benefit of benefits) {
      materials.push({
        type: 'benefit',
        content: benefit,
        source: 'knowledge',
        score: 5,
        reason: 'チャトレ業界定番メリット',
      });
    }
  }

  // 共通の感情トリガー
  const emotions = ['不安', '自由', '安心', '夢', '理想'];
  for (const emotion of emotions) {
    materials.push({
      type: 'emotion',
      content: emotion,
      source: 'knowledge',
      score: 4,
      reason: '感情トリガーキーワード',
    });
  }

  return materials;
}

/**
 * 推奨戦略生成
 */
function generateStrategy(materials: ScoutedMaterial[], industry: 'liver' | 'chatlady'): string {
  const feedbackMaterials = materials.filter(m => m.source === 'feedback' && m.score > 0);
  const tavilyMaterials = materials.filter(m => m.source === 'tavily' && m.score > 0);

  if (feedbackMaterials.length >= 5) {
    return '実績ベース戦略: 過去の高エンゲージメント投稿パターンを優先';
  }

  if (tavilyMaterials.length >= 5) {
    return 'トレンド戦略: Tavilyで検出した最新トレンドを活用';
  }

  return '基本戦略: 定番パターン + 具体的な数字で信頼性を高める';
}

/**
 * デフォルトターゲット
 */
function getDefaultTargets(industry: 'liver' | 'chatlady'): string[] {
  if (industry === 'liver') {
    return ['完全未経験', '副業希望', '在宅ワーク希望'];
  }
  return ['在宅ワーク希望', '副業希望', '主婦・ママ'];
}

/**
 * クイックスカウト（キャッシュ優先、軽量）
 */
export async function quickScout(industry: 'liver' | 'chatlady'): Promise<{
  topHooks: string[];
  topBenefits: string[];
  topTargets: string[];
}> {
  // キャッシュがあればそれを使う
  if (cachedReport && cachedReport.industry === industry) {
    return {
      topHooks: cachedReport.topHooks,
      topBenefits: cachedReport.topBenefits,
      topTargets: cachedReport.topTargets,
    };
  }

  // Feedbackだけで軽量レスポンス
  const feedbackContext = feedbackAgent.getLearnedContext();

  return {
    topHooks: feedbackContext.recommendedHooks.length > 0
      ? feedbackContext.recommendedHooks
      : getStaticMaterials(industry).filter(m => m.type === 'hook').slice(0, 5).map(m => m.content),
    topBenefits: feedbackContext.recommendedBenefits.length > 0
      ? feedbackContext.recommendedBenefits
      : getStaticMaterials(industry).filter(m => m.type === 'benefit').slice(0, 5).map(m => m.content),
    topTargets: feedbackContext.recommendedTargets.length > 0
      ? feedbackContext.recommendedTargets
      : getDefaultTargets(industry),
  };
}

/**
 * キャッシュクリア
 */
export function clearCache(): void {
  cachedReport = null;
  cacheTime = 0;
}

export default {
  fullScout,
  quickScout,
  clearCache,
};

/**
 * コピー改善・バリエーション生成エンジン
 * Geminiを使用して投稿文の改善提案と多様なバリエーションを生成
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const DATA_DIR = path.join(process.cwd(), 'data');

// ========================================
// 型定義
// ========================================

export interface CopyImprovement {
  original: string;
  improved: string;
  changes: Array<{
    type: 'hook' | 'empathy' | 'benefit' | 'cta' | 'tone' | 'structure';
    before: string;
    after: string;
    reason: string;
  }>;
  scoreChange: {
    before: number;
    after: number;
    improvement: number;
  };
}

export interface CopyVariation {
  id: string;
  text: string;
  style: string;
  target: string;
  benefit: string;
  hook: string;
  expectedScore: number;
  differentiator: string; // 何が違うのか
}

export interface VariationRequest {
  baseText?: string;
  target: string;
  benefit: string;
  count: number;
  styles?: string[];
}

// ========================================
// ナレッジ読み込み
// ========================================

function loadSuccessPatterns(): string[] {
  const patterns: string[] = [];

  try {
    // 成功パターンDB
    const patternsPath = path.join(DATA_DIR, 'success_patterns.json');
    if (fs.existsSync(patternsPath)) {
      const data = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
      for (const p of (data.patterns || [])) {
        if (p.score >= 8) {
          patterns.push(p.pattern);
        }
      }
    }

    // バイラルテンプレート
    const templatesPath = path.join(KNOWLEDGE_DIR, 'liver_viral_templates.json');
    if (fs.existsSync(templatesPath)) {
      const data = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
      for (const t of (data.templates || [])) {
        if (t.hook) {
          patterns.push(`フック: ${t.hook}`);
        }
      }
    }
  } catch (e) {
    console.error('Failed to load success patterns:', e);
  }

  return patterns.slice(0, 10);
}

function loadRecruitmentCopy(): string[] {
  const copies: string[] = [];

  try {
    const copyPath = path.join(KNOWLEDGE_DIR, 'liver_recruitment_copy.json');
    if (fs.existsSync(copyPath)) {
      const data = JSON.parse(fs.readFileSync(copyPath, 'utf-8'));
      for (const section of Object.values(data)) {
        if (Array.isArray(section)) {
          copies.push(...section.slice(0, 3));
        }
      }
    }
  } catch (e) {
    console.error('Failed to load recruitment copy:', e);
  }

  return copies.slice(0, 10);
}

// ========================================
// コピー改善提案
// ========================================

export async function improveCopy(
  originalText: string,
  context?: { target?: string; benefit?: string; score?: number }
): Promise<CopyImprovement> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  const patterns = loadSuccessPatterns();
  const copies = loadRecruitmentCopy();

  const prompt = `あなたはSNSコピーライティングの専門家です。以下の投稿文を改善してください。

## 元の投稿文
${originalText}

## コンテキスト
- ターゲット: ${context?.target || '不明'}
- ベネフィット: ${context?.benefit || '不明'}
- 現在のスコア: ${context?.score || '未評価'}

## 参考にすべき成功パターン
${patterns.join('\n')}

## 効果的なコピー例
${copies.slice(0, 5).join('\n---\n')}

## 改善のポイント
1. **フック（冒頭）**: 最初の1行で興味を引く。「ぶっちゃけ」「正直」「本当は」などの共感ワード
2. **共感**: ターゲットの悩みに寄り添う
3. **ベネフィット**: 具体的な数字（月○万円、週○日）で訴求
4. **CTA**: 行動を促す（DMで相談、気軽に連絡）
5. **トーン**: 親しみやすく、押し売り感なし
6. **構造**: 読みやすい改行、適度な絵文字

## 出力形式（JSON）
{
  "improved": "改善後の投稿文（全文）",
  "changes": [
    {
      "type": "hook | empathy | benefit | cta | tone | structure",
      "before": "変更前の部分",
      "after": "変更後の部分",
      "reason": "変更理由"
    }
  ],
  "scoreChange": {
    "before": 現在のスコア,
    "after": 改善後の予想スコア,
    "improvement": 改善幅
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON not found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      original: originalText,
      improved: parsed.improved,
      changes: parsed.changes || [],
      scoreChange: {
        before: context?.score || 7,
        after: parsed.scoreChange?.after || 10,
        improvement: parsed.scoreChange?.improvement || 3,
      },
    };
  } catch (e) {
    console.error('Failed to improve copy:', e);
    return {
      original: originalText,
      improved: originalText,
      changes: [],
      scoreChange: { before: context?.score || 7, after: context?.score || 7, improvement: 0 },
    };
  }
}

// ========================================
// 幅広いバリエーション生成
// ========================================

const STYLE_VARIATIONS = [
  { id: 'empathy', name: '共感型', description: '悩みに寄り添い、理解を示す' },
  { id: 'story', name: 'ストーリー型', description: '実例・体験談ベースで説得' },
  { id: 'question', name: '質問型', description: '問いかけで興味を引く' },
  { id: 'urgent', name: '緊急性型', description: '今すぐ行動を促す' },
  { id: 'casual', name: 'カジュアル型', description: '友達に話すようなトーン' },
  { id: 'professional', name: 'プロ型', description: '信頼感・専門性を強調' },
  { id: 'benefit', name: 'ベネフィット型', description: 'メリットを前面に押し出す' },
  { id: 'contrast', name: '対比型', description: 'ビフォーアフターで訴求' },
  { id: 'social_proof', name: '社会的証明型', description: '他の人の成功を見せる' },
  { id: 'secret', name: '秘密型', description: '特別な情報を提供する' },
];

export async function generateVariations(request: VariationRequest): Promise<CopyVariation[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  const patterns = loadSuccessPatterns();
  const copies = loadRecruitmentCopy();

  // 使用するスタイルを決定
  const stylesToUse = request.styles
    ? STYLE_VARIATIONS.filter(s => request.styles!.includes(s.id))
    : STYLE_VARIATIONS.slice(0, request.count);

  const prompt = `あなたはSNSコピーライティングの専門家です。
以下の条件で、**全く異なるアプローチ**の投稿文を${request.count}パターン生成してください。

## 条件
- ターゲット: ${request.target}
- ベネフィット: ${request.benefit}
${request.baseText ? `- 参考テキスト: ${request.baseText.slice(0, 200)}...` : ''}

## 生成すべきスタイル
${stylesToUse.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join('\n')}

## 成功パターン参考
${patterns.slice(0, 5).join('\n')}

## 効果的なコピー例
${copies.slice(0, 3).join('\n---\n')}

## 重要なルール
1. 各バリエーションは**明確に異なるアプローチ**で書く
2. 同じフレーズの使い回しは禁止
3. 140-280文字程度
4. 必ずCTA（DM誘導）を含める
5. 具体的な数字を入れる
6. ライバー/チャットレディ募集として自然な文章

## 出力形式（JSON配列）
{
  "variations": [
    {
      "text": "投稿文全文",
      "style": "スタイル名",
      "hook": "使用したフック（冒頭の文）",
      "expectedScore": 予想スコア（1-15）,
      "differentiator": "このバリエーションの特徴（他との違い）"
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON not found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return (parsed.variations || []).map((v: any, i: number) => ({
      id: `var_${Date.now()}_${i}`,
      text: v.text,
      style: v.style,
      target: request.target,
      benefit: request.benefit,
      hook: v.hook || v.text.split('\n')[0].slice(0, 30),
      expectedScore: v.expectedScore || 8,
      differentiator: v.differentiator || '',
    }));
  } catch (e) {
    console.error('Failed to generate variations:', e);
    return [];
  }
}

// ========================================
// 低スコア投稿の一括改善
// ========================================

export async function improveLowScorePosts(threshold: number = 8): Promise<{
  improved: CopyImprovement[];
  skipped: number;
}> {
  const stockPath = path.join(DATA_DIR, 'post_stock.json');
  const improved: CopyImprovement[] = [];
  let skipped = 0;

  try {
    if (fs.existsSync(stockPath)) {
      const data = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
      const stocks = data.stocks || [];

      // 低スコアかつ未使用の投稿を抽出
      const lowScorePosts = stocks.filter((s: any) =>
        !s.usedAt &&
        (typeof s.score === 'number' ? s.score : s.score?.total || 0) < threshold
      ).slice(0, 5); // 一度に5件まで

      for (const post of lowScorePosts) {
        const score = typeof post.score === 'number' ? post.score : post.score?.total || 0;
        const improvement = await improveCopy(post.text, {
          target: post.target,
          benefit: post.benefit,
          score,
        });

        if (improvement.scoreChange.improvement > 0) {
          improved.push(improvement);
        } else {
          skipped++;
        }
      }
    }
  } catch (e) {
    console.error('Failed to improve low score posts:', e);
  }

  return { improved, skipped };
}

// ========================================
// スタイル一覧を取得
// ========================================

export function getAvailableStyles(): typeof STYLE_VARIATIONS {
  return STYLE_VARIATIONS;
}

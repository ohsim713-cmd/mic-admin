/**
 * Claude Agent SDK クライアント
 *
 * 自律的にタスクをこなすエージェントを構築
 * - ファイル読み書き
 * - コマンド実行
 * - コード編集
 * - ワークフロー実行
 */

import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

// ========== 基本的なクエリ実行 ==========

export interface AgentResult {
  success: boolean;
  result: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
  };
  error?: string;
}

/**
 * Claude Agentでタスクを実行
 */
export async function runAgent(
  prompt: string,
  options?: {
    cwd?: string;
    model?: 'sonnet' | 'opus' | 'haiku';
    maxTurns?: number;
    allowedTools?: string[];
    disallowedTools?: string[];
  }
): Promise<AgentResult> {
  try {
    const messages: string[] = [];

    // クエリを実行
    for await (const message of query({
      prompt,
      options: {
        cwd: options?.cwd || process.cwd(),
        model: options?.model || 'sonnet',
        maxTurns: options?.maxTurns || 10,
        allowedTools: options?.allowedTools,
        disallowedTools: options?.disallowedTools,
      },
    })) {
      // メッセージを収集
      if (message.type === 'assistant') {
        const textContent = message.message.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n');
        if (textContent) {
          messages.push(textContent);
        }
      } else if (message.type === 'result') {
        // 完了
        if (message.subtype === 'success') {
          return {
            success: true,
            result: messages.join('\n\n'),
            usage: message.usage ? {
              inputTokens: message.usage.input_tokens,
              outputTokens: message.usage.output_tokens,
              costUSD: (message.usage as any).cost_usd || 0,
            } : undefined,
          };
        } else {
          return {
            success: false,
            result: messages.join('\n\n'),
            error: (message as any).errors?.join(', ') || 'Unknown error',
          };
        }
      }
    }

    return {
      success: true,
      result: messages.join('\n\n'),
    };
  } catch (error: any) {
    console.error('[Claude Agent] Error:', error);
    return {
      success: false,
      result: '',
      error: error.message || 'Unknown error',
    };
  }
}

// ========== 特化タスク ==========

/**
 * コードを生成
 */
export async function generateCodeWithAgent(
  description: string,
  options?: {
    language?: string;
    outputPath?: string;
  }
): Promise<AgentResult> {
  const lang = options?.language || 'TypeScript';
  const outputPath = options?.outputPath;

  const prompt = outputPath
    ? `Generate ${lang} code for: ${description}
       Save it to ${outputPath}`
    : `Generate ${lang} code for: ${description}
       Output only the code.`;

  return runAgent(prompt, {
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
  });
}

/**
 * コードをレビュー
 */
export async function reviewCodeWithAgent(
  filePath: string
): Promise<AgentResult> {
  const prompt = `Review the code in ${filePath}.
Provide:
1. A score from 1-10
2. List of issues found
3. Suggestions for improvement

Format as JSON: { "score": number, "issues": [], "suggestions": [] }`;

  return runAgent(prompt, {
    allowedTools: ['Read', 'Glob', 'Grep'],
    maxTurns: 5,
  });
}

/**
 * バグを修正
 */
export async function fixBugWithAgent(
  filePath: string,
  errorDescription: string
): Promise<AgentResult> {
  const prompt = `Fix the bug in ${filePath}.
Error: ${errorDescription}

1. Read the file
2. Identify the bug
3. Fix it
4. Verify the fix`;

  return runAgent(prompt, {
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    maxTurns: 10,
  });
}

/**
 * テストを実行
 */
export async function runTestsWithAgent(
  testCommand?: string
): Promise<AgentResult> {
  const prompt = `Run the tests using: ${testCommand || 'npm test'}
Report:
1. Number of tests passed/failed
2. Any error messages
3. Suggestions for fixing failures`;

  return runAgent(prompt, {
    allowedTools: ['Bash', 'Read', 'Glob'],
    maxTurns: 5,
  });
}

// ========== カスタムツール付きエージェント ==========

/**
 * カスタムツールを持つエージェントを作成
 */
export function createAgentWithTools(customTools: Array<{
  name: string;
  description: string;
  schema: Record<string, any>;
  handler: (args: any) => Promise<string>;
}>) {
  // カスタムMCPサーバーを作成
  const mcpServer = createSdkMcpServer({
    name: 'custom-tools',
    version: '1.0.0',
    tools: customTools.map((t) =>
      tool(
        t.name,
        t.description,
        t.schema as any,
        async (args) => ({
          content: [{ type: 'text', text: await t.handler(args) }],
        })
      )
    ),
  });

  return {
    run: async (prompt: string, options?: { maxTurns?: number }) => {
      const messages: string[] = [];

      for await (const message of query({
        prompt,
        options: {
          maxTurns: options?.maxTurns || 10,
          // MCPサーバーを追加
        },
      })) {
        if (message.type === 'assistant') {
          const textContent = message.message.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
          if (textContent) {
            messages.push(textContent);
          }
        } else if (message.type === 'result') {
          return {
            success: message.subtype === 'success',
            result: messages.join('\n\n'),
            error: message.subtype !== 'success' ? (message as any).errors?.join(', ') : undefined,
          };
        }
      }

      return { success: true, result: messages.join('\n\n') };
    },
  };
}

// ========== SNS自動化用エージェント ==========

/**
 * SNS投稿を生成・投稿するエージェント
 */
export async function runSNSPostingAgent(options: {
  accountType: 'liver' | 'chatlady';
  action: 'generate' | 'post' | 'analyze';
  count?: number;
}): Promise<AgentResult> {
  let prompt = '';

  switch (options.action) {
    case 'generate':
      prompt = `Generate ${options.count || 5} SNS posts for ${options.accountType === 'liver' ? 'ライバー' : 'チャットレディ'} recruitment.

Requirements:
1. Read the knowledge files from ./knowledge/
2. Generate engaging posts with hooks and CTAs
3. Save to ./data/post_stock.json
4. Each post should have a quality score`;
      break;

    case 'post':
      prompt = `Post to SNS:
1. Read pending posts from ./data/post_stock.json
2. Call the posting API at /api/automation/post
3. Update the post status to 'posted'
4. Report results`;
      break;

    case 'analyze':
      prompt = `Analyze SNS performance:
1. Read engagement data
2. Identify top performing posts
3. Extract success patterns
4. Save insights to ./knowledge/success_patterns.json`;
      break;
  }

  return runAgent(prompt, {
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch'],
    maxTurns: 15,
  });
}

// ========== ハイブリッドワークフロー（Gemini + Agent SDK） ==========

/**
 * Agent SDKで自律的にナレッジを学習・更新
 * - 成功パターンの抽出
 * - ナレッジファイルの自動更新
 * - トレンド分析
 */
export async function runKnowledgeLearningAgent(options?: {
  focusArea?: 'hooks' | 'cta' | 'trends' | 'all';
  maxTurns?: number;
}): Promise<AgentResult> {
  const focus = options?.focusArea || 'all';

  const prompt = `あなたはSNSマーケティングの専門家です。以下のタスクを実行してください。

## タスク: ナレッジベースの学習・更新

### ★最初に読むべきファイル（全データのサマリー）
./data/sdk_analysis_summary.json
↑ このファイル1つで全体像が把握できます:
- overview: スコア分布、平均スコア
- patterns: 効果的なフック/CTA
- lowScorePosts: 改善が必要な投稿
- highScorePosts: 参考にすべき成功投稿
- recommendations: 自動生成された改善提案

### 1. サマリーから課題を特定
- 低スコア投稿の共通点を分析
- 高スコア投稿のパターンを抽出

### 2. ${focus === 'all' ? '全体' : focus}の改善
${focus === 'hooks' || focus === 'all' ? `
- 高スコア投稿のフックパターンを抽出
- ./knowledge/liver_viral_templates.json に新パターンを追加
` : ''}
${focus === 'cta' || focus === 'all' ? `
- 効果的なCTAパターンを分析
- ./knowledge/liver_recruitment_copy.json を更新
` : ''}
${focus === 'trends' || focus === 'all' ? `
- 最新のトレンドワードを特定
- ./knowledge/liver_trends.json を更新
` : ''}

### 3. 出力
- 学習した内容のサマリー
- 更新したファイルのリスト
- 次回の改善提案

日本語で回答してください。`;

  return runAgent(prompt, {
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
    maxTurns: options?.maxTurns || 20,
    model: 'haiku', // コスト削減のためHaikuを使用
  });
}

/**
 * Agent SDKでパフォーマンス分析を実行
 * ★ ./data/sdk_analysis_summary.json を最初に読むと効率的
 */
export async function runPerformanceAnalysisAgent(options?: {
  period?: 'day' | 'week' | 'month';
  detailed?: boolean;
}): Promise<AgentResult> {
  const period = options?.period || 'week';

  const prompt = `SNS投稿のパフォーマンス分析を行ってください。

## 分析期間: ${period === 'day' ? '過去24時間' : period === 'week' ? '過去1週間' : '過去1ヶ月'}

## ★最初に読むべきファイル（全データのサマリー）
./data/sdk_analysis_summary.json
↑ このファイルに以下が全て含まれています:
- overview: 総投稿数、平均スコア、スコア分布
- performance: インプレッション、エンゲージメント
- patterns: フック、CTA、ターゲット別スコア
- recommendations: 自動生成された改善提案
- lowScorePosts: 低スコア投稿一覧
- highScorePosts: 高スコア投稿一覧

## 分析後に追加で読むファイル（必要な場合のみ）
- ./knowledge/liver_viral_templates.json - バイラルテンプレート
- ./knowledge/liver_recruitment_copy.json - 成功コピー例

## 出力形式
JSON形式で結果を出力:
{
  "summary": { "totalPosts": number, "avgScore": number, "topScore": number },
  "insights": [ "具体的な分析結果..." ],
  "recommendations": [ "改善アクション..." ],
  "topPatterns": [ "効果的なパターン..." ]
}

日本語で回答してください。`;

  return runAgent(prompt, {
    allowedTools: ['Read', 'Glob', 'Grep'],
    maxTurns: 10,
    model: 'haiku',
  });
}

/**
 * Agent SDKで自動PDCA実行
 * Geminiで生成した投稿をAgent SDKが評価・改善提案
 */
export async function runAutoPDCAAgent(postData: {
  text: string;
  score: number;
  target: string;
  benefit: string;
}): Promise<AgentResult> {
  const prompt = `以下のSNS投稿を評価し、改善提案を行ってください。

## 投稿データ
- テキスト: ${postData.text}
- 現在のスコア: ${postData.score}/15
- ターゲット: ${postData.target}
- ベネフィット: ${postData.benefit}

## 評価基準
1. フック力（最初の1行で興味を引けるか）
2. 共感性（ターゲットの悩みに寄り添えているか）
3. ベネフィット明確さ（メリットが伝わるか）
4. CTA効果（行動を促せるか）
5. 文字数・読みやすさ

## ナレッジ参照
./knowledge/liver_viral_templates.json を参考に改善案を提案

## 出力形式
{
  "currentScore": number,
  "evaluation": {
    "hook": { "score": 1-3, "comment": "..." },
    "empathy": { "score": 1-3, "comment": "..." },
    "benefit": { "score": 1-3, "comment": "..." },
    "cta": { "score": 1-3, "comment": "..." },
    "readability": { "score": 1-3, "comment": "..." }
  },
  "improvedText": "改善版の投稿文",
  "expectedScore": number
}

日本語で回答してください。`;

  return runAgent(prompt, {
    allowedTools: ['Read', 'Glob'],
    maxTurns: 5,
    model: 'haiku',
  });
}

// ========== 低コスト分析（Haiku使用） ==========

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

/**
 * Haikuで低コスト分析（Agent SDKの1/10以下のコスト）
 */
export async function analyzeWithHaiku(
  data: string,
  analysisType: 'performance' | 'patterns' | 'improvements'
): Promise<{
  success: boolean;
  result: string;
  insights?: Record<string, any>;
  costUSD?: number;
}> {
  try {
    const client = getAnthropicClient();

    const prompts: Record<string, string> = {
      performance: `以下のSNS投稿データを分析し、パフォーマンス評価を行ってください。
結果はJSON形式で: { "topPosts": [], "avgScore": number, "trends": [], "recommendations": [] }

データ:
${data}`,
      patterns: `以下のSNS投稿データから成功パターンを抽出してください。
結果はJSON形式で: { "patterns": [], "keywords": [], "bestTimeSlots": [], "ctaTypes": [] }

データ:
${data}`,
      improvements: `以下のSNS投稿データを分析し、改善点を提案してください。
結果はJSON形式で: { "weakPoints": [], "suggestions": [], "priority": [] }

データ:
${data}`,
    };

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompts[analysisType] }],
    });

    const resultText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // JSONを抽出
    let insights: Record<string, any> | undefined;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // JSON parse失敗
    }

    // コスト計算（Haiku: 入力$0.25/1M, 出力$1.25/1M）
    const inputCost = (response.usage.input_tokens / 1000000) * 0.25;
    const outputCost = (response.usage.output_tokens / 1000000) * 1.25;

    return {
      success: true,
      result: resultText,
      insights,
      costUSD: inputCost + outputCost,
    };
  } catch (error: any) {
    console.error('[Haiku Analysis] Error:', error);
    return {
      success: false,
      result: error.message || 'Analysis failed',
    };
  }
}

/**
 * ローカルデータのみで分析（APIコストゼロ）
 */
export function analyzeLocalData(posts: Array<{
  text: string;
  score?: number;
  impressions?: number;
  likes?: number;
  status?: string;
}>): {
  totalPosts: number;
  avgScore: number;
  scoreDistribution: { high: number; mid: number; low: number };
  topKeywords: string[];
  recommendations: string[];
} {
  const totalPosts = posts.length;
  const scores = posts.filter(p => p.score).map(p => p.score!);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const scoreDistribution = {
    high: scores.filter(s => s >= 10).length,
    mid: scores.filter(s => s >= 8 && s < 10).length,
    low: scores.filter(s => s < 8).length,
  };

  // キーワード抽出（簡易）
  const allText = posts.map(p => p.text).join(' ');
  const keywords = ['稼ぐ', '自由', '在宅', '高収入', 'スマホ', '副業', '簡単', '今すぐ', 'DM'];
  const topKeywords = keywords.filter(kw => allText.includes(kw));

  // レコメンデーション
  const recommendations: string[] = [];
  if (avgScore < 8) {
    recommendations.push('品質スコアが低めです。CTAを強化してください。');
  }
  if (scoreDistribution.low > scoreDistribution.high) {
    recommendations.push('低スコア投稿が多いです。成功パターンを参考にしてください。');
  }
  if (topKeywords.length < 3) {
    recommendations.push('パワーワードが少ないです。訴求力を高めてください。');
  }

  return {
    totalPosts,
    avgScore,
    scoreDistribution,
    topKeywords,
    recommendations,
  };
}

// ========== 設定確認 ==========

export function checkAgentConfig(): {
  available: boolean;
  message: string;
  haiku: boolean;
} {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  try {
    return {
      available: true,
      message: 'Claude Agent SDK is ready',
      haiku: hasApiKey,
    };
  } catch {
    return {
      available: false,
      message: 'Claude Agent SDK not available',
      haiku: hasApiKey,
    };
  }
}

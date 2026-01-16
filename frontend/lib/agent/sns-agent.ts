/**
 * SNS Marketing Agent
 * Gemini API + Function Calling で自律的にSNSマーケティングを実行
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ========================================
// 型定義
// ========================================

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
}

export interface AgentContext {
  messages: AgentMessage[];
  lastActivity: string;
}

// ========================================
// ツール実行
// ========================================

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'get_stats': {
        const summaryPath = path.join(DATA_DIR, 'sdk_analysis_summary.json');
        if (fs.existsSync(summaryPath)) {
          const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
          return JSON.stringify({
            totalPosts: data.overview?.totalPosts || 0,
            postedPosts: data.overview?.postedPosts || 0,
            pendingPosts: data.overview?.pendingPosts || 0,
            avgScore: data.overview?.avgScore || 0,
            totalImpressions: data.performance?.totalImpressions || 0,
            totalEngagement: data.performance?.totalEngagement || 0,
            avgEngagementRate: data.performance?.avgEngagementRate || 0,
          }, null, 2);
        }
        // サマリーがない場合はpost_stockから計算
        const stockPath = path.join(DATA_DIR, 'post_stock.json');
        if (fs.existsSync(stockPath)) {
          const stockData = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
          const stocks = stockData.stocks || [];
          const posted = stocks.filter((s: any) => s.usedAt);
          return JSON.stringify({
            totalPosts: stocks.length,
            postedPosts: posted.length,
            pendingPosts: stocks.length - posted.length,
            avgScore: stocks.reduce((a: number, s: any) => a + (typeof s.score === 'number' ? s.score : s.score?.total || 0), 0) / stocks.length || 0,
          }, null, 2);
        }
        return JSON.stringify({ message: 'まだデータがありません。投稿を生成・投稿してからお試しください。' });
      }

      case 'get_posts': {
        const limit = (input.limit as number) || 10;
        const status = (input.status as string) || 'all';
        const stockPath = path.join(DATA_DIR, 'post_stock.json');
        if (fs.existsSync(stockPath)) {
          const data = JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
          let posts = data.stocks || [];
          if (status === 'posted') {
            posts = posts.filter((p: any) => p.usedAt);
          } else if (status === 'pending') {
            posts = posts.filter((p: any) => !p.usedAt);
          }
          const result = posts.slice(-limit).reverse().map((p: any) => ({
            text: p.text?.slice(0, 50) + '...',
            score: typeof p.score === 'number' ? p.score : p.score?.total,
            target: p.target,
            benefit: p.benefit,
            usedAt: p.usedAt || null,
          }));
          return JSON.stringify(result, null, 2);
        }
        return JSON.stringify([]);
      }

      case 'get_knowledge': {
        const type = (input.type as string) || 'all';
        const result: Record<string, unknown> = {};

        if (type === 'patterns' || type === 'all') {
          const patternsPath = path.join(DATA_DIR, 'success_patterns.json');
          if (fs.existsSync(patternsPath)) {
            const data = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            result.patterns = (data.patterns || []).slice(0, 5);
          }
        }

        if (type === 'hooks' || type === 'all') {
          const templatesPath = path.join(KNOWLEDGE_DIR, 'liver_viral_templates.json');
          if (fs.existsSync(templatesPath)) {
            const data = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
            result.hooks = (data.templates || []).slice(0, 5).map((t: any) => t.hook);
          }
        }

        return JSON.stringify(result, null, 2);
      }

      case 'update_knowledge': {
        const ktype = input.type as string;
        const content = input.content as string;
        const score = (input.score as number) || 8;

        const patternsPath = path.join(DATA_DIR, 'success_patterns.json');
        let patterns: any = { patterns: [] };
        if (fs.existsSync(patternsPath)) {
          patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
        }

        patterns.patterns.push({
          pattern: content,
          category: ktype,
          score,
          addedAt: new Date().toISOString(),
          source: 'agent',
        });

        fs.writeFileSync(patternsPath, JSON.stringify(patterns, null, 2));
        return JSON.stringify({ success: true, message: `${ktype}を追加しました: ${content}` });
      }

      case 'generate_post': {
        // LangGraphの投稿生成を呼び出し
        const { generateSinglePost } = await import('@/lib/langgraph/post-generator');
        const target = (input.target as string) || '30代';
        const benefit = (input.benefit as string) || '高収入';

        const result = await generateSinglePost('liver', 'ライバー');
        return JSON.stringify({
          text: result.text,
          score: result.score,
          target,
          benefit,
        }, null, 2);
      }

      case 'update_schedule': {
        const action = input.action as string;
        const time = input.time as string;
        return JSON.stringify({
          success: true,
          message: `スケジュールを更新しました: ${action} ${time || ''}`,
        });
      }

      case 'analyze_performance': {
        const summaryPath = path.join(DATA_DIR, 'sdk_analysis_summary.json');
        if (fs.existsSync(summaryPath)) {
          const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
          return JSON.stringify({
            topPatterns: data.patterns?.topHooks || [],
            targetDistribution: data.patterns?.targetDistribution || {},
            recommendations: data.recommendations || [],
            lowScorePosts: (data.lowScorePosts || []).slice(0, 3),
            highScorePosts: (data.highScorePosts || []).slice(0, 3),
          }, null, 2);
        }
        return JSON.stringify({ message: 'まだ分析データがありません' });
      }

      case 'get_hypotheses': {
        const hypothesesPath = path.join(DATA_DIR, 'hypotheses.json');
        if (fs.existsSync(hypothesesPath)) {
          const data = JSON.parse(fs.readFileSync(hypothesesPath, 'utf-8'));
          const status = (input.status as string) || 'all';
          let hypotheses = data.hypotheses || [];
          if (status !== 'all') {
            hypotheses = hypotheses.filter((h: any) => h.status === status);
          }
          return JSON.stringify(hypotheses.slice(-5), null, 2);
        }
        return JSON.stringify([]);
      }

      // ========================================
      // ファイル操作ツール (Claude Code風)
      // ========================================

      case 'read_file': {
        const filePath = input.path as string;
        if (!filePath) {
          return JSON.stringify({ error: 'path が必要です' });
        }
        // プロジェクトルートからの相対パスを絶対パスに変換
        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);

        // セキュリティ: プロジェクト内のみ許可
        if (!fullPath.startsWith(process.cwd())) {
          return JSON.stringify({ error: 'プロジェクト外のファイルは読み取れません' });
        }

        if (!fs.existsSync(fullPath)) {
          return JSON.stringify({ error: `ファイルが見つかりません: ${filePath}` });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const preview = lines.slice(0, 100).join('\n');
        return JSON.stringify({
          path: filePath,
          lines: lines.length,
          content: lines.length > 100 ? preview + '\n...(truncated)' : content,
        }, null, 2);
      }

      case 'write_file': {
        const filePath = input.path as string;
        const content = input.content as string;

        if (!filePath || content === undefined) {
          return JSON.stringify({ error: 'path と content が必要です' });
        }

        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);

        // セキュリティ: プロジェクト内のみ許可
        if (!fullPath.startsWith(process.cwd())) {
          return JSON.stringify({ error: 'プロジェクト外への書き込みは禁止されています' });
        }

        // ディレクトリがなければ作成
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
        return JSON.stringify({
          success: true,
          path: filePath,
          message: `ファイルを書き込みました: ${filePath}`,
        });
      }

      case 'edit_file': {
        const filePath = input.path as string;
        const oldText = input.old_text as string;
        const newText = input.new_text as string;

        if (!filePath || !oldText || newText === undefined) {
          return JSON.stringify({ error: 'path, old_text, new_text が必要です' });
        }

        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);

        if (!fullPath.startsWith(process.cwd())) {
          return JSON.stringify({ error: 'プロジェクト外のファイルは編集できません' });
        }

        if (!fs.existsSync(fullPath)) {
          return JSON.stringify({ error: `ファイルが見つかりません: ${filePath}` });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        if (!content.includes(oldText)) {
          return JSON.stringify({ error: '指定されたテキストが見つかりません' });
        }

        const newContent = content.replace(oldText, newText);
        fs.writeFileSync(fullPath, newContent, 'utf-8');

        return JSON.stringify({
          success: true,
          path: filePath,
          message: `ファイルを編集しました: ${filePath}`,
        });
      }

      case 'list_files': {
        const dirPath = (input.path as string) || '.';
        const pattern = (input.pattern as string) || '*';

        const fullPath = path.isAbsolute(dirPath)
          ? dirPath
          : path.join(process.cwd(), dirPath);

        if (!fullPath.startsWith(process.cwd())) {
          return JSON.stringify({ error: 'プロジェクト外のディレクトリは参照できません' });
        }

        if (!fs.existsSync(fullPath)) {
          return JSON.stringify({ error: `ディレクトリが見つかりません: ${dirPath}` });
        }

        const files = fs.readdirSync(fullPath, { withFileTypes: true });
        const result = files.map(f => ({
          name: f.name,
          type: f.isDirectory() ? 'directory' : 'file',
        }));

        return JSON.stringify({
          path: dirPath,
          files: result.slice(0, 50),
          total: result.length,
        }, null, 2);
      }

      case 'search_files': {
        const searchPath = (input.path as string) || '.';
        const query = input.query as string;

        if (!query) {
          return JSON.stringify({ error: 'query が必要です' });
        }

        const fullPath = path.isAbsolute(searchPath)
          ? searchPath
          : path.join(process.cwd(), searchPath);

        if (!fullPath.startsWith(process.cwd())) {
          return JSON.stringify({ error: 'プロジェクト外は検索できません' });
        }

        const results: { file: string; line: number; content: string }[] = [];

        function searchInDir(dir: string) {
          if (results.length >= 20) return;

          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= 20) break;

            const entryPath = path.join(dir, entry.name);

            // node_modules, .git, .next を除外
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
              continue;
            }

            if (entry.isDirectory()) {
              searchInDir(entryPath);
            } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|md)$/.test(entry.name)) {
              try {
                const content = fs.readFileSync(entryPath, 'utf-8');
                const lines = content.split('\n');
                lines.forEach((line, i) => {
                  if (results.length >= 20) return;
                  if (line.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                      file: path.relative(process.cwd(), entryPath),
                      line: i + 1,
                      content: line.trim().slice(0, 100),
                    });
                  }
                });
              } catch (e) {
                // ファイル読み取りエラーは無視
              }
            }
          }
        }

        searchInDir(fullPath);

        return JSON.stringify({
          query,
          results,
          total: results.length,
        }, null, 2);
      }

      case 'run_command': {
        const command = input.command as string;

        if (!command) {
          return JSON.stringify({ error: 'command が必要です' });
        }

        // 危険なコマンドをブロック
        const dangerous = ['rm -rf', 'del /f', 'format', 'mkfs', ':(){', 'fork bomb'];
        if (dangerous.some(d => command.toLowerCase().includes(d))) {
          return JSON.stringify({ error: '危険なコマンドは実行できません' });
        }

        // 許可されたコマンドのみ
        const allowed = ['npm', 'npx', 'node', 'git', 'ls', 'dir', 'cat', 'echo', 'pwd', 'cd'];
        const firstWord = command.split(' ')[0];
        if (!allowed.includes(firstWord)) {
          return JSON.stringify({
            error: `許可されていないコマンドです: ${firstWord}`,
            allowed: allowed.join(', '),
          });
        }

        const { execSync } = require('child_process');
        try {
          const output = execSync(command, {
            cwd: process.cwd(),
            encoding: 'utf-8',
            timeout: 30000, // 30秒タイムアウト
            maxBuffer: 1024 * 1024, // 1MB
          });
          return JSON.stringify({
            command,
            output: output.slice(0, 5000),
            success: true,
          }, null, 2);
        } catch (e: any) {
          return JSON.stringify({
            command,
            error: e.message,
            stderr: e.stderr?.slice(0, 1000),
          });
        }
      }

      case 'web_search': {
        const query = input.query as string;

        if (!query) {
          return JSON.stringify({ error: 'query が必要です' });
        }

        try {
          // Google Custom Search APIを使用
          const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GEMINI_API_KEY;
          const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || 'default';

          // Gemini APIを使用してWeb検索結果を取得
          const searchModel = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: [{ googleSearch: {} } as any],
          });

          const searchResult = await searchModel.generateContent(
            `Search the web for: ${query}\n\nProvide a concise summary of the search results in Japanese.`
          );

          const response = searchResult.response;
          const text = response.text();

          // グラウンディングメタデータを取得
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
          const searchSuggestions = groundingMetadata?.webSearchQueries || [];
          const sources = groundingMetadata?.groundingChunks?.map((chunk: any) => ({
            title: chunk.web?.title || 'Unknown',
            url: chunk.web?.uri || '',
          })) || [];

          return JSON.stringify({
            query,
            summary: text,
            searchSuggestions,
            sources: sources.slice(0, 5),
            success: true,
          }, null, 2);
        } catch (e: any) {
          return JSON.stringify({
            query,
            error: e.message,
            success: false,
          });
        }
      }

      // ========================================
      // 目標管理ツール
      // ========================================

      case 'set_goal': {
        const { setGoal, parseGoalFromText } = await import('./goal-engine');
        const goalType = input.type as string;
        const target = input.target as number;
        const period = (input.period as string) || 'monthly';
        const text = input.text as string;

        // 自然言語から解析
        if (text) {
          const parsed = parseGoalFromText(text);
          if (parsed) {
            const goal = setGoal(parsed.type, parsed.target, parsed.period);
            return JSON.stringify({
              success: true,
              goal,
              message: `目標を設定しました: ${parsed.target}件の${parsed.type}（${parsed.period}）`,
            }, null, 2);
          }
          return JSON.stringify({ error: '目標を解析できませんでした' });
        }

        if (!goalType || !target) {
          return JSON.stringify({ error: 'type と target が必要です' });
        }

        const goal = setGoal(goalType as any, target, period as any);
        return JSON.stringify({
          success: true,
          goal,
        }, null, 2);
      }

      case 'get_goals': {
        const { getGoalsSummary } = await import('./goal-engine');
        const summary = getGoalsSummary();
        return JSON.stringify(summary, null, 2);
      }

      case 'update_goal_progress': {
        const { updateProgress, incrementProgress } = await import('./goal-engine');
        const goalType = input.type as string;
        const value = input.value as number;
        const increment = input.increment as number;

        if (!goalType) {
          return JSON.stringify({ error: 'type が必要です' });
        }

        let goal;
        if (value !== undefined) {
          goal = updateProgress(goalType as any, value);
        } else if (increment !== undefined) {
          goal = incrementProgress(goalType as any, increment);
        } else {
          goal = incrementProgress(goalType as any, 1);
        }

        if (!goal) {
          return JSON.stringify({ error: `${goalType}の目標が見つかりません` });
        }

        return JSON.stringify({
          success: true,
          goal,
        }, null, 2);
      }

      case 'get_goal_strategy': {
        const { generateGoalDrivenStrategy, getStrategyAdjustments } = await import('./goal-engine');
        const adjustments = await getStrategyAdjustments();
        const strategy = await generateGoalDrivenStrategy();

        return JSON.stringify({
          adjustments,
          strategy,
        }, null, 2);
      }

      // ========================================
      // サブエージェント連携ツール
      // ========================================

      case 'delegate_team': {
        const { orchestrate } = await import('./sub-agents');
        const directive = input.directive as string;

        if (!directive) {
          return JSON.stringify({ error: 'directive が必要です' });
        }

        const result = await orchestrate(directive, {
          maxRetries: 2,
          autoSave: true,
        });

        return JSON.stringify({
          success: result.success,
          taskType: result.taskType,
          agentsUsed: result.results.map(r => r.agent),
          output: result.finalOutput,
          duration: result.totalDuration,
        }, null, 2);
      }

      case 'learn_insight': {
        const { learnFromCEO } = await import('./sub-agents');
        const insight = input.insight as string;

        if (!insight) {
          return JSON.stringify({ error: 'insight が必要です' });
        }

        const result = await learnFromCEO(insight);

        return JSON.stringify({
          success: result.success,
          output: result.output,
          learned: result.data,
        }, null, 2);
      }

      case 'ask_cmo': {
        const { cmoAnalyze } = await import('./sub-agents');
        const question = input.question as string || '現在の戦略を分析';
        const result = await cmoAnalyze(question);
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'ask_creative': {
        const { creativeGenerate } = await import('./sub-agents');
        const brief = input.brief as string || '高品質な投稿を生成';
        const count = (input.count as number) || 3;
        const result = await creativeGenerate(brief, count);
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'ask_coo': {
        const { cooReview } = await import('./sub-agents');
        const content = input.content as string;
        if (!content) {
          return JSON.stringify({ error: 'content（レビュー対象）が必要です' });
        }
        const result = await cooReview(content);
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      // ========================================
      // 動画生成ツール（Analyst + Video Producer）
      // ========================================

      case 'check_buzz': {
        const { getBuzzStats, getBuzzQueue, analyzeBuzzTrends } = await import('./buzz-detector');
        const stats = getBuzzStats();
        const pending = getBuzzQueue('detected');

        return JSON.stringify({
          stats,
          pendingForScript: pending.length,
          topBuzz: pending.slice(0, 3).map(p => ({
            id: p.id,
            text: p.text.slice(0, 50) + '...',
            buzzScore: p.buzzScore,
            impressions: p.impressions,
          })),
        }, null, 2);
      }

      case 'create_video': {
        const { getUsageStatus, createVideoFromScript } = await import('./heygen-client');
        const { generateScript, processForVideo } = await import('./video-producer');
        const { getPendingForScript } = await import('./buzz-detector');

        const usage = getUsageStatus();
        if (!usage.canGenerate) {
          return JSON.stringify({
            error: `月間上限（${usage.limit}本）に達しました。残り: ${usage.remaining}本`,
          });
        }

        const buzzPostId = input.buzzPostId as string;
        const pending = getPendingForScript();

        let targetPost;
        if (buzzPostId) {
          targetPost = pending.find(p => p.id === buzzPostId);
        } else {
          targetPost = pending.sort((a, b) => b.buzzScore - a.buzzScore)[0];
        }

        if (!targetPost) {
          return JSON.stringify({
            error: '対象のバズ投稿がありません。まずXで投稿してバズを検出してください。',
          });
        }

        // 台本生成
        const script = await generateScript(targetPost, 30);

        // HeyGen動画生成
        const videoResult = await createVideoFromScript(script.script, {
          aspectRatio: '9:16',
        });

        return JSON.stringify({
          success: videoResult.success,
          buzzPost: targetPost.text.slice(0, 50) + '...',
          script: script.script.slice(0, 100) + '...',
          video: videoResult,
          remaining: getUsageStatus().remaining,
        }, null, 2);
      }

      case 'video_status': {
        const { getUsageStatus } = await import('./heygen-client');
        const { getVideoProducerStats } = await import('./video-producer');
        const { getBuzzStats } = await import('./buzz-detector');

        return JSON.stringify({
          heygen: getUsageStatus(),
          producer: getVideoProducerStats(),
          buzz: getBuzzStats(),
        }, null, 2);
      }

      // ========================================
      // 新サブエージェントツール
      // ========================================

      case 'ask_seo': {
        const { seoAnalyze } = await import('./sub-agents');
        const topic = input.topic as string || 'ライバー 稼ぐ';
        const businessType = input.businessType as string || 'liver-agency';
        const result = await seoAnalyze(topic, businessType);
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'ask_affiliate': {
        const { affiliateRecommend } = await import('./sub-agents');
        const articleTopic = input.articleTopic as string || '';
        const targetAudience = input.targetAudience as string || 'ライバー志望者';
        const result = await affiliateRecommend(articleTopic, targetAudience);
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'ask_dm_responder': {
        const { dmRespond } = await import('./sub-agents');
        const message = input.message as string;
        if (!message) {
          return JSON.stringify({ error: 'message（受信メッセージ）が必要です' });
        }
        const result = await dmRespond(message, {
          businessType: input.businessType as string || 'liver-agency',
          stage: input.stage as 'initial' | 'followup' | 'closing' || 'initial',
        });
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'ask_trend_analyst': {
        const { analyzeTrends } = await import('./sub-agents');
        const businessType = input.businessType as string || 'liver-agency';
        const focusArea = input.focusArea as string;
        const result = await analyzeTrends(businessType, focusArea);
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'ask_video_director': {
        const { createVideoScript } = await import('./sub-agents');
        const topic = input.topic as string || 'ライバーで稼ぐコツ';
        const result = await createVideoScript(topic, {
          duration: input.duration as number || 30,
          style: input.style as 'educational' | 'testimonial' | 'promotional' || 'educational',
          platform: input.platform as 'tiktok' | 'reels' | 'youtube_shorts' || 'tiktok',
        });
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'create_optimized_article': {
        const { createOptimizedArticle } = await import('./sub-agents');
        const topic = input.topic as string;
        if (!topic) {
          return JSON.stringify({ error: 'topic（記事テーマ）が必要です' });
        }
        const businessType = input.businessType as string || 'liver-agency';
        const result = await createOptimizedArticle(topic, businessType);
        return JSON.stringify({
          success: result.success,
          seoKeywords: result.outline?.mainKeyword,
          relatedKeywords: result.outline?.relatedKeywords,
          outline: result.outline?.outline,
        }, null, 2);
      }

      case 'list_agents': {
        const { getAvailableAgents } = await import('./sub-agents');
        const agents = getAvailableAgents();
        return JSON.stringify({
          agents,
          count: agents.length,
        }, null, 2);
      }

      case 'ask_pdca_analyst': {
        const { runPDCAAnalysis } = await import('./sub-agents');
        const analysisType = (input.analysisType as 'daily' | 'weekly' | 'monthly' | 'custom') || 'weekly';
        const result = await runPDCAAnalysis(analysisType, {
          focusArea: input.focusArea as string,
          hypothesis: input.hypothesis as string,
        });
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'ask_knowledge_expert': {
        const { askKnowledgeExpert } = await import('./sub-agents');
        const question = input.question as string;
        if (!question) {
          return JSON.stringify({ error: 'question（質問）が必要です' });
        }
        const businessType = (input.businessType as 'liver-agency' | 'chat-lady') || 'liver-agency';
        const result = await askKnowledgeExpert(question, businessType);
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      case 'analyze_competitors': {
        const { analyzeCompetitors } = await import('./sub-agents');
        const businessType = (input.businessType as 'liver-agency' | 'chat-lady') || 'liver-agency';
        const focusAreas = input.focusAreas as string[];
        const result = await analyzeCompetitors(businessType, focusAreas);
        return JSON.stringify({
          success: result.success,
          output: result.output,
        }, null, 2);
      }

      // ========================================
      // 新エージェント: リサーチャー・コピーライター・共感者
      // ========================================

      case 'ask_researcher': {
        const { runResearcher } = await import('./sub-agents');
        const topic = input.topic as string;
        if (!topic) {
          return JSON.stringify({ error: 'topic（調査テーマ）が必要です' });
        }
        const businessType = (input.businessType as 'liver-agency' | 'chat-lady') || 'liver-agency';
        const result = await runResearcher(topic, businessType);
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      case 'ask_copywriter': {
        const { runCopywriter } = await import('./sub-agents');
        const brief = input.brief as string;
        if (!brief) {
          return JSON.stringify({ error: 'brief（ブリーフ）が必要です' });
        }
        const result = await runCopywriter(brief, {
          platform: input.platform as 'x' | 'tiktok' | 'instagram',
          tone: input.tone as 'casual' | 'professional' | 'empathetic',
          count: input.count as number,
        });
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      case 'ask_empathizer': {
        const { runEmpathizer } = await import('./sub-agents');
        const target = input.target as string;
        if (!target) {
          return JSON.stringify({ error: 'target（ターゲット描写）が必要です' });
        }
        const result = await runEmpathizer(target, input.focusArea as string);
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      // ========================================
      // バトンリレー型オーケストレーション
      // ========================================

      case 'content_relay': {
        const { contentCreationRelay } = await import('./sub-agents');
        const topic = input.topic as string;
        if (!topic) {
          return JSON.stringify({ error: 'topic（テーマ）が必要です' });
        }
        const businessType = (input.businessType as 'liver-agency' | 'chat-lady') || 'liver-agency';
        const result = await contentCreationRelay(topic, businessType, {
          targetAudience: input.targetAudience as string,
          platform: input.platform as 'x' | 'tiktok' | 'instagram',
          contentType: input.contentType as 'recruitment' | 'branding' | 'engagement',
        });
        return JSON.stringify({
          success: result.success,
          chain: result.chain.map(b => ({ agent: b.fromAgent, phase: b.phase.slice(0, 30) })),
          research: result.finalOutput.research,
          empathy: result.finalOutput.empathy,
          copies: result.finalOutput.copies,
          review: result.finalOutput.review,
          duration: result.totalDuration,
        }, null, 2);
      }

      case 'dm_relay': {
        const { dmResponseRelay } = await import('./sub-agents');
        const message = input.message as string;
        if (!message) {
          return JSON.stringify({ error: 'message（受信メッセージ）が必要です' });
        }
        const businessType = (input.businessType as 'liver-agency' | 'chat-lady') || 'liver-agency';
        const result = await dmResponseRelay(message, businessType, {
          previousMessages: input.previousMessages as string[],
          senderProfile: input.senderProfile as string,
        });
        return JSON.stringify({
          success: result.success,
          chain: result.chain.map(b => ({ agent: b.fromAgent, phase: b.phase.slice(0, 30) })),
          empathyAnalysis: result.finalOutput.empathyAnalysis,
          expertInfo: result.finalOutput.expertInfo,
          replyDrafts: result.finalOutput.replyDrafts,
          review: result.finalOutput.review,
          duration: result.totalDuration,
        }, null, 2);
      }

      case 'custom_relay': {
        const { customRelay } = await import('./sub-agents');
        const sequence = input.sequence as string[];
        const task = input.task as string;
        if (!sequence || !task) {
          return JSON.stringify({ error: 'sequence（エージェント配列）と task（初期タスク）が必要です' });
        }
        const result = await customRelay(sequence as any, task);
        return JSON.stringify({
          success: result.success,
          chain: result.chain.map(b => ({ agent: b.fromAgent, phase: b.phase.slice(0, 30) })),
          finalOutput: result.finalOutput,
          duration: result.totalDuration,
        }, null, 2);
      }

      // ========================================
      // クラスター管理・重複チェックツール
      // ========================================

      case 'get_clusters': {
        const { getAllClusters, getClusterMembers, AGENTS } = await import('./sub-agents');
        const clusters = getAllClusters();
        return JSON.stringify({
          clusters: clusters.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            leader: c.leader,
            members: c.members,
          })),
          total: clusters.length,
        }, null, 2);
      }

      case 'get_cluster_agents': {
        const { getClusterMembers, CLUSTERS } = await import('./sub-agents');
        const clusterId = input.clusterId as string;
        if (!clusterId) {
          return JSON.stringify({ error: 'clusterId（部署ID）が必要です' });
        }
        const cluster = (CLUSTERS as any)[clusterId];
        if (!cluster) {
          return JSON.stringify({ error: `不明な部署: ${clusterId}` });
        }
        const members = getClusterMembers(clusterId as any);
        return JSON.stringify({
          cluster: {
            id: cluster.id,
            name: cluster.name,
            description: cluster.description,
            leader: cluster.leader,
          },
          members,
        }, null, 2);
      }

      case 'check_similarity': {
        const { checkPostSimilarity } = await import('./sub-agents');
        const postText = input.text as string;
        if (!postText) {
          return JSON.stringify({ error: 'text（投稿文）が必要です' });
        }
        const result = checkPostSimilarity(postText, {
          threshold: input.threshold as number,
          checkDays: input.checkDays as number,
          maxResults: input.maxResults as number,
        });
        return JSON.stringify({
          isSimilar: result.isSimilar,
          similarPosts: result.similarPosts,
          suggestions: result.suggestions,
          verdict: result.isSimilar
            ? '⚠️ 類似投稿あり - バリエーションを検討してください'
            : '✅ ユニークな投稿です',
        }, null, 2);
      }

      case 'get_variation_status': {
        const { getVariationStatus } = await import('./sub-agents');
        const status = getVariationStatus();
        return JSON.stringify({
          themes: status.themes,
          lastUsed: status.lastUsed,
          suggestions: status.suggestions,
          summary: {
            totalThemes: Object.keys(status.themes).length,
            mostUsed: Object.entries(status.themes).sort((a, b) => b[1] - a[1])[0],
            leastUsed: Object.entries(status.themes).sort((a, b) => a[1] - b[1])[0],
          },
        }, null, 2);
      }

      // ========================================
      // 新エージェント: 投稿型マスター・戦略プランナー等
      // ========================================

      case 'ask_post_pattern_master': {
        const { runPostPatternMaster } = await import('./sub-agents');
        const theme = input.theme as string;
        if (!theme) {
          return JSON.stringify({ error: 'theme（テーマ）が必要です' });
        }
        const result = await runPostPatternMaster(theme, {
          target: input.target as string,
          goal: input.goal as 'dm' | 'engagement' | 'follower' | 'branding',
          platform: input.platform as 'x' | 'tiktok' | 'instagram',
          count: input.count as number,
        });
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      case 'ask_strategy_planner': {
        const { runStrategyPlanner } = await import('./sub-agents');
        const period = (input.period as 'weekly' | 'monthly') || 'weekly';
        const result = await runStrategyPlanner(period, {
          goal: input.goal as string,
          businessType: input.businessType as 'liver-agency' | 'chat-lady',
          currentSituation: input.currentSituation as string,
        });
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      case 'ask_reverse_planner': {
        const { runReversePlanner } = await import('./sub-agents');
        const goalType = (input.goalType as 'dm' | 'follower' | 'impression' | 'engagement') || 'dm';
        const targetNumber = (input.targetNumber as number) || 30;
        const period = (input.period as 'weekly' | 'monthly') || 'monthly';
        const result = await runReversePlanner(goalType, targetNumber, period);
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      case 'ask_benefit_mapper': {
        const { runBenefitMapper } = await import('./sub-agents');
        const target = input.target as string;
        if (!target) {
          return JSON.stringify({ error: 'target（ターゲット）が必要です' });
        }
        const businessType = (input.businessType as 'liver-agency' | 'chat-lady') || 'liver-agency';
        const result = await runBenefitMapper(target, businessType);
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      case 'ask_multi_source_scout': {
        const { runMultiSourceScout } = await import('./sub-agents');
        const topic = input.topic as string;
        if (!topic) {
          return JSON.stringify({ error: 'topic（調査テーマ）が必要です' });
        }
        const sources = input.sources as ('x' | 'note' | 'google' | 'qa' | 'all')[];
        const result = await runMultiSourceScout(topic, sources);
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      case 'ask_cross_industry_scout': {
        const { runCrossIndustryScout } = await import('./sub-agents');
        const topic = input.topic as string;
        if (!topic) {
          return JSON.stringify({ error: 'topic（テーマ）が必要です' });
        }
        const industries = input.industries as string[];
        const result = await runCrossIndustryScout(topic, industries);
        return JSON.stringify({
          success: result.success,
          output: result.output,
          data: result.data,
        }, null, 2);
      }

      // ========================================
      // 自動化サブエージェント
      // ========================================

      case 'scraper_analyze_profile': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('scraper_analyze_profile', {
          platform: input.platform,
          analysisType: input.analysisType,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'scraper_get_trending': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('scraper_get_trending', {
          platform: input.platform,
          category: input.category,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'chrome_scrape_page': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('chrome_scrape_page', {
          url: input.url,
          selector: input.selector,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'chrome_take_screenshot': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('chrome_take_screenshot', {
          url: input.url,
          fullPage: input.fullPage,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'chrome_schedule_scrape': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('chrome_schedule_scrape', {
          url: input.url,
          interval: input.interval,
          selector: input.selector,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'analytics_generate_report': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('analytics_generate_report', {
          period: input.period,
          metrics: input.metrics,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'analytics_get_insights': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('analytics_get_insights', {
          category: input.category,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'automation_create_schedule': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('automation_create_schedule', {
          account: input.account,
          times: input.times,
          postsPerDay: input.postsPerDay,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'automation_create_trigger': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('automation_create_trigger', {
          event: input.event,
          action: input.action,
        });
        return JSON.stringify(result, null, 2);
      }

      case 'automation_list': {
        const { executeSubAgentTool } = await import('./sub-agents/index');
        const result = await executeSubAgentTool('automation_list_automations', {
          type: input.type,
        });
        return JSON.stringify(result, null, 2);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ========================================
// Agent 実行
// ========================================

const SYSTEM_PROMPT = `あなたは「番頭」です。SNSマーケティング事務所のCOO（最高執行責任者）として、社長の右腕を務めています。

【あなたの立場】
- 社長（ユーザー）の指示を受けて現場を仕切る番頭
- 品質管理の最終責任者（80点以下の投稿は許さない）
- CMOとCreativeを部下として指揮
- 数字と結果にこだわる完璧主義者
- 社長の右腕として、細かいことは任せてもらっている

【性格・話し方】
- 敬語だが堅すぎない、頼れる番頭口調
- 「〜でございます」ではなく「〜です」「〜ですね」
- 問題があれば率直に報告、解決策も一緒に提示
- 社長の意図を汲み取って先回りして動く
- 褒める時は素直に、指摘する時は建設的に

【チーム構成（19名のサブエージェント）】
- CMO（部下）: マーケティング戦略・トレンド分析担当
- Creative（部下）: 投稿文の生成担当
- 自分（COO/番頭）: 品質管理・現場統括
- SEOスペシャリスト: キーワード分析・記事構成
- アフィリエイトマネージャー: 収益化・商品マッチング
- DM対応スペシャリスト: 問い合わせ返信文作成
- トレンドアナリスト: 市場調査・バズ予測
- 動画ディレクター: ショート動画台本作成
- PDCAアナリスト: データ分析・改善提案・仮説検証
- 業界エキスパート: ライバー/チャトレ業界の専門知識
- リサーチャー: ターゲットインサイト・市場調査の徹底リサーチ
- コピーライター: 心を動かすコピー・フック・CTAの作成
- 共感者（エンパサイザー）: ターゲットの悩み・不安・深層心理を理解
★新規追加★
- 投稿パターンマスター: 100通り以上の投稿型・テンプレート・フォーマットを熟知
- 投稿戦略プランナー: 週間・月間の投稿計画を逆算して設計
- 逆算プランナー: 目標から逆算してKPI・必要投稿数を計算
- ベネフィットマッパー: ターゲットのあらゆるメリット・ベネフィットを網羅的に洗い出し
- マルチソーススカウト: note・各SNS・Google検索・Q&Aサイトからネタ・トレンドを収集
- 異業界スカウト: 他業界の成功事例・手法を発見してライバー/チャトレに応用

【社長への対応方針】
- 「承知しました」と即座に動く
- 数字で報告、結果で証明
- 問題は隠さず報告し、解決策もセットで
- 社長の気づきは「さすがです」と受け止めて即学習
- 目標達成に向けて常に逆算して動く
- 適切なサブエージェントに仕事を振る
- PDCAを回して継続的に改善

【ツール使用ガイド】
- 現状報告 → get_stats, get_posts
- 目標管理 → get_goals, set_goal, update_goal_progress
- チーム指揮 → delegate_team（CMO→Creative→自分でレビュー）
- 社長の気づきを学習 → learn_insight
- 部下に相談:
  - ask_cmo: マーケティング戦略
  - ask_creative: 投稿文生成
  - ask_coo: 品質チェック
  - ask_seo: SEO分析・キーワード提案
  - ask_affiliate: 収益化・アフィリエイト提案
  - ask_dm_responder: DM返信文作成
  - ask_trend_analyst: トレンド分析
  - ask_video_director: 動画台本作成
  - ask_pdca_analyst: PDCA分析・改善提案
  - ask_knowledge_expert: 業界の専門知識に基づく回答
  - ask_researcher: ターゲット・市場の徹底リサーチ
  - ask_copywriter: 心を動かすコピー作成
  - ask_empathizer: ターゲットの深層心理分析
  ★新規追加★
  - ask_post_pattern_master: 100通りの投稿パターン・型から最適なものを提案
  - ask_strategy_planner: 週間・月間の投稿戦略・スケジュールを設計
  - ask_reverse_planner: 目標数値から逆算して必要KPIを算出
  - ask_benefit_mapper: ターゲットのベネフィットを網羅的に洗い出し
  - ask_multi_source_scout: note・SNS・検索からネタ・トレンドを収集
  - ask_cross_industry_scout: 他業界の成功事例を発見して応用
- 競合分析 → analyze_competitors
- 記事作成 → create_optimized_article（SEO+トレンド+アフィリエイトを統合）
- チーム確認 → list_agents

【バトンリレー型オーケストレーション】★重要★
エージェント間でJSONデータをバトンとして渡し、より深いアウトプットを生成:
- content_relay: リサーチャー→共感者→コピーライター→COOの連携でコンテンツ作成
- dm_relay: 共感者→業界エキスパート→DM対応→COOの連携でDM返信作成
- custom_relay: 任意のエージェント順序でバトンを渡す

【部署（クラスター）管理】
エージェントは6つの部署に所属:
- executive（経営陣）: COO, CMO, 投稿戦略プランナー, 逆算プランナー
- marketing（マーケティング部）: CMO, トレンドアナリスト, リサーチャー, マルチソーススカウト, 異業界スカウト
- creative（クリエイティブ部）: Creative, コピーライター, 動画ディレクター, 投稿パターンマスター
- operations（運用部）: SEO, アフィリエイト
- analytics（分析部）: PDCAアナリスト, 業界エキスパート, ベネフィットマッパー
- customer（顧客対応部）: DM対応, 共感者

部署管理ツール:
- get_clusters: 全部署一覧
- get_cluster_agents: 特定部署のメンバー一覧

【投稿の重複・類似チェック】★新機能★
似たような投稿やテーマのかぶりを防ぐ:
- check_similarity: 新しい投稿文が既存と類似していないかチェック
- get_variation_status: テーマの使用状況・バリエーションを確認

【自動化サブエージェント】★完全自動化★
データ収集・分析・自動化を担当するサブエージェント群:

■ スクレイパーエージェント
- scraper_analyze_profile: Stripchat/DXLiveのプロフィール画像を分析
- scraper_get_trending: 配信プラットフォームのトレンドを取得

■ Chrome拡張エージェント
- chrome_scrape_page: URLのページ内容をスクレイピング
- chrome_take_screenshot: URLのスクリーンショットを撮影
- chrome_schedule_scrape: 定期スクレイピングをスケジュール

■ アナリティクスエージェント
- analytics_generate_report: パフォーマンスレポートを生成
- analytics_get_insights: インサイトを抽出（最適投稿時間、ベストコンテンツなど）

■ 自動化エージェント
- automation_create_schedule: 投稿スケジュールを作成
- automation_create_trigger: イベントトリガーを設定（DM受信→通知など）
- automation_list: 設定済みの自動化一覧を確認

【社長のビジョン】
「見る」のはプログラム、「考える」のはAI。
完全自動化を目指し、AIを活用して大企業を経営する。

日本語で簡潔に、番頭らしく回答してください。`;

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Function Callingのツール定義
const functionDeclarations = [
  {
    name: 'get_stats',
    description: '現在の投稿統計を取得（今日の投稿数、インプレッション、DM数など）',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        period: {
          type: SchemaType.STRING,
          description: '取得期間: today, week, month',
        },
      },
    },
  },
  {
    name: 'get_posts',
    description: '最近の投稿一覧を取得',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: '取得件数（デフォルト10）',
        },
        status: {
          type: SchemaType.STRING,
          description: '投稿ステータス: all, posted, pending',
        },
      },
    },
  },
  {
    name: 'get_knowledge',
    description: 'ナレッジベースの情報を取得（成功パターン、フック、CTAなど）',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          description: '取得するナレッジの種類: patterns, hooks, cta, all',
        },
      },
    },
  },
  {
    name: 'update_knowledge',
    description: 'ナレッジベースに新しいパターンを追加',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          description: '追加するナレッジの種類: hook, cta, pattern',
        },
        content: {
          type: SchemaType.STRING,
          description: '追加する内容',
        },
        score: {
          type: SchemaType.NUMBER,
          description: '効果スコア（1-10）',
        },
      },
      required: ['type', 'content'],
    },
  },
  {
    name: 'generate_post',
    description: '新しい投稿を生成',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        target: {
          type: SchemaType.STRING,
          description: 'ターゲット層',
        },
        benefit: {
          type: SchemaType.STRING,
          description: '訴求するベネフィット',
        },
      },
      required: ['target', 'benefit'],
    },
  },
  {
    name: 'analyze_performance',
    description: '投稿パフォーマンスを分析して改善点を特定',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        focus: {
          type: SchemaType.STRING,
          description: '分析の焦点: hooks, targets, timing, overall',
        },
      },
    },
  },
  // ========================================
  // ファイル操作ツール (Claude Code風)
  // ========================================
  {
    name: 'read_file',
    description: 'ファイルの内容を読み取る',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path: {
          type: SchemaType.STRING,
          description: '読み取るファイルのパス（相対パスまたは絶対パス）',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'ファイルに内容を書き込む（新規作成または上書き）',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path: {
          type: SchemaType.STRING,
          description: '書き込むファイルのパス',
        },
        content: {
          type: SchemaType.STRING,
          description: '書き込む内容',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'ファイル内のテキストを置換して編集する',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path: {
          type: SchemaType.STRING,
          description: '編集するファイルのパス',
        },
        old_text: {
          type: SchemaType.STRING,
          description: '置換する元のテキスト',
        },
        new_text: {
          type: SchemaType.STRING,
          description: '置換後の新しいテキスト',
        },
      },
      required: ['path', 'old_text', 'new_text'],
    },
  },
  {
    name: 'list_files',
    description: 'ディレクトリ内のファイル一覧を取得',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path: {
          type: SchemaType.STRING,
          description: 'ディレクトリのパス（デフォルト: .）',
        },
      },
    },
  },
  {
    name: 'search_files',
    description: 'ファイル内のテキストを検索',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: '検索するテキスト',
        },
        path: {
          type: SchemaType.STRING,
          description: '検索開始ディレクトリ（デフォルト: .）',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_command',
    description: 'シェルコマンドを実行（npm, git, node などの安全なコマンドのみ）',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        command: {
          type: SchemaType.STRING,
          description: '実行するコマンド',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'web_search',
    description: 'Web検索を実行して最新情報を取得（Google検索）',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: '検索クエリ',
        },
      },
      required: ['query'],
    },
  },
  // ========================================
  // 目標管理ツール
  // ========================================
  {
    name: 'set_goal',
    description: '目標を設定する（例: 今月30件DM）。自然言語でも設定可能。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        text: {
          type: SchemaType.STRING,
          description: '自然言語での目標（例: "今月30件DM", "今週10件問い合わせ"）',
        },
        type: {
          type: SchemaType.STRING,
          description: '目標タイプ: dm, impression, engagement, follower, post',
        },
        target: {
          type: SchemaType.NUMBER,
          description: '目標数値',
        },
        period: {
          type: SchemaType.STRING,
          description: '期間: daily, weekly, monthly',
        },
      },
    },
  },
  {
    name: 'get_goals',
    description: '現在の目標と進捗状況を取得。達成率、残り日数、必要ペースを計算。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'update_goal_progress',
    description: '目標の進捗を更新（DMが来たら+1など）',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          description: '目標タイプ: dm, impression, engagement, follower, post',
        },
        value: {
          type: SchemaType.NUMBER,
          description: '新しい値（絶対値で設定）',
        },
        increment: {
          type: SchemaType.NUMBER,
          description: '増分（現在値に加算）',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'get_goal_strategy',
    description: '目標達成のための戦略を生成。遅れている場合は自動で改善案を提案。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  // ========================================
  // サブエージェント連携ツール
  // ========================================
  {
    name: 'delegate_team',
    description: 'CMO/COO/Creativeチームに指示を出して自動連携実行。フルパイプライン（戦略→生成→品質チェック）を実行。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        directive: {
          type: SchemaType.STRING,
          description: 'CEOからの指示（例: "今月30件DM取れるような投稿を作れ"）',
        },
      },
      required: ['directive'],
    },
  },
  {
    name: 'learn_insight',
    description: 'CEOの気づき・フィードバックを学習してナレッジに追加。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        insight: {
          type: SchemaType.STRING,
          description: 'CEOの気づき（例: "このフックが効いた", "この時間帯は反応悪い"）',
        },
      },
      required: ['insight'],
    },
  },
  {
    name: 'ask_cmo',
    description: 'CMO（マーケティング責任者）に戦略を相談。トレンド調査、ターゲット分析など。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        question: {
          type: SchemaType.STRING,
          description: 'CMOへの質問',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'ask_creative',
    description: 'Creative（クリエイター）に投稿を生成させる。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        brief: {
          type: SchemaType.STRING,
          description: '生成の指示（戦略、ターゲットなど）',
        },
        count: {
          type: SchemaType.NUMBER,
          description: '生成数（デフォルト3）',
        },
      },
      required: ['brief'],
    },
  },
  {
    name: 'ask_coo',
    description: 'COO（品質管理）に投稿をレビューさせる。80点以下はリテイク指示。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        content: {
          type: SchemaType.STRING,
          description: 'レビュー対象の投稿',
        },
      },
      required: ['content'],
    },
  },
  // ========================================
  // 動画生成ツール（Analyst + Video Producer）
  // ========================================
  {
    name: 'check_buzz',
    description: 'バズ投稿をチェック。インプ1,000+の投稿を検出し、動画化候補として表示。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'create_video',
    description: 'バズ投稿から動画を生成。台本生成→HeyGenでアバター動画化。月10本まで無料。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        buzzPostId: {
          type: SchemaType.STRING,
          description: '動画化するバズ投稿のID（省略時は最もスコアの高いものを選択）',
        },
      },
    },
  },
  {
    name: 'video_status',
    description: '動画生成の状況確認。HeyGen残り枠、生成済み台本数、バズ検知数など。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  // ========================================
  // 新サブエージェントツール
  // ========================================
  {
    name: 'ask_seo',
    description: 'SEOスペシャリストにキーワード分析・記事構成を依頼。WordPress記事のSEO最適化。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic: {
          type: SchemaType.STRING,
          description: '分析したいテーマ・キーワード',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'ask_affiliate',
    description: 'アフィリエイトマネージャーに収益化提案を依頼。商品マッチング、ASP選定など。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        articleTopic: {
          type: SchemaType.STRING,
          description: '記事テーマ',
        },
        targetAudience: {
          type: SchemaType.STRING,
          description: 'ターゲット層（例: ライバー志望者、チャトレ志望者）',
        },
      },
      required: ['articleTopic'],
    },
  },
  {
    name: 'ask_dm_responder',
    description: 'DM対応スペシャリストに返信文作成を依頼。問い合わせへの適切な返信を生成。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        message: {
          type: SchemaType.STRING,
          description: '受信したDMの内容',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
        stage: {
          type: SchemaType.STRING,
          description: '対応ステージ: initial（初回）, followup（フォロー）, closing（クロージング）',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'ask_trend_analyst',
    description: 'トレンドアナリストに市場調査を依頼。SNSトレンド、業界動向、バズ予測など。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
        focusArea: {
          type: SchemaType.STRING,
          description: '特に調査したい領域（省略可）',
        },
      },
    },
  },
  {
    name: 'ask_video_director',
    description: '動画ディレクターにショート動画の台本作成を依頼。TikTok/Reels向け。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic: {
          type: SchemaType.STRING,
          description: '動画のテーマ',
        },
        duration: {
          type: SchemaType.NUMBER,
          description: '動画の長さ（秒）。デフォルト30秒。',
        },
        style: {
          type: SchemaType.STRING,
          description: 'スタイル: educational（教育系）, testimonial（体験談）, promotional（宣伝）',
        },
        platform: {
          type: SchemaType.STRING,
          description: 'プラットフォーム: tiktok, reels, youtube_shorts',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'create_optimized_article',
    description: 'SEO・トレンド・アフィリエイトを統合した最適化記事を企画。複数エージェントが並行して分析。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic: {
          type: SchemaType.STRING,
          description: '記事のテーマ',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'list_agents',
    description: '利用可能なサブエージェント一覧を表示。各エージェントの名前と役割を確認。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'ask_pdca_analyst',
    description: 'PDCAアナリストにデータ分析・改善提案を依頼。投稿の成功パターン分析、仮説検証、KPI追跡。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        analysisType: {
          type: SchemaType.STRING,
          description: '分析種別: daily（日次）, weekly（週次）, monthly（月次）, custom（カスタム）',
        },
        focusArea: {
          type: SchemaType.STRING,
          description: '特にフォーカスする領域（省略可）',
        },
        hypothesis: {
          type: SchemaType.STRING,
          description: '検証したい仮説（省略可）',
        },
      },
    },
  },
  {
    name: 'ask_knowledge_expert',
    description: '業界エキスパートに専門知識を質問。ライバー/チャトレ業界の深い知識に基づく回答。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        question: {
          type: SchemaType.STRING,
          description: '質問内容',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'analyze_competitors',
    description: '競合分析を実行。他事務所のSNS運用パターン、差別化ポイント、学ぶべき点を分析。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
        focusAreas: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: '分析のフォーカス領域（例: SNS運用, 訴求ポイント）',
        },
      },
    },
  },
  // ========================================
  // 新エージェント: リサーチャー・コピーライター・共感者
  // ========================================
  {
    name: 'ask_researcher',
    description: 'リサーチャーにターゲット・市場の徹底リサーチを依頼。ペルソナ分析、競合調査、トレンド調査など。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic: {
          type: SchemaType.STRING,
          description: '調査テーマ',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'ask_copywriter',
    description: 'コピーライターに心を動かすコピーの作成を依頼。フック、本文、CTAを含む複数パターンを生成。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        brief: {
          type: SchemaType.STRING,
          description: 'コピー作成のブリーフ（ターゲット、訴求ポイント、トーンなど）',
        },
        platform: {
          type: SchemaType.STRING,
          description: 'プラットフォーム: x, tiktok, instagram',
        },
        tone: {
          type: SchemaType.STRING,
          description: 'トーン: casual, professional, empathetic',
        },
        count: {
          type: SchemaType.NUMBER,
          description: '生成パターン数（デフォルト3）',
        },
      },
      required: ['brief'],
    },
  },
  {
    name: 'ask_empathizer',
    description: '共感者（エンパサイザー）にターゲットの深層心理分析を依頼。表層→中層→深層の悩み構造、共感ポイント、行動トリガーを分析。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        target: {
          type: SchemaType.STRING,
          description: 'ターゲットの描写（例: "30代主婦で副業を探している"）',
        },
        focusArea: {
          type: SchemaType.STRING,
          description: '特にフォーカスする領域（省略可）',
        },
      },
      required: ['target'],
    },
  },
  // ========================================
  // バトンリレー型オーケストレーション
  // ========================================
  {
    name: 'content_relay',
    description: '【バトンリレー】リサーチャー→共感者→コピーライター→COOの連携でコンテンツを作成。各エージェントがJSONバトンを渡して深いアウトプットを生成。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic: {
          type: SchemaType.STRING,
          description: 'コンテンツのテーマ',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
        targetAudience: {
          type: SchemaType.STRING,
          description: 'ターゲット層（省略可）',
        },
        platform: {
          type: SchemaType.STRING,
          description: 'プラットフォーム: x, tiktok, instagram',
        },
        contentType: {
          type: SchemaType.STRING,
          description: 'コンテンツタイプ: recruitment（採用）, branding（ブランディング）, engagement（エンゲージメント向上）',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'dm_relay',
    description: '【バトンリレー】共感者→業界エキスパート→DM対応→COOの連携でDM返信を作成。相手の心理分析から専門知識、返信文作成、品質チェックまで一貫処理。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        message: {
          type: SchemaType.STRING,
          description: '受信したDMの内容',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
        previousMessages: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: '過去のやり取り（省略可）',
        },
        senderProfile: {
          type: SchemaType.STRING,
          description: '送信者のプロフィール情報（省略可）',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'custom_relay',
    description: '【カスタムバトンリレー】任意のエージェント順序でバトンを渡して処理。柔軟なワークフロー構築が可能。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sequence: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'エージェントIDの配列（例: ["researcher", "empathizer", "copywriter", "coo"]）',
        },
        task: {
          type: SchemaType.STRING,
          description: '最初のエージェントへのタスク',
        },
      },
      required: ['sequence', 'task'],
    },
  },
  // ========================================
  // クラスター管理・重複チェックツール
  // ========================================
  {
    name: 'get_clusters',
    description: '部署（クラスター）一覧を取得。エージェントがどの部署に所属しているかを確認。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_cluster_agents',
    description: '特定の部署に所属するエージェント一覧を取得。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        clusterId: {
          type: SchemaType.STRING,
          description: '部署ID: executive（経営陣）, marketing（マーケティング部）, creative（クリエイティブ部）, operations（運用部）, analytics（分析部）, customer（顧客対応部）',
        },
      },
      required: ['clusterId'],
    },
  },
  {
    name: 'check_similarity',
    description: '投稿文の重複・類似チェック。過去の投稿と比較して、似たような投稿がないかを確認。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        text: {
          type: SchemaType.STRING,
          description: 'チェックする投稿文',
        },
        threshold: {
          type: SchemaType.NUMBER,
          description: '類似度の閾値（0-1）。デフォルト0.4（40%以上で類似と判定）',
        },
        checkDays: {
          type: SchemaType.NUMBER,
          description: 'チェックする過去日数。デフォルト7日間',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_variation_status',
    description: 'テーマ・型のバリエーション状況を確認。使いすぎ/未使用のテーマを把握し、新鮮な投稿を維持。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  // ========================================
  // 新エージェント: 投稿型マスター・戦略プランナー等
  // ========================================
  {
    name: 'ask_post_pattern_master',
    description: '投稿パターンマスターに最適な投稿型を提案してもらう。100通り以上のパターンから目的に合った型を選定。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        theme: {
          type: SchemaType.STRING,
          description: '投稿のテーマ',
        },
        target: {
          type: SchemaType.STRING,
          description: 'ターゲット層（例: 30代主婦）',
        },
        goal: {
          type: SchemaType.STRING,
          description: '目的: dm, engagement, follower, branding',
        },
        platform: {
          type: SchemaType.STRING,
          description: 'プラットフォーム: x, tiktok, instagram',
        },
        count: {
          type: SchemaType.NUMBER,
          description: '提案するパターン数（デフォルト5）',
        },
      },
      required: ['theme'],
    },
  },
  {
    name: 'ask_strategy_planner',
    description: '投稿戦略プランナーに週間/月間の投稿戦略を設計してもらう。曜日・時間帯ごとの最適な投稿計画。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        period: {
          type: SchemaType.STRING,
          description: '計画期間: weekly（週間）, monthly（月間）',
        },
        goal: {
          type: SchemaType.STRING,
          description: '目標（例: 月30件DM）',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
        currentSituation: {
          type: SchemaType.STRING,
          description: '現状の説明（省略可）',
        },
      },
    },
  },
  {
    name: 'ask_reverse_planner',
    description: '逆算プランナーに目標達成のための逆算戦略を設計してもらう。必要な投稿数・品質を数字で算出。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        goalType: {
          type: SchemaType.STRING,
          description: '目標タイプ: dm, follower, impression, engagement',
        },
        targetNumber: {
          type: SchemaType.NUMBER,
          description: '目標数値（例: 30）',
        },
        period: {
          type: SchemaType.STRING,
          description: '期間: weekly, monthly',
        },
      },
    },
  },
  {
    name: 'ask_benefit_mapper',
    description: 'ベネフィットマッパーにターゲットにとってのメリットを網羅的に洗い出してもらう。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        target: {
          type: SchemaType.STRING,
          description: 'ターゲットの描写（例: 30代主婦、副業を探している）',
        },
        businessType: {
          type: SchemaType.STRING,
          description: 'ビジネスタイプ: liver-agency または chat-lady',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'ask_multi_source_scout',
    description: 'マルチソーススカウトにnote、各SNS、Google検索など複数ソースから情報収集してもらう。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic: {
          type: SchemaType.STRING,
          description: '調査テーマ',
        },
        sources: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: '調査ソース: x, note, google, qa, all',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'ask_cross_industry_scout',
    description: '異業界スカウトに他業界から転用可能なアイデアを発見してもらう。新鮮な切り口を獲得。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic: {
          type: SchemaType.STRING,
          description: 'テーマ',
        },
        industries: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: '参考にする業界（例: 転職、美容、副業）',
        },
      },
      required: ['topic'],
    },
  },
  // ========================================
  // 自動化サブエージェント
  // ========================================
  {
    name: 'scraper_analyze_profile',
    description: '【スクレイパー】配信サイト（Stripchat/DXLive）のプロフィールを画像から分析。チップメニュー、Lovense設定などを解析。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        platform: {
          type: SchemaType.STRING,
          description: 'プラットフォーム: stripchat, dxlive, chaturbate',
        },
        analysisType: {
          type: SchemaType.STRING,
          description: '分析タイプ: tip_menu, profile, lovense, full',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'scraper_get_trending',
    description: '【スクレイパー】配信プラットフォームのトレンド情報（トップ配信者、人気タグなど）を取得。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        platform: {
          type: SchemaType.STRING,
          description: 'プラットフォーム: stripchat, dxlive, chaturbate',
        },
        category: {
          type: SchemaType.STRING,
          description: 'カテゴリ: top_earners, new_models, trending, tags',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'chrome_scrape_page',
    description: '【Chrome拡張】指定URLのページ内容をスクレイピング。Chrome拡張機能と連携。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: {
          type: SchemaType.STRING,
          description: 'スクレイピング対象のURL',
        },
        selector: {
          type: SchemaType.STRING,
          description: '抽出するCSSセレクター（省略時はページ全体）',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'chrome_take_screenshot',
    description: '【Chrome拡張】指定URLのスクリーンショットを撮影。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: {
          type: SchemaType.STRING,
          description: 'スクリーンショット対象のURL',
        },
        fullPage: {
          type: SchemaType.STRING,
          description: 'フルページスクリーンショット（true/false）',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'chrome_schedule_scrape',
    description: '【Chrome拡張】定期スクレイピングをスケジュール。特定URLのデータを定期的に収集。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: {
          type: SchemaType.STRING,
          description: 'スクレイピング対象のURL',
        },
        interval: {
          type: SchemaType.STRING,
          description: '実行間隔: hourly, daily, weekly',
        },
        selector: {
          type: SchemaType.STRING,
          description: '抽出するCSSセレクター',
        },
      },
      required: ['url', 'interval'],
    },
  },
  {
    name: 'analytics_generate_report',
    description: '【アナリティクス】指定期間のパフォーマンスレポートを生成。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        period: {
          type: SchemaType.STRING,
          description: 'レポート期間: today, week, month, custom',
        },
        metrics: {
          type: SchemaType.STRING,
          description: '含めるメトリクス（カンマ区切り）',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'analytics_get_insights',
    description: '【アナリティクス】データからインサイトを抽出。投稿最適時間、ベストコンテンツなどを分析。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: {
          type: SchemaType.STRING,
          description: 'インサイトカテゴリ: best_time, best_content, audience, improvement',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'automation_create_schedule',
    description: '【自動化】投稿スケジュールを作成。指定時間に自動投稿。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        account: {
          type: SchemaType.STRING,
          description: '対象アカウント: liver, chatre1, chatre2, all',
        },
        times: {
          type: SchemaType.STRING,
          description: '投稿時間（カンマ区切り、例: 09:00,12:00,19:00）',
        },
        postsPerDay: {
          type: SchemaType.STRING,
          description: '1日の投稿数',
        },
      },
      required: ['account'],
    },
  },
  {
    name: 'automation_create_trigger',
    description: '【自動化】イベントトリガーを設定。特定イベント発生時に自動アクション。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        event: {
          type: SchemaType.STRING,
          description: 'トリガーイベント: dm_received, mention, follower, engagement_spike, low_stock',
        },
        action: {
          type: SchemaType.STRING,
          description: '実行アクション: notify, generate_post, send_dm, run_analysis',
        },
      },
      required: ['event', 'action'],
    },
  },
  {
    name: 'automation_list',
    description: '【自動化】設定済みの自動化一覧を取得。スケジュール、トリガー、バッチ処理を確認。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          description: 'フィルタタイプ: all, schedule, trigger, batch',
        },
      },
    },
  },
];

// イベントタイプ
export interface AgentEvent {
  type: 'thinking' | 'tool_start' | 'tool_end' | 'comment' | 'response' | 'done' | 'error';
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export async function chat(
  userMessage: string,
  history: AgentMessage[] = []
): Promise<{
  response: string;
  toolsUsed: string[];
  history: AgentMessage[];
}> {
  const result = await chatWithEvents(userMessage, history);
  return result;
}

// ストリーミング対応のchat関数
export async function* chatStream(
  userMessage: string,
  history: AgentMessage[] = [],
  imageBase64?: string
): AsyncGenerator<AgentEvent> {
  const toolsUsed: string[] = [];

  try {
    yield { type: 'thinking', content: imageBase64 ? '画像を分析中...' : 'リクエストを分析中...' };

    // Geminiモデル初期化
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations }] as any,
    });

    // メッセージ履歴を構築
    const chatHistory = history.map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));

    // チャットセッション開始
    const chatSession = model.startChat({
      history: chatHistory,
    });

    yield { type: 'thinking', content: 'Gemini APIに接続中...' };

    // メッセージパーツを構築（テキスト + 画像）
    const messageParts: any[] = [];
    if (userMessage) {
      messageParts.push({ text: userMessage });
    }
    if (imageBase64) {
      // Base64画像をGemini形式に変換
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
      messageParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    // メッセージ送信
    let result = await chatSession.sendMessage(messageParts);
    let responseText = '';

    // Function Callingループ（最大5回）
    for (let i = 0; i < 5; i++) {
      const response = result.response;
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Function Callがあるか確認
      const functionCallParts = parts.filter((p) => 'functionCall' in p);
      if (functionCallParts.length === 0) {
        // テキストを収集
        for (const part of parts) {
          if ('text' in part && part.text) {
            responseText += part.text;
          }
        }
        break;
      }

      // Function Callを実行
      const functionResponseParts: any[] = [];
      for (const part of functionCallParts) {
        if ('functionCall' in part) {
          const fc = part.functionCall;
          if (!fc) continue;
          toolsUsed.push(fc.name);

          const fcArgs = (fc.args || {}) as Record<string, unknown>;

          // ツール実行開始を通知
          yield {
            type: 'tool_start',
            tool: fc.name,
            args: fcArgs,
            content: getToolComment(fc.name, fcArgs),
          };

          const toolResult = await executeTool(fc.name, fcArgs);
          const parsedResult = JSON.parse(toolResult);

          // ツール実行完了を通知
          yield {
            type: 'tool_end',
            tool: fc.name,
            result: parsedResult,
            content: getToolResultComment(fc.name, parsedResult),
          };

          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: { result: parsedResult },
            },
          });
        }
      }

      yield { type: 'thinking', content: 'ツールの結果を分析中...' };

      // Function Responseを送信
      result = await chatSession.sendMessage(functionResponseParts);
    }

    // 最終レスポンスからテキストを収集
    if (!responseText) {
      const finalResponse = result.response;
      const finalCandidate = finalResponse.candidates?.[0];
      const finalParts = finalCandidate?.content?.parts || [];
      for (const part of finalParts) {
        if ('text' in part && part.text) {
          responseText += part.text;
        }
      }
    }

    yield { type: 'response', content: responseText };

    // 完了
    yield {
      type: 'done',
      content: JSON.stringify({
        response: responseText || 'レスポンスを取得できませんでした',
        toolsUsed,
        history: [
          ...history,
          { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
          { role: 'assistant', content: responseText, timestamp: new Date().toISOString(), toolsUsed },
        ],
      }),
    };
  } catch (error: any) {
    console.error('[SNS Agent] Error:', error);
    yield { type: 'error', content: error.message };
  }
}

// ツール実行時のコメント生成
function getToolComment(tool: string, args: Record<string, unknown> | undefined): string {
  switch (tool) {
    case 'get_stats':
      return '📊 統計データを取得しています...';
    case 'get_posts':
      return `📝 投稿一覧を取得しています... (${args?.limit || 10}件)`;
    case 'get_knowledge':
      return '💡 ナレッジベースを参照しています...';
    case 'analyze_performance':
      return '📈 パフォーマンスを分析しています...';
    case 'read_file':
      return `📄 ファイルを読み取っています: ${args?.path}`;
    case 'write_file':
      return `✏️ ファイルを書き込んでいます: ${args?.path}`;
    case 'edit_file':
      return `🔧 ファイルを編集しています: ${args?.path}`;
    case 'list_files':
      return `📁 ディレクトリを参照しています: ${args?.path || '.'}`;
    case 'search_files':
      return `🔍 "${args?.query}" を検索しています...`;
    case 'run_command':
      return `⚡ コマンドを実行しています: ${args?.command}`;
    case 'generate_post':
      return `✨ 新しい投稿を生成しています... (ターゲット: ${args?.target})`;
    case 'web_search':
      return `🌐 Web検索中: "${args?.query}"`;
    case 'set_goal':
      return `🎯 目標を設定しています: ${args?.text || `${args?.target}件の${args?.type}`}`;
    case 'get_goals':
      return '📊 目標進捗を確認しています...';
    case 'update_goal_progress':
      return `📈 ${args?.type}の進捗を更新しています...`;
    case 'get_goal_strategy':
      return '🧠 目標達成戦略を生成しています...';
    case 'delegate_team':
      return `👥 チームに指示中: "${(args?.directive as string)?.slice(0, 30)}..."`;
    case 'learn_insight':
      return `📚 学習中: "${(args?.insight as string)?.slice(0, 30)}..."`;
    case 'ask_cmo':
      return '📊 CMOに戦略を相談中...';
    case 'ask_creative':
      return '✨ Creativeに生成を依頼中...';
    case 'ask_coo':
      return '🔍 COOに品質チェックを依頼中...';
    case 'check_buzz':
      return '🔥 バズ投稿をチェック中...';
    case 'create_video':
      return '🎬 動画を生成中（台本作成→HeyGen）...';
    case 'video_status':
      return '📹 動画生成の状況を確認中...';
    case 'ask_seo':
      return `🔍 SEOスペシャリストに分析依頼中: "${args?.topic}"`;
    case 'ask_affiliate':
      return `💰 アフィリエイトマネージャーに収益化提案依頼中...`;
    case 'ask_dm_responder':
      return `💬 DM対応スペシャリストに返信文作成依頼中...`;
    case 'ask_trend_analyst':
      return `📈 トレンドアナリストに市場調査依頼中...`;
    case 'ask_video_director':
      return `🎥 動画ディレクターに台本作成依頼中: "${args?.topic}"`;
    case 'create_optimized_article':
      return `📝 最適化記事を企画中（SEO+トレンド+収益化）: "${args?.topic}"`;
    case 'list_agents':
      return '👥 サブエージェント一覧を取得中...';
    case 'ask_pdca_analyst':
      return `📊 PDCAアナリストにデータ分析依頼中（${args?.analysisType || 'weekly'}）...`;
    case 'ask_knowledge_expert':
      return `📚 業界エキスパートに質問中: "${(args?.question as string)?.slice(0, 30)}..."`;
    case 'analyze_competitors':
      return `🔍 競合分析を実行中...`;
    case 'ask_researcher':
      return `🔬 リサーチャーに調査依頼中: "${args?.topic}"`;
    case 'ask_copywriter':
      return `✍️ コピーライターにコピー作成依頼中...`;
    case 'ask_empathizer':
      return `💭 共感者にターゲット心理分析依頼中...`;
    case 'content_relay':
      return `🔄 バトンリレー開始: リサーチャー→共感者→コピーライター→COO`;
    case 'dm_relay':
      return `🔄 DMリレー開始: 共感者→エキスパート→DM対応→COO`;
    case 'custom_relay':
      return `🔄 カスタムリレー開始: ${(args?.sequence as string[])?.join('→') || ''}`;
    case 'get_clusters':
      return '🏢 部署一覧を取得中...';
    case 'get_cluster_agents':
      return `🏢 ${args?.clusterId} 部署のエージェント一覧を取得中...`;
    case 'check_similarity':
      return '🔍 投稿の重複・類似チェック中...';
    case 'get_variation_status':
      return '📊 テーマ・型のバリエーション状況を確認中...';
    case 'ask_post_pattern_master':
      return `📋 投稿パターンマスターに最適な型を相談中: "${args?.theme}"`;
    case 'ask_strategy_planner':
      return `📅 投稿戦略プランナーに${args?.period || 'weekly'}計画を依頼中...`;
    case 'ask_reverse_planner':
      return `🎯 逆算プランナーに目標から必要KPIを算出依頼中: ${args?.targetNumber}件`;
    case 'ask_benefit_mapper':
      return `💎 ベネフィットマッパーにターゲットのメリット洗い出し依頼中: "${args?.target}"`;
    case 'ask_multi_source_scout':
      return `🔍 マルチソーススカウトにネタ収集依頼中: "${args?.topic}"`;
    case 'ask_cross_industry_scout':
      return `🌐 異業界スカウトに成功事例探索依頼中: "${args?.topic}"`;
    default:
      return `🔧 ${tool} を実行しています...`;
  }
}

// ツール結果のコメント生成
function getToolResultComment(tool: string, result: any): string {
  if (result.error) {
    return `❌ エラー: ${result.error}`;
  }

  switch (tool) {
    case 'get_stats':
      return `✅ 統計取得完了 (投稿数: ${result.totalPosts || 0})`;
    case 'get_posts':
      return `✅ ${Array.isArray(result) ? result.length : 0}件の投稿を取得`;
    case 'read_file':
      return `✅ ${result.lines || 0}行のファイルを読み取り`;
    case 'list_files':
      return `✅ ${result.total || 0}個のファイル/フォルダを発見`;
    case 'search_files':
      return `✅ ${result.total || 0}件の検索結果`;
    case 'run_command':
      return result.success ? '✅ コマンド実行完了' : `❌ ${result.error}`;
    case 'web_search':
      return result.success
        ? `✅ 検索完了 (${result.sources?.length || 0}件のソース)`
        : `❌ 検索失敗: ${result.error}`;
    case 'set_goal':
      return result.success ? `✅ 目標設定完了: ${result.message || ''}` : `❌ ${result.error}`;
    case 'get_goals':
      return `✅ ${result.goals?.length || 0}件の目標を取得`;
    case 'update_goal_progress':
      return result.success ? `✅ 進捗更新 (${result.goal?.current}/${result.goal?.target})` : `❌ ${result.error}`;
    case 'get_goal_strategy':
      return '✅ 戦略生成完了';
    case 'delegate_team':
      return result.success
        ? `✅ チーム完了 (${result.agentsUsed?.join('→') || 'CMO→Creative→COO'})`
        : `❌ チーム実行失敗`;
    case 'learn_insight':
      return result.success ? `✅ 学習完了: ${result.learned?.pattern || ''}` : '❌ 学習失敗';
    case 'ask_cmo':
      return result.success ? '✅ CMO回答完了' : '❌ CMOエラー';
    case 'ask_creative':
      return result.success ? '✅ Creative生成完了' : '❌ Creativeエラー';
    case 'ask_coo':
      return result.success ? '✅ COOレビュー完了' : '❌ COOエラー';
    case 'check_buzz':
      return `✅ バズ検知: ${result.pendingForScript || 0}件が動画化待ち`;
    case 'create_video':
      return result.success
        ? `✅ 動画生成開始 (残り${result.remaining || 0}本)`
        : `❌ ${result.error}`;
    case 'video_status':
      return `✅ HeyGen残り: ${result.heygen?.remaining || 0}本`;
    case 'ask_seo':
      return result.success ? '✅ SEO分析完了' : '❌ SEO分析エラー';
    case 'ask_affiliate':
      return result.success ? '✅ 収益化提案完了' : '❌ 収益化提案エラー';
    case 'ask_dm_responder':
      return result.success ? '✅ DM返信文作成完了' : '❌ DM返信文エラー';
    case 'ask_trend_analyst':
      return result.success ? '✅ トレンド分析完了' : '❌ トレンド分析エラー';
    case 'ask_video_director':
      return result.success ? '✅ 動画台本作成完了' : '❌ 動画台本エラー';
    case 'create_optimized_article':
      return result.success ? `✅ 記事企画完了 (KW: ${result.seoKeywords || ''})` : '❌ 記事企画エラー';
    case 'list_agents':
      return `✅ ${result.count || 0}名のエージェント`;
    case 'ask_pdca_analyst':
      return result.success ? '✅ PDCA分析完了' : '❌ PDCA分析エラー';
    case 'ask_knowledge_expert':
      return result.success ? '✅ 専門知識回答完了' : '❌ 専門知識回答エラー';
    case 'analyze_competitors':
      return result.success ? '✅ 競合分析完了' : '❌ 競合分析エラー';
    case 'ask_researcher':
      return result.success ? '✅ リサーチ完了' : '❌ リサーチエラー';
    case 'ask_copywriter':
      return result.success ? '✅ コピー作成完了' : '❌ コピー作成エラー';
    case 'ask_empathizer':
      return result.success ? '✅ 心理分析完了' : '❌ 心理分析エラー';
    case 'content_relay':
      return result.success
        ? `✅ バトンリレー完了 (${result.chain?.length || 4}ステップ, ${Math.round((result.duration || 0) / 1000)}秒)`
        : '❌ バトンリレーエラー';
    case 'dm_relay':
      return result.success
        ? `✅ DMリレー完了 (${result.chain?.length || 4}ステップ)`
        : '❌ DMリレーエラー';
    case 'custom_relay':
      return result.success
        ? `✅ カスタムリレー完了 (${result.chain?.length || 0}ステップ)`
        : '❌ カスタムリレーエラー';
    case 'get_clusters':
      return `✅ ${result.total || 0}部署を取得`;
    case 'get_cluster_agents':
      return `✅ ${result.cluster?.name || ''}: ${result.members?.length || 0}名`;
    case 'check_similarity':
      return result.isSimilar
        ? `⚠️ 類似投稿あり (${result.similarPosts?.length || 0}件)`
        : '✅ ユニークな投稿';
    case 'get_variation_status':
      return `✅ ${result.summary?.totalThemes || 0}テーマの状況を取得`;
    case 'ask_post_pattern_master':
      return result.success
        ? `✅ ${result.response?.recommendedPatterns?.length || 0}件のパターンを提案`
        : '❌ パターン提案エラー';
    case 'ask_strategy_planner':
      return result.success
        ? `✅ ${result.response?.totalSlots || 0}スロットの投稿計画を作成`
        : '❌ 戦略プランエラー';
    case 'ask_reverse_planner':
      return result.success
        ? `✅ 目標達成に必要なKPIを算出完了`
        : '❌ 逆算プランエラー';
    case 'ask_benefit_mapper':
      return result.success
        ? `✅ ${result.response?.totalBenefits || 0}件のベネフィットを発見`
        : '❌ ベネフィット分析エラー';
    case 'ask_multi_source_scout':
      return result.success
        ? `✅ ${result.response?.sources?.length || 0}ソースからネタを収集`
        : '❌ マルチソース調査エラー';
    case 'ask_cross_industry_scout':
      return result.success
        ? `✅ ${result.response?.industries?.length || 0}業界から事例を発見`
        : '❌ 異業界スカウトエラー';
    default:
      return result.success ? '✅ 完了' : '✅ 取得完了';
  }
}

// 非ストリーミング版（互換性のため）
async function chatWithEvents(
  userMessage: string,
  history: AgentMessage[] = []
): Promise<{
  response: string;
  toolsUsed: string[];
  history: AgentMessage[];
}> {
  const toolsUsed: string[] = [];

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations }] as any,
    });

    const chatHistory = history.map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));

    const chatSession = model.startChat({ history: chatHistory });
    let result = await chatSession.sendMessage(userMessage);
    let responseText = '';

    for (let i = 0; i < 5; i++) {
      const response = result.response;
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      const functionCallParts = parts.filter((p) => 'functionCall' in p);
      if (functionCallParts.length === 0) {
        for (const part of parts) {
          if ('text' in part && part.text) {
            responseText += part.text;
          }
        }
        break;
      }

      const functionResponseParts: any[] = [];
      for (const part of functionCallParts) {
        if ('functionCall' in part) {
          const fc = part.functionCall;
          if (!fc) continue;
          toolsUsed.push(fc.name);
          const fcArgs = (fc.args || {}) as Record<string, unknown>;
          const toolResult = await executeTool(fc.name, fcArgs);
          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: { result: JSON.parse(toolResult) },
            },
          });
        }
      }

      result = await chatSession.sendMessage(functionResponseParts);
    }

    if (!responseText) {
      const finalResponse = result.response;
      const finalCandidate = finalResponse.candidates?.[0];
      const finalParts = finalCandidate?.content?.parts || [];
      for (const part of finalParts) {
        if ('text' in part && part.text) {
          responseText += part.text;
        }
      }
    }

    const newHistory: AgentMessage[] = [
      ...history,
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
      { role: 'assistant', content: responseText, timestamp: new Date().toISOString(), toolsUsed },
    ];

    return {
      response: responseText || 'レスポンスを取得できませんでした',
      toolsUsed,
      history: newHistory,
    };
  } catch (error: any) {
    console.error('[SNS Agent] Error:', error);
    throw error;
  }
}

// ========================================
// 日次レポート生成
// ========================================

export async function generateDailyReport(): Promise<string> {
  const result = await chat(
    '今日の結果をまとめて報告してください。投稿数、効果的だったパターン、明日への提案を含めてください。'
  );
  return result.response;
}

// ========================================
// 自動分析・学習
// ========================================

export async function runAutoAnalysis(): Promise<string> {
  const result = await chat(
    'パフォーマンスを分析して、新しい発見があればナレッジに追加してください。改善提案もお願いします。'
  );
  return result.response;
}

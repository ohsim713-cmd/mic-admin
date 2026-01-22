/**
 * WordPress自動投稿 Cron ジョブ
 *
 * Twitterと同じ仕組みで記事を生成:
 * - 50%: self (過去の伸びた記事をリライト)
 * - 50%: transform (バズ記事を自分風に変換)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/model';
import { buildChatladyKnowledgeContext } from '@/lib/langgraph/knowledge-loader';

export const runtime = 'nodejs';
export const maxDuration = 120;

const SCHEDULES_FILE = path.join(process.cwd(), 'knowledge', 'wordpress_schedules.json');
const WP_CREDENTIALS_FILE = path.join(process.cwd(), 'knowledge', 'wordpress_credentials.json');
const WP_POST_LOG_FILE = path.join(process.cwd(), 'data', 'wordpress_post_log.json');
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

type WordPressSchedule = {
  id: string;
  enabled: boolean;
  intervalHours: number;
  keywords: string;
  targetLength: string;
  tone: string;
  publishStatus: 'draft' | 'publish';
  generateThumbnail: boolean;
  businessType?: 'chat-lady' | 'liver-agency';
  lastRun?: string;
  nextRun?: string;
  lastPostId?: number;
  lastPostTitle?: string;
  lastMode?: string;
};

type PostLogEntry = {
  id: string;
  scheduleId: string;
  postId: number;
  title: string;
  link: string;
  businessType: string;
  publishStatus: string;
  mode: string;
  createdAt: string;
};

function loadSchedules(): WordPressSchedule[] {
  try {
    if (!fs.existsSync(SCHEDULES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.schedules || [];
  } catch (e) {
    console.error('[WP-Cron] Failed to load schedules:', e);
    return [];
  }
}

function saveSchedules(schedules: WordPressSchedule[]) {
  try {
    const dir = path.dirname(SCHEDULES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify({ schedules }, null, 2));
  } catch (e) {
    console.error('[WP-Cron] Failed to save schedules:', e);
  }
}

function loadPostLog(): PostLogEntry[] {
  try {
    if (!fs.existsSync(WP_POST_LOG_FILE)) {
      return [];
    }
    const data = fs.readFileSync(WP_POST_LOG_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.posts || [];
  } catch (e) {
    return [];
  }
}

function savePostLog(posts: PostLogEntry[]) {
  try {
    const dir = path.dirname(WP_POST_LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(WP_POST_LOG_FILE, JSON.stringify({ posts }, null, 2));
  } catch (e) {
    console.error('[WP-Cron] Failed to save post log:', e);
  }
}

function loadJsonKnowledge(filename: string) {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// 過去の伸びたWordPress記事を取得（self モード用）
function getOldWpPosts(limit: number = 10): { title: string; excerpt: string }[] {
  const postLog = loadPostLog();
  // 最新の投稿から取得（本来はPV数などでソートしたい）
  return postLog
    .slice(-limit)
    .reverse()
    .map((p) => ({
      title: p.title,
      excerpt: p.title, // 現状はタイトルのみ
    }));
}

// 競合サイトの記事を取得（transform モード用）
function getCompetitorArticles(limit: number = 10): { title: string; content: string; source: string; keywords: string[] }[] {
  const stock = loadJsonKnowledge('competitor_articles.json');
  if (!stock || !stock.sources) return [];

  const allArticles: { title: string; content: string; source: string; keywords: string[] }[] = [];
  for (const [sourceKey, source] of Object.entries(stock.sources) as [string, { articles: { title: string; content: string; keywords: string[] }[] }][]) {
    if (source.articles) {
      allArticles.push(...source.articles.map(a => ({
        title: a.title,
        content: a.content,
        source: sourceKey,
        keywords: a.keywords || [],
      })));
    }
  }

  // ランダムにシャッフルして返す
  return allArticles
    .sort(() => Math.random() - 0.5)
    .slice(0, limit);
}

// SEO/AIO対策のガイドライン
const SEO_AIO_GUIDELINES = `
【SEO対策】
1. タイトル: メインキーワードを前半に配置、32文字以内
2. メタディスクリプション風の導入文: 120文字程度で記事の要約
3. H2見出し: 質問形式を含める（例：「〇〇とは？」「〇〇の方法は？」）
4. 内部リンク用のアンカーテキストを意識した文章
5. 共起語・関連キーワードを自然に含める
6. E-E-A-T強化: 具体的な数字、実体験、専門的な情報を含める

【AIO（AI Overview）対策】
1. 質問形式の見出し（H2/H3）を必ず2-3個含める
2. 各質問の直後に「結論ファースト」で簡潔な回答（2-3文）を配置
3. 箇条書き・番号付きリストを積極的に活用
4. 表形式のデータがあれば<table>タグで構造化
5. 「〇〇とは」「〇〇のメリット」「〇〇の始め方」などの定型パターンを使用
6. FAQ形式のセクションを記事末尾に追加

【構造化データ用FAQ】
記事に関連するFAQを3つ生成し、faqSchemaに含める
`;

// 記事生成（self モード: 過去の伸びた記事をリライト）
async function generateSelfArticle(
  schedule: WordPressSchedule,
  knowledgeContext: string
): Promise<{ title: string; content: string; faqSchema?: { question: string; answer: string }[] } | null> {
  const oldPosts = getOldWpPosts(10);

  if (oldPosts.length === 0) {
    console.log('[WP-Cron] No old posts found, falling back to transform mode');
    return null;
  }

  const systemPrompt = `あなたはチャットレディ事務所の求人ブログを書くSEO専門ライターです。
以下の過去の記事から1つ選び、同じテーマで完全に新しい記事を書き直してください。

【事務所の知識・業界情報】
${knowledgeContext}

【過去の伸びた記事タイトル】
${oldPosts.map((p, i) => `${i + 1}. ${p.title}`).join('\n')}

${SEO_AIO_GUIDELINES}

【条件】
- 元の記事の「テーマ・メッセージ」は維持しつつ、「表現・構成」を完全に変える
- SEO最適化された2000-2500文字の記事
- H2見出しを3-5個（うち2個以上は質問形式）、H3見出しを適宜使用
- 具体的な数字・データを含める
- 読者の不安を解消する内容
- まとめにCTA（行動喚起）を含める
- 記事末尾に「よくある質問」セクション（FAQ形式、3問）を追加

【禁止事項】
- 「必ず稼げる」「誰でも簡単に」などの誇大表現
- 過度に性的な表現

【出力形式】
以下のJSON形式で出力してください：
{
  "title": "記事タイトル（32文字以内）",
  "content": "記事本文（HTML形式：h2, h3, p, ul, li タグを使用。FAQセクション含む）",
  "faqSchema": [
    { "question": "質問1", "answer": "回答1" },
    { "question": "質問2", "answer": "回答2" },
    { "question": "質問3", "answer": "回答3" }
  ]
}

JSONのみを出力してください。`;

  try {
    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: '過去の伸びた記事を参考に、新しいSEO記事を1つ生成してください。',
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const articleData = JSON.parse(jsonMatch[0]);
      return {
        title: articleData.title,
        content: articleData.content,
        faqSchema: articleData.faqSchema,
      };
    }
    return null;
  } catch (error) {
    console.error('[WP-Cron] Self article generation failed:', error);
    return null;
  }
}

// 記事生成（transform モード: 競合記事を自分風に変換）
async function generateTransformArticle(
  schedule: WordPressSchedule,
  knowledgeContext: string
): Promise<{ title: string; content: string; faqSchema?: { question: string; answer: string }[] } | null> {
  const competitorArticles = getCompetitorArticles(5);

  if (competitorArticles.length === 0) {
    console.log('[WP-Cron] No competitor articles found');
    return null;
  }

  // ランダムに1つ選択
  const selectedArticle = competitorArticles[Math.floor(Math.random() * competitorArticles.length)];
  console.log(`[WP-Cron] Selected competitor article: ${selectedArticle.title} (${selectedArticle.source})`);

  const systemPrompt = `あなたはチャットレディ事務所の求人ブログを書くSEO専門ライターです。
以下の競合サイトの記事を参考に、完全オリジナルの記事を書いてください。

【事務所の知識・業界情報】
${knowledgeContext}

【参考記事】
タイトル: ${selectedArticle.title}
ソース: ${selectedArticle.source}
キーワード: ${selectedArticle.keywords.join(', ')}
内容:
${selectedArticle.content.substring(0, 3000)}

${SEO_AIO_GUIDELINES}

【条件】
- 参考記事の「テーマ・トピック」を借りて、完全オリジナルの記事を作成
- コピーではなく、自分の言葉・視点で書き直す
- SEO最適化された2000-2500文字のブログ記事
- H2見出しを3-5個（うち2個以上は質問形式）、H3見出しを適宜使用
- 具体的な数字・データを含める
- 事務所視点で求職者にアピール
- まとめにCTA（行動喚起）を含める
- 記事末尾に「よくある質問」セクション（FAQ形式、3問）を追加

【重要】
- 参考記事の文章をそのまま使わない
- 同じ構成でも言い回しは完全に変える
- 自分たちの事務所の強みを織り込む

【禁止事項】
- 「必ず稼げる」「誰でも簡単に」などの誇大表現
- 過度に性的な表現
- 参考記事のコピペ

【出力形式】
以下のJSON形式で出力してください：
{
  "title": "記事タイトル（32文字以内）",
  "content": "記事本文（HTML形式：h2, h3, p, ul, li タグを使用。FAQセクション含む）",
  "faqSchema": [
    { "question": "質問1", "answer": "回答1" },
    { "question": "質問2", "answer": "回答2" },
    { "question": "質問3", "answer": "回答3" }
  ]
}

JSONのみを出力してください。`;

  try {
    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: '競合記事を参考に、オリジナルのSEO記事を1つ生成してください。',
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const articleData = JSON.parse(jsonMatch[0]);
      return {
        title: articleData.title,
        content: articleData.content,
        faqSchema: articleData.faqSchema,
      };
    }
    return null;
  } catch (error) {
    console.error('[WP-Cron] Transform article generation failed:', error);
    return null;
  }
}

// FAQ構造化データをJSON-LDスクリプトとして生成
function generateFaqSchemaScript(faqSchema: { question: string; answer: string }[]): string {
  if (!faqSchema || faqSchema.length === 0) return '';

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqSchema.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return `\n\n<!-- FAQ構造化データ（SEO/AIO対策） -->\n<script type="application/ld+json">\n${JSON.stringify(schemaData, null, 2)}\n</script>`;
}

// サムネイル画像を生成してWordPressに設定
async function generateAndSetThumbnail(postId: number, title: string): Promise<boolean> {
  try {
    // 自サイトのAPIを呼び出し
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/wordpress/generate-thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, postId }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[WP-Cron] Thumbnail set: mediaId=${result.mediaId}`);
      return result.success && result.featuredSet;
    }

    console.error('[WP-Cron] Thumbnail generation failed:', response.status);
    return false;
  } catch (error) {
    console.error('[WP-Cron] Thumbnail error:', error);
    return false;
  }
}

async function postToWordPress(
  title: string,
  content: string,
  status: 'draft' | 'publish',
  faqSchema?: { question: string; answer: string }[]
): Promise<{ id: number; link: string } | null> {
  if (!fs.existsSync(WP_CREDENTIALS_FILE)) {
    console.error('[WP-Cron] WordPress credentials not found');
    return null;
  }

  const credentials = JSON.parse(fs.readFileSync(WP_CREDENTIALS_FILE, 'utf-8'));
  const auth = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64');

  // FAQ構造化データを記事末尾に追加
  const faqScript = faqSchema ? generateFaqSchemaScript(faqSchema) : '';
  const finalContent = content + faqScript;

  try {
    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content: finalContent,
        status,
      }),
    });

    if (response.ok) {
      const post = await response.json();
      return {
        id: post.id,
        link: post.link,
      };
    }
    console.error('[WP-Cron] WordPress API error:', await response.text());
    return null;
  } catch (error) {
    console.error('[WP-Cron] WordPress post failed:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('[WP-Cron] Starting WordPress auto-post...');

    const now = new Date();
    const schedules = loadSchedules();
    const postLog = loadPostLog();
    const results: {
      id: string;
      success?: boolean;
      error?: string;
      mode?: string;
      thumbnailSet?: boolean;
      post?: { id: number; title: string; link: string };
    }[] = [];

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      if (!schedule.nextRun) continue;

      const nextRunTime = new Date(schedule.nextRun);
      if (now >= nextRunTime) {
        console.log(`[WP-Cron] Executing schedule: ${schedule.id}`);

        // ナレッジコンテキストを取得
        let knowledgeContext = '';
        try {
          knowledgeContext = await buildChatladyKnowledgeContext();
        } catch (e) {
          console.error('[WP-Cron] Failed to load knowledge context:', e);
        }

        // モード選択（50%: self, 50%: transform）
        const mode = Math.random() < 0.5 ? 'self' : 'transform';
        console.log(`[WP-Cron] Mode: ${mode}`);

        // 記事を生成
        let article: { title: string; content: string; faqSchema?: { question: string; answer: string }[] } | null = null;

        if (mode === 'self') {
          article = await generateSelfArticle(schedule, knowledgeContext);
          // selfモードで過去記事がない場合はtransformにフォールバック
          if (!article) {
            console.log('[WP-Cron] Falling back to transform mode');
            article = await generateTransformArticle(schedule, knowledgeContext);
          }
        } else {
          article = await generateTransformArticle(schedule, knowledgeContext);
        }

        if (!article) {
          results.push({ id: schedule.id, error: 'Failed to generate article' });
          continue;
        }

        // WordPressに投稿（FAQ構造化データ含む）
        const result = await postToWordPress(article.title, article.content, schedule.publishStatus, article.faqSchema);
        if (!result) {
          results.push({ id: schedule.id, error: 'Failed to post to WordPress' });
          continue;
        }

        // サムネイル生成（設定で有効な場合）
        let thumbnailSet = false;
        if (schedule.generateThumbnail) {
          console.log(`[WP-Cron] Generating thumbnail for post ${result.id}...`);
          thumbnailSet = await generateAndSetThumbnail(result.id, article.title);
        }

        // スケジュールを更新
        const index = schedules.findIndex((s) => s.id === schedule.id);
        if (index !== -1) {
          schedules[index].lastRun = now.toISOString();
          schedules[index].nextRun = new Date(
            now.getTime() + schedule.intervalHours * 60 * 60 * 1000
          ).toISOString();
          schedules[index].lastPostId = result.id;
          schedules[index].lastPostTitle = article.title;
          schedules[index].lastMode = mode;
        }

        // ログに記録
        postLog.push({
          id: `wp-${Date.now()}`,
          scheduleId: schedule.id,
          postId: result.id,
          title: article.title,
          link: result.link,
          businessType: schedule.businessType || 'chat-lady',
          publishStatus: schedule.publishStatus,
          mode,
          createdAt: now.toISOString(),
        });

        results.push({
          id: schedule.id,
          success: true,
          mode,
          thumbnailSet,
          post: {
            id: result.id,
            title: article.title,
            link: result.link,
          },
        });

        console.log(`[WP-Cron] Posted (${mode}): ${article.title} [thumbnail: ${thumbnailSet}]`);
      }
    }

    saveSchedules(schedules);
    savePostLog(postLog);

    console.log(`[WP-Cron] Completed. ${results.length} posts processed.`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      executed: results.length,
      results,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WP-Cron] Error:', error);
    return NextResponse.json({ error: 'Failed to execute WordPress cron', details: errorMessage }, { status: 500 });
  }
}

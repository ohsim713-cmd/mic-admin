import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildEnrichedKnowledgeContext,
  buildChatladyKnowledgeContext,
} from '@/lib/langgraph/knowledge-loader';

const SCHEDULES_FILE = path.join(process.cwd(), 'knowledge', 'wordpress_schedules.json');
const WP_CREDENTIALS_FILE = path.join(process.cwd(), 'knowledge', 'wordpress_credentials.json');
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// 未使用の関数を削除し、シンプルに

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
    console.error('Failed to load WordPress schedules:', e);
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
    console.error('Failed to save WordPress schedules:', e);
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

function getRandomTopic(businessType: 'chat-lady' | 'liver-agency' = 'chat-lady') {
  const topicsFile = businessType === 'liver-agency' ? 'liver_article_topics.json' : 'article_topics.json';
  const topics = loadJsonKnowledge(topicsFile);
  if (!topics || !topics.categories) return null;

  const categories = Object.keys(topics.categories);
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const categoryTopics = topics.categories[randomCategory].topics;
  const randomTopic = categoryTopics[Math.floor(Math.random() * categoryTopics.length)];

  return {
    ...randomTopic,
    category: randomCategory
  };
}

async function generateArticle(schedule: WordPressSchedule): Promise<{ title: string; content: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const businessType = schedule.businessType || 'chat-lady';

  // ビジネスタイプに応じたナレッジコンテキストを取得
  const knowledgeContext = businessType === 'liver-agency'
    ? await buildEnrichedKnowledgeContext()
    : await buildChatladyKnowledgeContext();

  const businessLabel = businessType === 'liver-agency' ? 'ライバー事務所' : 'チャットレディ事務所';
  const defaultKeywords = businessType === 'liver-agency'
    ? 'ライバー 稼ぐ 事務所'
    : 'チャットレディ 高収入 在宅';

  // キーワードが指定されていない場合はランダムトピックを使用
  let topicInfo = null;
  let keywords = schedule.keywords;
  if (!keywords || keywords.trim() === '') {
    topicInfo = getRandomTopic(businessType);
    if (topicInfo) {
      keywords = topicInfo.keywords.join(', ');
    } else {
      keywords = defaultKeywords;
    }
  }

  // 文字数設定
  let charCount = '2000-2500';
  if (schedule.targetLength === '1000-1500') charCount = '1000-1500';
  if (schedule.targetLength === '3000-5000') charCount = '3000-4000';
  if (schedule.targetLength === '5000+') charCount = '5000-6000';

  // トーン設定
  let styleGuide = '親しみやすく、専門的な文体。';
  if (schedule.tone === 'フォーマル') {
    styleGuide = '専門的で信頼感のある文体。データや具体例を多用。';
  } else if (schedule.tone === 'カジュアル') {
    styleGuide = '親しみやすく、読者に語りかけるような文体。';
  } else if (schedule.tone === '説得力のある') {
    styleGuide = '行動を促す、説得力のある文体。問題提起と解決策を明確に。';
  }

  // トピック情報を追加
  let topicContext = '';
  if (topicInfo) {
    topicContext = `
【記事テーマ】
タイトル案: ${topicInfo.title}
ターゲット読者: ${topicInfo.targetAudience}
記事の切り口: ${topicInfo.angle}
カテゴリ: ${topicInfo.category}
`;
  }

  const targetAudience = businessType === 'liver-agency'
    ? 'ライバーに興味がある人'
    : 'チャットレディに興味がある女性';

  const prompt = `あなたは${businessLabel}の求人ブログを書くSEO専門ライターです。
事務所の立場から、求職者（${targetAudience}）に向けて記事を書きます。

【事務所の知識・業界情報】
${knowledgeContext}
${topicContext}

以下の情報に基づいて、SEO最適化されたブログ記事を作成してください。

【メインキーワード】
${keywords}

【文字数】
${charCount}文字程度

【文体・トーン】
${styleGuide}

【記事の目的】
- ${targetAudience}の疑問や不安を解消する
- 事務所への問い合わせ・応募につなげる
- 信頼性のある情報を提供し、SEOで上位表示を狙う

【記事構成の要件】
1. **タイトル（H1）**: キーワードを含む魅力的なタイトル（32文字以内推奨）
2. **導入文（リード）**: 読者の悩みに共感し、この記事を読むメリットを明確に
3. **本文**:
   - H2見出しを3-5個使用
   - 各H2の下にH3見出しを適宜使用
   - 具体的な数字・データを含める（知識情報を活用）
   - 読者の不安を解消する内容を含める
   - 読みやすい短い段落（2-3文ごと）
4. **まとめ**: 要点を簡潔に、「まずは相談から」などのCTA（行動喚起）を含める

【SEO要件】
- タイトルと最初のH2にキーワードを含める
- 共起語・関連キーワードを自然に織り込む
- E-E-A-T（経験・専門性・権威性・信頼性）を意識

【禁止事項】
- 「必ず稼げる」「誰でも簡単に」などの誇大表現
- 過度に性的な表現
- 事実と異なる情報

【出力形式】
以下のJSON形式で出力してください：
{
  "title": "記事タイトル",
  "content": "記事本文（HTML形式：h2, h3, p, ul, li タグを使用）"
}

JSONのみを出力してください。`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const articleData = JSON.parse(jsonMatch[0]);
      return {
        title: articleData.title,
        content: articleData.content
      };
    }
    return null;
  } catch (error) {
    console.error('Article generation failed:', error);
    return null;
  }
}

async function postToWordPress(title: string, content: string, status: 'draft' | 'publish'): Promise<{ id: number; link: string } | null> {
  if (!fs.existsSync(WP_CREDENTIALS_FILE)) {
    console.error('WordPress credentials not found');
    return null;
  }

  const credentials = JSON.parse(fs.readFileSync(WP_CREDENTIALS_FILE, 'utf-8'));
  const auth = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64');

  try {
    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        content,
        status
      })
    });

    if (response.ok) {
      const post = await response.json();
      return {
        id: post.id,
        link: post.link
      };
    }
    console.error('WordPress API error:', await response.text());
    return null;
  } catch (error) {
    console.error('WordPress post failed:', error);
    return null;
  }
}

// POST - 特定のスケジュールを手動実行
export async function POST(request: NextRequest) {
  try {
    const { scheduleId } = await request.json();

    const schedules = loadSchedules();
    const schedule = schedules.find(s => s.id === scheduleId);

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // 記事を生成
    const article = await generateArticle(schedule);
    if (!article) {
      return NextResponse.json({ error: 'Failed to generate article' }, { status: 500 });
    }

    // WordPressに投稿
    const result = await postToWordPress(article.title, article.content, schedule.publishStatus);
    if (!result) {
      return NextResponse.json({ error: 'Failed to post to WordPress' }, { status: 500 });
    }

    // スケジュールを更新
    const index = schedules.findIndex(s => s.id === scheduleId);
    if (index !== -1) {
      const now = new Date();
      schedules[index].lastRun = now.toISOString();
      schedules[index].nextRun = new Date(now.getTime() + schedule.intervalHours * 60 * 60 * 1000).toISOString();
      schedules[index].lastPostId = result.id;
      schedules[index].lastPostTitle = article.title;
      saveSchedules(schedules);
    }

    return NextResponse.json({
      success: true,
      post: {
        id: result.id,
        title: article.title,
        link: result.link
      }
    });
  } catch (error) {
    console.error('Execute schedule failed:', error);
    return NextResponse.json({ error: 'Failed to execute schedule' }, { status: 500 });
  }
}

// GET - 期限切れのスケジュールを実行（cronジョブ用）
export async function GET() {
  try {
    const now = new Date();
    const schedules = loadSchedules();
    const results: any[] = [];

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      if (!schedule.nextRun) continue;

      const nextRunTime = new Date(schedule.nextRun);
      if (now >= nextRunTime) {
        // 記事を生成
        const article = await generateArticle(schedule);
        if (!article) {
          results.push({ id: schedule.id, error: 'Failed to generate article' });
          continue;
        }

        // WordPressに投稿
        const result = await postToWordPress(article.title, article.content, schedule.publishStatus);
        if (!result) {
          results.push({ id: schedule.id, error: 'Failed to post to WordPress' });
          continue;
        }

        // スケジュールを更新
        const index = schedules.findIndex(s => s.id === schedule.id);
        if (index !== -1) {
          schedules[index].lastRun = now.toISOString();
          schedules[index].nextRun = new Date(now.getTime() + schedule.intervalHours * 60 * 60 * 1000).toISOString();
          schedules[index].lastPostId = result.id;
          schedules[index].lastPostTitle = article.title;
        }

        results.push({
          id: schedule.id,
          success: true,
          post: {
            id: result.id,
            title: article.title,
            link: result.link
          }
        });
      }
    }

    saveSchedules(schedules);

    return NextResponse.json({
      executed: results.length,
      results
    });
  } catch (error) {
    console.error('Execute schedules failed:', error);
    return NextResponse.json({ error: 'Failed to execute schedules' }, { status: 500 });
  }
}

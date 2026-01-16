import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const POSTS_HISTORY_FILE = path.join(process.cwd(), 'knowledge', 'posts_history.json');
const PAST_POSTS_FILE = path.join(process.cwd(), 'knowledge', 'past_posts.txt');
const LEARNING_LOG_FILE = path.join(process.cwd(), 'knowledge', 'learning_log.json');

type PostHistory = {
    id: string;
    text: string;
    timestamp: string;
    impressions?: number;
    engagements?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
};

type LearningLog = {
    timestamp: string;
    analyzedPosts: number;
    excellentPosts: number;
    patterns: string[];
    recommendations: string[];
};

function loadPostsHistory(): PostHistory[] {
    try {
        if (!fs.existsSync(POSTS_HISTORY_FILE)) {
            return [];
        }
        const data = fs.readFileSync(POSTS_HISTORY_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.posts || [];
    } catch (e) {
        console.error('Failed to load posts history:', e);
        return [];
    }
}

function saveLearningLog(log: LearningLog) {
    try {
        const dir = path.dirname(LEARNING_LOG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        let logs: LearningLog[] = [];
        if (fs.existsSync(LEARNING_LOG_FILE)) {
            const data = fs.readFileSync(LEARNING_LOG_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            logs = parsed.logs || [];
        }

        logs.push(log);
        fs.writeFileSync(LEARNING_LOG_FILE, JSON.stringify({ logs }, null, 2));
    } catch (e) {
        console.error('Failed to save learning log:', e);
    }
}

function appendToPastPosts(posts: PostHistory[]) {
    try {
        const dir = path.dirname(PAST_POSTS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        let content = '';
        if (fs.existsSync(PAST_POSTS_FILE)) {
            content = fs.readFileSync(PAST_POSTS_FILE, 'utf-8');
        }

        // TSV形式で追加
        for (const post of posts) {
            const line = `${post.text}\t${post.impressions || 0}\t${post.engagements || 0}\t優秀な投稿\n`;
            if (!content.includes(post.text)) {
                content += line;
            }
        }

        fs.writeFileSync(PAST_POSTS_FILE, content);
    } catch (e) {
        console.error('Failed to append to past posts:', e);
    }
}

export async function POST() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        const posts = loadPostsHistory();

        // インプレッションがある投稿のみ分析
        const postsWithMetrics = posts.filter(p => p.impressions !== undefined && p.impressions > 0);

        if (postsWithMetrics.length < 5) {
            return NextResponse.json({
                success: false,
                message: '学習に必要なデータが不足しています (最低5件の投稿が必要)',
                postsCount: postsWithMetrics.length
            });
        }

        // 平均インプレッションを計算
        const avgImpressions = postsWithMetrics.reduce((sum, p) => sum + (p.impressions || 0), 0) / postsWithMetrics.length;

        // 優秀な投稿を抽出 (平均の1.5倍以上)
        const excellentPosts = postsWithMetrics.filter(p => (p.impressions || 0) >= avgImpressions * 1.5);

        if (excellentPosts.length === 0) {
            return NextResponse.json({
                success: false,
                message: '優秀な投稿が見つかりませんでした',
                avgImpressions: Math.round(avgImpressions)
            });
        }

        // Gemini APIで優秀な投稿を分析
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const analysisPrompt = `
以下の優秀な投稿(高いインプレッションを獲得した投稿)を分析し、成功パターンを抽出してください。

【優秀な投稿一覧】
${excellentPosts.map((p, i) => `${i + 1}. "${p.text}" (インプレッション: ${p.impressions}, エンゲージメント: ${p.engagements})`).join('\n')}

【分析項目】
1. 共通する特徴やパターン
2. 効果的なキーワードやフレーズ
3. 投稿の構造や文体
4. 今後の投稿への推奨事項

JSON形式で以下のように回答してください:
{
  "patterns": ["パターン1", "パターン2", ...],
  "recommendations": ["推奨事項1", "推奨事項2", ...]
}
`;

        const result = await model.generateContent(analysisPrompt);
        const response = result.response.text();

        // JSONを抽出
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        let analysis = { patterns: [], recommendations: [] };

        if (jsonMatch) {
            try {
                analysis = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error('Failed to parse AI response:', e);
            }
        }

        // 学習ログを保存
        const learningLog: LearningLog = {
            timestamp: new Date().toISOString(),
            analyzedPosts: postsWithMetrics.length,
            excellentPosts: excellentPosts.length,
            patterns: analysis.patterns || [],
            recommendations: analysis.recommendations || []
        };

        saveLearningLog(learningLog);

        // 優秀な投稿をpast_posts.txtに追加
        appendToPastPosts(excellentPosts);

        console.log('AI learning completed:', learningLog);

        return NextResponse.json({
            success: true,
            message: 'AI学習が完了しました',
            learningLog,
            avgImpressions: Math.round(avgImpressions),
            excellentPostsCount: excellentPosts.length
        });
    } catch (error) {
        console.error('Failed to run AI learning:', error);
        return NextResponse.json(
            { error: 'Failed to run AI learning' },
            { status: 500 }
        );
    }
}

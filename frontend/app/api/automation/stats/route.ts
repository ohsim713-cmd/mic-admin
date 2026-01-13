import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SCHEDULES_FILE = path.join(process.cwd(), 'knowledge', 'schedules.json');
const POSTS_HISTORY_FILE = path.join(process.cwd(), 'knowledge', 'posts_history.json');
const AUTOMATION_CONFIG_FILE = path.join(process.cwd(), 'knowledge', 'automation_config.json');
const INQUIRIES_FILE = path.join(process.cwd(), 'knowledge', 'inquiries.json');

type Schedule = {
    id: string;
    enabled: boolean;
    intervalHours: number;
    target: string;
    postType: string;
    keywords: string;
    lastRun?: string;
    nextRun?: string;
};

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

type AutomationConfig = {
    autonomousMode: boolean;
    dailyPostsTarget: number;
    avgImpressionsTarget: number;
    monthlyInquiriesTarget: number;
};

type Inquiry = {
    id: string;
    timestamp: string;
    source: string;
    name?: string;
    email?: string;
};

function loadSchedules(): Schedule[] {
    try {
        if (!fs.existsSync(SCHEDULES_FILE)) {
            return [];
        }
        const data = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.schedules || [];
    } catch (e) {
        console.error('Failed to load schedules:', e);
        return [];
    }
}

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

function loadAutomationConfig(): AutomationConfig {
    try {
        if (!fs.existsSync(AUTOMATION_CONFIG_FILE)) {
            const defaultConfig: AutomationConfig = {
                autonomousMode: false,
                dailyPostsTarget: 15,
                avgImpressionsTarget: 1000,
                monthlyInquiriesTarget: 3
            };
            saveAutomationConfig(defaultConfig);
            return defaultConfig;
        }
        const data = fs.readFileSync(AUTOMATION_CONFIG_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Failed to load automation config:', e);
        return {
            autonomousMode: false,
            dailyPostsTarget: 15,
            avgImpressionsTarget: 1000,
            monthlyInquiriesTarget: 3
        };
    }
}

function saveAutomationConfig(config: AutomationConfig) {
    try {
        const dir = path.dirname(AUTOMATION_CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(AUTOMATION_CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('Failed to save automation config:', e);
    }
}

function loadInquiries(): Inquiry[] {
    try {
        if (!fs.existsSync(INQUIRIES_FILE)) {
            return [];
        }
        const data = fs.readFileSync(INQUIRIES_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.inquiries || [];
    } catch (e) {
        console.error('Failed to load inquiries:', e);
        return [];
    }
}

function calculatePerformance(impressions: number, target: number): 'excellent' | 'good' | 'average' | 'poor' {
    const ratio = impressions / target;
    if (ratio >= 1.5) return 'excellent';
    if (ratio >= 1.0) return 'good';
    if (ratio >= 0.5) return 'average';
    return 'poor';
}

export async function GET() {
    try {
        const schedules = loadSchedules();
        const postsHistory = loadPostsHistory();
        const config = loadAutomationConfig();
        const inquiries = loadInquiries();

        // 今日の投稿を取得
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayPosts = postsHistory.filter(post => {
            const postDate = new Date(post.timestamp);
            postDate.setHours(0, 0, 0, 0);
            return postDate.getTime() === today.getTime();
        });

        // 今月の問い合わせを取得
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const monthlyInquiries = inquiries.filter(inquiry => {
            const inquiryDate = new Date(inquiry.timestamp);
            return inquiryDate >= thisMonth;
        });

        // 平均インプレッションを計算
        const postsWithImpressions = postsHistory.filter(p => p.impressions !== undefined && p.impressions > 0);
        const avgImpressions = postsWithImpressions.length > 0
            ? Math.round(postsWithImpressions.reduce((sum, p) => sum + (p.impressions || 0), 0) / postsWithImpressions.length)
            : 0;

        // アクティブなスケジュールを取得
        const activeSchedules = schedules.filter(s => s.enabled);

        // 次回投稿時刻を取得
        const nextRuns = activeSchedules
            .map(s => s.nextRun)
            .filter(nr => nr !== undefined)
            .sort();
        const nextPostTime = nextRuns.length > 0 ? nextRuns[0] : null;

        // 最終投稿時刻を取得
        const lastPostTime = postsHistory.length > 0
            ? postsHistory[postsHistory.length - 1].timestamp
            : null;

        // 学習ステータスを判定
        let learningStatus = '待機中';
        if (config.autonomousMode) {
            if (postsWithImpressions.length >= 10) {
                learningStatus = '学習中 - パターン分析実行中';
            } else {
                learningStatus = 'データ収集中';
            }
        }

        // 最近の投稿にパフォーマンス評価を追加
        const recentPosts = postsHistory
            .slice(-20)
            .reverse()
            .map(post => ({
                ...post,
                impressions: post.impressions || 0,
                engagements: (post.likes || 0) + (post.retweets || 0) + (post.replies || 0),
                performance: calculatePerformance(post.impressions || 0, config.avgImpressionsTarget)
            }));

        const stats = {
            dailyPosts: activeSchedules.length,
            dailyPostsTarget: config.dailyPostsTarget,
            avgImpressions,
            avgImpressionsTarget: config.avgImpressionsTarget,
            monthlyInquiries: monthlyInquiries.length,
            monthlyInquiriesTarget: config.monthlyInquiriesTarget,
            autonomousMode: config.autonomousMode,
            lastPostTime,
            nextPostTime,
            activeSchedules: activeSchedules.length,
            totalPostsToday: todayPosts.length,
            learningStatus
        };

        return NextResponse.json({
            stats,
            recentPosts
        });
    } catch (error) {
        console.error('Failed to get automation stats:', error);
        return NextResponse.json(
            { error: 'Failed to get automation stats' },
            { status: 500 }
        );
    }
}

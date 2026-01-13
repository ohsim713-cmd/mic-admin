import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const SCHEDULES_FILE = path.join(process.cwd(), 'knowledge', 'schedules.json');
const THEME_OPTIONS_FILE = path.join(process.cwd(), 'knowledge', 'theme_options.json');

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

type ThemeOptions = {
    targets?: string[];
    postTypes?: string[];
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

function saveSchedules(schedules: Schedule[]) {
    try {
        const dir = path.dirname(SCHEDULES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(SCHEDULES_FILE, JSON.stringify({ schedules }, null, 2));
    } catch (e) {
        console.error('Failed to save schedules:', e);
    }
}

function loadThemeOptions(): ThemeOptions {
    try {
        if (!fs.existsSync(THEME_OPTIONS_FILE)) {
            return {
                targets: ['20代女性', '30代女性', '学生', '主婦', 'フリーター'],
                postTypes: ['求人情報', '体験談', 'Q&A', '特典紹介', '働き方紹介']
            };
        }
        const data = fs.readFileSync(THEME_OPTIONS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Failed to load theme options:', e);
        return {
            targets: ['20代女性', '30代女性', '学生', '主婦', 'フリーター'],
            postTypes: ['求人情報', '体験談', 'Q&A', '特典紹介', '働き方紹介']
        };
    }
}

export async function POST() {
    try {
        // 既存のスケジュールを削除
        const existingSchedules = loadSchedules();
        const disabledSchedules = existingSchedules.map(s => ({ ...s, enabled: false }));

        const themeOptions = loadThemeOptions();
        const targets = themeOptions.targets || ['20代女性', '30代女性', '学生'];
        const postTypes = themeOptions.postTypes || ['求人情報', '体験談', 'Q&A'];

        // 1日15件投稿 = 24時間 / 15 = 1.6時間おき (96分おき)
        const totalPosts = 15;
        const intervalMinutes = Math.floor((24 * 60) / totalPosts); // 96分

        const newSchedules: Schedule[] = [];
        const now = new Date();

        // 投稿開始時刻を設定 (朝7時から開始)
        const startHour = 7;
        const startTime = new Date(now);
        startTime.setHours(startHour, 0, 0, 0);

        // 現在時刻より前の場合は明日の7時に設定
        if (startTime <= now) {
            startTime.setDate(startTime.getDate() + 1);
        }

        for (let i = 0; i < totalPosts; i++) {
            // 各投稿の時刻を計算
            const postTime = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);

            // ターゲットと投稿タイプをローテーション
            const target = targets[i % targets.length];
            const postType = postTypes[i % postTypes.length];

            // 時間帯に応じたキーワードを設定
            const hour = postTime.getHours();
            let keywords = '';
            if (hour >= 7 && hour < 12) {
                keywords = '朝活,おはよう,今日も頑張ろう';
            } else if (hour >= 12 && hour < 17) {
                keywords = 'お昼休み,午後,仕事';
            } else if (hour >= 17 && hour < 21) {
                keywords = '夕方,お疲れ様,副業';
            } else {
                keywords = '夜,在宅,自由な働き方';
            }

            const schedule: Schedule = {
                id: uuidv4(),
                enabled: true,
                intervalHours: 24, // 24時間後に次の投稿 (毎日同じ時刻)
                target,
                postType,
                keywords,
                nextRun: postTime.toISOString()
            };

            newSchedules.push(schedule);
        }

        // 既存の無効化されたスケジュールと新しいスケジュールを保存
        saveSchedules([...disabledSchedules, ...newSchedules]);

        console.log(`Created ${totalPosts} optimal schedules for daily posting`);

        return NextResponse.json({
            success: true,
            message: `${totalPosts}件の最適スケジュールを作成しました`,
            schedules: newSchedules,
            intervalMinutes,
            startTime: startTime.toISOString()
        });
    } catch (error) {
        console.error('Failed to create optimal schedules:', error);
        return NextResponse.json(
            { error: 'Failed to create optimal schedules' },
            { status: 500 }
        );
    }
}

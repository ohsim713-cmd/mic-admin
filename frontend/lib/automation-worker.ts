import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

const AUTOMATION_CONFIG_FILE = path.join(process.cwd(), 'knowledge', 'automation_config.json');

type AutomationConfig = {
    autonomousMode: boolean;
    dailyPostsTarget: number;
    avgImpressionsTarget: number;
    monthlyInquiriesTarget: number;
};

function loadAutomationConfig(): AutomationConfig {
    try {
        if (!fs.existsSync(AUTOMATION_CONFIG_FILE)) {
            return {
                autonomousMode: false,
                dailyPostsTarget: 15,
                avgImpressionsTarget: 1000,
                monthlyInquiriesTarget: 3
            };
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

async function fetchImpressions() {
    try {
        console.log('[Automation Worker] Fetching impressions...');
        const response = await fetch('http://localhost:3000/api/automation/fetch-impressions', {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`[Automation Worker] Updated ${result.updated} posts with impressions`);
        } else {
            console.error('[Automation Worker] Failed to fetch impressions');
        }
    } catch (error) {
        console.error('[Automation Worker] Error fetching impressions:', error);
    }
}

async function runAILearning() {
    try {
        console.log('[Automation Worker] Running AI learning...');
        const response = await fetch('http://localhost:3000/api/automation/learn', {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`[Automation Worker] AI learning completed: ${result.message}`);
        } else {
            const error = await response.json();
            console.log(`[Automation Worker] AI learning skipped: ${error.message}`);
        }
    } catch (error) {
        console.error('[Automation Worker] Error running AI learning:', error);
    }
}

export function startAutomationWorker() {
    console.log('🤖 Starting Automation Worker...');

    // 1時間ごとにインプレッションを取得
    cron.schedule('0 * * * *', async () => {
        const config = loadAutomationConfig();
        if (config.autonomousMode) {
            console.log('[Automation Worker] Autonomous mode is ON - fetching impressions');
            await fetchImpressions();
        }
    });

    // 6時間ごとにAI学習を実行
    cron.schedule('0 */6 * * *', async () => {
        const config = loadAutomationConfig();
        if (config.autonomousMode) {
            console.log('[Automation Worker] Autonomous mode is ON - running AI learning');
            await runAILearning();
        }
    });

    // 起動時に一度実行
    setTimeout(async () => {
        const config = loadAutomationConfig();
        if (config.autonomousMode) {
            console.log('[Automation Worker] Initial run - fetching impressions and learning');
            await fetchImpressions();
            await runAILearning();
        }
    }, 10000); // 10秒後に実行

    console.log('✅ Automation Worker started successfully');
    console.log('   - Impressions fetch: Every hour');
    console.log('   - AI learning: Every 6 hours');
}

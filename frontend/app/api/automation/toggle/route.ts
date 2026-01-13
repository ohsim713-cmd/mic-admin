import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { enabled } = body;

        const config = loadAutomationConfig();
        config.autonomousMode = enabled;
        saveAutomationConfig(config);

        console.log(`Autonomous mode ${enabled ? 'enabled' : 'disabled'}`);

        return NextResponse.json({
            success: true,
            autonomousMode: config.autonomousMode
        });
    } catch (error) {
        console.error('Failed to toggle autonomous mode:', error);
        return NextResponse.json(
            { error: 'Failed to toggle autonomous mode' },
            { status: 500 }
        );
    }
}

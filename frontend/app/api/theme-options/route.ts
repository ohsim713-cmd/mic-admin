import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

export async function GET() {
    try {
        const filePath = path.join(KNOWLEDGE_DIR, 'theme_options.json');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'theme_options.json not found' }, { status: 404 });
        }

        const data = fs.readFileSync(filePath, 'utf-8');
        const themeOptions = JSON.parse(data);

        // 必要なデータのみを返す
        return NextResponse.json({
            postGoals: themeOptions.postGoals || [],
            postAngles: themeOptions.postAngles || [],
            targetProfiles: themeOptions.targetProfiles || [],
        });
    } catch (error: any) {
        console.error('Failed to load theme options:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Project Intelligence テスト用API
 */

import { NextResponse } from 'next/server';
import { analyzeProject, inferFilesToEdit } from '@/lib/agent/project-intelligence';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'analyze';
    const instruction = searchParams.get('instruction');

    try {
        if (action === 'analyze') {
            // charged-tyson 全体を分析
            const projectMap = await analyzeProject();

            return NextResponse.json({
                success: true,
                summary: projectMap.summary,
                stats: projectMap.stats,
                sampleFiles: projectMap.structure.slice(0, 20),
            });
        }

        if (action === 'infer' && instruction) {
            // 指示から編集すべきファイルを推論
            const files = await inferFilesToEdit(instruction);

            return NextResponse.json({
                success: true,
                instruction,
                suggestedFiles: files,
            });
        }

        return NextResponse.json({
            error: 'Invalid action. Use ?action=analyze or ?action=infer&instruction=...',
        }, { status: 400 });

    } catch (error: any) {
        console.error('[Test Intelligence] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}

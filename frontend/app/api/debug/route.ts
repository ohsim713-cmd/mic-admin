import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        apiKeyExists: !!process.env.GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
}

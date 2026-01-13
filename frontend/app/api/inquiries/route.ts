import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const INQUIRIES_FILE = path.join(process.cwd(), 'knowledge', 'inquiries.json');

type Inquiry = {
    id: string;
    timestamp: string;
    source: string;
    name?: string;
    email?: string;
    message?: string;
    phone?: string;
};

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

function saveInquiries(inquiries: Inquiry[]) {
    try {
        const dir = path.dirname(INQUIRIES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(INQUIRIES_FILE, JSON.stringify({ inquiries }, null, 2));
    } catch (e) {
        console.error('Failed to save inquiries:', e);
    }
}

// GET - 問い合わせ一覧取得
export async function GET() {
    try {
        const inquiries = loadInquiries();

        // 今月の問い合わせを取得
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);

        const monthlyInquiries = inquiries.filter(inquiry => {
            const inquiryDate = new Date(inquiry.timestamp);
            return inquiryDate >= thisMonth;
        });

        return NextResponse.json({
            inquiries,
            monthlyInquiries,
            monthlyCount: monthlyInquiries.length,
            totalCount: inquiries.length
        });
    } catch (error) {
        console.error('Failed to get inquiries:', error);
        return NextResponse.json(
            { error: 'Failed to get inquiries' },
            { status: 500 }
        );
    }
}

// POST - 新規問い合わせ登録
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { source, name, email, message, phone } = body;

        if (!source) {
            return NextResponse.json(
                { error: 'Source is required' },
                { status: 400 }
            );
        }

        const inquiries = loadInquiries();

        const newInquiry: Inquiry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            source,
            name,
            email,
            message,
            phone
        };

        inquiries.push(newInquiry);
        saveInquiries(inquiries);

        console.log('New inquiry registered:', newInquiry);

        return NextResponse.json({
            success: true,
            inquiry: newInquiry
        });
    } catch (error) {
        console.error('Failed to register inquiry:', error);
        return NextResponse.json(
            { error: 'Failed to register inquiry' },
            { status: 500 }
        );
    }
}

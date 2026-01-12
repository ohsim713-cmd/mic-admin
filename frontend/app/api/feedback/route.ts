import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const FEEDBACK_FILE = path.join(KNOWLEDGE_DIR, 'feedback_rules.json');
const GOOD_EXAMPLES_FILE = path.join(KNOWLEDGE_DIR, 'good_examples.json');

interface FeedbackRule {
  id: string;
  businessType: string;
  targetAudience?: string;
  rule: string;        // 例: "エンジニア用語を避ける"
  reason?: string;     // 例: "夜職の子には伝わりにくいため"
  createdAt: string;
}

interface GoodExample {
  id: string;
  businessType: string;
  targetAudience?: string;
  post: string;
  approvedAt: string;
  tags?: string[];      // 例: ["共感系", "カジュアル"]
}

function loadFeedbackRules(): FeedbackRule[] {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load feedback rules:', e);
  }
  return [];
}

function saveFeedbackRules(rules: FeedbackRule[]): void {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(rules, null, 2), 'utf-8');
}

function loadGoodExamples(): GoodExample[] {
  try {
    if (fs.existsSync(GOOD_EXAMPLES_FILE)) {
      return JSON.parse(fs.readFileSync(GOOD_EXAMPLES_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load good examples:', e);
  }
  return [];
}

function saveGoodExamples(examples: GoodExample[]): void {
  fs.writeFileSync(GOOD_EXAMPLES_FILE, JSON.stringify(examples, null, 2), 'utf-8');
}

// GET: フィードバックルールと良い例を取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'rules' | 'examples' | 'all'
  const businessType = searchParams.get('businessType');

  let rules = loadFeedbackRules();
  let examples = loadGoodExamples();

  // businessTypeでフィルタ
  if (businessType) {
    rules = rules.filter(r => r.businessType === businessType || r.businessType === 'all');
    examples = examples.filter(e => e.businessType === businessType || e.businessType === 'all');
  }

  if (type === 'rules') {
    return NextResponse.json({ rules });
  } else if (type === 'examples') {
    return NextResponse.json({ examples });
  }

  return NextResponse.json({ rules, examples });
}

// POST: フィードバックルールまたは良い例を追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (type === 'rule') {
      const rules = loadFeedbackRules();
      const newRule: FeedbackRule = {
        id: `rule_${Date.now()}`,
        businessType: data.businessType || 'all',
        targetAudience: data.targetAudience,
        rule: data.rule,
        reason: data.reason,
        createdAt: new Date().toISOString()
      };
      rules.push(newRule);
      saveFeedbackRules(rules);
      return NextResponse.json({ success: true, rule: newRule });
    }

    if (type === 'example') {
      const examples = loadGoodExamples();
      const newExample: GoodExample = {
        id: `example_${Date.now()}`,
        businessType: data.businessType || 'all',
        targetAudience: data.targetAudience,
        post: data.post,
        approvedAt: new Date().toISOString(),
        tags: data.tags
      };
      examples.push(newExample);
      saveGoodExamples(examples);
      return NextResponse.json({ success: true, example: newExample });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  } catch (error: any) {
    console.error('Feedback API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: ルールまたは例を削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json({ error: 'type and id required' }, { status: 400 });
    }

    if (type === 'rule') {
      let rules = loadFeedbackRules();
      rules = rules.filter(r => r.id !== id);
      saveFeedbackRules(rules);
      return NextResponse.json({ success: true });
    }

    if (type === 'example') {
      let examples = loadGoodExamples();
      examples = examples.filter(e => e.id !== id);
      saveGoodExamples(examples);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  } catch (error: any) {
    console.error('Feedback delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { updatePostStatus } from '../../../lib/database/generated-posts';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const DATA_DIR = path.join(process.cwd(), 'data');
const FEEDBACK_FILE = path.join(KNOWLEDGE_DIR, 'feedback_rules.json');
const GOOD_EXAMPLES_FILE = path.join(KNOWLEDGE_DIR, 'good_examples.json');
const POST_COMMENTS_FILE = path.join(DATA_DIR, 'post_comments.json');
const SUCCESS_PATTERNS_FILE = path.join(KNOWLEDGE_DIR, 'success_patterns.json');
const NG_PATTERNS_FILE = path.join(KNOWLEDGE_DIR, 'ng_patterns.json');
const STYLE_GUIDE_FILE = path.join(KNOWLEDGE_DIR, 'style_guide.json');

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

// 投稿へのコメント
interface PostComment {
  id: string;
  postId: string;
  postText: string;
  action: 'approve' | 'reject' | 'improve' | 'style';
  comment: string;
  createdAt: string;
  appliedToKnowledge: boolean;
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

// コメント読み込み・保存
function loadPostComments(): PostComment[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(POST_COMMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(POST_COMMENTS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load post comments:', e);
  }
  return [];
}

function savePostComments(comments: PostComment[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(POST_COMMENTS_FILE, JSON.stringify(comments, null, 2), 'utf-8');
}

// 成功パターンに追加
function addToSuccessPatterns(postText: string, reason: string): void {
  let patterns: any = { patterns: [], hooks: [], phrases: [] };
  try {
    if (fs.existsSync(SUCCESS_PATTERNS_FILE)) {
      patterns = JSON.parse(fs.readFileSync(SUCCESS_PATTERNS_FILE, 'utf-8'));
    }
  } catch (e) {
    // 新規作成
  }

  if (!patterns.patterns) patterns.patterns = [];
  patterns.patterns.push({
    text: postText,
    reason: reason,
    addedAt: new Date().toISOString(),
  });

  // フックパターンを抽出（最初の1行）
  const firstLine = postText.split('\n')[0].trim();
  if (firstLine && firstLine.length < 50 && firstLine.length > 5) {
    if (!patterns.hooks) patterns.hooks = [];
    if (!patterns.hooks.includes(firstLine)) {
      patterns.hooks.push(firstLine);
    }
  }

  fs.writeFileSync(SUCCESS_PATTERNS_FILE, JSON.stringify(patterns, null, 2), 'utf-8');
}

// NGパターンに追加
function addToNgPatterns(postText: string, reason: string): void {
  let ngPatterns: any = { patterns: [], phrases: [] };
  try {
    if (fs.existsSync(NG_PATTERNS_FILE)) {
      ngPatterns = JSON.parse(fs.readFileSync(NG_PATTERNS_FILE, 'utf-8'));
    }
  } catch (e) {
    // 新規作成
  }

  if (!ngPatterns.patterns) ngPatterns.patterns = [];
  ngPatterns.patterns.push({
    text: postText,
    reason: reason,
    addedAt: new Date().toISOString(),
  });

  fs.writeFileSync(NG_PATTERNS_FILE, JSON.stringify(ngPatterns, null, 2), 'utf-8');
}

// スタイルガイドに追加
function addToStyleGuide(rule: string): void {
  let guide: any = { rules: [] };
  try {
    if (fs.existsSync(STYLE_GUIDE_FILE)) {
      guide = JSON.parse(fs.readFileSync(STYLE_GUIDE_FILE, 'utf-8'));
    }
  } catch (e) {
    // 新規作成
  }

  if (!guide.rules) guide.rules = [];
  guide.rules.push({
    rule: rule,
    addedAt: new Date().toISOString(),
  });

  fs.writeFileSync(STYLE_GUIDE_FILE, JSON.stringify(guide, null, 2), 'utf-8');
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

// POST: フィードバックルールまたは良い例を追加、または投稿コメントを保存
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

    // 投稿へのコメント機能
    if (type === 'comment') {
      const { postId, postText, action, comment } = data;

      if (!postId || !postText || !action) {
        return NextResponse.json({ error: 'postId, postText, action are required' }, { status: 400 });
      }

      const comments = loadPostComments();
      const newComment: PostComment = {
        id: `comment_${Date.now()}`,
        postId,
        postText,
        action,
        comment: comment || '',
        createdAt: new Date().toISOString(),
        appliedToKnowledge: false
      };

      // アクションに応じてナレッジDBを更新
      let appliedToKnowledge = false;

      switch (action) {
        case 'approve':
          // 良い投稿として成功パターンに追加
          addToSuccessPatterns(postText, comment || '承認済み');
          appliedToKnowledge = true;
          // 投稿ステータスを更新
          try {
            await updatePostStatus(postId, 'approved');
          } catch (e) {
            console.error('Failed to update post status:', e);
          }
          break;

        case 'reject':
          // NGパターンとして記録
          addToNgPatterns(postText, comment || '却下');
          appliedToKnowledge = true;
          // 投稿ステータスを更新
          try {
            await updatePostStatus(postId, 'rejected');
          } catch (e) {
            console.error('Failed to update post status:', e);
          }
          break;

        case 'improve':
          // 改善コメントはそのまま保存（次回生成時に参照）
          if (comment) {
            // 改善ポイントをスタイルガイドに追加
            addToStyleGuide(`改善: ${comment}`);
            appliedToKnowledge = true;
          }
          break;

        case 'style':
          // スタイル指定をスタイルガイドに追加
          if (comment) {
            addToStyleGuide(comment);
            appliedToKnowledge = true;
          }
          break;
      }

      newComment.appliedToKnowledge = appliedToKnowledge;
      comments.push(newComment);
      savePostComments(comments);

      return NextResponse.json({
        success: true,
        comment: newComment,
        appliedToKnowledge
      });
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

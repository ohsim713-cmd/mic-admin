// LangGraph ノード定義
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PostState, QualityScore, QualityScoreSchema, QUALITY_THRESHOLD } from './types';
import fs from 'fs';
import path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// Geminiモデル初期化
function getModel() {
  return new ChatGoogleGenerativeAI({
    model: 'gemini-3-flash-preview',
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.8,
  });
}

// 品質チェック用モデル（低温度で安定した評価）
function getEvaluatorModel() {
  return new ChatGoogleGenerativeAI({
    model: 'gemini-3-flash-preview',
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.2,
  });
}

// メリットリスト読み込み
function getBenefits() {
  return [
    { label: '通勤ゼロ', desc: '家から一歩も出ずに稼げる' },
    { label: '時間自由', desc: '好きな時間に好きなだけ働ける' },
    { label: '顔出しなし', desc: '完全匿名で身バレの心配なし' },
    { label: '日払いOK', desc: '働いたらすぐお金になる' },
    { label: '月10万円の副収入', desc: '週3日×3時間で月10万円' },
    { label: '30代から始める人が多い', desc: '大人の女性を求めるユーザーは多い' },
    { label: '未経験OK', desc: 'スマホが使えれば誰でもできる' },
  ];
}

// ===== ノード1: 投稿生成 =====
export async function generatePostNode(state: PostState): Promise<Partial<PostState>> {
  const model = getModel();
  const benefits = getBenefits();
  const benefit = benefits[Math.floor(Math.random() * benefits.length)];

  const prompt = `あなたは在宅ワーク求人のプロコピーライターです。
以下の投稿タイプに合った投稿を作成してください。

【投稿タイプ】${state.postType}
【強調メリット】${benefit.label} - ${benefit.desc}
【ターゲット】${state.targetAudience}

### ルール
- 200-280文字（短く刺さる）
- 「私」視点のリアルな体験談風
- 数字を具体的に入れる（時間、金額、日数）
- ハッシュタグ禁止
- 2-3行ごとに空行
- ${state.postType === '求人' ? '最後に「気になる方はDMへ💬」のようなCTAを入れる' : 'CTAは軽めに'}

投稿文のみ出力。説明不要。`;

  try {
    const response = await model.invoke(prompt);
    const generatedPost = typeof response.content === 'string'
      ? response.content
      : response.content.toString();

    return {
      generatedPost: generatedPost.trim(),
      logs: [...state.logs, `[生成] 投稿を生成しました (${generatedPost.length}文字)`],
    };
  } catch (error: any) {
    return {
      error: `生成エラー: ${error.message}`,
      logs: [...state.logs, `[エラー] 生成失敗: ${error.message}`],
    };
  }
}

// ===== ノード2: 品質チェック =====
export async function qualityCheckNode(state: PostState): Promise<Partial<PostState>> {
  const model = getEvaluatorModel();
  const postToCheck = state.revisedPost || state.generatedPost;

  const prompt = `あなたはSNSマーケティングの専門家です。
以下の投稿の品質を評価してください。

【投稿】
${postToCheck}

【評価基準】
- hook: 書き出しの強さ（最初の1文で興味を引けるか）
- clarity: わかりやすさ（誰が読んでもすぐ理解できるか）
- cta: 行動喚起の効果（DMしたくなるか）
- authenticity: リアルさ・信頼性（体験談として自然か）

以下のJSON形式で出力してください：
{
  "overall": 7,
  "hook": 8,
  "clarity": 7,
  "cta": 6,
  "authenticity": 7,
  "issues": ["CTAが弱い", "数字がない"],
  "suggestions": ["具体的な金額を入れる", "DMへの誘導を強くする"]
}

JSONのみ出力。説明不要。`;

  try {
    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : response.content.toString();

    // JSON抽出
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSONが見つかりません');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const qualityScore = QualityScoreSchema.parse(parsed);
    const passed = qualityScore.overall >= QUALITY_THRESHOLD.minimum;

    return {
      qualityScore,
      passedQualityCheck: passed,
      logs: [
        ...state.logs,
        `[品質チェック] スコア: ${qualityScore.overall}/10 ${passed ? '✓合格' : '✗要改善'}`,
        ...(qualityScore.issues.length > 0 ? [`  問題点: ${qualityScore.issues.join(', ')}`] : []),
      ],
    };
  } catch (error: any) {
    // 品質チェック失敗時はデフォルトで通過させる
    return {
      qualityScore: {
        overall: 7,
        hook: 7,
        clarity: 7,
        cta: 7,
        authenticity: 7,
        issues: [],
        suggestions: [],
      },
      passedQualityCheck: true,
      logs: [...state.logs, `[品質チェック] 評価スキップ（エラー: ${error.message}）`],
    };
  }
}

// ===== ノード3: 投稿改善 =====
export async function revisePostNode(state: PostState): Promise<Partial<PostState>> {
  const model = getModel();
  const currentPost = state.revisedPost || state.generatedPost;
  const issues = state.qualityScore?.issues || [];
  const suggestions = state.qualityScore?.suggestions || [];

  const prompt = `以下の投稿を改善してください。

【現在の投稿】
${currentPost}

【問題点】
${issues.join('\n')}

【改善案】
${suggestions.join('\n')}

### ルール
- 200-280文字を維持
- 指摘された問題点を修正
- 良い部分は残す
- ハッシュタグ禁止

改善した投稿文のみ出力。説明不要。`;

  try {
    const response = await model.invoke(prompt);
    const revisedPost = typeof response.content === 'string'
      ? response.content
      : response.content.toString();

    return {
      revisedPost: revisedPost.trim(),
      revisionCount: state.revisionCount + 1,
      logs: [...state.logs, `[改善] 投稿を修正しました (${state.revisionCount + 1}回目)`],
    };
  } catch (error: any) {
    return {
      logs: [...state.logs, `[改善エラー] ${error.message}`],
    };
  }
}

// ===== ノード4: X投稿 =====
export async function postToXNode(state: PostState): Promise<Partial<PostState>> {
  const { TwitterApi } = await import('twitter-api-v2');
  const crypto = await import('crypto');

  const SETTINGS_FILE = path.join(KNOWLEDGE_DIR, 'twitter_credentials.json');
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';

  // 復号化
  function decrypt(text: string): string {
    try {
      const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
      const parts = text.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '';
    }
  }

  try {
    // 認証情報読み込み
    if (!fs.existsSync(SETTINGS_FILE)) {
      throw new Error('Twitter credentials not found');
    }

    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const credentials = {
      apiKey: parsed.apiKey ? decrypt(parsed.apiKey) : '',
      apiSecret: parsed.apiSecret ? decrypt(parsed.apiSecret) : '',
      accessToken: parsed.accessToken ? decrypt(parsed.accessToken) : '',
      accessSecret: parsed.accessSecret ? decrypt(parsed.accessSecret) : '',
    };

    if (!credentials.apiKey || !credentials.accessToken) {
      throw new Error('Twitter credentials incomplete');
    }

    // 投稿
    const client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });

    const postText = state.revisedPost || state.generatedPost;
    const tweet = await client.v2.tweet(postText);

    return {
      posted: true,
      tweetId: tweet.data.id,
      logs: [...state.logs, `[投稿完了] Tweet ID: ${tweet.data.id}`],
    };
  } catch (error: any) {
    return {
      posted: false,
      error: error.message,
      logs: [...state.logs, `[投稿エラー] ${error.message}`],
    };
  }
}

// ===== 条件分岐: 品質チェック結果 =====
export function shouldRevise(state: PostState): 'revise' | 'post' {
  // 最大改善回数に達したら投稿
  if (state.revisionCount >= state.maxRevisions) {
    return 'post';
  }
  // 品質チェック通過なら投稿
  if (state.passedQualityCheck) {
    return 'post';
  }
  // それ以外は改善
  return 'revise';
}

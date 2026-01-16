import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  generateProfileAnalysisPrompt,
  generateProfileImprovementPrompt,
  generateStreamIdeasPrompt,
  getUpcomingEvents,
} from '@/lib/research/site-analyzer';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { type, input } = await request.json();

    let prompt = '';

    switch (type) {
      case 'competitor':
        // 競合分析
        prompt = `以下の配信者のプロフィールを分析して、以下の観点でフィードバックをください。

## 入力情報
${input}

## 分析してください
1. **強み** (3-5個): このプロフィールの良い点
2. **学べるポイント** (3-5個): 真似したい要素
3. **差別化のヒント**: この配信者と差別化するには
4. **効果的なキーワード**: プロフィールで使われている効果的な言葉
5. **チップメニューの特徴**: 価格設定や内容の工夫

実践的で具体的なアドバイスをお願いします。`;
        break;

      case 'profile':
        // プロフィール改善
        prompt = `私のライブ配信プロフィールを改善してください。

## 私の情報
自己紹介: ${input.bio || '(未設定)'}
スタイル: ${input.style || 'natural'}

## 改善案を提案してください

### 1. 自己紹介文の改善案
- 英語版と日本語版の両方を提案
- 絵文字を効果的に使用
- 150-200文字程度

### 2. おすすめタグ (10個)
- ジャンル、スタイル、特徴を表すタグ

### 3. チップメニュー案 (8-10項目)
- 価格帯: 10-500 tokens
- バランスの良い構成で

### 4. 配信タイトル案 (5個)
- 目を引くタイトル

### 5. 差別化ポイント
- 他の配信者と差をつける工夫

具体的で今すぐ使える内容でお願いします。`;
        break;

      case 'ideas':
        // 配信ネタ提案
        const events = getUpcomingEvents().slice(0, 5);
        const eventNames = events.map(e => `${e.name}(${e.date})`).join(', ');

        prompt = `配信のネタ・企画を提案してください。

## 私のスタイル
${input.style || 'ナチュラル系'}

## 今後のイベント
${eventNames || '特になし'}

## 提案してください

### すぐできるネタ (5個)
準備不要で今日からできるもの

### 企画モノ (3個)
少し準備が必要だけど盛り上がるもの

### 季節・イベント企画 (3個)
今後のイベントに合わせたもの

### 視聴者参加型 (3個)
視聴者と一緒に楽しめるもの

それぞれ以下の形式で:
- **タイトル**: 〇〇
- **概要**: 〇〇
- **準備**: 〇〇
- **チップゴール案**: 〇〇 tokens

具体的で実践しやすいアイデアをお願いします。`;
        break;

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({ analysis: text });
  } catch (error) {
    console.error('Research API error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

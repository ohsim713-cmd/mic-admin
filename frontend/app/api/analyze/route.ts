import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'asia-northeast1',
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
});

export async function POST(request: NextRequest) {
  try {
    const { post } = await request.json();

    if (!post) {
      return NextResponse.json({ error: 'Post content is required' }, { status: 400 });
    }

    const prompt = `
あなたはチャットレディ事務所のマーケティング専門家です。
以下のX（旧Twitter）投稿文を分析し、改善点を提案してください。

# 投稿文
${post}

# 分析項目
1. **強み（3つ）**: この投稿の良い点を具体的に挙げてください
2. **改善点（3つ）**: より効果的にするための具体的な改善提案
3. **総合評価**: 5段階評価（1-5）とその理由
4. **推奨アクション**: すぐに実行できる具体的な改善案

簡潔かつ実用的なフィードバックを提供してください。
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const feedback = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze post' },
      { status: 500 }
    );
  }
}

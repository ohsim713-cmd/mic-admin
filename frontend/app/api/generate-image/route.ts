import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
  console.log('=== Generate Image API (generate-image) called ===');

  try {
    const body = await request.json();
    const { designDescription } = body;
    console.log('Design Description:', designDescription);

    if (!designDescription) {
      return NextResponse.json(
        { error: 'デザインの説明が必要です' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return NextResponse.json(
        { error: 'GEMINI_API_KEYが設定されていません。.env.localを確認してください。' },
        { status: 500 }
      );
    }

    // 季節判定
    const month = new Date().getMonth() + 1;
    let seasonalStyle = 'cherry blossom pink, soft pastels, floral patterns';
    if (month >= 6 && month <= 8) seasonalStyle = 'vibrant colors, ocean blue, tropical motifs';
    else if (month >= 9 && month <= 11) seasonalStyle = 'burgundy, amber, gold leaf, warm tones';
    else if (month >= 12 || month <= 2) seasonalStyle = 'snowflake, silver glitter, deep red, gold';

    const prompt = `Generate a stunning professional nail art photograph:

DESIGN: ${designDescription}

STYLE:
- Ultra high-end nail salon quality
- Elegant female hands with perfectly manicured nails
- Close-up macro shot
- ${seasonalStyle}
- Professional studio lighting
- Shallow depth of field (bokeh background)
- Clean, minimalist background
- Magazine editorial style
- Photorealistic

Create an Instagram-worthy nail art image.`;

    // まずGemini 3 Flashを試す (2026年現在の利用可能モデル)
    console.log('Trying Gemini 3 Flash for image generation...');

    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"]
        }
      })
    });

    console.log('Gemini 3 Flash Response Status:', response.status);

    let data;

    if (response.ok) {
      data = await response.json();
      console.log('Gemini response received, checking for image data...');

      // Gemini 3 Flash形式のレスポンス処理
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            console.log('Image generated successfully with Gemini 3 Flash!');
            return NextResponse.json({ imageUrl });
          }
        }
      }
    }

    // Gemini 3 Flashで画像が取得できなかった場合、Gemini 3 Pro Imageを試す
    console.log('Gemini 3 Flash did not return image, trying Gemini 3 Pro Image...');

    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["IMAGE"]
        }
      })
    });

    console.log('Gemini 3 Pro Image Response Status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Imagen API error:', JSON.stringify(errorData, null, 2));

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'APIのレート制限に達しました。1分ほど待ってから再試行してください。' },
          { status: 429 }
        );
      }

      // 両方失敗した場合のエラー
      return NextResponse.json(
        { error: '画像生成に失敗しました。APIモデルが利用できない可能性があります。', detail: errorData.error?.message || JSON.stringify(errorData) },
        { status: response.status }
      );
    }

    data = await response.json();
    console.log('Gemini 3 Pro response received');

    // Gemini 3 Pro形式のレスポンス処理
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          console.log('Image generated successfully with Gemini 3 Pro!');
          return NextResponse.json({ imageUrl });
        }
      }
    }

    console.error('Unexpected response format:', JSON.stringify(data, null, 2));
    return NextResponse.json(
      { error: '画像データが取得できませんでした', detail: 'APIレスポンスの形式が不明です' },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: '画像生成に失敗しました', detail: error.message },
      { status: 500 }
    );
  }
}

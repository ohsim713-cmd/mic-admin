import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
    console.log('Instagram Image Generation API called');

    try {
        const { designDescription } = await request.json();

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

        // 季節を判定
        const month = new Date().getMonth() + 1;
        let seasonalStyle = 'soft pastels, floral patterns';
        if (month >= 6 && month <= 8) seasonalStyle = 'vibrant colors, ocean blue, tropical motifs';
        else if (month >= 9 && month <= 11) seasonalStyle = 'burgundy, amber, gold leaf, warm earth tones';
        else if (month >= 12 || month <= 2) seasonalStyle = 'snowflake designs, silver glitter, deep red, white and gold';

        // 画像生成プロンプト
        const prompt = `Generate a stunning professional nail art photograph with:

DESIGN: ${designDescription}

STYLE:
- Ultra high-end nail salon quality photograph
- Elegant female hands with perfectly manicured nails
- Close-up macro shot
- ${seasonalStyle}

TECHNICAL:
- Professional studio lighting
- Shallow depth of field (bokeh background)
- Clean, minimalist background
- Magazine editorial style
- Photorealistic

Create an Instagram-worthy image.`;

        console.log('Calling Imagen 3 API...');

        // Imagen 3 API呼び出し
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "1:1"
                }
            })
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Imagen API error:', JSON.stringify(errorData));

            if (response.status === 429) {
                return NextResponse.json(
                    { error: 'APIのレート制限に達しました。少し待ってから再試行してください。' },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                { error: '画像生成に失敗しました', detail: errorData.error?.message || '不明なエラー' },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log('Imagen response received successfully');

        // Imagen 3 形式のレスポンス処理
        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
            const base64Image = data.predictions[0].bytesBase64Encoded;
            const imageUrl = `data:image/jpeg;base64,${base64Image}`;
            return NextResponse.json({ imageUrl });
        }

        return NextResponse.json(
            { error: '画像データが取得できませんでした' },
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

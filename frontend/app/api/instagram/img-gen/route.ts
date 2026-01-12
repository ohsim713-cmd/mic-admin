import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
    console.log('Generate Image API (img-gen) called');

    try {
        const { designDescription } = await request.json();

        if (!designDescription) {
            return NextResponse.json(
                { error: 'デザインの説明が必要です' },
                { status: 400 }
            );
        }

        if (!apiKey) {
            console.error('API Key missing in img-gen');
            return NextResponse.json(
                { error: 'GEMINI_API_KEYが設定されていません。.env.localを確認してください。' },
                { status: 500 }
            );
        }

        // ナレッジベース読み込み（失敗しても続行するロジック）
        let trendColors = '';
        let seasonalStyle = 'soft pastels, floral patterns';

        try {
            const knowledgeDir = path.join(process.cwd(), 'knowledge');
            const loadK = (f: string) => {
                try {
                    const p = path.join(knowledgeDir, f);
                    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
                } catch (e) { console.error(`Failed to load ${f}`, e); }
                return null;
            };

            const nailTrends = loadK('nail_trends.json');
            if (nailTrends?.colorPalette?.primary) {
                trendColors = nailTrends.colorPalette.primary.slice(0, 3).join(', ');
            }

            // Season Logic inline
            const month = new Date().getMonth() + 1;
            let season = 'spring';
            if (month >= 6 && month <= 8) season = 'summer';
            else if (month >= 9 && month <= 11) season = 'autumn';
            else if (month >= 12 || month <= 2) season = 'winter';

            const styles: Record<string, string> = {
                spring: 'cherry blossom pink, soft pastels, floral patterns, fresh green accents',
                summer: 'vibrant colors, ocean blue, tropical motifs, bright neon, holographic',
                autumn: 'burgundy, amber, gold leaf, tortoiseshell, warm earth tones',
                winter: 'snowflake designs, silver glitter, deep red, white and gold, festive sparkle'
            };
            seasonalStyle = styles[season] || styles.spring;

        } catch (e) {
            console.error('Error in knowledge loading block', e);
        }

        // プロ級の画像生成プロンプト
        const prompt = `プロフェッショナルなネイルアート写真を生成してください。

デザイン: ${designDescription}

スタイル要件:
- 高級ネイルサロンのクオリティの写真
- 美しくマニキュアされた爪
- ネイルアートの詳細に焦点を当てたクローズアップ
- ${seasonalStyle}
${trendColors ? `- トレンドカラー: ${trendColors}` : ''}

技術仕様:
- プロのスタジオ照明
- ぼかした背景
- クリーンでミニマリストな背景（白い大理石、ソフトピンク、またはニュートラル）
- 雑誌の編集スタイル
- フォトリアリスティック

構図:
- エレガントに配置された手
- ネイルアートを見せるために軽く曲げた指
- Instagram向けの美しい写真`;

        console.log('Image prompt:', prompt);

        // Gemini 2.0 Flash で画像生成
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: prompt,
            config: {
                responseModalities: ['Text', 'Image'],
            },
        });

        console.log('Gemini response received');

        // レスポンスから画像を抽出
        if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                    return NextResponse.json({ imageUrl });
                }
            }
        }

        return NextResponse.json(
            { error: '画像データが取得できませんでした', detail: 'APIレスポンスに画像が含まれていません' },
            { status: 500 }
        );

    } catch (error: any) {
        console.error('Image generation failed:', error);

        // エラーメッセージを詳細に
        let errorMessage = '画像生成に失敗しました';
        if (error.message?.includes('429') || error.message?.includes('rate')) {
            errorMessage = 'APIのレート制限に達しました。少し待ってから再試行してください。';
        } else if (error.message?.includes('API key')) {
            errorMessage = 'APIキーが無効です。設定を確認してください。';
        }

        return NextResponse.json(
            { error: errorMessage, detail: error.message },
            { status: 500 }
        );
    }
}

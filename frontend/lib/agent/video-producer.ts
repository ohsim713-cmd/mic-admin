/**
 * 動画プロデューサーエージェント（Video Producer）
 *
 * バズ投稿から台本を生成し、HeyGenで動画化
 * 画像生成も担当
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { BuzzPost, updateBuzzStatus } from './buzz-detector';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCRIPTS_PATH = path.join(DATA_DIR, 'video_scripts.json');

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// ========================================
// 型定義
// ========================================

export interface VideoScript {
  id: string;
  buzzPostId: string;
  originalText: string;
  script: string;
  duration: number; // 秒
  scenes: ScriptScene[];
  voiceStyle: 'friendly' | 'professional' | 'energetic';
  createdAt: string;
  status: 'draft' | 'approved' | 'video_created';
}

export interface ScriptScene {
  order: number;
  duration: number;
  narration: string;
  visualDescription: string;
  imagePrompt?: string;
  imageUrl?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  url?: string;
  prompt: string;
  error?: string;
}

// ========================================
// 台本生成
// ========================================

export async function generateScript(
  buzzPost: BuzzPost,
  targetDuration: number = 30
): Promise<VideoScript> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `あなたはSNS動画のスクリプトライターです。
バズったツイートを元に、TikTok/Reels向けのショート動画台本を作成します。

ルール:
- 最初の3秒で視聴者を掴む（フック）
- テンポよく、無駄な言葉は削る
- 具体的な数字やストーリーを入れる
- 最後にCTAを入れる
- 自然な話し言葉で`,
  });

  const prompt = `
以下のバズ投稿を${targetDuration}秒のショート動画台本に変換してください。

【バズ投稿】
${buzzPost.text}

【パフォーマンス】
- インプレッション: ${buzzPost.impressions.toLocaleString()}
- エンゲージメント率: ${buzzPost.engagementRate.toFixed(1)}%
- バズスコア: ${buzzPost.buzzScore}点

以下のJSON形式で出力:
{
  "script": "完全な台本（ナレーション全文）",
  "duration": ${targetDuration},
  "scenes": [
    {
      "order": 1,
      "duration": 5,
      "narration": "この部分のナレーション",
      "visualDescription": "この部分の映像イメージ",
      "imagePrompt": "画像生成用のプロンプト（英語）"
    },
    ...
  ],
  "voiceStyle": "friendly"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON形式の出力が見つかりません');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const script: VideoScript = {
      id: `script-${Date.now()}`,
      buzzPostId: buzzPost.id,
      originalText: buzzPost.text,
      script: parsed.script,
      duration: parsed.duration || targetDuration,
      scenes: parsed.scenes || [],
      voiceStyle: parsed.voiceStyle || 'friendly',
      createdAt: new Date().toISOString(),
      status: 'draft',
    };

    // 保存
    saveScript(script);

    // バズ投稿のステータスを更新
    updateBuzzStatus(buzzPost.id, 'scripted', { script: script.script });

    console.log(`[VideoProducer] Script generated: ${script.id}`);

    return script;
  } catch (e: any) {
    console.error('[VideoProducer] Script generation failed:', e);
    throw e;
  }
}

// ========================================
// 台本の保存・取得
// ========================================

function loadScripts(): VideoScript[] {
  try {
    if (fs.existsSync(SCRIPTS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SCRIPTS_PATH, 'utf-8'));
      return data.scripts || [];
    }
  } catch (e) {
    console.error('[VideoProducer] Failed to load scripts:', e);
  }
  return [];
}

function saveScript(script: VideoScript): void {
  const scripts = loadScripts();
  const existingIndex = scripts.findIndex(s => s.id === script.id);

  if (existingIndex >= 0) {
    scripts[existingIndex] = script;
  } else {
    scripts.push(script);
  }

  try {
    fs.writeFileSync(SCRIPTS_PATH, JSON.stringify({ scripts }, null, 2));
  } catch (e) {
    console.error('[VideoProducer] Failed to save script:', e);
  }
}

export function getScripts(status?: VideoScript['status']): VideoScript[] {
  const scripts = loadScripts();
  if (status) {
    return scripts.filter(s => s.status === status);
  }
  return scripts;
}

export function getScriptById(id: string): VideoScript | null {
  const scripts = loadScripts();
  return scripts.find(s => s.id === id) || null;
}

export function updateScriptStatus(
  scriptId: string,
  status: VideoScript['status']
): VideoScript | null {
  const scripts = loadScripts();
  const index = scripts.findIndex(s => s.id === scriptId);

  if (index < 0) return null;

  scripts[index].status = status;

  try {
    fs.writeFileSync(SCRIPTS_PATH, JSON.stringify({ scripts }, null, 2));
  } catch (e) {
    console.error('[VideoProducer] Failed to update script:', e);
  }

  return scripts[index];
}

// ========================================
// 画像生成（Imagen 3）
// ========================================

export async function generateImage(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '9:16' | '16:9' | '3:4' | '4:3';
    numberOfImages?: number;
  } = {}
): Promise<ImageGenerationResult> {
  const { aspectRatio = '9:16', numberOfImages = 1 } = options;

  try {
    return await generateImageWithImagen3(prompt, aspectRatio, numberOfImages);
  } catch (e: any) {
    console.error('[ImageGen] Failed:', e);
    return {
      success: false,
      prompt,
      error: e.message,
    };
  }
}

// Imagen 3 での画像生成（Vertex AI / AI Studio）
async function generateImageWithImagen3(
  prompt: string,
  aspectRatio: string,
  numberOfImages: number
): Promise<ImageGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      prompt,
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    // Gemini API経由でImagen 3を使用
    // 注: imagen-3.0-generate-001 モデルを使用
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: prompt,
            },
          ],
          parameters: {
            sampleCount: numberOfImages,
            aspectRatio: aspectRatio,
            // safetyFilterLevel: 'block_few', // 必要に応じて調整
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const predictions = data.predictions || [];

    if (predictions.length === 0) {
      return {
        success: false,
        prompt,
        error: 'No image generated',
      };
    }

    // Base64画像データを取得
    const imageData = predictions[0].bytesBase64Encoded;

    if (!imageData) {
      return {
        success: false,
        prompt,
        error: 'No image data in response',
      };
    }

    // Base64データをData URLに変換
    const imageUrl = `data:image/png;base64,${imageData}`;

    return {
      success: true,
      prompt,
      url: imageUrl,
    };
  } catch (e: any) {
    console.error('[ImageGen] Imagen 3 failed:', e);

    // フォールバック: Gemini 2.0のネイティブ画像生成を試す
    return await generateImageWithGeminiNative(prompt);
  }
}

// Gemini 2.0 ネイティブ画像生成（フォールバック）
async function generateImageWithGeminiNative(prompt: string): Promise<ImageGenerationResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `Generate an image for social media (TikTok/Reels style, vertical 9:16): ${prompt}`,
        }],
      }],
    });

    const response = result.response;
    const candidates = response.candidates || [];

    // 画像パートを探す
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts || []) {
        if ('inlineData' in part && part.inlineData) {
          return {
            success: true,
            prompt,
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          };
        }
      }
    }

    return {
      success: false,
      prompt,
      error: 'No image in response',
    };
  } catch (e: any) {
    console.error('[ImageGen] Gemini native failed:', e);
    return {
      success: false,
      prompt,
      error: e.message,
    };
  }
}

// ========================================
// シーン画像の一括生成
// ========================================

export async function generateSceneImages(
  script: VideoScript
): Promise<VideoScript> {
  const updatedScenes: ScriptScene[] = [];

  for (const scene of script.scenes) {
    if (scene.imagePrompt) {
      console.log(`[VideoProducer] Generating image for scene ${scene.order} with Imagen 3...`);

      const result = await generateImage(scene.imagePrompt, { aspectRatio: '9:16' });

      updatedScenes.push({
        ...scene,
        imageUrl: result.url,
      });

      // レート制限回避のため待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      updatedScenes.push(scene);
    }
  }

  script.scenes = updatedScenes;
  saveScript(script);

  return script;
}

// ========================================
// バズ投稿から動画素材を一括生成
// ========================================

export async function processForVideo(
  buzzPost: BuzzPost,
  options: {
    duration?: number;
    generateImages?: boolean;
  } = {}
): Promise<{
  script: VideoScript;
  imagesGenerated: number;
}> {
  const {
    duration = 30,
    generateImages = true,
  } = options;

  // 1. 台本生成
  console.log('[VideoProducer] Step 1: Generating script...');
  let script = await generateScript(buzzPost, duration);

  // 2. 画像生成（オプション）- Imagen 3使用
  let imagesGenerated = 0;
  if (generateImages && script.scenes.length > 0) {
    console.log('[VideoProducer] Step 2: Generating scene images with Imagen 3...');
    script = await generateSceneImages(script);
    imagesGenerated = script.scenes.filter(s => s.imageUrl).length;
  }

  console.log(`[VideoProducer] Complete! Script: ${script.id}, Images: ${imagesGenerated}`);

  return {
    script,
    imagesGenerated,
  };
}

// ========================================
// 統計
// ========================================

export function getVideoProducerStats(): {
  totalScripts: number;
  pendingApproval: number;
  videoCreated: number;
  imagesGenerated: number;
} {
  const scripts = loadScripts();

  const imagesGenerated = scripts.reduce((acc, s) => {
    return acc + s.scenes.filter(scene => scene.imageUrl).length;
  }, 0);

  return {
    totalScripts: scripts.length,
    pendingApproval: scripts.filter(s => s.status === 'draft').length,
    videoCreated: scripts.filter(s => s.status === 'video_created').length,
    imagesGenerated,
  };
}

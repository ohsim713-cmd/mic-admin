import os
from google import genai
from dotenv import load_dotenv
from typing import List
from google.genai import types
import base64

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def generate_chatre_post(target: str, atmosphere: str, perks: List[str]) -> str:
    if not GEMINI_API_KEY:
        return "Error: GEMINI_API_KEY is not set in the environment variables."

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # 特典リストを文字列に変換
        perks_text = "、".join(perks) if perks else "未指定"

        prompt = f"""
あなたは、チャットレディ事務所の採用SNS運用代行を行うプロのマーケターです。
ターゲット層の心に刺さり、思わずDMを送りたくなるようなX（旧Twitter）の投稿文を1つ作成してください。

【提供された情報】
・ターゲット: {target}
・投稿の雰囲気: {atmosphere}
・アピールポイント（特典）: {perks_text}

【作成ルール】
1. 構成: 
   - [フック]: ターゲットが「これ私のこと？」と思うような1行目
   - [ベネフィット]: この事務所で働くメリット（アピールポイントを自然に組み込む）
   - [信頼/安心感]: "{atmosphere}"な雰囲気が伝わる言葉
   - [CTA]: DMやLINEへの誘導（例: 「詳細はDMまで💌」）
2. 文字数: 140文字以内（厳守）
3. トーン: {atmosphere} なイメージを強調した、ターゲットにとって心地よい言葉遣い
4. 絵文字: 適度に使用し、視認性を高める
5. ハッシュタグ: 業界で人気のタグを2〜3個含める

【出力上の注意】
- 前置きや、構成案の説明（[フック]などのラベル）は一切不要です。
- 投稿文そのものだけを出力してください。
"""
        
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )
        
        if response.text:
            return response.text.strip()
        return "Error: No content generated."
        

    except Exception as e:
        return f"Error generating content: {str(e)}"

def generate_image(prompt: str) -> str:
    """
    Generates an image using Imagen 3 model and returns base64 encoded string.
    """
    if not GEMINI_API_KEY:
        return None

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_image(
            model='imagen-3.0-generate-001',
            prompt=prompt,
            config=types.GenerateImageConfig(
                number_of_images=1,
            )
        )
        if response.generated_images:
            image_bytes = response.generated_images[0].image.image_bytes
            return base64.b64encode(image_bytes).decode('utf-8')
        return None
    except Exception as e:
        print(f"Error generating image: {e}")
        return None

def generate_short_video_script(topic: str) -> str:
    """
    Generates a script for a short video (TikTok/Reels/Shorts).
    """
    if not GEMINI_API_KEY:
        return "Error: GEMINI_API_KEY is not set."

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f'''
あなたはショート動画（TikTok/Reels/Shorts）のプロ脚本家です。
以下のテーマに基づいて、視聴維持率が高く、最後まで見たくなるショート動画の台本を作成してください。

【テーマ】: {topic}

【出力フォーマット】
# タイトル: [キャッチーなタイトル]

## 構成案
- **0-3秒 (フック)**: 
  - 映像: [具体的な映像指示]
  - 音声: [セリフやナレーション]
- **3-15秒 (導入)**: 
  - 映像: ...
  - 音声: ...
- **15-45秒 (本題)**: 
  - 映像: ...
  - 音声: ...
- **45-60秒 (結末/CTA)**: 
  - 映像: ...
  - 音声: ...
'''
        
        response = client.models.generate_content(
            model="gemini-1.5-flash", 
            contents=prompt
        )
        
        if response.text:
            return response.text.strip()
        return "Error: No script generated."
        
    except Exception as e:
        return f"Error generating script: {str(e)}"


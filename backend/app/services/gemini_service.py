import os
from google import genai
from dotenv import load_dotenv
from typing import List

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

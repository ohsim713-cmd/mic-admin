import re

# ファイルの読み込み
file_path = r"c:\Users\user\.gemini\antigravity\playground\charged-tyson\knowledge\past_posts.txt"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

cleaned_posts = []
# ヘッダーと思われる行や、初期のサンプルを除外して25行目（スプレッドシートデータ開始）から処理
# ただし元々のサンプル（1-1~1-3）も良いものなので残す
cleaned_posts.append("【過去の成功投稿例】\n")

for line in lines:
    # 行をタブで分割 (スプレッドシートコピペは通常タブ区切り)
    parts = line.split('\t')
    
    # 本文（通常2列目）を取得
    if len(parts) > 1:
        content = parts[1].strip()
        # 文頭文末の引用符を削除
        if content.startswith('"') and content.endswith('"'):
            content = content[1:-1]
        
        # 内部の "" (エスケープされた引用符) を " に戻す
        content = content.replace('""', '"')
        
        # 不要なメタデータ行（IDなどが含まれる行）をスキップ
        if content == "Text" or not content or content == "Language":
            continue
            
        # 投稿として追加
        if content not in cleaned_posts:
            cleaned_posts.append(f"--- \n{content}\n")
    else:
        # タブがない行（最初のサンプルなど）はそのまま活かす
        stripped = line.strip()
        if stripped and not stripped.startswith("ID\tText"):
            cleaned_posts.append(stripped)

# ファイルに書き戻し
with open(file_path, "w", encoding="utf-8") as f:
    f.write("\n".join(cleaned_posts))

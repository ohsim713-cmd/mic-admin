# /wordpress - WordPress記事生成スキル

SEO対策済みの長編記事を生成してWordPressに投稿します。

## 使い方

```
/wordpress [トピック]
```

**例:**
- `/wordpress` → トピック一覧から選択
- `/wordpress ライバー 始め方` → 指定トピックで生成

## 実行手順

1. **トピック確認**
   - knowledge/liver_article_topics.json から候補取得
   - または指定トピックを使用

2. **記事生成**
   ```bash
   curl -X POST "http://localhost:3000/api/wordpress/generate-article" \
     -H "Content-Type: application/json" \
     -d '{"topic": "[トピック]", "type": "liver"}'
   ```

3. **プレビュー表示**
   - タイトル
   - 見出し構成
   - 本文プレビュー（冒頭500文字）

4. **投稿確認**
   - ユーザーに確認後、WordPressに投稿

## 記事タイプ

| タイプ | 対象サイト | 内容 |
|--------|-----------|------|
| liver | ms-livechat.com | ライバー向け情報記事 |
| chatlady | （未設定） | チャトレ向け情報記事 |

## SEO対策

- H1/H2/H3構造
- メタディスクリプション
- 内部リンク
- キーワード最適化

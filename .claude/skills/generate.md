# /generate - 投稿生成スキル

投稿を生成してストックに追加します。

## 使い方

```
/generate [件数] [アカウント]
```

**例:**
- `/generate` → liver用に5件生成
- `/generate 10` → 10件生成
- `/generate 5 chatre1` → chatre1用に5件生成

## 実行手順

1. **現在のストック確認**
   ```bash
   curl -s "http://localhost:3000/api/automation/stock?view=full"
   ```

2. **投稿生成**
   ```bash
   curl -X POST "http://localhost:3000/api/generate/langgraph" \
     -H "Content-Type: application/json" \
     -d '{"count": [件数], "account": "[アカウント]"}'
   ```

3. **品質チェック結果を報告**
   - 平均スコア
   - 8点以上の件数
   - リトライ回数

4. **ストック状況を再確認して報告**

## アカウント

| ID | 用途 |
|----|------|
| liver | ライバー募集（@tt_liver） |
| chatre1 | チャトレ募集（@mic_chat_） |
| chatre2 | チャトレ募集（@ms_stripchat） |

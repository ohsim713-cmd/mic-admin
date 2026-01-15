# /post - 即時投稿スキル

ストックから投稿を取り出してTwitterに投稿します。

## 使い方

```
/post [アカウント] [--dry]
```

**例:**
- `/post` → 全アカウントに投稿
- `/post liver` → liverのみ投稿
- `/post --dry` → ドライラン（実際には投稿しない）

## 実行手順

1. **スケジュール確認**
   ```bash
   curl -s "http://localhost:3000/api/automation/post"
   ```

2. **投稿実行**
   ```bash
   curl -X POST "http://localhost:3000/api/automation/post" \
     -H "Content-Type: application/json" \
     -d '{"dryRun": [true/false], "secret": "[AUTO_POST_SECRET]"}'
   ```

3. **結果報告**
   - 投稿したアカウント
   - 投稿内容（プレビュー）
   - 成功/失敗ステータス

## 注意

- 現在 `@tt_liver` のみ自動投稿有効
- chatre1, chatre2 は停止中
- 1日15投稿が目標

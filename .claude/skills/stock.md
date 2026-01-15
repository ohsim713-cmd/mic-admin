# /stock - ストック管理スキル

投稿ストックの確認と補充を行います。

## 使い方

```
/stock [アクション]
```

**例:**
- `/stock` → ストック状況を確認
- `/stock refill` → 不足分を自動補充

## 実行手順

### 確認モード（デフォルト）

1. **ストック状況取得**
   ```bash
   curl -s "http://localhost:3000/api/automation/stock?view=full"
   ```

2. **報告内容**
   - 各アカウントの在庫数
   - 補充が必要なアカウント
   - 推奨アクション

### 補充モード

1. **全アカウント補充**
   ```bash
   curl -X POST "http://localhost:3000/api/automation/stock" \
     -H "Content-Type: application/json" \
     -d '{"action": "refill-all", "secret": "[AUTO_POST_SECRET]"}'
   ```

2. **補充結果を報告**

## 目標在庫数

| 設定 | 値 |
|------|-----|
| 最小在庫 | 15件（1日分） |
| 最大在庫 | 30件（2日分） |
| 補充開始 | 10件以下 |

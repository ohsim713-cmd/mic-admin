# Google Cloud デプロイガイド

このガイドでは、MIC Admin を Google Cloud にデプロイする手順を説明します。

## 前提条件

1. Google Cloud アカウント
2. gcloud CLI インストール済み
3. Docker インストール済み（ローカルビルド時）

## Step 1: Google Cloud プロジェクト作成

```bash
# 1. Google Cloud Console でプロジェクトを作成
# https://console.cloud.google.com/projectcreate

# 2. gcloud CLI でログイン
gcloud auth login

# 3. プロジェクトを設定
export GOOGLE_CLOUD_PROJECT=your-project-id
gcloud config set project $GOOGLE_CLOUD_PROJECT
```

## Step 2: Firestore 設定

```bash
# Firestore データベースを作成
cd frontend
./scripts/setup-firestore.sh
```

または手動で:
1. https://console.cloud.google.com/firestore にアクセス
2. 「ネイティブモード」を選択
3. リージョン「asia-northeast1」を選択

## Step 3: Cloud Run デプロイ

```bash
# デプロイスクリプトを実行
./scripts/deploy-gcp.sh
```

### 環境変数の設定

デプロイ後、環境変数を設定:

```bash
gcloud run services update mic-admin \
  --region asia-northeast1 \
  --set-env-vars "\
GEMINI_API_KEY=your-gemini-api-key,\
TWITTER_API_KEY_TT_LIVER=xxx,\
TWITTER_API_SECRET_TT_LIVER=xxx,\
TWITTER_ACCESS_TOKEN_TT_LIVER=xxx,\
TWITTER_ACCESS_SECRET_TT_LIVER=xxx"
```

## Step 4: Cloud Scheduler 設定

```bash
# スケジューラを設定（1日15回の自動投稿）
./scripts/setup-scheduler.sh
```

## 構成図

```
┌─────────────────────────────────────────────────────┐
│                 Google Cloud                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cloud Scheduler (15 jobs/day)                      │
│       │                                             │
│       ▼                                             │
│  Cloud Run (mic-admin)                              │
│       │                                             │
│       ├──▶ Firestore (データ永続化)                  │
│       │    ├─ post_stock                            │
│       │    ├─ success_patterns                      │
│       │    ├─ posts_history                         │
│       │    └─ ...                                   │
│       │                                             │
│       ├──▶ Gemini API (AI生成)                      │
│       └──▶ X API (投稿)                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 料金目安

| サービス | 無料枠 | 予想コスト |
|---------|-------|----------|
| Cloud Run | 200万リクエスト/月 | $0-5 |
| Firestore | 1GB, 5万読取/日 | $0-3 |
| Cloud Scheduler | 3ジョブ | $0-2 |
| **合計** | - | **$0-15/月** |

## トラブルシューティング

### Cloud Run がタイムアウトする

```bash
# タイムアウトを延長
gcloud run services update mic-admin \
  --region asia-northeast1 \
  --timeout 300
```

### Firestore 接続エラー

1. Cloud Run サービスアカウントに Firestore 権限を付与:
```bash
gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
  --member="serviceAccount:$GOOGLE_CLOUD_PROJECT@appspot.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### ローカル開発時の認証

```bash
# サービスアカウントキーを作成
gcloud iam service-accounts keys create ./service-account.json \
  --iam-account=mic-admin@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com

# 環境変数に設定
export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

## ローカル開発

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
# .env.local を編集

# 開発サーバー起動
npm run dev
```

## コードの切り替え

Firestore版のライブラリを使用するには:

```typescript
// 旧: JSONファイル版
import { getStockCounts } from '@/lib/dm-hunter/post-stock';

// 新: Firestore版
import { getStockCounts } from '@/lib/firebase';
```

## 監視とアラート

Cloud Monitoring でアラートを設定:

1. https://console.cloud.google.com/monitoring にアクセス
2. 「アラートポリシーを作成」
3. 条件: Cloud Run エラー率 > 5%
4. 通知チャンネル: メールまたは Slack

## 次のステップ

- [ ] 本番環境の環境変数を設定
- [ ] Cloud Monitoring でダッシュボード作成
- [ ] 定期バックアップの設定
- [ ] カスタムドメインの設定（オプション）

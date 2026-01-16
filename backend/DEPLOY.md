# Cloud Run デプロイ手順

## 方法1: Google Cloud Console（簡単）

1. https://console.cloud.google.com/run にアクセス
2. 「サービスを作成」をクリック
3. 「ソースリポジトリから継続的にデプロイする」を選択
4. GitHubリポジトリ `ohsim713-cmd/mic-admin` を接続
5. ブランチ: `main`、ソースの場所: `/backend`
6. リージョン: `asia-northeast1` (東京)
7. 環境変数を設定:
   - `VERCEL_URL`: https://frontend-kohl-eight-glnhg9tp79.vercel.app
   - `AUTO_POST_SECRET`: mic-auto-post-secret-2024
   - `CRON_SECRET`: mic-auto-post-cron-2024

## 方法2: gcloud CLI

```bash
# gcloud CLIインストール
# Windows: https://cloud.google.com/sdk/docs/install

# ログイン
gcloud auth login

# プロジェクト設定
gcloud config set project micpro

# デプロイ
cd backend
gcloud run deploy mic-backend \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "VERCEL_URL=https://frontend-kohl-eight-glnhg9tp79.vercel.app,AUTO_POST_SECRET=mic-auto-post-secret-2024"
```

## 環境変数

| 変数名 | 値 |
|--------|-----|
| VERCEL_URL | https://frontend-kohl-eight-glnhg9tp79.vercel.app |
| AUTO_POST_SECRET | mic-auto-post-secret-2024 |
| CRON_SECRET | mic-auto-post-cron-2024 |

## 動作確認

デプロイ後、Cloud RunのURLにアクセスしてヘルスチェック:
```
curl https://mic-backend-xxxxx-an.a.run.app/
```

手動で投稿テスト:
```
curl -X POST https://mic-backend-xxxxx-an.a.run.app/api/post
```

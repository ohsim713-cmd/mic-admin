#!/bin/bash
# Google Cloud デプロイスクリプト
#
# 使い方:
#   ./scripts/deploy-gcp.sh
#
# 事前準備:
#   1. gcloud CLI をインストール
#   2. gcloud auth login でログイン
#   3. プロジェクト ID を設定

set -e

# 設定
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="asia-northeast1"
SERVICE_NAME="mic-admin"
IMAGE_NAME="asia-northeast1-docker.pkg.dev/${PROJECT_ID}/mic-admin/app"

echo "========================================"
echo "  MIC Admin - Google Cloud デプロイ"
echo "========================================"
echo ""
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# プロジェクト確認
echo "Step 1: プロジェクト確認..."
gcloud config set project ${PROJECT_ID}

# API 有効化（初回のみ）
echo "Step 2: 必要な API を有効化..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  --quiet

# Artifact Registry リポジトリ作成（初回のみ）
echo "Step 3: Artifact Registry リポジトリ確認..."
gcloud artifacts repositories describe mic-admin \
  --location=${REGION} 2>/dev/null || \
gcloud artifacts repositories create mic-admin \
  --repository-format=docker \
  --location=${REGION} \
  --description="MIC Admin Docker images"

# Docker 認証設定
echo "Step 4: Docker 認証設定..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# Docker イメージビルド
echo "Step 5: Docker イメージビルド..."
docker build -t ${IMAGE_NAME}:latest .

# Docker イメージプッシュ
echo "Step 6: Docker イメージプッシュ..."
docker push ${IMAGE_NAME}:latest

# Cloud Run デプロイ
echo "Step 7: Cloud Run デプロイ..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"

# デプロイ完了
echo ""
echo "========================================"
echo "  デプロイ完了！"
echo "========================================"
echo ""

# サービス URL を取得
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "次のステップ:"
echo "  1. Firestore を初期化: gcloud firestore databases create --region=${REGION}"
echo "  2. 環境変数を設定: gcloud run services update ${SERVICE_NAME} --set-env-vars KEY=VALUE"
echo "  3. Cloud Scheduler を設定: ./scripts/setup-scheduler.sh"

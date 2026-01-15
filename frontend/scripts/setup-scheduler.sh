#!/bin/bash
# Cloud Scheduler 設定スクリプト
#
# 使い方:
#   ./scripts/setup-scheduler.sh
#
# 1日15回の自動投稿スケジュールを設定

set -e

# 設定
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="asia-northeast1"
SERVICE_NAME="mic-admin"

# サービス URL を取得
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)' 2>/dev/null)

if [ -z "$SERVICE_URL" ]; then
  echo "Error: Cloud Run サービスが見つかりません"
  echo "先に deploy-gcp.sh を実行してください"
  exit 1
fi

echo "========================================"
echo "  Cloud Scheduler 設定"
echo "========================================"
echo ""
echo "Service URL: ${SERVICE_URL}"
echo ""

# サービスアカウント作成（初回のみ）
SA_NAME="scheduler-invoker"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Step 1: サービスアカウント作成..."
gcloud iam service-accounts describe ${SA_EMAIL} 2>/dev/null || \
gcloud iam service-accounts create ${SA_NAME} \
  --display-name="Cloud Scheduler Invoker"

# Cloud Run 呼び出し権限を付与
echo "Step 2: Cloud Run 呼び出し権限を付与..."
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
  --region=${REGION} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker" \
  --quiet

# 既存のジョブを削除（更新用）
echo "Step 3: 既存のスケジューラジョブをクリーンアップ..."
for i in {1..15}; do
  gcloud scheduler jobs delete "auto-post-slot-${i}" \
    --location=${REGION} \
    --quiet 2>/dev/null || true
done

# スケジュール定義（JST時間）
# 07:00, 08:00, 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 20:00, 22:00, 23:00
declare -a SCHEDULES=(
  "0 7 * * *"   # 07:00 JST
  "0 8 * * *"   # 08:00 JST
  "0 9 * * *"   # 09:00 JST
  "0 10 * * *"  # 10:00 JST
  "0 11 * * *"  # 11:00 JST
  "0 12 * * *"  # 12:00 JST
  "0 13 * * *"  # 13:00 JST
  "0 14 * * *"  # 14:00 JST
  "0 15 * * *"  # 15:00 JST
  "0 16 * * *"  # 16:00 JST
  "0 17 * * *"  # 17:00 JST
  "0 18 * * *"  # 18:00 JST
  "0 20 * * *"  # 20:00 JST
  "0 22 * * *"  # 22:00 JST
  "0 23 * * *"  # 23:00 JST
)

declare -a LABELS=(
  "07:00 JST"
  "08:00 JST"
  "09:00 JST"
  "10:00 JST"
  "11:00 JST"
  "12:00 JST"
  "13:00 JST"
  "14:00 JST"
  "15:00 JST"
  "16:00 JST"
  "17:00 JST"
  "18:00 JST"
  "20:00 JST"
  "22:00 JST"
  "23:00 JST"
)

echo "Step 4: スケジューラジョブを作成..."
for i in "${!SCHEDULES[@]}"; do
  SLOT_NUM=$((i + 1))
  SCHEDULE="${SCHEDULES[$i]}"
  LABEL="${LABELS[$i]}"

  echo "  Creating slot ${SLOT_NUM}: ${LABEL}..."

  gcloud scheduler jobs create http "auto-post-slot-${SLOT_NUM}" \
    --location=${REGION} \
    --schedule="${SCHEDULE}" \
    --time-zone="Asia/Tokyo" \
    --uri="${SERVICE_URL}/api/automation/post" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body='{"dryRun":false}' \
    --oidc-service-account-email=${SA_EMAIL} \
    --oidc-token-audience=${SERVICE_URL} \
    --attempt-deadline="300s" \
    --description="Auto post at ${LABEL}" \
    --quiet
done

echo ""
echo "========================================"
echo "  設定完了！"
echo "========================================"
echo ""
echo "作成したジョブ一覧:"
gcloud scheduler jobs list --location=${REGION}
echo ""
echo "ジョブを手動実行するには:"
echo "  gcloud scheduler jobs run auto-post-slot-1 --location=${REGION}"

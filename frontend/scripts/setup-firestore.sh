#!/bin/bash
# Firestore 初期設定スクリプト
#
# 使い方:
#   ./scripts/setup-firestore.sh

set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="asia-northeast1"

echo "========================================"
echo "  Firestore 初期設定"
echo "========================================"
echo ""

# Firestore データベース作成
echo "Step 1: Firestore データベース作成..."
gcloud firestore databases create \
  --location=${REGION} \
  --type=firestore-native \
  2>/dev/null || echo "Database already exists"

# インデックス作成（複合クエリ用）
echo "Step 2: インデックス作成..."

# post_stock コレクションのインデックス
cat > /tmp/firestore-indexes.json << 'EOF'
{
  "indexes": [
    {
      "collectionGroup": "post_stock",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "account", "order": "ASCENDING" },
        { "fieldPath": "usedAt", "order": "ASCENDING" },
        { "fieldPath": "score", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "post_stock",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "usedAt", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "success_patterns",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "score", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "posts_history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "account", "order": "ASCENDING" },
        { "fieldPath": "postedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
EOF

gcloud firestore indexes composite create \
  --project=${PROJECT_ID} \
  --collection-group=post_stock \
  --field-config=field-path=account,order=ascending \
  --field-config=field-path=usedAt,order=ascending \
  --field-config=field-path=score,order=descending \
  2>/dev/null || echo "Index may already exist"

gcloud firestore indexes composite create \
  --project=${PROJECT_ID} \
  --collection-group=success_patterns \
  --field-config=field-path=category,order=ascending \
  --field-config=field-path=score,order=descending \
  2>/dev/null || echo "Index may already exist"

echo ""
echo "========================================"
echo "  Firestore 設定完了！"
echo "========================================"
echo ""
echo "コンソールで確認:"
echo "  https://console.cloud.google.com/firestore/databases?project=${PROJECT_ID}"

#!/bin/bash
# ═══════════════════════════════════════════════
# Cloud Run 部署腳本
# 使用方式: bash deploy.sh
# ═══════════════════════════════════════════════

set -e

# ── 設定 ──────────────────────────────────────
SERVICE_NAME="semgee-line-bot"
REGION="asia-east1"
MEMORY="512Mi"

# 從環境變數或提示輸入
GCS_BUCKET="${GCS_BUCKET:-semgee-product-images}"
LINE_CHANNEL_SECRET="${LINE_CHANNEL_SECRET}"
LINE_CHANNEL_ACCESS_TOKEN="${LINE_CHANNEL_ACCESS_TOKEN}"

if [ -z "$LINE_CHANNEL_SECRET" ] || [ -z "$LINE_CHANNEL_ACCESS_TOKEN" ]; then
    echo "請設定環境變數:"
    echo "  export LINE_CHANNEL_SECRET=your_secret"
    echo "  export LINE_CHANNEL_ACCESS_TOKEN=your_token"
    echo "或在 Cloud Shell 中直接執行 gcloud run deploy 命令"
    exit 1
fi

echo "╔═══════════════════════════════════════╗"
echo "║  部署 ${SERVICE_NAME}                  ║"
echo "║  區域: ${REGION}                       ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── 部署 ──────────────────────────────────────
gcloud run deploy "$SERVICE_NAME" \
    --source=. \
    --region="$REGION" \
    --allow-unauthenticated \
    --memory="$MEMORY" \
    --set-env-vars="GCS_BUCKET=${GCS_BUCKET},LINE_CHANNEL_SECRET=${LINE_CHANNEL_SECRET},LINE_CHANNEL_ACCESS_TOKEN=${LINE_CHANNEL_ACCESS_TOKEN}"

echo ""
echo "部署完成！"
echo ""

# 取得服務 URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' 2>/dev/null)
echo "服務 URL: ${SERVICE_URL}"
echo ""
echo "API 端點:"
echo "  管理後台:  ${SERVICE_URL}/api/admin"
echo "  進銷存:    ${SERVICE_URL}/api/inventory"
echo "  財務管理:  ${SERVICE_URL}/api/finance"
echo "  發票管理:  ${SERVICE_URL}/api/invoices"
echo "  BOM管理:   ${SERVICE_URL}/api/bom"
echo "  LINE Hook: ${SERVICE_URL}/webhook"
echo ""
echo "請到 LINE Developers Console 設定 Webhook URL:"
echo "  ${SERVICE_URL}/webhook"

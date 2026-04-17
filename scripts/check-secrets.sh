#!/bin/bash
# 배포 전 Docker Swarm에 필수 시크릿/컨피그가 등록되어 있는지 확인
# 사용법: ./scripts/check-secrets.sh
set -e

REQUIRED_SECRETS=("DB_PASSWORD" "MINIO_PASSWORD" "JWT_SECRET" "OWNER_PASSWORD" "PASSWORD_PEPPER" "RABBITMQ_PASSWORD")
REQUIRED_CONFIGS=("DB_NAME" "DB_URL" "DB_USER" "MINIO_ENDPOINT" "MINIO_ROOT_USER" "MINIO_BUCKET" "OWNER_USERNAME" "OWNER_NICKNAME" "JWT_ACCESS_EXPIRY_MS" "JWT_REFRESH_EXPIRY_MS" "CORS_ALLOWED_ORIGINS" "RABBITMQ_HOST" "RABBITMQ_PORT" "RABBITMQ_USERNAME" "FIREBASE_CREDENTIALS_PATH")

MISSING=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  docker secret inspect "$secret" > /dev/null 2>&1 || MISSING+=("secret:$secret")
done

for config in "${REQUIRED_CONFIGS[@]}"; do
  docker config inspect "$config" > /dev/null 2>&1 || MISSING+=("config:$config")
done

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "ERROR: 누락된 항목:"
  for item in "${MISSING[@]}"; do
    echo "  - $item"
  done
  echo ""
  echo "등록 방법: make setup"
  exit 1
fi

echo "모든 시크릿/컨피그 확인 완료. 배포를 진행합니다."

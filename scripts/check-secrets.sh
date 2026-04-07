#!/bin/bash
# 배포 전 Docker Swarm에 필수 시크릿이 등록되어 있는지 확인
# 사용법: ./scripts/check-secrets.sh
set -e

REQUIRED_SECRETS=("terab_db_password" "terab_minio_password" "terab_jwt_secret")
MISSING=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  docker secret inspect "$secret" > /dev/null 2>&1 || MISSING+=("$secret")
done

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "ERROR: 누락된 시크릿: ${MISSING[*]}"
  echo ""
  echo "등록 방법:"
  for s in "${MISSING[@]}"; do
    echo "  printf '<value>' | docker secret create $s -"
  done
  exit 1
fi

echo "모든 시크릿 확인 완료. 배포를 진행합니다."

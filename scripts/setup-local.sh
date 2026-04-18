#!/bin/bash
set -e

SERVICES=(api notification)

# ─── secrets.env 존재 확인 ──────────────────────────────────────
if [ ! -f secrets.env ]; then
  echo "ERROR: secrets.env 없음. 아래 명령으로 생성하세요:"
  echo "  cp secrets.env.example secrets.env"
  exit 1
fi

# ─── 누락 키 검증 (root 수준에서 한눈에 확인) ────────────────────
echo "=== 환경변수 검증 ==="
MISSING=()
while IFS='=' read -r key _; do
  [[ "$key" =~ ^# || -z "$key" ]] && continue
  grep -q "^${key}=" secrets.env 2>/dev/null || MISSING+=("$key")
done < secrets.env.example

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "  ⚠ secrets.env 누락 키: ${MISSING[*]}"
  echo "  secrets.env를 업데이트한 후 다시 실행하세요."
  exit 1
fi
echo "  ✓ 모든 필수 키 확인 완료"

# ─── 서비스별 configtree run/ 디렉터리 생성 ─────────────────────
echo ""
echo "=== configtree 파일 생성 ==="
for service in "${SERVICES[@]}"; do
  mkdir -p "services/${service}/run"

  while IFS='=' read -r key val; do
    [[ "$key" =~ ^# || -z "$key" ]] && continue
    printf '%s' "${val%$'\r'}" > "services/${service}/run/${key}"
  done < configs.env

  while IFS='=' read -r key val; do
    [[ "$key" =~ ^# || -z "$key" ]] && continue
    printf '%s' "${val%$'\r'}" > "services/${service}/run/${key}"
  done < secrets.env

  echo "  ✓ services/${service}/run/ 생성 완료 ($(ls services/${service}/run/ | wc -l)개 파일)"
done

# ─── secrets/ 파일 secret → run/ 복사 ──────────────────────────
if [ -d secrets ]; then
  echo ""
  echo "=== 파일 secret 복사 ==="
  for f in secrets/*; do
    name=$(basename "$f")
    for service in "${SERVICES[@]}"; do
      cp "$f" "services/${service}/run/${name}"
    done
    echo "  ✓ ${name} → services/{api,notification}/run/"
  done
fi

echo ""
echo "setup-local 완료. 'make api' 또는 'make notification'으로 서버를 기동하세요."

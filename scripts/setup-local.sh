#!/bin/bash
set -e

# ─── api.env 존재 확인 ───────────────────────────────────────────
if [ ! -f api.env ]; then
  echo "ERROR: api.env 없음. 아래 명령으로 생성하세요:"
  echo "  cp api.env.example api.env"
  exit 1
fi

# ─── 누락 키 검증 ──────────────────────────────────────────────
echo "=== 환경변수 검증 ==="
MISSING=()
while IFS='=' read -r key _; do
  [[ "$key" =~ ^# || -z "$key" ]] && continue
  grep -q "^${key}=" api.env 2>/dev/null || MISSING+=("$key")
done < api.env.example

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "  ⚠ api.env 누락 키: ${MISSING[*]}"
  exit 1
fi
echo "  ✓ 모든 필수 키 확인 완료"

# ─── 심볼릭링크 생성 ────────────────────────────────────────────
echo ""
echo "=== 심볼릭링크 생성 ==="

ln -sf "$(pwd)/api.env" services/api/.env
echo "  ✓ services/api/.env → $(pwd)/api.env"

echo ""
echo "setup-local 완료. 'make api'로 서버를 기동하세요."
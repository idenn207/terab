#!/bin/bash
set -e

register_config() {
  local key="$1" val="$2"
  docker config rm "$key" >/dev/null 2>&1 || true
  if printf '%s' "$val" | docker config create "$key" - >/dev/null 2>&1; then
    echo "  ✓ $key"
  else
    echo "  ⚠ $key — 스택 실행 중(in use), 건너뜀 (값 변경 시 스택 중단 후 재실행)"
  fi
}

register_secret_value() {
  local key="$1" val="$2"
  docker secret rm "$key" >/dev/null 2>&1 || true
  if printf '%s' "$val" | docker secret create "$key" - >/dev/null 2>&1; then
    echo "  ✓ $key"
  else
    echo "  ⚠ $key — 스택 실행 중(in use), 건너뜀"
  fi
}

register_secret_file() {
  local file="$1" name
  name=$(basename "$file")
  docker secret rm "$name" >/dev/null 2>&1 || true
  if docker secret create "$name" "$file" >/dev/null 2>&1; then
    echo "  ✓ $name"
  else
    echo "  ⚠ $name — 스택 실행 중(in use), 건너뜀"
  fi
}

# ─── Docker Config 등록 ──────────────────────────────────────────
echo "=== Registering Docker Configs ==="
while IFS='=' read -r key val || [ -n "$key" ]; do
  [ -z "$key" ] && continue
  echo "$key" | grep -q '^#' && continue
  register_config "$key" "${val%$'\r'}"
done < configs.env

# ─── Docker Secret 등록 (env 문자열 값) ─────────────────────────
echo "=== Registering Docker Secrets (env) ==="
while IFS='=' read -r key val || [ -n "$key" ]; do
  [ -z "$key" ] && continue
  echo "$key" | grep -q '^#' && continue
  register_secret_value "$key" "${val%$'\r'}"
done < secrets.env

# ─── Docker Secret 등록 (파일) ──────────────────────────────────
echo "=== Registering Docker Secrets (files) ==="
if [ -d secrets ]; then
  for f in secrets/*; do
    register_secret_file "$f"
  done
else
  echo "  secrets/ 디렉터리 없음, 건너뜀"
fi

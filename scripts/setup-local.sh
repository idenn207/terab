#!/bin/bash
set -e

# ─── 설정 영역 ──────────────────────────────────────────────────────────
# 추가할 서비스가 있다면 이 배열에 이름만 추가하세요
SERVICES=("api" "mq" "web")

# ─── 헬퍼 함수 ──────────────────────────────────────────────────────────
# 운영체제에 맞는 심볼릭 링크 생성
# GOTCHA(Git Bash) 1: 기존 `cmd //c mklink` + `if [ $? -ne 0 ]` 패턴은 `set -e` 와
#   충돌해 worktree-bootstrap.sh 의 5/6 단계가 즉시 종료되며 6/6 까지 도달 못 함.
# GOTCHA 2 (Windows symlink 권한): file symlink 는 Developer Mode 활성만으로도 가능.
#   `cmd mklink` 는 동작하지만 PowerShell `New-Item -ItemType SymbolicLink` 는
#   동일 환경에서 "Administrator privilege required" 로 실패함 (실측).
# GOTCHA 3: 통일된 우회책 — Git Bash 네이티브 `ln -s` 를 `MSYS=winsymlinks:nativestrict`
#   환경변수로 강제. cmd / PowerShell interop 자체를 회피해 GOTCHA 1, 2 모두 해결.
#   `nativestrict` 는 file-copy fallback 을 금지하므로 권한 부족 시 명확히 실패.
#   `|| true` + `[ -L "$dest" ]` post-check 로 가짜 success 차단 후 exit 1 (dev 필수).
create_symlink() {
  local src="$1"
  local dest="$2"

  mkdir -p "$(dirname "$dest")"
  rm -f "$dest"

  MSYS=winsymlinks:nativestrict ln -s "$src" "$dest" 2>/dev/null || true

  if [ ! -L "$dest" ]; then
    echo "  ERROR: 심볼릭 링크 생성 실패: $dest" >&2
    echo "         Windows: 설정 → 개발자용 → '개발자 모드' 활성화 후 재시도" >&2
    exit 1
  fi
}

# 환경변수 파일 검증
validate_env() {
    local name="$1"
    local env_file="$name.env"
    local example_file="$name.env.example"

    echo "=== [$name] 환경변수 검증 ==="

    if [[ ! -f "$env_file" ]]; then
        echo "  ERROR: $env_file 없음. 'cp $example_file $env_file' 실행 후 다시 시도하세요."
        exit 1
    fi

    local missing=()
    while IFS='=' read -r key _; do
        key="${key//[[:space:]]/}"
        [[ "$key" =~ ^# || -z "$key" ]] && continue
        grep -q "^${key}=" "$env_file" 2>/dev/null || missing+=("$key")
    done < "$example_file"

    if [ ${#missing[@]} -ne 0 ]; then
        echo "  ⚠ $name.env 누락 키: ${missing[*]}"
        exit 1
    fi
    echo "  ✓ $name 필수 키 확인 완료"
}
# ─── 메인 로직 ──────────────────────────────────────────────────────────

for svc in "${SERVICES[@]}"; do
    # 1. 검증
    validate_env "$svc"
    
    # 2. 링크 생성
    SRC="$(pwd)/$svc.env"
    DEST="$(pwd)/services/$svc/.env"
    create_symlink "$SRC" "$DEST"
    echo "  ✓ $DEST → $SRC"
    echo ""
done

echo "setup-local 완료."
#!/bin/bash
set -e

# ─── 설정 영역 ──────────────────────────────────────────────────────────
# 추가할 서비스가 있다면 이 배열에 이름만 추가하세요
SERVICES=("api" "web")

# ─── 헬퍼 함수 ──────────────────────────────────────────────────────────
# 운영체제에 맞는 심볼릭 링크 생성
# create_symlink() {
#     local src="$1"
#     local dest="$2"
    
#     # 디렉토리 생성 (없을 경우)
#     mkdir -p "$(dirname "$dest")"
    
#     # 기존 파일/링크 삭제
#     rm -f "$dest"

#     if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
#         # Windows: mklink 사용 (경로 구분자를 역슬래시로 변환)
#         cmd //c mklink "${dest//\//\\}" "${src//\//\\}"
#     else
#         # Linux/macOS: ln -sf 사용
#         ln -sf "$src" "$dest"
#     fi
# }
create_symlink() {
  local src="$1"
  local dest="$2"
  
  # 1. 대상 디렉토리 존재 여부 확인 및 생성
  mkdir -p "$(dirname "$dest")"
  
  # 2. 기존 파일/링크 삭제
  rm -f "$dest"

  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # 윈도우 경로로 변환 (cygpath 사용)
    local win_src=$(cygpath -w "$src")
    local win_dest=$(cygpath -w "$dest")
    
    # 디버깅 출력: 실행되는 명령어를 눈으로 확인
    echo "DEBUG: 실행 경로 확인"
    echo "  SRC : $win_src"
    echo "  DEST: $win_dest"
    
    # 3. mklink 실행
    # 명령어를 직접 echo 해서 복사/붙여넣기 할 수 있게 함
    cmd //c mklink "$win_dest" "$win_src"
    
    if [ $? -ne 0 ]; then
      echo "  ERROR: mklink 실행 실패. 위 경로가 정확한지 확인하세요."
    fi
  else
    ln -sf "$src" "$dest"
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

echo "setup-local 완료. 'make api' 또는 'make web'으로 서버를 기동하세요."
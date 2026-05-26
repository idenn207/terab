#!/bin/bash
# worktree-bootstrap.sh
#   새 git worktree 를 로컬 개발에 즉시 쓸 수 있도록 부트스트랩한다.
#   1) repo root 의 api.env / mq.env / web.env 를 worktree 로 복사 (덮어쓰지 않음)
#   2) repo root 의 secrets/ 를 worktree 에 심볼릭 링크 (이미 있으면 skip)
#   3) worktree 안에서 `make setup-local` 실행 (services/*/.env 심볼릭 링크)
#   4) services/{api,mq,web} 에서 `npm ci` 실행
#
# 사용법:
#   scripts/worktree-bootstrap.sh <worktree-path>

set -e

WT="${1:-}"
if [ -z "$WT" ]; then
  echo "[worktree-bootstrap] ERROR: worktree 경로가 필요합니다" >&2
  echo "Usage: $0 <worktree-path>" >&2
  exit 2
fi

if [ ! -d "$WT" ]; then
  echo "[worktree-bootstrap] ERROR: worktree 디렉토리가 존재하지 않습니다: $WT" >&2
  exit 2
fi

WT_ABS="$(cd "$WT" && pwd)"

# repo root 결정: worktree 의 git common dir → 그 부모가 main repo root
GIT_COMMON_DIR_REL="$(cd "$WT_ABS" && git rev-parse --git-common-dir 2>/dev/null || true)"
if [ -z "$GIT_COMMON_DIR_REL" ]; then
  echo "[worktree-bootstrap] ERROR: git 저장소가 아닙니다: $WT_ABS" >&2
  exit 2
fi
GIT_COMMON_DIR_ABS="$(cd "$WT_ABS" && cd "$GIT_COMMON_DIR_REL" && pwd)"
ROOT="$(dirname "$GIT_COMMON_DIR_ABS")"

if [ "$ROOT" = "$WT_ABS" ]; then
  echo "[worktree-bootstrap] skip: worktree 가 repo root 와 동일합니다 ($ROOT)"
  exit 0
fi

echo "[worktree-bootstrap] root     : $ROOT"
echo "[worktree-bootstrap] worktree : $WT_ABS"
echo ""

# ─── 1) env 파일 복사 (worktree 에 이미 있으면 보존) ──────────────────────
echo "[1/4] env 파일 복사"
for f in api.env mq.env web.env; do
  if [ ! -f "$ROOT/$f" ]; then
    echo "  · $f 원본 없음 — skip"
    continue
  fi
  if [ -e "$WT_ABS/$f" ]; then
    echo "  · $f 이미 존재 — skip"
    continue
  fi
  cp "$ROOT/$f" "$WT_ABS/$f"
  echo "  ✓ $f 복사"
done
echo ""

# ─── 2) secrets/ 심볼릭 링크 ────────────────────────────────────────────
echo "[2/4] secrets/ 심볼릭 링크"
if [ ! -d "$ROOT/secrets" ]; then
  echo "  · 원본 secrets/ 없음 — skip"
elif [ -e "$WT_ABS/secrets" ]; then
  echo "  · secrets/ 이미 존재 — skip"
else
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    win_src=$(cygpath -w "$ROOT/secrets")
    win_dest=$(cygpath -w "$WT_ABS/secrets")
    cmd //c mklink /D "$win_dest" "$win_src" >/dev/null
  else
    ln -s "$ROOT/secrets" "$WT_ABS/secrets"
  fi
  echo "  ✓ secrets/ → $ROOT/secrets"
fi
echo ""

# ─── 3) make setup-local ────────────────────────────────────────────────
echo "[3/4] make setup-local (services/*/.env 심볼릭 링크)"
( cd "$WT_ABS" && make setup-local )
echo ""

# ─── 4) npm ci per service ──────────────────────────────────────────────
echo "[4/4] npm ci (api / mq / web)"
for svc in api mq web; do
  svc_dir="$WT_ABS/services/$svc"
  if [ ! -d "$svc_dir" ]; then
    echo "  · services/$svc 디렉토리 없음 — skip"
    continue
  fi
  if [ ! -f "$svc_dir/package-lock.json" ]; then
    echo "  · services/$svc/package-lock.json 없음 — npm ci 불가, skip" >&2
    continue
  fi
  echo "  ▶ services/$svc"
  ( cd "$svc_dir" && npm ci --no-audit --no-fund )
  echo "  ✓ services/$svc deps 설치"
done
echo ""

echo "[worktree-bootstrap] 완료 — '$WT_ABS' 에서 make api / make mq / make web 실행 가능"

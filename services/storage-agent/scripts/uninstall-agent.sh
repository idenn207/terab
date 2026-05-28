#!/usr/bin/env bash
# Terab Storage Agent NAS 제거 (systemd-only).
# 결정 배경: docs/adr/0005-sidecar-agent-systemd-only.md
#
# Usage:
#   NAS_HOST=nas-claude [NAS_USER=admin] bash scripts/uninstall-agent.sh
# 또는:
#   NAS_HOST=nas-claude make uninstall-agent

set -euo pipefail

NAS_HOST="${NAS_HOST:-}"
NAS_USER="${NAS_USER:-admin}"

SOCKET_PATH="/run/terab-agent/agent.sock"
REMOTE_BIN="/usr/local/bin/terab-agent"
REMOTE_UNIT="/etc/systemd/system/terab-agent.service"
UNIT_NAME="terab-agent.service"

log() { printf '[uninstall-agent] %s\n' "$*"; }
fail() { printf '[uninstall-agent] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -n "${NAS_HOST}" ]] || fail "NAS_HOST 미설정"

SSH=(ssh "${NAS_USER}@${NAS_HOST}")
log "target: ${NAS_USER}@${NAS_HOST}"

# step 1: dummy target 회수 시도 — agent 가 살아있고 jq 가 NAS 에 있을 때만
log "dummy target 회수 시도"
if "${SSH[@]}" 'command -v jq' >/dev/null 2>&1; then
  IQNS=$("${SSH[@]}" "sudo curl -sS --max-time 5 --unix-socket ${SOCKET_PATH} http://localhost/v1/targets 2>/dev/null | jq -r '..|.iqn? // empty' 2>/dev/null | grep -E '^iqn\\.' || true")
  if [[ -n "${IQNS}" ]]; then
    while IFS= read -r iqn; do
      [[ -z "${iqn}" ]] && continue
      log "  delete: ${iqn}"
      "${SSH[@]}" "sudo curl -sS -X DELETE --max-time 5 --unix-socket ${SOCKET_PATH} \"http://localhost/v1/targets/${iqn}\"" >/dev/null 2>&1 || true
    done <<< "${IQNS}"
  else
    log "  dummy target 0건 (또는 agent 미응답)"
  fi
else
  log "  NAS 에 jq 미설치 — dummy target 회수 skip (수동 확인 권장)"
fi

# step 2: systemd disable + 파일 정리 (idempotent — unit not-found 시에도 exit 0)
log "systemctl disable --now + 파일 정리"
"${SSH[@]}" "
  sudo systemctl disable --now ${UNIT_NAME} 2>/dev/null || true
  sudo rm -f ${REMOTE_UNIT} ${REMOTE_BIN}
  sudo systemctl daemon-reload
"

# step 3: 결과 보고
STATUS=$("${SSH[@]}" "systemctl status ${UNIT_NAME} 2>&1 | head -1" || echo "")
log "ok — final status: ${STATUS}"
log "  잔존 파일 확인: ssh ${NAS_USER}@${NAS_HOST} 'ls -la ${REMOTE_BIN} ${REMOTE_UNIT} 2>&1 | head -2'"

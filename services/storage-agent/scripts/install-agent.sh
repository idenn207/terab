#!/usr/bin/env bash
# Terab Storage Agent NAS 배포 (systemd-only).
# 결정 배경: docs/adr/0005-sidecar-agent-systemd-only.md
#
# Usage:
#   NAS_HOST=nas-claude [NAS_USER=admin] bash scripts/install-agent.sh
# 또는:
#   NAS_HOST=nas-claude make install-agent
#
# 사전 조건:
#   1) make build-linux-amd64  (services/storage-agent/bin/agent-linux-amd64 생성)
#   2) NAS 의 ${NAS_USER} 에 sudo NOPASSWD — README 의 §"사전 설정" 참조
#   3) SSH key 등록 (password 자동화 안함)

set -euo pipefail

NAS_HOST="${NAS_HOST:-}"
NAS_USER="${NAS_USER:-admin}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_BIN="${SCRIPT_DIR}/../bin/agent-linux-amd64"
UNIT_FILE="${SCRIPT_DIR}/../systemd/terab-agent.service"

REMOTE_BIN="/usr/local/bin/terab-agent"
REMOTE_UNIT="/etc/systemd/system/terab-agent.service"
SOCKET_PATH="/run/terab-agent/agent.sock"
UNIT_NAME="terab-agent.service"

log() { printf '[install-agent] %s\n' "$*"; }
fail() { printf '[install-agent] ERROR: %s\n' "$*" >&2; exit 1; }

# step 1: env / 산출물 사전 검증
[[ -n "${NAS_HOST}" ]] || fail "NAS_HOST 미설정 — 예: NAS_HOST=nas-claude $0"
[[ -f "${AGENT_BIN}" ]] || fail "agent binary 없음 (${AGENT_BIN}) — 'make build-linux-amd64' 먼저 실행"
[[ -f "${UNIT_FILE}" ]] || fail "systemd unit 파일 없음 (${UNIT_FILE})"

SSH=(ssh "${NAS_USER}@${NAS_HOST}")
log "target: ${NAS_USER}@${NAS_HOST}"

# step 2: sudo NOPASSWD 사전 검증 — password prompt 에서 hang 방지
# command-scoped NOPASSWD 환경 호환: 실제로 호출할 systemctl 로 검증
"${SSH[@]}" 'sudo -n /usr/bin/systemctl --version' >/dev/null 2>&1 \
  || fail "NAS 의 sudo NOPASSWD 미설정 — README §'사전 설정' 참조"

# step 3: binary + unit 전송 (atomic move 위해 /tmp 경유)
log "binary 전송 → /tmp/terab-agent"
scp -q -O "${AGENT_BIN}" "${NAS_USER}@${NAS_HOST}:/tmp/terab-agent"

log "unit 전송 → /tmp/${UNIT_NAME}"
scp -q -O "${UNIT_FILE}" "${NAS_USER}@${NAS_HOST}:/tmp/${UNIT_NAME}"

# step 4: install + daemon-reload + enable + restart (idempotent)
# DSM 7 의 systemd 219 가 --now flag 미지원 — enable 와 restart 를 분리
log "install + systemctl enable + restart"
"${SSH[@]}" "
  set -e
  sudo install -m 0755 -o root -g root /tmp/terab-agent ${REMOTE_BIN}
  sudo install -m 0644 -o root -g root /tmp/${UNIT_NAME} ${REMOTE_UNIT}
  sudo rm -f /tmp/terab-agent /tmp/${UNIT_NAME}
  sudo systemctl daemon-reload
  sudo systemctl enable ${UNIT_NAME}
  sudo systemctl restart ${UNIT_NAME}
"

# step 5: healthz 검증 — socket bind 까지 시간 여유
log "healthz 검증 (3초 대기)"
sleep 3
HEALTH=$("${SSH[@]}" "sudo curl -sS --max-time 5 --unix-socket ${SOCKET_PATH} http://localhost/healthz" 2>/dev/null || echo "")
if [[ "${HEALTH}" != '{"status":"ok"}' ]]; then
  fail "healthz 미응답 (received: '${HEALTH}') — 'ssh ${NAS_USER}@${NAS_HOST} sudo journalctl -u ${UNIT_NAME} -n 50' 로 확인"
fi

# step 6: 결과
log "ok"
log "  socket=${SOCKET_PATH}"
log "  NestJS env: STORAGE_AGENT_SOCKET_PATH=${SOCKET_PATH}"
log "  status: ssh ${NAS_USER}@${NAS_HOST} 'systemctl is-active ${UNIT_NAME}'"
log "  logs:   ssh ${NAS_USER}@${NAS_HOST} 'sudo journalctl -fu ${UNIT_NAME}'"

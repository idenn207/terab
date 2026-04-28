#!/bin/bash
# Docker Swarm 스택 순차 배포 스크립트
# 인프라 서비스(db, minio, rabbitmq)가 준비된 후 앱 서비스를 재기동한다.
# 사용법: bash scripts/stack-deploy.sh

set -euo pipefail

STACK="terab"
INFRA_SERVICES=("${STACK}_db" "${STACK}_redis" "${STACK}_minio")
APP_SERVICES=("${STACK}_api" "${STACK}_mq")

# 서비스의 실행 중인 replica 수가 목표치와 같아질 때까지 대기
wait_service_ready() {
    local service="$1"
    local timeout="${2:-180}"
    local interval=5
    local elapsed=0

    printf "  대기 중: %-30s" "$service"
    while [ "$elapsed" -lt "$timeout" ]; do
        replicas=$(docker service ls \
            --format "{{.Name}} {{.Replicas}}" 2>/dev/null \
            | awk -v svc="$service" '$1 == svc { print $2 }')

        if [ -n "$replicas" ]; then
            running=$(echo "$replicas" | cut -d'/' -f1)
            total=$(echo  "$replicas" | cut -d'/' -f2)
            if [ -n "$total" ] && [ "$total" -gt 0 ] && [ "$running" -eq "$total" ]; then
                echo " 준비 완료 ($replicas)"
                return 0
            fi
            printf "\r  대기 중: %-30s [%s, %ds 경과]" "$service" "$replicas" "$elapsed"
        fi

        sleep "$interval"
        elapsed=$((elapsed + interval))
    done

    echo ""
    echo "  타임아웃: $service (${timeout}s 초과)" >&2
    return 1
}

# ── 1. 전체 스택 배포 ─────────────────────────────────────────────
echo "[1/3] 스택 배포 시작..."
docker stack deploy -c docker-stack.yml "$STACK" --with-registry-auth

# ── 2. 인프라 서비스 준비 대기 ────────────────────────────────────
echo "[2/3] 인프라 서비스 준비 대기 중..."
for svc in "${INFRA_SERVICES[@]}"; do
    wait_service_ready "$svc" 180
done

# ── 3. 앱 서비스 재기동 ──────────────────────────────────────────
# 인프라가 준비된 시점에 앱 서비스를 재기동해 연결 실패 없이 시작하도록 한다.
echo "[3/3] 앱 서비스 재기동 중..."
for svc in "${APP_SERVICES[@]}"; do
    echo "  재기동: $svc"
    docker service update --force "$svc"
done

echo ""
echo "배포 완료."

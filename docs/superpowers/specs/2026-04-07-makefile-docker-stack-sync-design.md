# Makefile & Docker Stack Sync 설계

**날짜:** 2026-04-07
**브랜치:** feat/zero-downtime-deployment

---

## 배경

현재 Makefile과 Docker Compose/Stack 파일 사이에 4가지 sync 불일치가 존재한다:

1. `docker-compose.infra.yml`이 Makefile에서 참조되지 않음 (고립된 파일)
2. `make infra`가 DB/MinIO 포트를 호스트에 노출하지 않아 로컬 API 서버가 실제로 접근 불가 (버그)
3. `make up`/`make down`이 "운영 환경"으로 표기되나 실제 운영은 `docker-stack.yml` Swarm
4. Swarm 운영 명령(`stack deploy`, `service update`)이 Makefile에 없음

추가로 Synology NAS Container Manager는 Swarm을 공식 지원하지 않으므로, Portainer CE를 통해 원격 컨테이너 상태를 모니터링한다.

---

## 파일 구조

### 변경 전

```
docker-compose.yml          # base (ghcr.io 이미지, bridge network)
docker-compose.local.yml    # override (로컬 빌드, 볼륨)
docker-compose.infra.yml    # standalone infra (고립, 중복)
docker-stack.yml            # Swarm 프로덕션
```

### 변경 후

```
docker-compose.local.yml    # 로컬 개발 — standalone 완전한 정의 (포트 노출, 로컬 빌드)
docker-stack.yml            # Swarm 프로덕션 — Portainer CE 추가
```

- `docker-compose.yml` 삭제 (역할 모호, base layer 불필요)
- `docker-compose.infra.yml` 삭제 (중복, `local.yml`이 포트 노출 담당)

---

## Makefile 타겟

### 변경 후 전체 구조

```makefile
LOCAL := docker compose -f docker-compose.local.yml

# ─── 로컬 인프라 (DB + MinIO만, 포트 노출) ──────────────────────────
infra         $(LOCAL) up -d db minio
infra-down    $(LOCAL) stop db minio
infra-reset   rm -rf ./volumes/ && $(LOCAL) up -d db minio

# ─── 개발 환경 (전체 서비스, 로컬 빌드) ─────────────────────────────
dev-up        $(LOCAL) up -d
dev-down      $(LOCAL) down

# ─── Docker Swarm 운영 환경 ──────────────────────────────────────────
stack-deploy  docker stack deploy -c docker-stack.yml terab --with-registry-auth
stack-rm      docker stack rm terab
stack-update  docker service update --image ghcr.io/idenn207/terab-api:latest --with-registry-auth --force terab_api
              && docker service update --image ghcr.io/idenn207/terab-web:latest --with-registry-auth --force terab_web
```

### 삭제 타겟

| 기존 | 이유 |
|------|------|
| `up` | Swarm으로 대체 → `stack-deploy` |
| `down` | Swarm으로 대체 → `stack-rm` |

### 유지 타겟

`api`, `web`, `android`, `android-open`, `build-web`, `build-android`, `test`, `test-api`, `test-api-unit`, `test-api-integration`, `test-web` — 변경 없음

---

## docker-compose.local.yml 변경

기존 override 구조 → standalone 완전한 정의로 전환.

### 핵심 변경사항

**db** — 포트 추가:
```yaml
ports:
  - '5432:5432'
```

**minio** — 포트 추가:
```yaml
ports:
  - '9000:9000'
  - '9001:9001'
```

**api** — 로컬 빌드 + 전체 환경변수 정의:
```yaml
build:
  context: ./services/api
  dockerfile: Dockerfile
environment:
  DB_URL: jdbc:postgresql://db:5432/${DB_NAME}
  ...
depends_on:
  db:
    condition: service_healthy
  minio:
    condition: service_healthy
```

**web** — 로컬 빌드:
```yaml
build:
  context: ./services/web
  dockerfile: Dockerfile
```

**nginx** — 포트 및 볼륨:
```yaml
ports:
  - '8080:80'
volumes:
  - ./services/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
```

네트워크: `terab-net` (driver: bridge)

---

## docker-stack.yml 변경 — Portainer CE 추가

```yaml
  portainer:
    image: portainer/portainer-ce:latest
    ports:
      - '9443:9443'   # HTTPS UI
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    networks:
      - terab-net
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure

  portainer_agent:
    image: portainer/agent:latest
    environment:
      AGENT_CLUSTER_ADDR: tasks.portainer_agent
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /var/lib/docker/volumes:/var/lib/docker/volumes
    networks:
      - terab-net
    deploy:
      mode: global
      restart_policy:
        condition: on-failure

volumes:
  portainer_data:
```

접근: `https://nas-ip:9443`

---

## Portainer 초기 설치 가이드

### 1. 사전 조건 — NAS에서 Swarm 초기화

NAS에 SSH 접속 후:

```bash
# Swarm 초기화 (최초 1회)
docker swarm init --advertise-addr <NAS_IP>
```

### 2. 스택 최초 배포

로컬 컴퓨터에서:

```bash
# NAS에 docker-stack.yml 복사 후 배포
scp docker-stack.yml user@nas-ip:/path/to/project/
ssh user@nas-ip "docker stack deploy -c /path/to/project/docker-stack.yml terab --with-registry-auth"
```

또는 CI/CD가 자동 배포 후 Portainer도 함께 올라옴.

### 3. Portainer 초기 설정 (브라우저)

1. `https://nas-ip:9443` 접속 (최초 접속 시 관리자 계정 생성)
2. **Home → Environments → local** 선택
3. **Swarm** 탭에서 서비스 상태 확인 가능

### 4. Portainer Agent 연결 확인

Portainer UI → **Environments → primary** → Swarm 섹션에서:
- `terab_portainer_agent`가 global 모드로 실행 중인지 확인
- 에이전트 연결이 되면 각 노드의 컨테이너 상태 개별 조회 가능

### 5. 포트 방화벽 설정 (필요 시)

NAS 방화벽에서 로컬 네트워크 접근 허용:
- `9443` (Portainer HTTPS UI)
- `9001` (MinIO Console) — 이미 열려 있음

---

## 로컬 개발 플로우 (변경 후)

```
1. make infra          → DB + MinIO 시작 (5432, 9000 포트 열림)
   make api / make web → 로컬 서버 실행 (빠른 iteration)

2. make dev-up         → 전체 컨테이너 환경 (2차 검증)

3. git push master     → GitHub Actions → build & push → SSH → docker service update
   (Portainer에서 롤링 업데이트 상태 실시간 확인)
```

---

## 영향 범위

| 파일 | 변경 유형 |
|------|----------|
| `Makefile` | 수정 |
| `docker-compose.local.yml` | 재작성 (standalone) |
| `docker-stack.yml` | 수정 (Portainer 추가) |
| `docker-compose.yml` | 삭제 |
| `docker-compose.infra.yml` | 삭제 |

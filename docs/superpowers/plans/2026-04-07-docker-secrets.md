# Docker Secrets 적용 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Docker Swarm `docker stack deploy` 시 `${}` 환경변수 미치환 오류를 해결하고, 민감 크리덴셜을 Docker Secrets로 안전하게 관리한다.

**Architecture:** 민감 값(DB_PASSWORD, MINIO_PASSWORD, JWT_SECRET) 3개를 Docker Swarm 외부 시크릿으로 등록한다. PostgreSQL/MinIO는 네이티브 `_FILE` 환경변수로 시크릿을 읽고, Spring Boot API는 `docker-entrypoint.sh` wrapper가 시크릿 파일을 환경변수로 변환한 뒤 앱을 기동한다. 경로 값과 비민감 설정은 `docker-stack.yml`에 직접 기입한다.

**Tech Stack:** Docker Swarm Secrets, POSIX sh, Bash, PostgreSQL 16, MinIO, Spring Boot (eclipse-temurin:21-jre-alpine)

---

## 파일 구조

| 경로 | 상태 | 역할 |
|------|------|------|
| `scripts/check-secrets.sh` | 신규 | 배포 전 Swarm 시크릿 등록 여부 확인 |
| `services/api/docker-entrypoint.sh` | 신규 | 시크릿 파일 검증 → env 변환 → 앱 기동 |
| `services/api/Dockerfile` | 수정 | entrypoint wrapper 추가, ENTRYPOINT 교체 |
| `docker-stack.yml` | 수정 | secrets 블록, `_FILE` env var, 경로 하드코딩 |
| `.env` | 수정 | 시크릿 값 제거, 로컬 개발 전용 명시 |

---

### Task 1: 배포 전 시크릿 검증 스크립트

**Files:**
- Create: `scripts/check-secrets.sh`

- [ ] **Step 1: 스크립트 파일 생성**

```bash
#!/bin/bash
# 배포 전 Docker Swarm에 필수 시크릿이 등록되어 있는지 확인
# 사용법: ./scripts/check-secrets.sh
set -e

REQUIRED_SECRETS=("terab_db_password" "terab_minio_password" "terab_jwt_secret")
MISSING=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  docker secret inspect "$secret" > /dev/null 2>&1 || MISSING+=("$secret")
done

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "ERROR: 누락된 시크릿: ${MISSING[*]}"
  echo ""
  echo "등록 방법:"
  for s in "${MISSING[@]}"; do
    echo "  printf '<value>' | docker secret create $s -"
  done
  exit 1
fi

echo "모든 시크릿 확인 완료. 배포를 진행합니다."
```

- [ ] **Step 2: 실행 권한 부여 및 문법 검증**

```bash
chmod +x scripts/check-secrets.sh
bash -n scripts/check-secrets.sh
```

Expected: 오류 없이 종료 (출력 없음)

- [ ] **Step 3: 동작 검증 — 시크릿 미등록 시 오류 출력 확인**

```bash
# 존재하지 않는 시크릿 이름으로 임시 테스트
REQUIRED_SECRETS=("nonexistent_secret_xyz") bash -c '
  MISSING=()
  for secret in "${REQUIRED_SECRETS[@]}"; do
    docker secret inspect "$secret" > /dev/null 2>&1 || MISSING+=("$secret")
  done
  [ ${#MISSING[@]} -ne 0 ] && echo "PASS: 오류 감지됨 — ${MISSING[*]}" || echo "FAIL: 감지 실패"
'
```

Expected: `PASS: 오류 감지됨 — nonexistent_secret_xyz`

- [ ] **Step 4: 커밋**

```bash
git add scripts/check-secrets.sh
git commit -m "feat: 배포 전 Docker Swarm 시크릿 검증 스크립트 추가"
```

---

### Task 2: API Entrypoint Wrapper 스크립트

**Files:**
- Create: `services/api/docker-entrypoint.sh`

- [ ] **Step 1: 스크립트 파일 생성**

```sh
#!/bin/sh
# Docker Secrets 파일을 환경변수로 변환한 뒤 Spring Boot를 기동한다.
# /run/secrets/<name> 파일이 마운트되지 않으면 즉시 종료한다.
set -e

REQUIRED_SECRET_FILES="terab_db_password terab_minio_password terab_jwt_secret"
for f in $REQUIRED_SECRET_FILES; do
  if [ ! -f "/run/secrets/$f" ]; then
    echo "FATAL: Docker secret '$f' is not mounted at /run/secrets/$f"
    exit 1
  fi
done

export DB_PASSWORD=$(cat /run/secrets/terab_db_password)
export MINIO_SECRET_KEY=$(cat /run/secrets/terab_minio_password)
export JWT_SECRET=$(cat /run/secrets/terab_jwt_secret)

exec wait-for-it.sh db:5432 --timeout=60 -- java -jar app.jar
```

- [ ] **Step 2: 문법 검증**

```bash
bash -n services/api/docker-entrypoint.sh
```

Expected: 오류 없이 종료

- [ ] **Step 3: 시크릿 파일 미마운트 시 FATAL 출력 검증**

```bash
# /run/secrets 없는 환경에서 실행 시 에러 확인
sh -c '
  REQUIRED_SECRET_FILES="terab_db_password"
  for f in $REQUIRED_SECRET_FILES; do
    [ ! -f "/run/secrets/$f" ] && echo "PASS: FATAL 감지됨 — $f" && exit 0
  done
  echo "FAIL: FATAL 미감지"
'
```

Expected: `PASS: FATAL 감지됨 — terab_db_password`

- [ ] **Step 4: 커밋**

```bash
git add services/api/docker-entrypoint.sh
git commit -m "feat: API 컨테이너 Docker Secrets entrypoint wrapper 추가"
```

---

### Task 3: Dockerfile에 Entrypoint Wrapper 통합

**Files:**
- Modify: `services/api/Dockerfile`

현재 Dockerfile (관련 부분):
```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["wait-for-it.sh", "db:5432", "--timeout=60", "--", "java", "-jar", "app.jar"]
```

- [ ] **Step 1: Dockerfile 수정 — wrapper 스크립트 추가 및 ENTRYPOINT 교체**

`RUN addgroup...` 줄 바로 위에 아래 두 줄을 추가하고, ENTRYPOINT를 교체한다:

```dockerfile
# ─── Stage 2: Runtime ────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# wait-for-it.sh: bash 필요 (Alpine 기본 미포함)
RUN apk add --no-cache bash

# root 권한으로 스크립트 설치 (USER 전환 전)
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN chmod +x /usr/local/bin/wait-for-it.sh

# Docker Secrets entrypoint wrapper
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 보안: non-root 사용자로 실행
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
```

- [ ] **Step 2: Docker 이미지 빌드 검증**

```bash
cd services/api
docker build -t terab-api:secrets-test .
```

Expected: `Successfully built` (빌드 오류 없음)

- [ ] **Step 3: ENTRYPOINT 확인**

```bash
docker inspect terab-api:secrets-test --format '{{json .Config.Entrypoint}}'
```

Expected: `["docker-entrypoint.sh"]`

- [ ] **Step 4: 시크릿 미마운트 시 컨테이너 즉시 종료 확인**

```bash
docker run --rm terab-api:secrets-test 2>&1 | head -5
```

Expected: `FATAL: Docker secret 'terab_db_password' is not mounted at /run/secrets/terab_db_password`

- [ ] **Step 5: 커밋**

```bash
git add services/api/Dockerfile
git commit -m "feat: Dockerfile에 Docker Secrets entrypoint wrapper 통합"
```

---

### Task 4: docker-stack.yml 전면 수정

**Files:**
- Modify: `docker-stack.yml`

- [ ] **Step 1: docker-stack.yml 전체를 아래 내용으로 교체**

```yaml
# Docker Swarm 프로덕션 스택
# 사용법: ./scripts/check-secrets.sh && docker stack deploy -c docker-stack.yml terab --with-registry-auth
# 로컬 개발: docker-compose.local.yml 사용

services:
  # ─── PostgreSQL ───────────────────────────────────────────────
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: terab_db
      POSTGRES_USER: terab_user
      POSTGRES_PASSWORD_FILE: /run/secrets/terab_db_password
    secrets:
      - terab_db_password
    volumes:
      - /volume2/docker/terab/volumes/db:/var/lib/postgresql/data
    networks:
      - terab-net
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U terab_user -d terab_db']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
        delay: 5s

  # ─── MinIO (S3 호환 오브젝트 스토리지) ───────────────────────
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/terab_minio_password
    secrets:
      - terab_minio_password
    volumes:
      - /volume1/storage:/data
    ports:
      - '9001:9001'
    networks:
      - terab-net
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure

  # ─── Spring Boot API ──────────────────────────────────────────
  api:
    image: ghcr.io/idenn207/terab-api:latest
    environment:
      DB_URL: jdbc:postgresql://db:5432/terab_db
      DB_USER: terab_user
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: minioadmin
      MINIO_BUCKET: terab-files
      JWT_EXPIRATION_MS: 86400000
      # DB_PASSWORD, MINIO_SECRET_KEY, JWT_SECRET 은
      # docker-entrypoint.sh가 /run/secrets/ 에서 읽어 주입
    secrets:
      - terab_db_password
      - terab_minio_password
      - terab_jwt_secret
    networks:
      - terab-net
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/actuator/health']
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      replicas: 3
      update_config:
        order: start-first
        parallelism: 1
        failure_action: rollback
        delay: 10s
        monitor: 120s
      rollback_config:
        order: start-first
        parallelism: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  # ─── React Frontend ───────────────────────────────────────────
  web:
    image: ghcr.io/idenn207/terab-web:latest
    networks:
      - terab-net
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:80/']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    deploy:
      replicas: 2
      update_config:
        order: start-first
        parallelism: 1
        failure_action: rollback
        delay: 10s
        monitor: 20s
      rollback_config:
        order: start-first
      restart_policy:
        condition: on-failure

  # ─── Nginx (리버스 프록시) ─────────────────────────────────────
  nginx:
    image: nginx:alpine
    ports:
      - '8080:80'
    volumes:
      - /volume2/docker/terab/services/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - terab-net
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure

  # ─── Portainer CE (컨테이너 모니터링 UI) ─────────────────────────
  portainer:
    image: portainer/portainer-ce:latest
    command: -H tcp://tasks.portainer_agent:9001 --tlsskip-verify
    ports:
      - '9443:9443'
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

networks:
  terab-net:
    driver: overlay

secrets:
  terab_db_password:
    external: true
  terab_minio_password:
    external: true
  terab_jwt_secret:
    external: true
```

- [ ] **Step 2: YAML 문법 검증**

```bash
docker stack config -c docker-stack.yml > /dev/null
```

Expected: 오류 없이 종료 (`${}` 미치환 관련 오류 없음)

- [ ] **Step 3: 커밋**

```bash
git add docker-stack.yml
git commit -m "feat: docker-stack.yml Docker Secrets 적용 및 경로 하드코딩"
```

---

### Task 5: `.env` 정리 — 로컬 개발 전용 파일로 전환

**Files:**
- Modify: `.env`

- [ ] **Step 1: `.env`에서 시크릿 값 제거 및 주석 추가**

`.env`를 아래 내용으로 교체한다 (시크릿 제거, 로컬 개발 전용 명시):

```dotenv
# ─── 로컬 개발 전용 (.env) ────────────────────────────────────────
# 운영(Docker Swarm) 시크릿은 docker secret create 로 별도 등록
# 참고: docs/superpowers/specs/2026-04-07-docker-secrets-design.md

# ─── Paths (로컬 개발용) ─────────────────────────────────────────
DB_DATA_PATH=/volume2/docker/terab/volumes/db
MINIO_DATA_PATH=/volume1/storage
NGINX_CONF_PATH=/volume2/docker/terab/services/nginx/nginx.conf

# ─── Database ────────────────────────────────────────────────────
DB_NAME=terab_db
DB_USER=terab_user
DB_URL=jdbc:postgresql://db:5432/terab_db

# ─── MinIO (File Storage) ────────────────────────────────────────
MINIO_USER=minioadmin
MINIO_BUCKET=terab-files
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=minioadmin

# ─── JWT ─────────────────────────────────────────────────────────
JWT_EXPIRATION_MS=86400000

# ─── 아래 시크릿 값은 운영 환경에서 docker secret create 로 관리 ──
# DB_PASSWORD=
# MINIO_PASSWORD=
# JWT_SECRET=
```

- [ ] **Step 2: 커밋**

```bash
git add .env
git commit -m "chore: .env 시크릿 제거, 로컬 개발 전용 파일로 전환"
```

---

### Task 6: NAS 배포 및 E2E 검증

> 이 Task는 NAS SSH 접속 후 실행한다.

- [ ] **Step 1: NAS에서 Docker Secrets 등록**

`printf '%s'` 형식을 사용해야 `%`, `*`, `^` 등 특수문자가 안전하게 처리된다.  
실제 값은 로컬 `.env` 파일(시크릿 주석 블록) 또는 비밀번호 관리자에서 확인한다.

```bash
printf '%s' '<DB_PASSWORD 실제값>'    | docker secret create terab_db_password -
printf '%s' '<MINIO_PASSWORD 실제값>' | docker secret create terab_minio_password -
printf '%s' '<JWT_SECRET 실제값>'     | docker secret create terab_jwt_secret -
```

Expected:
```
<hash_id>   # 각각 생성된 시크릿 ID
```

- [ ] **Step 2: 시크릿 등록 확인**

```bash
docker secret ls
```

Expected:
```
ID          NAME                   DRIVER    CREATED         UPDATED
<id>        terab_db_password                <time>          <time>
<id>        terab_minio_password             <time>          <time>
<id>        terab_jwt_secret                 <time>          <time>
```

- [ ] **Step 3: 검증 스크립트 실행**

```bash
./scripts/check-secrets.sh
```

Expected: `모든 시크릿 확인 완료. 배포를 진행합니다.`

- [ ] **Step 4: 스택 배포**

```bash
docker stack deploy -c docker-stack.yml terab --with-registry-auth
```

Expected: volume 오류(`empty section between colons`) 없이 정상 배포

- [ ] **Step 5: 서비스 상태 확인**

```bash
docker stack ps terab --no-trunc
```

Expected: 모든 서비스 `Running` 상태 (Preparing/Starting은 잠시 후 Running으로 전환)

- [ ] **Step 6: API 헬스체크**

```bash
docker service logs terab_api 2>&1 | grep -E "FATAL|Started|health"
```

Expected:
- `FATAL` 로그 없음
- `Started TerabApplication` 또는 Spring Boot 기동 완료 로그 확인

- [ ] **Step 7: 서비스별 헬스 검증**

```bash
# PostgreSQL
docker exec $(docker ps -q -f name=terab_db) pg_isready -U terab_user -d terab_db

# API
curl -sf http://localhost:8080/actuator/health | grep '"status":"UP"'

# MinIO
curl -sf http://localhost:9000/minio/health/live && echo "MinIO OK"
```

Expected:
```
/var/run/postgresql:5432 - accepting connections
{"status":"UP",...}
MinIO OK
```

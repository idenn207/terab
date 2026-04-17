# 환경변수 관리 v2 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `local.env` + `application-local.properties` 이중 관리를 제거하고, `configs.env` + `secrets.env`를 단일 소스로 삼아 로컬(configtree `./run/`)과 운영(Docker config/secret)이 동일한 Spring 메커니즘을 사용하도록 통합한다.

**Architecture:** `configs.env`(committed, UPPERCASE)와 `secrets.env`(gitignored, UPPERCASE)가 단일 소스다. `make setup`은 docker config/secret을 등록하고, `make setup-local`은 `services/*/run/` configtree 파일을 생성한다. 로컬 인프라는 `docker-stack.infra.local.yml`로 Swarm Stack 배포하고, 전체 컨테이너 환경은 `docker-stack.yml -c docker-stack.local.yml` override 패턴으로 배포한다.

**Tech Stack:** Docker Swarm Stack, Spring Boot configtree, bash

---

## 파일 맵

### 신규 생성
```
configs.env                              (committed, UPPERCASE dev 기본값)
secrets.env.example                      (committed, UPPERCASE 키+로컬 기본값)
scripts/setup-local.sh                   (run/ 생성 + 누락 키 검증)
docker-stack.infra.local.yml             (infra 전용 로컬 스택)
docker-stack.local.yml                   (전체 로컬 override)
```

### 수정
```
.gitignore                               (configs.env 제거, services/*/run/ 추가)
Makefile                                 (LOCAL 변수 제거, infra/dev-up 업데이트)
docker-stack.yml                         (UPPERCASE config/secret 이름, rabbitmq + notification 추가)
services/api/src/main/resources/application.yml        (${UPPERCASE} 변환)
services/notification/src/main/resources/application.yml (${UPPERCASE} 변환)
services/api/src/main/resources/application-local.yml  (configtree ./run/)
services/notification/src/main/resources/application-local.yml (configtree ./run/)
scripts/check-secrets.sh                 (UPPERCASE 시크릿 이름)
```

### 삭제
```
local.env
docker-compose.local.yml
```

---

## Task 1: 소스 파일 — configs.env + secrets.env.example + .gitignore

**Files:**
- Modify: `configs.env`
- Create: `secrets.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: configs.env를 UPPERCASE dev 기본값으로 교체**

기존 파일 내용을 전부 교체한다. 기존 prod 값이 있다면 별도로 백업 후 진행.

```bash
# ─── DB ────────────────────────────────────────────────────────
DB_NAME=terab_db
DB_URL=jdbc:postgresql://localhost:5432/terab_db
DB_USER=terab_user

# ─── MinIO ─────────────────────────────────────────────────────
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=minioadmin
MINIO_BUCKET=terab-files

# ─── RabbitMQ ──────────────────────────────────────────────────
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=terab

# ─── JWT ───────────────────────────────────────────────────────
JWT_ACCESS_EXPIRY_MS=900000
JWT_REFRESH_EXPIRY_MS=604800000

# ─── App ───────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=https://drive.skypark207.com,https://admin.drive.skypark207.com,http://localhost:5173
OWNER_USERNAME=owner
OWNER_NICKNAME=Owner

# ─── Notification ──────────────────────────────────────────────
FIREBASE_CREDENTIALS_PATH=~/terab-firebase-key.json
```

- [ ] **Step 2: secrets.env.example 생성**

```bash
DB_PASSWORD=terab1234
MINIO_PASSWORD=minioadmin
JWT_SECRET=dev-secret-key-that-is-at-least-256-bits-long-for-hs256-algorithm
OWNER_PASSWORD=owner1234
PASSWORD_PEPPER=password-pepper-key
RABBITMQ_PASSWORD=terab1234
```

- [ ] **Step 3: secrets.env 생성 (개발자 로컬용, gitignore 대상)**

```bash
cp secrets.env.example secrets.env
```

- [ ] **Step 4: .gitignore 업데이트**

`.gitignore`에서 `configs.env` 줄을 제거하고, 하단에 추가:

```gitignore
# 제거할 줄
configs.env

# 추가할 줄 (services/api/application-local.properties 줄 아래)
services/api/run/
services/notification/run/
```

결과적으로 `.gitignore`에는 `services/api/application-local.properties`가 남아있어도 무방 (파일이 더 이상 생성되지 않으므로 무해).

- [ ] **Step 5: 검증 — configs.env가 커밋 대상인지 확인**

```bash
git status configs.env
```

Expected: `modified: configs.env` (tracked file로 표시됨, untracked 아님)

- [ ] **Step 6: Commit**

```bash
git add configs.env secrets.env.example .gitignore
git commit -m "chore: 환경변수 소스 파일 UPPERCASE 통일 (configs.env 재구성, secrets.env.example 추가)"
```

---

## Task 2: scripts/setup-local.sh 생성

**Files:**
- Create: `scripts/setup-local.sh`

- [ ] **Step 1: setup-local.sh 생성**

```bash
#!/bin/bash
set -e

SERVICES=(api notification)

# ─── secrets.env 존재 확인 ──────────────────────────────────────
if [ ! -f secrets.env ]; then
  echo "ERROR: secrets.env 없음. 아래 명령으로 생성하세요:"
  echo "  cp secrets.env.example secrets.env"
  exit 1
fi

# ─── 누락 키 검증 (root 수준에서 한눈에 확인) ────────────────────
echo "=== 환경변수 검증 ==="
MISSING=()
while IFS='=' read -r key _; do
  [[ "$key" =~ ^# || -z "$key" ]] && continue
  grep -q "^${key}=" secrets.env 2>/dev/null || MISSING+=("$key")
done < secrets.env.example

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "  ⚠ secrets.env 누락 키: ${MISSING[*]}"
  echo "  secrets.env를 업데이트한 후 다시 실행하세요."
  exit 1
fi
echo "  ✓ 모든 필수 키 확인 완료"

# ─── 서비스별 configtree run/ 디렉터리 생성 ─────────────────────
echo ""
echo "=== configtree 파일 생성 ==="
for service in "${SERVICES[@]}"; do
  mkdir -p "services/${service}/run"

  while IFS='=' read -r key val; do
    [[ "$key" =~ ^# || -z "$key" ]] && continue
    printf '%s' "$val" > "services/${service}/run/${key}"
  done < configs.env

  while IFS='=' read -r key val; do
    [[ "$key" =~ ^# || -z "$key" ]] && continue
    printf '%s' "$val" > "services/${service}/run/${key}"
  done < secrets.env

  echo "  ✓ services/${service}/run/ 생성 완료 ($(ls services/${service}/run/ | wc -l)개 파일)"
done

echo ""
echo "setup-local 완료. 'make api' 또는 'make notification'으로 서버를 기동하세요."
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x scripts/setup-local.sh
```

- [ ] **Step 3: 동작 확인**

```bash
bash scripts/setup-local.sh
```

Expected:
```
=== 환경변수 검증 ===
  ✓ 모든 필수 키 확인 완료

=== configtree 파일 생성 ===
  ✓ services/api/run/ 생성 완료 (20개 파일)
  ✓ services/notification/run/ 생성 완료 (20개 파일)

setup-local 완료. 'make api' 또는 'make notification'으로 서버를 기동하세요.
```

- [ ] **Step 4: 누락 키 검증 동작 확인**

```bash
# 임시로 secrets.env에서 키 하나 제거 후 실행
sed -i '/^DB_PASSWORD/d' secrets.env
bash scripts/setup-local.sh
```

Expected: `⚠ secrets.env 누락 키: DB_PASSWORD`

```bash
# 복원
cp secrets.env.example secrets.env
```

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-local.sh
git commit -m "chore: setup-local.sh 추가 (configtree run/ 생성 + 누락 키 검증)"
```

---

## Task 3: docker-stack.infra.local.yml 생성

**Files:**
- Create: `docker-stack.infra.local.yml`

- [ ] **Step 1: docker-stack.infra.local.yml 생성**

```yaml
# 로컬 인프라 전용 스택 — make infra 용
# docker config/secret은 make setup으로 사전 등록 필요

services:
  # ─── PostgreSQL ───────────────────────────────────────────────
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB_FILE:       /run/configs/DB_NAME
      POSTGRES_USER_FILE:     /run/configs/DB_USER
      POSTGRES_PASSWORD_FILE: /run/secrets/DB_PASSWORD
    configs:
      - { source: DB_NAME, target: /run/configs/DB_NAME }
      - { source: DB_USER, target: /run/configs/DB_USER }
    secrets:
      - DB_PASSWORD
    volumes:
      - ./volumes/db:/var/lib/postgresql/data
    ports:
      - '5432:5432'
    networks:
      - terab-net
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure

  # ─── MinIO ───────────────────────────────────────────────────
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER_FILE:     /run/configs/MINIO_ROOT_USER
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/MINIO_PASSWORD
    configs:
      - { source: MINIO_ROOT_USER, target: /run/configs/MINIO_ROOT_USER }
    secrets:
      - MINIO_PASSWORD
    volumes:
      - ./volumes/storage:/data
    ports:
      - '9000:9000'
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

  # ─── RabbitMQ ────────────────────────────────────────────────
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER_FILE: /run/configs/RABBITMQ_USERNAME
      RABBITMQ_DEFAULT_PASS_FILE: /run/secrets/RABBITMQ_PASSWORD
    configs:
      - { source: RABBITMQ_USERNAME, target: /run/configs/RABBITMQ_USERNAME }
    secrets:
      - RABBITMQ_PASSWORD
    volumes:
      - ./volumes/rabbitmq:/var/lib/rabbitmq
    ports:
      - '5672:5672'
      - '15672:15672'
    networks:
      - terab-net
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure

networks:
  terab-net:
    driver: overlay
    attachable: true

configs:
  DB_NAME:           { external: true }
  DB_USER:           { external: true }
  MINIO_ROOT_USER:   { external: true }
  RABBITMQ_USERNAME: { external: true }

secrets:
  DB_PASSWORD:       { external: true }
  MINIO_PASSWORD:    { external: true }
  RABBITMQ_PASSWORD: { external: true }
```

- [ ] **Step 2: make setup 실행 (docker config/secret 등록)**

```bash
make setup
```

Expected: 각 키에 대해 `docker config create DB_NAME ...` 성공 메시지

- [ ] **Step 3: 배포 확인**

```bash
docker stack deploy -c docker-stack.infra.local.yml terab-infra
docker stack ps terab-infra
```

Expected: `db`, `minio`, `rabbitmq` 서비스가 `Running` 상태

- [ ] **Step 4: DB 연결 확인**

```bash
docker exec $(docker ps -q -f name=terab-infra_db) pg_isready
```

Expected: `localhost:5432 - accepting connections`

- [ ] **Step 5: Commit**

```bash
git add docker-stack.infra.local.yml
git commit -m "feat: docker-stack.infra.local.yml 추가 (로컬 인프라 Swarm Stack)"
```

---

## Task 4: docker-stack.local.yml 생성

**Files:**
- Create: `docker-stack.local.yml`

- [ ] **Step 1: docker-stack.local.yml 생성**

`docker-stack.yml`의 override 파일. 변경이 필요한 항목만 선언한다.

```yaml
# 로컬 개발용 docker-stack.yml override
# 사용법: docker stack deploy -c docker-stack.yml -c docker-stack.local.yml terab
# 주의: make infra (terab-infra 스택)가 먼저 실행되어 terab-infra_terab-net 네트워크가 있어야 함

services:
  # ─── Infra: terab-infra 스택에서 실행 중이므로 여기서는 0 ─────────
  # make dev-up 전에 반드시 make infra가 먼저 실행되어야 함
  db:
    deploy:
      replicas: 0

  minio:
    deploy:
      replicas: 0

  rabbitmq:
    deploy:
      replicas: 0

  # ─── App: 로컬 빌드 이미지 override ────────────────────────────
  api:
    image: terab-api:local
    build:
      context: ./services/api
      dockerfile: Dockerfile
    deploy:
      replicas: 1
      placement:
        constraints: []
      update_config:
        order: start-first

  notification:
    image: terab-notification:local
    build:
      context: ./services/notification
      dockerfile: Dockerfile
    ports:
      - '8082:8082'
    deploy:
      replicas: 1
      placement:
        constraints: []

  web:
    image: terab-web:local
    build:
      context: ./services/web
      dockerfile: Dockerfile
    deploy:
      replicas: 1
      placement:
        constraints: []

  # ─── 로컬 불필요 서비스 제거 ─────────────────────────────────────
  portainer:
    deploy:
      replicas: 0

  portainer_agent:
    deploy:
      replicas: 0

# ─── 네트워크: terab-infra 스택이 생성한 네트워크 참조 ─────────────
networks:
  terab-net:
    external: true
    name: terab-infra_terab-net
```

- [ ] **Step 2: Commit**

```bash
git add docker-stack.local.yml
git commit -m "feat: docker-stack.local.yml 추가 (전체 로컬 Swarm override)"
```

---

## Task 5: docker-stack.yml 업데이트

**Files:**
- Modify: `docker-stack.yml`

이 태스크는 범위가 넓다. 변경 내용: ① 모든 config/secret 이름 UPPERCASE 변환, ② API 서비스에 누락 config/secret 추가, ③ rabbitmq 서비스 추가, ④ notification 서비스 추가.

- [ ] **Step 1: db 서비스 config/secret 이름 변경**

```yaml
# 변경 전
db:
  environment:
    POSTGRES_DB_FILE:       /run/configs/db_name
    POSTGRES_USER_FILE:     /run/configs/db_user
    POSTGRES_PASSWORD_FILE: /run/secrets/terab_db_password
  configs:
    - { source: db_name, target: /run/configs/db_name }
    - { source: db_user, target: /run/configs/db_user }
  secrets:
    - terab_db_password

# 변경 후
db:
  environment:
    POSTGRES_DB_FILE:       /run/configs/DB_NAME
    POSTGRES_USER_FILE:     /run/configs/DB_USER
    POSTGRES_PASSWORD_FILE: /run/secrets/DB_PASSWORD
  configs:
    - { source: DB_NAME, target: /run/configs/DB_NAME }
    - { source: DB_USER, target: /run/configs/DB_USER }
  secrets:
    - DB_PASSWORD
```

- [ ] **Step 2: minio 서비스 config/secret 이름 변경**

```yaml
# 변경 전
minio:
  environment:
    MINIO_ROOT_USER_FILE:     /run/configs/minio_root_user
    MINIO_ROOT_PASSWORD_FILE: /run/secrets/terab_minio_password
  configs:
    - { source: minio_root_user, target: /run/configs/minio_root_user }
  secrets:
    - terab_minio_password

# 변경 후
minio:
  environment:
    MINIO_ROOT_USER_FILE:     /run/configs/MINIO_ROOT_USER
    MINIO_ROOT_PASSWORD_FILE: /run/secrets/MINIO_PASSWORD
  configs:
    - { source: MINIO_ROOT_USER, target: /run/configs/MINIO_ROOT_USER }
  secrets:
    - MINIO_PASSWORD
```

- [ ] **Step 3: api 서비스 configs/secrets 전면 교체 (누락 항목 포함)**

```yaml
# 변경 후 (api 서비스의 configs + secrets 블록 전체)
api:
  image: ghcr.io/idenn207/terab-api:latest
  configs:
    - { source: DB_URL,               target: /run/configs/DB_URL }
    - { source: DB_USER,              target: /run/configs/DB_USER }
    - { source: MINIO_ENDPOINT,       target: /run/configs/MINIO_ENDPOINT }
    - { source: MINIO_ROOT_USER,      target: /run/configs/MINIO_ROOT_USER }
    - { source: MINIO_BUCKET,         target: /run/configs/MINIO_BUCKET }
    - { source: OWNER_USERNAME,       target: /run/configs/OWNER_USERNAME }
    - { source: OWNER_NICKNAME,       target: /run/configs/OWNER_NICKNAME }
    - { source: JWT_ACCESS_EXPIRY_MS,  target: /run/configs/JWT_ACCESS_EXPIRY_MS }
    - { source: JWT_REFRESH_EXPIRY_MS, target: /run/configs/JWT_REFRESH_EXPIRY_MS }
    - { source: CORS_ALLOWED_ORIGINS,  target: /run/configs/CORS_ALLOWED_ORIGINS }
    - { source: RABBITMQ_HOST,        target: /run/configs/RABBITMQ_HOST }
    - { source: RABBITMQ_PORT,        target: /run/configs/RABBITMQ_PORT }
    - { source: RABBITMQ_USERNAME,    target: /run/configs/RABBITMQ_USERNAME }
  secrets:
    - DB_PASSWORD
    - MINIO_PASSWORD
    - JWT_SECRET
    - OWNER_PASSWORD
    - PASSWORD_PEPPER
    - RABBITMQ_PASSWORD
  # networks, healthcheck, deploy 블록은 그대로 유지
```

- [ ] **Step 4: rabbitmq 서비스 추가 (minio 서비스 아래)**

```yaml
  # ─── RabbitMQ (메시지 브로커) ─────────────────────────────────
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER_FILE: /run/configs/RABBITMQ_USERNAME
      RABBITMQ_DEFAULT_PASS_FILE: /run/secrets/RABBITMQ_PASSWORD
    configs:
      - { source: RABBITMQ_USERNAME, target: /run/configs/RABBITMQ_USERNAME }
    secrets:
      - RABBITMQ_PASSWORD
    volumes:
      - /volume2/docker/terab/volumes/rabbitmq:/var/lib/rabbitmq
    networks:
      - terab-net
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'ping']
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
```

- [ ] **Step 5: notification 서비스 추가 (api 서비스 아래)**

```yaml
  # ─── Notification MS ──────────────────────────────────────────
  notification:
    image: ghcr.io/idenn207/terab-notification:latest
    configs:
      - { source: RABBITMQ_HOST,             target: /run/configs/RABBITMQ_HOST }
      - { source: RABBITMQ_PORT,             target: /run/configs/RABBITMQ_PORT }
      - { source: RABBITMQ_USERNAME,         target: /run/configs/RABBITMQ_USERNAME }
      - { source: FIREBASE_CREDENTIALS_PATH, target: /run/configs/FIREBASE_CREDENTIALS_PATH }
    secrets:
      - RABBITMQ_PASSWORD
    networks:
      - terab-net
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO /dev/null http://localhost:8082/actuator/health || exit 1']
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 5s
```

- [ ] **Step 6: configs + secrets 최상위 블록 전면 교체**

```yaml
configs:
  DB_NAME:                   { external: true }
  DB_URL:                    { external: true }
  DB_USER:                   { external: true }
  MINIO_ENDPOINT:            { external: true }
  MINIO_ROOT_USER:           { external: true }
  MINIO_BUCKET:              { external: true }
  OWNER_USERNAME:            { external: true }
  OWNER_NICKNAME:            { external: true }
  JWT_ACCESS_EXPIRY_MS:      { external: true }
  JWT_REFRESH_EXPIRY_MS:     { external: true }
  CORS_ALLOWED_ORIGINS:      { external: true }
  RABBITMQ_HOST:             { external: true }
  RABBITMQ_PORT:             { external: true }
  RABBITMQ_USERNAME:         { external: true }
  FIREBASE_CREDENTIALS_PATH: { external: true }

secrets:
  DB_PASSWORD:       { external: true }
  MINIO_PASSWORD:    { external: true }
  JWT_SECRET:        { external: true }
  OWNER_PASSWORD:    { external: true }
  PASSWORD_PEPPER:   { external: true }
  RABBITMQ_PASSWORD: { external: true }
```

- [ ] **Step 7: Commit**

```bash
git add docker-stack.yml
git commit -m "chore: docker-stack.yml config/secret 이름 UPPERCASE 통일 + rabbitmq/notification 서비스 추가"
```

---

## Task 6: API application.yml — placeholder UPPERCASE 변환

**Files:**
- Modify: `services/api/src/main/resources/application.yml`

- [ ] **Step 1: application.yml 전체 교체**

```yaml
spring:
  config:
    import:
      - 'optional:configtree:/run/secrets/'
      - 'optional:configtree:/run/configs/'
  datasource:
    driver-class-name: org.postgresql.Driver
    url: ${DB_URL:}
    username: ${DB_USER:}
    password: ${DB_PASSWORD:}
    hikari:
      maximum-pool-size: 5
      minimum-idle: 2
      connection-timeout: 30000
      keepalive-time: 60000
      initialization-fail-timeout: -1
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration
    connect-retries: 10
    connect-retries-interval: 3s
  servlet:
    multipart:
      max-file-size: 10GB
      max-request-size: 10GB
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: ${RABBITMQ_PORT:5672}
    username: ${RABBITMQ_USERNAME:terab}
    password: ${RABBITMQ_PASSWORD:}
  cloud:
    stream:
      bindings:
        terab-events-out-0:
          destination: terab.events
          content-type: application/json
      rabbit:
        bindings:
          terab-events-out-0:
            producer:
              routing-key-expression: headers['routingKey']
              exchange-type: topic

server:
  port: 8080

minio:
  endpoint: ${MINIO_ENDPOINT:}
  access-key: ${MINIO_ROOT_USER:}
  secret-key: ${MINIO_PASSWORD:}
  bucket: ${MINIO_BUCKET:}

jwt:
  secret: ${JWT_SECRET:}
  access-token-expiration-ms: ${JWT_ACCESS_EXPIRY_MS:900000}
  refresh-token-expiration-ms: ${JWT_REFRESH_EXPIRY_MS:604800000}

app:
  cors:
    allowed-origins: ${CORS_ALLOWED_ORIGINS:https://drive.skypark207.com,https://admin.drive.skypark207.com}
  security:
    password-pepper: ${PASSWORD_PEPPER:}
  owner:
    username: ${OWNER_USERNAME:owner}
    nickname: ${OWNER_NICKNAME:Owner}
    password: ${OWNER_PASSWORD:}
```

- [ ] **Step 2: 단위 테스트 실행 — 컴파일 확인**

```bash
cd services/api && ./gradlew test -x integrationTest 2>&1 | tail -5
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add services/api/src/main/resources/application.yml
git commit -m "chore: API application.yml placeholder UPPERCASE 통일 (terab_ 접두사 제거)"
```

---

## Task 7: Notification application.yml — placeholder UPPERCASE 변환

**Files:**
- Modify: `services/notification/src/main/resources/application.yml`

- [ ] **Step 1: application.yml 전체 교체**

```yaml
spring:
  config:
    import:
      - 'optional:configtree:/run/secrets/'
      - 'optional:configtree:/run/configs/'
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: ${RABBITMQ_PORT:5672}
    username: ${RABBITMQ_USERNAME:terab}
    password: ${RABBITMQ_PASSWORD:}
  cloud:
    function:
      definition: processPushChallenge
    stream:
      bindings:
        processPushChallenge-in-0:
          destination: terab.events
          group: notification-push
          content-type: application/json
      rabbit:
        bindings:
          processPushChallenge-in-0:
            consumer:
              binding-routing-key: auth.2fa.challenge
              exchange-type: topic

server:
  port: 8082

firebase:
  credentials-path: ${FIREBASE_CREDENTIALS_PATH:}

management:
  endpoints:
    web:
      exposure:
        include: health
```

- [ ] **Step 2: 단위 테스트 실행 — 컴파일 확인**

```bash
cd services/notification && ./gradlew test -x integrationTest 2>&1 | tail -5
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add services/notification/src/main/resources/application.yml
git commit -m "chore: Notification application.yml placeholder UPPERCASE 통일"
```

---

## Task 8: application-local.yml — configtree ./run/ 전환

**Files:**
- Modify: `services/api/src/main/resources/application-local.yml`
- Modify: `services/notification/src/main/resources/application-local.yml`

- [ ] **Step 1: setup-local.sh 실행 (run/ 파일이 존재해야 함)**

```bash
bash scripts/setup-local.sh
```

Expected: `services/api/run/`과 `services/notification/run/` 에 파일 생성 확인

```bash
ls services/api/run/ | head -5
```

Expected: `CORS_ALLOWED_ORIGINS  DB_NAME  DB_PASSWORD  DB_URL  DB_USER  ...`

- [ ] **Step 2: API application-local.yml 교체**

```yaml
server:
  port: 9090

spring:
  config:
    import:
      - 'optional:configtree:./run/'
  jpa:
    show-sql: true

logging:
  level:
    root: info
    '[com.terab.api]': warn
```

- [ ] **Step 3: Notification application-local.yml 교체**

```yaml
spring:
  config:
    import:
      - 'optional:configtree:./run/'
```

- [ ] **Step 4: API bootRun 기동 확인**

인프라(DB, RabbitMQ)가 `make infra`로 실행 중인 상태에서:

```bash
cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local' &
sleep 20
curl -s http://localhost:9090/actuator/health | grep '"status":"UP"'
kill %1
```

Expected: `"status":"UP"` 출력

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/resources/application-local.yml \
        services/notification/src/main/resources/application-local.yml
git commit -m "chore: application-local.yml configtree ./run/ 전환 (hardcoded 값 제거)"
```

---

## Task 9: Makefile 업데이트

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: LOCAL 변수 제거 및 setup-local 업데이트**

`Makefile` 상단에서 `LOCAL := ...` 줄 제거.

`setup-local` 타겟 교체:

```makefile
.PHONY: setup-local
setup-local: ## 로컬 개발 초기 설정 (최초 클론 후 1회, configs.env/secrets.env 변경 시 재실행)
	@bash scripts/setup-local.sh
```

- [ ] **Step 2: infra 관련 타겟 교체**

```makefile
# ─── 로컬 인프라 (DB + MinIO + RabbitMQ) ──────────────────────────
.PHONY: infra
infra:
	docker stack deploy -c docker-stack.infra.local.yml terab-infra

.PHONY: infra-down
infra-down:
	docker stack rm terab-infra

.PHONY: infra-reset
infra-reset:
	docker stack rm terab-infra
	rm -rf ./volumes/
	docker stack deploy -c docker-stack.infra.local.yml terab-infra
```

- [ ] **Step 3: dev-up / dev-down 타겟 교체**

```makefile
# ─── 개발 환경 (전체 서비스, 로컬 빌드) ──────────────────────────
.PHONY: dev-up
dev-up: build-local
	docker stack deploy -c docker-stack.yml -c docker-stack.local.yml terab

.PHONY: dev-down
dev-down:
	docker stack rm terab

# ─── 로컬 이미지 빌드 ─────────────────────────────────────────────
.PHONY: build-local
build-local:
	docker build -t terab-api:local ./services/api
	docker build -t terab-notification:local ./services/notification
	docker build -t terab-web:local ./services/web
```

- [ ] **Step 4: 동작 확인**

```bash
make infra-down
make infra
docker stack ps terab-infra --format "{{.Name}} {{.CurrentState}}"
```

Expected: `terab-infra_db`, `terab-infra_minio`, `terab-infra_rabbitmq` 각각 `Running` 상태

- [ ] **Step 5: Commit**

```bash
git add Makefile
git commit -m "chore: Makefile LOCAL 변수 제거, infra/dev-up docker stack 전환"
```

---

## Task 10: 정리 — check-secrets.sh 업데이트 + 구 파일 삭제

**Files:**
- Modify: `scripts/check-secrets.sh`
- Delete: `local.env`
- Delete: `docker-compose.local.yml`

- [ ] **Step 1: check-secrets.sh 업데이트**

```bash
#!/bin/bash
# 배포 전 Docker Swarm에 필수 시크릿/컨피그가 등록되어 있는지 확인
# 사용법: ./scripts/check-secrets.sh
set -e

REQUIRED_SECRETS=("DB_PASSWORD" "MINIO_PASSWORD" "JWT_SECRET" "OWNER_PASSWORD" "PASSWORD_PEPPER" "RABBITMQ_PASSWORD")
REQUIRED_CONFIGS=("DB_NAME" "DB_URL" "DB_USER" "MINIO_ENDPOINT" "MINIO_ROOT_USER" "MINIO_BUCKET" "OWNER_USERNAME" "OWNER_NICKNAME" "JWT_ACCESS_EXPIRY_MS" "JWT_REFRESH_EXPIRY_MS" "CORS_ALLOWED_ORIGINS" "RABBITMQ_HOST" "RABBITMQ_PORT" "RABBITMQ_USERNAME" "FIREBASE_CREDENTIALS_PATH")

MISSING=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  docker secret inspect "$secret" > /dev/null 2>&1 || MISSING+=("secret:$secret")
done

for config in "${REQUIRED_CONFIGS[@]}"; do
  docker config inspect "$config" > /dev/null 2>&1 || MISSING+=("config:$config")
done

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "ERROR: 누락된 항목:"
  for item in "${MISSING[@]}"; do
    echo "  - $item"
  done
  echo ""
  echo "등록 방법: make setup"
  exit 1
fi

echo "모든 시크릿/컨피그 확인 완료. 배포를 진행합니다."
```

- [ ] **Step 2: local.env 삭제**

```bash
git rm local.env
```

- [ ] **Step 3: docker-compose.local.yml 삭제**

```bash
git rm docker-compose.local.yml
```

- [ ] **Step 4: Commit**

```bash
git add scripts/check-secrets.sh
git commit -m "chore: check-secrets.sh UPPERCASE 반영, local.env + docker-compose.local.yml 제거"
```

---

## Task 11: 통합 검증

이 태스크는 전체 플로우가 end-to-end로 동작하는지 확인한다.

- [ ] **Step 1: 신규 개발자 시나리오 검증 (클린 상태에서)**

```bash
# secrets.env가 없는 상태에서 setup-local이 에러를 내는지 확인
mv secrets.env secrets.env.bak
bash scripts/setup-local.sh
```

Expected: `ERROR: secrets.env 없음. cp secrets.env.example secrets.env`

```bash
mv secrets.env.bak secrets.env
```

- [ ] **Step 2: make setup + make setup-local 전체 실행**

```bash
make setup
make setup-local
```

Expected:
```
=== 환경변수 검증 ===
  ✓ 모든 필수 키 확인 완료

=== configtree 파일 생성 ===
  ✓ services/api/run/ 생성 완료
  ✓ services/notification/run/ 생성 완료
```

- [ ] **Step 3: configtree 파일 내용 확인**

```bash
cat services/api/run/DB_URL
```

Expected: `jdbc:postgresql://localhost:5432/terab_db`

```bash
cat services/api/run/JWT_SECRET
```

Expected: `dev-secret-key-that-is-at-least-256-bits-long-for-hs256-algorithm`

- [ ] **Step 4: make infra 확인**

```bash
make infra
sleep 15
docker stack ps terab-infra --format "{{.Name}} {{.CurrentState}}"
```

Expected: 3개 서비스 모두 `Running`

- [ ] **Step 5: API bootRun 확인**

```bash
cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local' &
sleep 25
curl -s http://localhost:9090/actuator/health
kill %1
```

Expected: `{"status":"UP",...}`

- [ ] **Step 6: Notification bootRun 확인**

```bash
cd services/notification && ./gradlew bootRun --args='--spring.profiles.active=local' &
sleep 20
curl -s http://localhost:8082/actuator/health
kill %1
```

Expected: `{"status":"UP",...}`

- [ ] **Step 7: check-secrets.sh 확인**

```bash
bash scripts/check-secrets.sh
```

Expected: `모든 시크릿/컨피그 확인 완료. 배포를 진행합니다.`

- [ ] **Step 8: 전체 테스트 통과 확인**

```bash
cd services/api && ./gradlew test -x integrationTest 2>&1 | tail -3
cd services/notification && ./gradlew test -x integrationTest 2>&1 | tail -3
```

Expected: 두 서비스 모두 `BUILD SUCCESSFUL`

- [ ] **Step 9: Final Commit**

```bash
git add .
git status
# 변경된 파일이 없어야 함 (모든 변경이 이전 태스크에서 커밋됨)
```

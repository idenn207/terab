# 환경변수 관리 v2 설계 (Multi-Service 통합)

## 배경 및 목표

Notification MS 추가로 서비스가 늘어나면서 기존 환경변수 관리 방식의 한계가 드러났다.

**기존 문제:**
- `local.env` 하나에 Spring Boot 키(소문자)와 Docker Compose 키(대문자)가 혼재
- `make setup-local`이 API 서비스만 위한 `application-local.properties`를 생성 (Notification 미지원)
- 로컬(`application-local.properties`)과 운영(Docker config/secret)이 완전히 다른 메커니즘
- Notification의 `application-local.yml`은 하드코딩 값으로 git에 커밋

**목표:**
- 단일 소스: `configs.env` + `secrets.env`
- 로컬과 운영이 동일한 Spring 메커니즘(configtree) 사용
- 환경변수 누락 여부를 root 수준에서 한눈에 확인
- `.env` 컨벤션 통일 (UPPERCASE)
- `local.env` 제거

---

## 아키텍처

```
configs.env (committed, UPPERCASE, dev 기본값)  ─┬─ make setup ──► docker config 등록
secrets.env (gitignored, UPPERCASE, 민감값)      ─┘   (local + prod 동일 명령어)
secrets.env.example (committed, 키+기본값 템플릿)
                                                  │
                                                  └─ make setup-local ──► services/*/run/
                                                                                │
                                                              configtree:./run/ (local bootRun)
                                                              configtree:/run/configs/ + /run/secrets/ (prod)

docker-stack.infra.local.yml ─── docker stack deploy terab-infra ──► DB / MinIO / RabbitMQ
docker-stack.yml + docker-stack.local.yml ─── docker stack deploy terab ──► 전체 로컬 컨테이너
```

---

## 환경변수 분류

### `configs.env` (비민감, committed)

```bash
# DB
DB_NAME=terab_db
DB_URL=jdbc:postgresql://localhost:5432/terab_db
DB_USER=terab_user

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=minioadmin
MINIO_BUCKET=terab-files

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=terab

# JWT
JWT_ACCESS_EXPIRY_MS=900000
JWT_REFRESH_EXPIRY_MS=604800000

# App
CORS_ALLOWED_ORIGINS=https://drive.skypark207.com,https://admin.drive.skypark207.com,http://localhost:5173
OWNER_USERNAME=owner
OWNER_NICKNAME=Owner

# Notification
FIREBASE_CREDENTIALS_PATH=~/terab-firebase-key.json
```

### `secrets.env.example` (키+로컬 기본값, committed)

```bash
DB_PASSWORD=terab1234
MINIO_PASSWORD=minioadmin
JWT_SECRET=dev-secret-key-that-is-at-least-256-bits-long-for-hs256-algorithm
OWNER_PASSWORD=owner1234
PASSWORD_PEPPER=password-pepper-key
RABBITMQ_PASSWORD=terab1234
```

`secrets.env` (gitignored) — 개발자가 `cp secrets.env.example secrets.env` 후 운영값 교체.

---

## 파일 변경 목록

| 액션 | 파일 | 내용 |
|------|------|------|
| 신규 | `docker-stack.local.yml` | 전체 로컬 override (api+notification+web+nginx+infra) |
| 신규 | `docker-stack.infra.local.yml` | infra 전용 로컬 스택 (make infra 용) |
| 신규 | `secrets.env.example` | 필수 시크릿 키 + 로컬 기본값 템플릿 |
| 신규 | `scripts/setup-local.sh` | run/ 생성 + 누락 변수 검증 |
| 수정 | `configs.env` | UPPERCASE 키, dev 기본값 포함, gitignore 제외 |
| 수정 | `.gitignore` | configs.env 제거, services/*/run/ 추가 |
| 수정 | `Makefile` | LOCAL 변수 제거, infra/dev-up/build-local 업데이트 |
| 수정 | `docker-stack.yml` | config/secret source 이름 → UPPERCASE, rabbitmq + notification 서비스 추가 |
| 수정 | `services/api/src/main/resources/application.yml` | `${lowercase}` → `${UPPERCASE}`, terab_ 접두사 제거 |
| 수정 | `services/notification/src/main/resources/application.yml` | 동일 |
| 수정 | `services/api/application-local.yml` | configtree `./run/` 사용 |
| 수정 | `services/notification/application-local.yml` | configtree `./run/` 사용 |
| 수정 | `scripts/check-secrets.sh` | UPPERCASE 시크릿 이름 반영 |
| 삭제 | `local.env` | configs.env + secrets.env로 흡수 |
| 삭제 | `docker-compose.local.yml` | docker-stack.local.yml + docker-stack.infra.local.yml로 대체 |
| gitignore 제거 | `services/api/application-local.properties` | 더 이상 생성 안 함 |
| gitignore 추가 | `services/api/run/`, `services/notification/run/` | 생성된 configtree 파일 트리 |

---

## 신규 파일 상세

### `docker-stack.infra.local.yml`

infra 서비스만 포함. 로컬 볼륨 경로 사용. `terab-infra_terab-net` 오버레이 네트워크 생성.

```yaml
services:
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
    networks: [terab-net]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      replicas: 1

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
    networks: [terab-net]
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      replicas: 1

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
    networks: [terab-net]
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      replicas: 1

networks:
  terab-net:
    driver: overlay
    attachable: true

configs:
  DB_NAME:         { external: true }
  DB_USER:         { external: true }
  MINIO_ROOT_USER: { external: true }
  RABBITMQ_USERNAME: { external: true }

secrets:
  DB_PASSWORD:       { external: true }
  MINIO_PASSWORD:    { external: true }
  RABBITMQ_PASSWORD: { external: true }
```

### `docker-stack.local.yml`

`docker-stack.yml`의 override 파일. 변경되는 항목만 선언.

```yaml
services:
  # ─── Infra: 로컬 볼륨 경로 override ────────────────────────────
  db:
    volumes:
      - ./volumes/db:/var/lib/postgresql/data
    deploy:
      replicas: 1
      placement:
        constraints: []

  minio:
    volumes:
      - ./volumes/storage:/data
    deploy:
      replicas: 1
      placement:
        constraints: []

  # ─── App: 로컬 빌드 이미지로 override ───────────────────────────
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

  web:
    image: terab-web:local
    build:
      context: ./services/web
      dockerfile: Dockerfile
    deploy:
      replicas: 1
      placement:
        constraints: []

  # ─── 로컬에서 불필요한 서비스 제거 ──────────────────────────────
  portainer:
    deploy:
      replicas: 0
  portainer_agent:
    deploy:
      replicas: 0

# ─── 네트워크: infra stack이 생성한 terab-net 공유 ────────────────
networks:
  terab-net:
    external: true
    name: terab-infra_terab-net

configs:
  RABBITMQ_HOST:             { external: true }
  RABBITMQ_USERNAME:         { external: true }
  FIREBASE_CREDENTIALS_PATH: { external: true }

secrets:
  RABBITMQ_PASSWORD: { external: true }
  OWNER_PASSWORD:    { external: true }
  PASSWORD_PEPPER:   { external: true }
```

### `scripts/setup-local.sh`

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

# ─── 누락 키 검증 ────────────────────────────────────────────────
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

  echo "  ✓ services/${service}/run/ 생성 완료"
done

echo ""
echo "setup-local 완료."
```

---

## 수정 파일 상세

### `application.yml` placeholder 변경 (API + Notification 공통)

| 현재 | 변경 후 | 비고 |
|------|---------|------|
| `${db_url:}` | `${DB_URL:}` | |
| `${db_user:}` | `${DB_USER:}` | |
| `${terab_db_password:}` | `${DB_PASSWORD:}` | terab_ 접두사 제거 |
| `${rabbitmq_host:localhost}` | `${RABBITMQ_HOST:localhost}` | |
| `${rabbitmq_port:5672}` | `${RABBITMQ_PORT:5672}` | |
| `${rabbitmq_username:terab}` | `${RABBITMQ_USERNAME:terab}` | |
| `${terab_rabbitmq_password:}` | `${RABBITMQ_PASSWORD:}` | terab_ 접두사 제거 |
| `${minio_endpoint:}` | `${MINIO_ENDPOINT:}` | |
| `${minio_root_user:}` | `${MINIO_ROOT_USER:}` | |
| `${terab_minio_password:}` | `${MINIO_PASSWORD:}` | terab_ 접두사 제거 |
| `${minio_bucket:}` | `${MINIO_BUCKET:}` | |
| `${terab_jwt_secret:}` | `${JWT_SECRET:}` | terab_ 접두사 제거 |
| `${jwt_access_expiry_ms:900000}` | `${JWT_ACCESS_EXPIRY_MS:900000}` | |
| `${jwt_refresh_expiry_ms:604800000}` | `${JWT_REFRESH_EXPIRY_MS:604800000}` | |
| `${cors_allowed_origins:...}` | `${CORS_ALLOWED_ORIGINS:...}` | |
| `${terab_password_pepper:}` | `${PASSWORD_PEPPER:}` | terab_ 접두사 제거 |
| `${owner_username:owner}` | `${OWNER_USERNAME:owner}` | |
| `${owner_nickname:Owner}` | `${OWNER_NICKNAME:Owner}` | |
| `${terab_owner_password:}` | `${OWNER_PASSWORD:}` | terab_ 접두사 제거 |
| `${FIREBASE_CREDENTIALS_PATH:}` | `${FIREBASE_CREDENTIALS_PATH:}` | 이미 대문자, 유지 |

### `application-local.yml` (API + Notification)

```yaml
# API: services/api/src/main/resources/application-local.yml
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

```yaml
# Notification: services/notification/src/main/resources/application-local.yml
spring:
  config:
    import:
      - 'optional:configtree:./run/'
```

### `Makefile` 주요 변경

```makefile
# ─── 제거 ──────────────────────────────────────────────────────────
# LOCAL := docker compose -f docker-compose.local.yml --env-file local.env

# ─── 환경 설정 ─────────────────────────────────────────────────────
.PHONY: setup-local
setup-local:
	@bash scripts/setup-local.sh

# ─── 로컬 인프라 ────────────────────────────────────────────────────
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

# ─── 전체 로컬 컨테이너 환경 ───────────────────────────────────────
.PHONY: dev-up
dev-up: build-local
	# make infra가 먼저 실행되어 terab-infra_terab-net 네트워크가 존재해야 함
	docker stack deploy -c docker-stack.yml -c docker-stack.local.yml terab

.PHONY: dev-down
dev-down:
	docker stack rm terab

# ─── 로컬 이미지 빌드 ──────────────────────────────────────────────
.PHONY: build-local
build-local:
	docker build -t terab-api:local ./services/api
	docker build -t terab-notification:local ./services/notification
	docker build -t terab-web:local ./services/web
```

### `docker-stack.yml` config/secret 이름 변경

```yaml
# 변경 전 → 변경 후
source: db_url        → source: DB_URL
source: db_name       → source: DB_NAME
source: db_user       → source: DB_USER
source: minio_endpoint → source: MINIO_ENDPOINT
source: minio_root_user → source: MINIO_ROOT_USER
source: minio_bucket  → source: MINIO_BUCKET
source: owner_username → source: OWNER_USERNAME
source: owner_nickname → source: OWNER_NICKNAME
source: jwt_access_expiry_ms → source: JWT_ACCESS_EXPIRY_MS
source: jwt_refresh_expiry_ms → source: JWT_REFRESH_EXPIRY_MS

secrets:
  terab_db_password   → DB_PASSWORD
  terab_minio_password → MINIO_PASSWORD
  terab_jwt_secret    → JWT_SECRET
  terab_owner_password → OWNER_PASSWORD
```

### `.gitignore` 변경

```gitignore
# 제거
configs.env
services/api/application-local.properties

# 추가
services/api/run/
services/notification/run/

# 유지
secrets.env
```

---

## 개발자 초기 설정 (신규 클론 후)

```bash
# 1. 시크릿 파일 생성
cp secrets.env.example secrets.env
# (필요 시 운영 값으로 교체)

# 2. docker config/secret 등록
make setup

# 3. configtree 파일 생성 (bootRun용)
make setup-local

# 4. 인프라 기동
make infra

# 5. 개발 서버 실행
make api
make notification
```

---

## 워크플로우 비교

| 상황 | 명령어 |
|------|--------|
| 초기 설정 | `cp secrets.env.example secrets.env` → `make setup` → `make setup-local` |
| configs.env 변경 | `make setup` → `make setup-local` |
| secrets.env 변경 | `make setup` → `make setup-local` |
| 인프라만 기동 (bootRun 개발) | `make infra` + `make api` / `make notification` |
| 전체 컨테이너 환경 | `make dev-up` |
| 운영 배포 | `make setup` (NAS에서) → `make stack-deploy` |

# Environment Variable Management Design

**Date:** 2026-04-11
**Branch:** feat/user-login
**Scope:** 로컬/운영 환경변수 단일 소스 관리 — `.env` 이중 관리 제거 및 Docker Config/Secret 기반 통합

---

## 목표

- 환경별 설정을 단일 소스 파일로 관리
- 로컬: `local.env` → `make setup-local` → `services/api/application-local.properties`
- 운영: `configs.env` + `secrets.env` → `make setup` → Docker Config/Secret
- `application.properties` (Docker Config `api_properties`) 제거 → 개별 configtree 주입으로 대체
- symlink 제거 (Windows 권한 문제 해결)
- 모든 YML/Compose 파일의 하드코딩 값을 외부 주입으로 전환

---

## 최종 파일 구조

```
terab/
├── local.env                      ← 로컬 개발 단일 소스 (git 커밋, 비민감)
├── configs.env                    ← 운영 비민감 Docker Config 등록용 (gitignore)
├── configs.env.example            ← 키 목록 템플릿 (git 커밋)
├── secrets.env                    ← 운영 민감 Docker Secret 등록용 (gitignore)
├── secrets.env.example            ← 키 목록 템플릿 (git 커밋)
│
├── docker-stack.yml               ← 수정: api_properties 제거, 개별 configs 추가
├── docker-compose.local.yml       ← 수정: ${VAR} 치환 방식으로 변경
│
└── services/api/
    ├── src/main/resources/
    │   ├── application.yml        ← 수정: configtree 확장 + 모든 property 참조
    │   └── application-local.yml  ← 변경 없음
    └── application-local.properties  ← gitignore (make setup-local 생성 파일)
```

**제거 파일:**

- `terab/application-local.properties` (root) — `local.env`로 대체
- `terab/application.properties` — `configs.env` + `secrets.env`로 대체
- `services/api/application-local.properties` symlink → 생성 파일로 전환

---

## 파일별 내용 및 역할

### `local.env` (git 커밋, 로컬 개발 단일 소스)

소문자 키 = configtree 프로퍼티명 (Spring Boot용, `make setup-local`로 추출)
대문자 키 = Docker Compose 전용 변수

```bash
# ─── Spring Boot configtree 키 (소문자) → application-local.properties 생성 ─────
db_url=jdbc:postgresql://localhost:5432/terab_db
db_user=terab_user
terab_db_password=terab1234
minio_endpoint=http://localhost:9000
minio_root_user=minioadmin
terab_minio_password=minioadmin
minio_bucket=terab-files
terab_jwt_secret=dev-secret-key-that-is-at-least-256-bits-long-for-hs256-algorithm
jwt_access_expiry_ms=900000
jwt_refresh_expiry_ms=604800000
owner_username=owner
owner_nickname=Owner
terab_owner_password=owner1234

# ─── Docker Compose 전용 (대문자) → ${VAR} 치환 ─────────────────────────────────
POSTGRES_DB=terab_db
POSTGRES_USER=terab_user
POSTGRES_PASSWORD=terab1234
MINIO_ROOT_PASSWORD=minioadmin
SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/terab_db
```

> 참고: `db_url`은 Gradle 직접 실행 기준 `localhost:5432`.
> Docker Compose 실행 시 `SPRING_DATASOURCE_URL` env var가 `spring.datasource.url`을 override.

---

### `configs.env` (NAS에만 존재, gitignore)

모든 값은 평문 완성형 (변수 참조 없음). `docker config create`로 등록.
키명은 소문자 — `local.env` 소문자 섹션 및 `application.yml` property 참조와 일치.

```bash
db_url=jdbc:postgresql://db:5432/terab_db
db_name=terab_db
db_user=terab_user
minio_endpoint=http://minio:9000
minio_root_user=minioadmin
minio_bucket=terab-files
owner_username=owner
owner_nickname=Owner
jwt_access_expiry_ms=900000
jwt_refresh_expiry_ms=604800000
```

> 키명은 Docker Config 이름이 됨: `db_url` → `docker config create db_url`
> `/run/configs/db_url` → configtree → Spring Boot property `db_url`

---

### `secrets.env` (NAS에만 존재, gitignore)

민감값만. `docker secret create`로 등록.

```bash
TERAB_DB_PASSWORD=
TERAB_MINIO_PASSWORD=
TERAB_JWT_SECRET=
TERAB_OWNER_PASSWORD=
```

---

### `configs.env.example` / `secrets.env.example` (git 커밋)

키 목록만 포함, 값은 빈칸.

```bash
# configs.env.example
DB_URL=
DB_NAME=
DB_USER=
MINIO_ENDPOINT=
MINIO_ROOT_USER=
MINIO_BUCKET=
OWNER_USERNAME=
OWNER_NICKNAME=
JWT_ACCESS_EXPIRY_MS=
JWT_REFRESH_EXPIRY_MS=
```

---

## Makefile 타겟

### `make setup-local` (로컬 개발 초기 설정)

`local.env`의 소문자 키만 추출 → `services/api/application-local.properties` 생성

```makefile
setup-local:
    grep -E '^[a-z]' local.env > services/api/application-local.properties
```

실행 시점: 최초 클론 후 1회, 또는 `local.env` 값 변경 후

---

### `make setup` (운영 NAS에서 실행)

`configs.env` → Docker Config 등록, `secrets.env` → Docker Secret 등록

```makefile
setup:
    @echo "Registering Docker Configs..."
    @while IFS='=' read -r key val; do \
      [ -z "$$key" ] && continue; \
      printf '%s' "$$key" | grep -q '^#' && continue; \
      docker config rm $$key 2>/dev/null || true; \
      printf '%s' "$$val" | docker config create $$key -; \
    done < configs.env

    @echo "Registering Docker Secrets..."
    @while IFS='=' read -r key val; do \
      [ -z "$$key" ] && continue; \
      printf '%s' "$$key" | grep -q '^#' && continue; \
      docker secret rm $$key 2>/dev/null || true; \
      printf '%s' "$$val" | docker secret create $$key -; \
    done < secrets.env
```

---

## `application.yml` 변경

configtree import 확장 + 모든 Spring Boot property를 외부 주입으로 전환.
로컬에서는 `application-local.properties`(생성 파일)가 동일한 키로 값을 제공.

```yaml
spring:
  config:
    import:
      - 'optional:configtree:/run/secrets/'
      - 'optional:configtree:/run/configs/'
  datasource:
    driver-class-name: org.postgresql.Driver
    url: ${db_url:}
    username: ${db_user:}
    password: ${terab_db_password:}
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
    open-in-view: true
  flyway:
    enabled: true
    locations: classpath:db/migration
    connect-retries: 10
    connect-retries-interval: 3s
  servlet:
    multipart:
      max-file-size: 10GB
      max-request-size: 10GB

server:
  port: 8080

minio:
  endpoint: ${minio_endpoint:}
  access-key: ${minio_root_user:}
  secret-key: ${terab_minio_password:}
  bucket: ${minio_bucket:}

jwt:
  secret: ${terab_jwt_secret:}
  access-token-expiration-ms: ${jwt_access_expiry_ms:900000}
  refresh-token-expiration-ms: ${jwt_refresh_expiry_ms:604800000}

app:
  owner:
    username: ${owner_username:owner}
    nickname: ${owner_nickname:Owner}
    password: ${terab_owner_password:}
```

> 모든 property 키는 소문자 — configtree 파일명(`/run/configs/db_url`)과 동일.
> `:` 뒤 기본값은 테스트 컨텍스트에서 placeholder 미해소 오류 방지용.
> 로컬에서는 `application-local.properties`의 소문자 키가 값을 제공.

---

## `docker-stack.yml` 변경

### `api` 서비스: `api_properties` 제거 → 개별 configs/secrets 주입

```yaml
api:
  image: ghcr.io/idenn207/terab-api:latest
  configs:
    - source: db_url
      target: /run/configs/db_url
    - source: db_user
      target: /run/configs/db_user
    - source: minio_endpoint
      target: /run/configs/minio_endpoint
    - source: minio_root_user
      target: /run/configs/minio_root_user
    - source: minio_bucket
      target: /run/configs/minio_bucket
    - source: owner_username
      target: /run/configs/owner_username
    - source: owner_nickname
      target: /run/configs/owner_nickname
    - source: jwt_access_expiry_ms
      target: /run/configs/jwt_access_expiry_ms
    - source: jwt_refresh_expiry_ms
      target: /run/configs/jwt_refresh_expiry_ms
  secrets:
    - terab_db_password
    - terab_minio_password
    - terab_jwt_secret
    - terab_owner_password
```

### `db` 서비스: 버그 수정 (빈 target 제거) + db_name/db_user config 사용

```yaml
db:
  environment:
    POSTGRES_DB_FILE: /run/configs/db_name
    POSTGRES_USER_FILE: /run/configs/db_user
    POSTGRES_PASSWORD_FILE: /run/secrets/terab_db_password
  configs:
    - source: db_name
      target: /run/configs/db_name
    - source: db_user
      target: /run/configs/db_user
  secrets:
    - terab_db_password
```

### `minio` 서비스: minio_root_user config 유지

```yaml
minio:
  environment:
    MINIO_ROOT_USER_FILE: /run/configs/minio_root_user
    MINIO_ROOT_PASSWORD_FILE: /run/secrets/terab_minio_password
  configs:
    - source: minio_root_user
      target: /run/configs/minio_root_user
  secrets:
    - terab_minio_password
```

### 최상단 `configs:` / `secrets:` 블록

```yaml
configs:
  db_url:
    external: true
  db_name:
    external: true
  db_user:
    external: true
  minio_endpoint:
    external: true
  minio_root_user:
    external: true
  minio_bucket:
    external: true
  owner_username:
    external: true
  owner_nickname:
    external: true
  jwt_access_expiry_ms:
    external: true
  jwt_refresh_expiry_ms:
    external: true

secrets:
  terab_db_password:
    external: true
  terab_minio_password:
    external: true
  terab_jwt_secret:
    external: true
  terab_owner_password:
    external: true
```

---

## `docker-compose.local.yml` 변경

`${VAR}` 치환 방식으로 변경. Docker Compose가 `local.env`를 `--env-file`로 참조.

```yaml
# docker-compose.local.yml 실행 시:
# docker compose -f docker-compose.local.yml --env-file local.env up

db:
  environment:
    POSTGRES_DB: ${POSTGRES_DB}
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

minio:
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER}        # local.env 대문자 섹션
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}

api:
  volumes:
    - ./services/api/application-local.properties:/app/application.properties:ro
  environment:
    SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL}
```

> `api` 서비스는 생성된 `application-local.properties`를 마운트.
> `SPRING_DATASOURCE_URL`이 `db:5432`로 override (Gradle 직접 실행 시 `localhost:5432`와 구분).

---

## `docker-compose.local.yml` Makefile 타겟 반영

```makefile
infra:
    docker compose -f docker-compose.local.yml --env-file local.env up -d db minio

dev-up:
    docker compose -f docker-compose.local.yml --env-file local.env up -d
```

---

## `.gitignore` 변경

```diff
- application.properties
- application-local.properties
+ configs.env
+ secrets.env
+ services/api/application-local.properties
```

---

## 변경 없는 파일

| 파일 | 이유 |
| ---- | ---- |
| `application-local.yml` | 개발 편의 설정만 (show-sql, 로깅) |
| `application-test.yml` | 테스트 픽스처, 독립 실행 필요, 의도적 하드코딩 |
| `application-integration.yml` | Testcontainers `@DynamicPropertySource`로 동적 주입 |
| `docker-compose.runner.yml` | `ACCESS_TOKEN` 단독 관리, 변경 불필요 |

---

## 환경별 동작 흐름

### 1. 로컬 Gradle 직접 실행 (`make api`)

```
local.env (소문자 섹션)
  → make setup-local
  → services/api/application-local.properties
  → Spring Boot --spring.profiles.active=local
  → application-local.properties 로드 (db_url=localhost:5432/...)
```

### 2. 로컬 Docker Compose (`make infra` / `make dev-up`)

```
local.env (대문자 섹션)
  → docker compose --env-file local.env
  → db/minio: ${POSTGRES_DB}, ${POSTGRES_USER}, ... 치환
  → api: application-local.properties 볼륨 마운트
       + SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/... (override)
```

### 3. 운영 Docker Swarm (`make setup` + `make stack-deploy`)

```
configs.env → make setup → docker config create (10개)
secrets.env → make setup → docker secret create (4개)

docker stack deploy
  → api: /run/configs/* + /run/secrets/* 마운트
  → configtree:/run/configs/ → Spring Boot property (DB_URL, DB_USER, ...)
  → configtree:/run/secrets/ → Spring Boot property (TERAB_DB_PASSWORD, ...)
  → db: POSTGRES_DB_FILE, POSTGRES_USER_FILE, POSTGRES_PASSWORD_FILE
  → minio: MINIO_ROOT_USER_FILE, MINIO_ROOT_PASSWORD_FILE
```

---

## 개발자 온보딩 절차

```bash
git clone https://github.com/idenn207/terab
cd terab

# 로컬 Spring Boot 설정 생성 (최초 1회, local.env 변경 시 재실행)
make setup-local

# 인프라 실행
make infra

# API 실행
make api
```

---

## 변경 파일 목록

| 파일 | 변경 내용 |
| ---- | --------- |
| `local.env` | 신규 — 로컬 단일 소스 (git 커밋) |
| `configs.env` | 신규 — 운영 비민감 config 등록용 (gitignore) |
| `configs.env.example` | 신규 — 키 목록 템플릿 (git 커밋) |
| `secrets.env` | 신규 — 운영 민감 secret 등록용 (gitignore) |
| `secrets.env.example` | 신규 — 키 목록 템플릿 (git 커밋) |
| `services/api/src/main/resources/application.yml` | configtree 확장 + 모든 property 참조 추가 |
| `docker-stack.yml` | api_properties 제거, 개별 configs/secrets, db 버그 수정 |
| `docker-compose.local.yml` | ${VAR} 치환, --env-file local.env |
| `Makefile` | setup-local 타겟 추가, infra/dev-up에 --env-file 추가 |
| `.gitignore` | configs.env, secrets.env, services/api/application-local.properties 추가 |
| `application.properties` | 삭제 (configs.env + secrets.env로 대체) |
| `terab/application-local.properties` | 삭제 (local.env로 대체) |

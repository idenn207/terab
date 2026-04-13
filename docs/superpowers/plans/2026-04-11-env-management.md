# Environment Variable Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 환경변수를 `local.env` (로컬) / `configs.env`+`secrets.env` (운영) 단일 소스로 통합하고, 모든 YML/Compose 파일의 하드코딩 값을 제거한다.

**Architecture:** 로컬은 `local.env` → `make setup-local` → `services/api/application-local.properties` 생성. 운영은 `configs.env`+`secrets.env` → `make setup` → Docker Config/Secret 등록. Spring Boot `application.yml`은 configtree(`/run/configs/`, `/run/secrets/`)를 통해 모든 값을 주입받는다.

**Tech Stack:** Docker Swarm, Spring Boot configtree, Docker Config/Secret, GNU Make, bash

---

### Task 1: `local.env` 및 example 파일 생성

**Files:**

- Create: `local.env`
- Create: `configs.env.example`
- Create: `secrets.env.example`

- [x] **Step 1: `local.env` 생성**

```bash
# local.env
# ─── Spring Boot (소문자 키) → make setup-local → application-local.properties ──
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

# ─── Docker Compose 전용 (대문자 키) → ${VAR} 치환 ────────────────────────────
POSTGRES_DB=terab_db
POSTGRES_USER=terab_user
POSTGRES_PASSWORD=terab1234
MINIO_ROOT_PASSWORD=minioadmin
SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/terab_db
```

- [x] **Step 2: `configs.env.example` 생성**

```bash
# configs.env.example — 운영 Docker Config 키 목록 (NAS에서 configs.env로 복사 후 값 채움)
db_url=
db_name=
db_user=
minio_endpoint=
minio_root_user=
minio_bucket=
owner_username=
owner_nickname=
jwt_access_expiry_ms=
jwt_refresh_expiry_ms=
```

- [x] **Step 3: `secrets.env.example` 생성**

```bash
# secrets.env.example — 운영 Docker Secret 키 목록 (NAS에서 secrets.env로 복사 후 값 채움)
terab_db_password=
terab_minio_password=
terab_jwt_secret=
terab_owner_password=
```

- [x] **Step 4: 커밋**

```bash
git add local.env configs.env.example secrets.env.example
git commit -m "chore: add local.env and example files for unified env management"
```

---

### Task 2: `.gitignore` 업데이트

**Files:**

- Modify: `.gitignore`

- [x] **Step 1: `.gitignore` 수정**

현재:

```
application.properties
application-local.properties
```

변경 후:

```
# 환경 설정 (절대 커밋 금지)
.claude/*.local.*
configs.env
secrets.env
services/api/application-local.properties
application-runner.properties
```

> `application.properties`, `application-local.properties` (root) 항목 제거.
> `configs.env`, `secrets.env`, `services/api/application-local.properties` 추가.

- [x] **Step 2: 커밋**

```bash
git add .gitignore
git commit -m "chore: update gitignore for new env management structure"
```

---

### Task 3: `Makefile` 업데이트

**Files:**

- Modify: `Makefile`

- [x] **Step 1: `LOCAL` 변수에 `--env-file local.env` 추가, `setup-local` / `setup` 타겟 추가**

`Makefile` 상단 `LOCAL` 변수 수정:

```makefile
LOCAL := docker compose -f docker-compose.local.yml --env-file local.env
```

`infra` 타겟 위에 두 타겟 추가:

```makefile
# ─── 환경 설정 ────────────────────────────────────────────────────
.PHONY: setup-local
setup-local: ## 로컬 개발 초기 설정 (최초 클론 후 1회, local.env 변경 시 재실행)
	grep -E '^[a-z]' local.env > services/api/application-local.properties

.PHONY: setup
setup: ## 운영 Docker Config/Secret 등록 (NAS에서 실행, configs.env + secrets.env 필요)
	@echo "=== Registering Docker Configs ==="
	@while IFS='=' read -r key val; do \
	  [ -z "$$key" ] && continue; \
	  echo "$$key" | grep -q '^#' && continue; \
	  docker config rm $$key 2>/dev/null || true; \
	  printf '%s' "$$val" | docker config create $$key -; \
	done < configs.env
	@echo "=== Registering Docker Secrets ==="
	@while IFS='=' read -r key val; do \
	  [ -z "$$key" ] && continue; \
	  echo "$$key" | grep -q '^#' && continue; \
	  docker secret rm $$key 2>/dev/null || true; \
	  printf '%s' "$$val" | docker secret create $$key -; \
	done < secrets.env
```

- [x] **Step 2: `make setup-local` 실행 확인**

```bash
make setup-local
cat services/api/application-local.properties
```

예상 출력:

```
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
```

> 대문자 `POSTGRES_*`, `MINIO_ROOT_PASSWORD`, `SPRING_DATASOURCE_URL`은 포함되면 안 됨.

- [x] **Step 3: 커밋**

```bash
git add Makefile
git commit -m "chore: add setup-local/setup targets and update LOCAL env-file"
```

---

### Task 4: `application.yml` 업데이트

**Files:**

- Modify: `services/api/src/main/resources/application.yml`

- [x] **Step 1: `application.yml` 전체 교체**

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
      maximum-pool-size: 5 # 인스턴스당 최대 5개 (3 replicas × 5 = 15 total, PostgreSQL 100 한도 대비 여유)
      minimum-idle: 2 # 최소 유휴 연결 2개 (메모리 절약)
      connection-timeout: 30000 # 연결 획득 대기 최대 30초
      keepalive-time: 60000 # 60초마다 연결 유효성 확인 (좀비 연결 방지)
      initialization-fail-timeout: -1 # 시작 시 DB 없어도 앱 종료 안 함
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    open-in-view: true
  flyway:
    enabled: true
    locations: classpath:db/migration
    connect-retries: 10 # 10회 재시도
    connect-retries-interval: 3s # 3초 간격 → 최대 30초 대기
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

- [x] **Step 2: 단위 테스트 실행 (application.yml 변경이 테스트를 깨지 않는지 확인)**

```bash
cd services/api && ./gradlew test
```

예상: BUILD SUCCESSFUL, `@WebMvcTest` 슬라이스 테스트 전부 PASS.

- [x] **Step 3: Spring Boot 로컬 기동 확인**

```bash
make api
```

예상: `Started TerabApiApplication` 로그 출력, `http://localhost:8080/actuator/health` 응답 `{"status":"UP"}`.

- [x] **Step 4: 커밋**

```bash
git add services/api/src/main/resources/application.yml
git commit -m "feat: externalize all Spring Boot properties via configtree"
```

---

### Task 5: `docker-compose.local.yml` 업데이트

**Files:**

- Modify: `docker-compose.local.yml`

- [x] **Step 1: `db` 서비스 environment를 `${VAR}` 치환으로 변경**

`POSTGRES_DB: terab_db` → `POSTGRES_DB: ${POSTGRES_DB}`
`POSTGRES_USER: terab_user` → `POSTGRES_USER: ${POSTGRES_USER}`
`POSTGRES_PASSWORD: terab1234` → `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}`

- [x] **Step 2: `minio` 서비스 environment를 `${VAR}` 치환으로 변경**

`MINIO_ROOT_USER: minioadmin` → `MINIO_ROOT_USER: ${MINIO_ROOT_USER}`
`MINIO_ROOT_PASSWORD: minioadmin` → `MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}`

- [x] **Step 3: `api` 서비스 volumes 경로 수정 + environment 변경**

volumes:

```yaml
- ./services/api/application-local.properties:/app/application.properties:ro
```

environment:

```yaml
SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL}
```

- [x] **Step 4: Docker Compose 기동 확인**

```bash
make infra
docker ps
```

예상: `terab-db`, `terab-storage` 컨테이너 STATUS `Up` 및 `(healthy)`.

- [x] **Step 5: 커밋**

```bash
git add docker-compose.local.yml
git commit -m "chore: replace hardcoded values with \${VAR} substitution in local compose"
```

---

### Task 6: `docker-stack.yml` 업데이트

**Files:**

- Modify: `docker-stack.yml`

- [x] **Step 1: `db` 서비스 — `api_properties` config 제거, `db_name`/`db_user` config 추가**

`db` 서비스 `configs:` 블록을 아래로 교체:

```yaml
configs:
  - source: db_name
    target: /run/configs/db_name
  - source: db_user
    target: /run/configs/db_user
```

- [x] **Step 2: `api` 서비스 — `api_properties` config 제거, 개별 configs/secrets 주입**

`api` 서비스의 `configs:` 블록 전체 교체:

```yaml
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

- [x] **Step 3: 최상단 `configs:` 블록 전체 교체**

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
```

- [x] **Step 4: 최상단 `secrets:` 블록 키명 소문자 확인**

```yaml
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

- [x] **Step 5: `docker-stack.yml` YAML 유효성 확인**

```bash
docker compose -f docker-stack.yml config --quiet 2>&1 | head -20
```

예상: 에러 없음 (또는 external config 관련 경고만).

- [x] **Step 6: 커밋**

```bash
git add docker-stack.yml
git commit -m "chore: replace api_properties with individual configtree configs in docker-stack"
```

---

### Task 7: 구 파일 정리

**Files:**

- Delete: `application.properties` (root)
- Delete: `application-local.properties` (root)

- [x] **Step 1: root `application.properties` 삭제**

```bash
rm application.properties
```

- [x] **Step 2: root `application-local.properties` 삭제**

```bash
rm application-local.properties
```

- [x] **Step 3: `services/api/application-local.properties` 구 symlink/파일 확인 후 재생성**

현재 `services/api/application-local.properties`가 구 파일(symlink 또는 독립 파일)이므로 삭제 후 `make setup-local`로 재생성:

```bash
rm services/api/application-local.properties
make setup-local
cat services/api/application-local.properties
```

예상: Task 3 Step 2와 동일한 소문자 키-값 쌍.

- [x] **Step 4: 전체 테스트 통과 확인**

```bash
cd services/api && ./gradlew check
```

예상: BUILD SUCCESSFUL.

- [x] **Step 5: 로컬 기동 최종 확인**

```bash
make infra   # DB + MinIO 기동
make api     # Spring Boot 기동
```

예상: `actuator/health` → `{"status":"UP"}`.

- [x] **Step 6: 커밋**

```bash
git add -A
git commit -m "chore: remove legacy application.properties and application-local.properties"
```

---

### Task 8: 통합 테스트 확인 및 최종 커밋

**Files:** 없음 (검증만)

- [x] **Step 1: 통합 테스트 실행**

```bash
cd services/api && ./gradlew integrationTest
```

예상: BUILD SUCCESSFUL (Testcontainers `@DynamicPropertySource`가 datasource를 override하므로 `${db_url:}` 빈 기본값 무관).

- [x] **Step 2: `application.properties.example` 파일 내용 최신화**

`application.properties.example`가 존재한다면 `configs.env.example` + `secrets.env.example`로 대체되었음을 주석으로 표시:

```bash
# application.properties.example は configs.env.example + secrets.env.example 로 대체됨
# 운영 배포: make setup (NAS에서 configs.env + secrets.env 준비 후 실행)
```

- [x] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "chore: complete env management unification - local.env + configtree pattern"
```


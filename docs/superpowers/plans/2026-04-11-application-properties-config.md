# Application Properties Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `.env` + `docker-stack.yml` environment 블록으로 이중 관리하던 API 설정을 Spring Boot external config 파일 방식으로 통합한다.

**Architecture:** 로컬은 프로젝트 root의 `application-local.properties`를 symlink로 API 모듈에 연결하여 IDE와 Docker Compose가 공유한다. 운영은 `application.properties`를 Docker Config로 등록·마운트하고 민감 값은 Docker Secrets configtree로 주입한다.

**Tech Stack:** Spring Boot 3.x (external config / configtree), Docker Swarm (Config + Secrets), Docker Compose v2, Git symlinks (Windows Developer Mode)

---

## File Map

| 상태 | 경로 | 역할 |
|---|---|---|
| **삭제** | `services/api/src/main/resources/application.properties` | 빈 파일, 혼선 방지용 제거 |
| **삭제** | `services/api/src/main/resources/application-local.yml` | application-local.properties로 통합 |
| **수정** | `services/api/src/main/resources/application.yml` | 구조만, 환경 값 전부 제거 + configtree import |
| **신규** | `application-local.properties` (root) | 로컬 더미 값, symlink 원본, git 커밋 |
| **신규** | `services/api/application-local.properties` | symlink → `../../application-local.properties` |
| **신규** | `application.properties` (root, gitignore) | 운영 Docker Config 파일 |
| **신규** | `application-runner.properties` (root, gitignore) | runner.env 대체 |
| **수정** | `.gitignore` | runner.env 제거, 신규 항목 추가 |
| **수정** | `Makefile` | api 타겟에서 `source .env.local` 제거 |
| **수정** | `docker-compose.local.yml` | api service: env 제거, volume mount 추가 |
| **수정** | `services/api/docker-entrypoint.sh` | 시크릿 읽기 로직 제거, wait-for-it만 |
| **수정** | `docker-stack.yml` | api: environment 제거, configs + terab_owner_password 추가 |
| **수정** | `docker-compose.runner.yml` | env_file: runner.env → application-runner.properties |

---

## Task 1: Git symlink 활성화 + .gitignore 업데이트

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: git symlink 활성화**

```bash
cd c:/_project/my/terab
git config core.symlinks true
```

Expected: no output (success)

- [ ] **Step 2: .gitignore 업데이트**

`.gitignore` 내용 변경:

```diff
 # 환경변수 (절대 커밋 금지)
 .env
 .env.local
 .claude/*.local.*
-runner.env
+application.properties
+application-runner.properties
```

결과:
```
# 환경변수 (절대 커밋 금지)
.env
.env.local
.claude/*.local.*
application.properties
application-runner.properties
```

- [ ] **Step 3: 커밋**

```bash
git add .gitignore
git commit -m "chore: gitignore runner.env → application-runner.properties, application.properties 추가"
```

---

## Task 2: application-local.properties 생성 (root)

**Files:**
- Create: `application-local.properties` (project root)
- Delete: `services/api/src/main/resources/application-local.yml`
- Delete: `services/api/src/main/resources/application.properties`

- [ ] **Step 1: application-local.properties 생성**

프로젝트 root(`c:/_project/my/terab/`)에 파일 생성:

```properties
# ─── Local dev defaults ─────────────────────────────────────────────
# IDE/Gradle 직접 실행 시 사용 (make api)
# Docker Compose 실행 시 SPRING_DATASOURCE_URL env var가 DB hostname을 override

# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/terab_db
spring.datasource.username=terab_user
spring.datasource.password=terab1234

# MinIO
minio.endpoint=http://localhost:9000
minio.access-key=minioadmin
minio.secret-key=minioadmin
minio.bucket=terab-files

# JWT
jwt.secret=dev-secret-key-that-is-at-least-256-bits-long-for-hs256-algorithm
jwt.access-token-expiration-ms=900000
jwt.refresh-token-expiration-ms=604800000

# Owner
app.owner.username=owner
app.owner.nickname=Owner
app.owner.password=owner1234

# Dev convenience
spring.jpa.show-sql=true
logging.level.root=WARN
logging.level.com.terab=WARN
```

- [ ] **Step 2: application-local.yml 삭제**

`services/api/src/main/resources/application-local.yml` 파일 삭제.
내용은 이미 위 properties 파일에 통합됨.
파일이 unstaged 수정 상태이므로 `-f` 플래그 필요:

```bash
git rm -f services/api/src/main/resources/application-local.yml
```

- [ ] **Step 3: 빈 application.properties (classpath) 삭제**

`services/api/src/main/resources/application.properties`는 untracked 빈 파일. 삭제:

```bash
rm services/api/src/main/resources/application.properties
```

- [ ] **Step 4: 커밋**

```bash
git add application-local.properties
git commit -m "chore: application-local.properties 생성, application-local.yml 통합 삭제"
```

---

## Task 3: Symlink 생성

**Files:**
- Create: `services/api/application-local.properties` (symlink)

- [ ] **Step 1: symlink 생성**

```bash
cd c:/_project/my/terab
ln -s ../../application-local.properties services/api/application-local.properties
```

- [ ] **Step 2: symlink 확인**

```bash
ls -la services/api/application-local.properties
```

Expected:
```
services/api/application-local.properties -> ../../application-local.properties
```

- [ ] **Step 3: symlink를 git에 추가 및 커밋**

```bash
git add services/api/application-local.properties
git commit -m "chore: services/api/application-local.properties symlink 추가"
```

Expected: symlink가 파일로 tracked됨 (내용: `../../application-local.properties`)

---

## Task 4: application.yml 업데이트

**Files:**
- Modify: `services/api/src/main/resources/application.yml`

- [ ] **Step 1: application.yml 전체 교체**

`services/api/src/main/resources/application.yml`을 아래 내용으로 교체:

```yaml
spring:
  config:
    import: "optional:configtree:/run/secrets/"
  datasource:
    driver-class-name: org.postgresql.Driver
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
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
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
```

변경 요약:
- `spring.config.import` 추가 (configtree)
- `datasource.url`, `datasource.username`, `datasource.password` 제거
- `minio:` 섹션 전체 제거
- `jwt:` 섹션 전체 제거
- `app.owner:` 섹션 전체 제거

- [ ] **Step 2: 커밋**

```bash
git add services/api/src/main/resources/application.yml
git commit -m "feat: application.yml에서 환경 값 제거, configtree import 추가"
```

---

## Task 5: 테스트 실행으로 기존 기능 검증

**Files:** (없음, 검증만)

`application.yml` 변경 후 기존 테스트가 모두 통과하는지 확인.
`application-test.yml`, `application-integration.yml`이 독립적으로 필요한 값을 제공하므로 통과해야 함.

- [ ] **Step 1: 단위 테스트 + WebMvcTest 실행**

```bash
cd services/api && ./gradlew test
```

Expected: BUILD SUCCESSFUL, JwtProviderTest 포함 전체 PASS

실패 시: 실패한 테스트의 에러 메시지를 확인. 누락된 프로퍼티가 있다면 해당 test yml에 추가.

- [ ] **Step 2: 통합 테스트 실행**

```bash
./gradlew integrationTest
```

Expected: BUILD SUCCESSFUL (Testcontainers가 DB/MinIO를 동적 주입)

- [ ] **Step 3: 모든 테스트 통과 확인 후 다음 Task 진행**

---

## Task 6: Makefile 업데이트

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: api 타겟에서 .env.local source 제거**

`Makefile`의 `api` 타겟 변경:

```makefile
# 변경 전
api:
	set -a && source .env.local && set +a && cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local'

# 변경 후
api:
	cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local'
```

- [ ] **Step 2: 커밋**

```bash
git add Makefile
git commit -m "chore: Makefile api 타겟 .env.local source 제거"
```

---

## Task 7: docker-compose.local.yml api 서비스 업데이트

**Files:**
- Modify: `docker-compose.local.yml`

- [ ] **Step 1: api 서비스 블록 교체**

`docker-compose.local.yml`의 api 서비스를 아래로 교체 (다른 서비스는 유지):

```yaml
  # ─── Spring Boot API ─────────────────────────────────────────────
  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile
    container_name: terab-api
    restart: on-failure
    volumes:
      - ./application-local.properties:/app/application.properties:ro
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/terab_db
    depends_on:
      db:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/actuator/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - terab-net
```

변경 요약:
- `volumes` 추가: `application-local.properties`를 컨테이너 `/app/application.properties`로 마운트 (read-only)
- `environment` 단순화: `SPRING_DATASOURCE_URL`만 유지 (Docker 네트워크 hostname `db` 사용)
- 기존 `DB_URL`, `DB_USER`, `DB_PASSWORD`, `MINIO_*`, `JWT_*` env var 전부 제거

- [ ] **Step 2: 커밋**

```bash
git add docker-compose.local.yml
git commit -m "chore: docker-compose.local.yml api 서비스 env 제거, properties 마운트로 전환"
```

---

## Task 8: docker-entrypoint.sh 간소화

**Files:**
- Modify: `services/api/docker-entrypoint.sh`

- [ ] **Step 1: 시크릿 읽기 로직 제거, wait-for-it만 유지**

`services/api/docker-entrypoint.sh` 전체 교체:

```bash
#!/bin/sh
# Spring Boot configtree가 /run/secrets/ 에서 시크릿을 직접 읽으므로
# 이 스크립트는 DB 준비 대기만 담당한다.
set -e

exec wait-for-it.sh db:5432 --timeout=60 -- java -jar app.jar
```

- [ ] **Step 2: 커밋**

```bash
git add services/api/docker-entrypoint.sh
git commit -m "chore: docker-entrypoint.sh 시크릿 읽기 로직 제거 (configtree로 대체)"
```

---

## Task 9: docker-stack.yml 업데이트

**Files:**
- Modify: `docker-stack.yml`

- [ ] **Step 1: api 서비스 블록 교체**

`docker-stack.yml`의 api 서비스를 아래로 교체:

```yaml
  # ─── Spring Boot API ──────────────────────────────────────────────
  api:
    image: ghcr.io/idenn207/terab-api:latest
    configs:
      - source: api_properties
        target: /app/application.properties
    secrets:
      - terab_db_password
      - terab_minio_password
      - terab_jwt_secret
      - terab_owner_password
    networks:
      - terab-net
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO /dev/null http://localhost:8080/actuator/health || exit 1']
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 120s
    deploy:
      replicas: 3
      update_config:
        order: stop-first
        parallelism: 1
        failure_action: rollback
        delay: 10s
        monitor: 120s
      rollback_config:
        order: stop-first
        parallelism: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

- [ ] **Step 2: configs 최상위 섹션 추가**

파일 하단 `volumes:` 앞에 추가:

```yaml
configs:
  api_properties:
    external: true
```

- [ ] **Step 3: secrets 섹션에 terab_owner_password 추가**

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

- [ ] **Step 4: 커밋**

```bash
git add docker-stack.yml
git commit -m "feat: docker-stack.yml api environment 제거, Docker Config + terab_owner_password 시크릿 추가"
```

---

## Task 10: docker-compose.runner.yml 업데이트

**Files:**
- Modify: `docker-compose.runner.yml`

- [ ] **Step 1: env_file 참조 변경**

`docker-compose.runner.yml`의 `env_file` 블록 변경:

```yaml
# 변경 전
    env_file:
      - runner.env

# 변경 후
    env_file:
      - application-runner.properties
```

- [ ] **Step 2: 커밋**

```bash
git add docker-compose.runner.yml
git commit -m "chore: docker-compose.runner.yml env_file runner.env → application-runner.properties"
```

---

## Task 11: runner.env → application-runner.properties 이름 변경

**Files:**
- Rename: `runner.env` → `application-runner.properties` (NAS에서 수행)

이 파일은 gitignore 대상이므로 git에서 이름 변경 불가. NAS에서 직접 수행.

- [ ] **Step 1: NAS SSH 접속 후 파일 이름 변경**

```bash
# NAS SSH 접속 후 프로젝트 디렉터리에서
mv runner.env application-runner.properties
```

- [ ] **Step 2: 로컬에서도 동일하게 이름 변경**

```bash
# c:/_project/my/terab/ 에서
mv runner.env application-runner.properties
```

Expected: `application-runner.properties`에 `ACCESS_TOKEN=ghp_...` 내용이 그대로 유지됨.

---

## Task 12: 운영용 application.properties 생성 (gitignore)

**Files:**
- Create: `application.properties` (project root, gitignore)

이 파일은 NAS에서 실제 운영 값으로 작성 후 Docker Config으로 등록한다.
로컬에는 참고용 템플릿으로 생성 (gitignore이므로 커밋 안 됨).

- [ ] **Step 1: application.properties 생성 (로컬 템플릿)**

프로젝트 root(`c:/_project/my/terab/`)에 파일 생성:

```properties
# ─── 운영 Docker Config ──────────────────────────────────────────────
# 이 파일은 NAS에서 실제 값으로 작성 후 아래 명령으로 Docker Config 등록:
#   docker config create api_properties ./application.properties
#
# 시크릿 값(${terab_*})은 configtree가 /run/secrets/ 에서 자동 주입.

# Database
spring.datasource.url=jdbc:postgresql://db:5432/terab_db
spring.datasource.username=terab_user
spring.datasource.password=${terab_db_password}

# MinIO
minio.endpoint=http://minio:9000
minio.access-key=minioadmin
minio.secret-key=${terab_minio_password}
minio.bucket=terab-files

# JWT
jwt.secret=${terab_jwt_secret}
jwt.access-token-expiration-ms=900000
jwt.refresh-token-expiration-ms=604800000

# Owner
app.owner.username=owner
app.owner.nickname=Owner
app.owner.password=${terab_owner_password}
```

- [ ] **Step 2: gitignore 동작 확인**

```bash
git status
```

Expected: `application.properties`가 `git status` 출력에 나타나지 않음 (gitignore 적용됨).

- [ ] **Step 3: NAS에서 Docker Config 등록 (운영 배포 전 1회)**

NAS SSH 접속 후:

```bash
# 실제 운영 값으로 application.properties 작성 후
docker config create api_properties ./application.properties

# terab_owner_password 시크릿 추가 (신규)
echo "실제_owner_비밀번호" | docker secret create terab_owner_password -

# 등록 확인
docker config ls
docker secret ls
```

---

## Task 13: 로컬 실행 검증

**Files:** (없음, 검증만)

- [ ] **Step 1: 인프라 실행 확인**

```bash
make infra
```

Expected: DB, MinIO 컨테이너 정상 기동.

- [ ] **Step 2: make api 실행 (IDE 방식)**

```bash
make api
```

Expected:
- Spring Boot가 `services/api/application-local.properties` (symlink)를 로드
- DB 연결 성공 (localhost:5432)
- 포트 8080 기동
- 로그에 `Started ...Application` 출력

실패 시 확인:
- symlink가 올바르게 생성됐는지: `ls -la services/api/application-local.properties`
- `--spring.profiles.active=local` 인수가 Makefile에 있는지 확인

- [ ] **Step 3: make dev-up 실행 (Docker Compose 방식)**

```bash
make dev-up
```

Expected:
- api 컨테이너가 `/app/application.properties`(마운트된 application-local.properties)를 로드
- `SPRING_DATASOURCE_URL`이 `db:5432`로 DB hostname override
- healthcheck 통과: `http://localhost:8080/actuator/health` → `{"status":"UP"}`

실패 시 확인:
- `docker logs terab-api` 로 Spring Boot 에러 확인
- volume mount 경로: `./application-local.properties` 파일이 root에 있는지 확인

- [ ] **Step 4: 최종 테스트 실행**

```bash
cd services/api && ./gradlew check
```

Expected: BUILD SUCCESSFUL

---

## NAS 운영 배포 체크리스트

아래는 코드 변경과 별개로 NAS에서 수동 수행 필요:

```bash
# 1. terab_owner_password 시크릿 생성
echo "실제_owner_비밀번호" | docker secret create terab_owner_password -

# 2. application.properties 작성 후 Docker Config 등록
docker config create api_properties ./application.properties

# 3. 기존 스택 업데이트 전 확인
docker config ls | grep api_properties
docker secret ls | grep terab_owner_password

# 4. 스택 재배포
make stack-deploy
```

> **주의:** `docker config create`는 기존 동명 config가 있으면 실패.
> 업데이트 시: `docker config rm api_properties && docker config create api_properties ./application.properties`
> 단, config를 사용 중인 서비스가 있으면 rm 불가 → 스택 중단 후 수행.

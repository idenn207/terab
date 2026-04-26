# Application Properties Config Design

**Date:** 2026-04-11
**Branch:** feat/user-login
**Scope:** API 설정 파일 통합 — `.env` 기반 환경변수에서 Spring Boot external config 파일 방식으로 전환

---

## 목표

- 환경별 설정을 `.env` + `docker-stack.yml` environment 블록으로 이중 관리하던 방식을 제거
- 단일 소스 파일로 각 환경의 설정을 관리 (운영: Docker Config, 로컬: symlink 파일)
- `docker-stack.yml`에 평문으로 노출된 비민감 보안 정보 제거 (DB URL, DB user, MinIO endpoint/key, bucket 등)
- `docker-entrypoint.sh`의 시크릿 읽기 로직을 Spring Boot configtree로 대체

---

## 최종 파일 구조

```
terab/
├── application.properties              ← 운영 Docker Config (gitignore)
├── application-local.properties        ← 로컬 더미 값, git 커밋 ✓
├── application-runner.properties       ← GitHub Runner ACCESS_TOKEN (gitignore)
└── services/api/
    └── application-local.properties    → symlink: ../../application-local.properties
```

---

## 파일별 내용 및 역할

### `services/api/src/main/resources/application.yml` (classpath, 이미지 내 포함)

구조·프레임워크 설정만 담당. 환경별 값 없음.

```yaml
spring:
  config:
    import: "optional:configtree:/run/secrets/"
  datasource:
    driver-class-name: org.postgresql.Driver
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
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
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
```

- `optional:configtree:/run/secrets/` : Docker Secrets 디렉터리의 파일을 자동으로 Spring 프로퍼티로 매핑
  - `/run/secrets/terab_db_password` → `terab_db_password` 프로퍼티
  - `optional:` prefix로 파일 없을 시 에러 없음 (로컬 환경 호환)
- 기존 `${DB_URL}`, `${JWT_SECRET}` 등 환경변수 참조 전부 제거

### `application.properties` (운영, gitignore)

Docker Config으로 등록하여 컨테이너 `/app/application.properties`에 마운트.
비민감 운영 값 + Docker Secrets configtree 참조 포함.

```properties
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

- `${terab_*}` 는 configtree가 `/run/secrets/terab_*` 파일 내용으로 자동 치환
- 이 파일 자체는 Docker Config (암호화 없음) → 시크릿 값 직접 포함 불가

### `application-local.properties` (프로젝트 root, git 커밋 ✓)

로컬 개발용 더미 값. 참조 없이 실제 값 직접 기입.
`services/api/application-local.properties`는 이 파일의 symlink.

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/terab_db
spring.datasource.username=terab_user
spring.datasource.password=terab1234

minio.endpoint=http://localhost:9000
minio.access-key=minioadmin
minio.secret-key=minioadmin
minio.bucket=terab-files

jwt.secret=dev-secret-key-that-is-at-least-256-bits-long-for-hs256-algorithm
jwt.access-token-expiration-ms=900000
jwt.refresh-token-expiration-ms=604800000

app.owner.username=owner
app.owner.nickname=Owner
app.owner.password=owner1234
```

- `localhost` hostname: IDE/Gradle 직접 실행 기준
- Docker Compose 실행 시 DB hostname만 `SPRING_DATASOURCE_URL` env var로 override

### `application-runner.properties` (gitignore)

기존 `runner.env` 파일 이름 변경. 내용 동일.

```properties
ACCESS_TOKEN=<github_personal_access_token>
```

---

## 환경별 실행 방식

### 1. 로컬 IDE/Gradle (`make api`)

```
Working dir: services/api/
Spring Boot file:./ search → services/api/application-local.properties (symlink) 로드
Profile: local → application-local.properties 활성화
```

Makefile 변경:
```makefile
# 변경 전
api:
    set -a && source .env.local && set +a && cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local'

# 변경 후
api:
    cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local'
```

### 2. 로컬 Docker Compose (`make dev-up`)

```yaml
# docker-compose.local.yml api 서비스
api:
  volumes:
    - ./application-local.properties:/app/application.properties:ro
  environment:
    SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/terab_db
  # 기존 environment DB_URL/DB_USER/MINIO_*/JWT_* 블록 전부 제거
  # docker-entrypoint.sh secrets 읽기 불필요 (로컬은 properties에 직접 값 포함)
```

- `SPRING_DATASOURCE_URL`: Spring Boot relaxed binding으로 `spring.datasource.url`을 override
- Docker Compose local에는 Swarm secrets 없음 → properties 파일 직접 값 사용 (더미)
- DB/MinIO 컨테이너는 기존과 동일하게 `.env.local` 사용

### 3. 운영 Docker Swarm (`make stack-deploy`)

```yaml
# docker-stack.yml api 서비스 변경 후
api:
  image: ghcr.io/idenn207/terab-api:latest
  configs:
    - source: api_properties
      target: /app/application.properties
  secrets:
    - terab_db_password
    - terab_minio_password
    - terab_jwt_secret
    - terab_owner_password    # 신규
  # environment 블록 전부 제거

configs:
  api_properties:
    external: true

secrets:
  terab_db_password:
    external: true
  terab_minio_password:
    external: true
  terab_jwt_secret:
    external: true
  terab_owner_password:
    external: true            # 신규
```

Docker Config 등록 명령 (NAS에서 실행):
```bash
docker config create api_properties ./application.properties
docker secret create terab_owner_password -   # stdin으로 입력
```

### 4. GitHub Actions Runner

```yaml
# docker-compose.runner.yml
env_file:
  - application-runner.properties  # runner.env → 이름 변경
```

---

## `docker-entrypoint.sh` 간소화

```bash
#!/bin/sh
# wait-for-it만 유지. 시크릿 읽기 로직 제거 (Spring Boot configtree가 담당)
set -e
exec wait-for-it.sh db:5432 --timeout=60 -- java -jar app.jar
```

---

## Symlink 설정

```bash
# git symlinks 활성화 (Windows Developer Mode 필요)
git config core.symlinks true

# symlink 생성
ln -s ../../application-local.properties services/api/application-local.properties
git add services/api/application-local.properties
```

---

## `.gitignore` 변경

```diff
- runner.env
+ application.properties
+ application-runner.properties
```

`application-local.properties`는 커밋 대상 (더미 값만 포함).

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `services/api/src/main/resources/application.yml` | `${ENV_VAR}` 전부 제거, configtree import 추가 |
| `application.properties` (신규, gitignore) | 운영 비민감 값 + 시크릿 참조 |
| `application-local.properties` (신규, 커밋) | 로컬 더미 값, symlink 원본 |
| `services/api/application-local.properties` (신규) | symlink |
| `docker-stack.yml` | api environment 제거, configs 추가, terab_owner_password 시크릿 추가 |
| `docker-compose.local.yml` | api env 정리, volume mount 추가, SPRING_DATASOURCE_URL 추가 |
| `docker-compose.runner.yml` | env_file 참조 변경 |
| `services/api/docker-entrypoint.sh` | 시크릿 읽기 로직 제거 |
| `Makefile` | api 타겟에서 `source .env.local` 제거 |
| `.gitignore` | `runner.env` 제거, `application.properties` / `application-runner.properties` 추가 |

---

## 제외 범위

- `db`, `minio` 컨테이너의 `POSTGRES_*`, `MINIO_ROOT_*` 환경변수: 해당 컨테이너 자체 설정으로 Spring Boot properties로 관리 불가
- `application-test.yml`, `application-integration.yml`: 테스트 전용 설정, 변경 없음
- frontend (`services/web`): Vite proxy 설정으로 API URL env var 불필요, 변경 없음

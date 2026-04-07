# Zero-Downtime Deployment 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** terab-api DB 연결 안정화 + Docker Swarm 기반 무중단 배포 인프라 구축

**Architecture:** Flyway connect-retries + wait-for-it.sh으로 기동 순서 경쟁 조건을 제거하고, docker-compose.yml을 docker-stack.yml로 전환해 api 3 replica rolling update(start-first + health gate)를 구성한다. CI/CD는 기존 build/push 뒤에 SSH deploy job을 추가해 Watchtower를 대체한다.

**Tech Stack:** Docker Swarm, Spring Boot 3 (Flyway, HikariCP), GitHub Actions (`appleboy/ssh-action`), Alpine Linux (`wait-for-it.sh`)

---

## 파일 구성

| 파일 | 작업 |
|---|---|
| `services/api/src/main/resources/application.yml` | Flyway retry + HikariCP timeout 추가 |
| `services/api/wait-for-it.sh` | 신규 생성 (TCP wait 스크립트) |
| `services/api/Dockerfile` | bash 설치, wait-for-it.sh COPY, ENTRYPOINT 수정 |
| `docker-stack.yml` | 신규 생성 (Swarm 프로덕션 스택) |
| `.github/workflows/deploy.yml` | deploy job 추가, Watchtower 제거 |

`docker-compose.yml`은 로컬 개발용으로 변경하지 않는다.

---

## Task 1: API 기동 안정화 — application.yml

**Files:**
- Modify: `services/api/src/main/resources/application.yml`

- [ ] **Step 1: 현재 설정 확인**

  ```bash
  cat services/api/src/main/resources/application.yml
  ```

  `spring.flyway` 섹션에 `connect-retries` 항목이 없고, `spring.datasource.hikari` 섹션이 없음을 확인한다.

- [ ] **Step 2: Flyway retry + HikariCP 설정 추가**

  `spring.flyway` 블록 하단과 `spring.datasource` 블록에 다음을 추가한다.

  ```yaml
  spring:
    datasource:
      url: ${DB_URL}
      username: ${DB_USER}
      password: ${DB_PASSWORD}
      driver-class-name: org.postgresql.Driver
      hikari:
        connection-timeout: 30000        # 연결 획득 대기 최대 30초
        initialization-fail-timeout: -1  # 시작 시 DB 없어도 앱 종료 안 함
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
      connect-retries: 10          # 10회 재시도
      connect-retries-interval: 3s # 3초 간격 → 최대 30초 대기
    servlet:
      multipart:
        max-file-size: 10GB
        max-request-size: 10GB
  ```

- [ ] **Step 3: 로컬 통합 테스트로 설정 검증**

  ```bash
  cd services/api
  ./gradlew check --no-daemon
  ```

  Expected: `BUILD SUCCESSFUL` — 기존 테스트가 깨지지 않음을 확인.

- [ ] **Step 4: Commit**

  ```bash
  git add services/api/src/main/resources/application.yml
  git commit -m "fix: Flyway connect-retries + HikariCP startup timeout 설정 추가"
  ```

---

## Task 2: wait-for-it.sh 추가 + Dockerfile 수정

**Files:**
- Create: `services/api/wait-for-it.sh`
- Modify: `services/api/Dockerfile`

- [ ] **Step 1: wait-for-it.sh 생성**

  `services/api/wait-for-it.sh` 파일을 생성한다.

  ```bash
  #!/usr/bin/env bash
  # wait-for-it.sh — TCP 포트가 열릴 때까지 대기
  # 출처: https://github.com/vishnubob/wait-for-it (MIT License)
  # 경량 버전: Alpine bash 호환

  WAITFORIT_cmdname=${0##*/}

  echoerr() { if [[ $WAITFORIT_QUIET -ne 1 ]]; then echo "$@" 1>&2; fi }

  usage() {
    cat << USAGE >&2
  Usage:
    $WAITFORIT_cmdname host:port [-t timeout] [-- command args]
    -t TIMEOUT  Timeout in seconds (default: 60)
    -q          Quiet mode
  USAGE
    exit 1
  }

  wait_for() {
    local waitforit_timeout=${WAITFORIT_TIMEOUT:-60}
    local waitforit_start_ts
    waitforit_start_ts=$(date +%s)

    while :; do
      if [[ $WAITFORIT_ISBUSY -eq 1 ]]; then
        nc -z "$WAITFORIT_HOST" "$WAITFORIT_PORT" > /dev/null 2>&1
        WAITFORIT_result=$?
      else
        (echo > /dev/tcp/"$WAITFORIT_HOST"/"$WAITFORIT_PORT") >/dev/null 2>&1
        WAITFORIT_result=$?
      fi

      if [[ $WAITFORIT_result -eq 0 ]]; then
        local waitforit_end_ts
        waitforit_end_ts=$(date +%s)
        echoerr "$WAITFORIT_cmdname: $WAITFORIT_HOST:$WAITFORIT_PORT is available after $((waitforit_end_ts - waitforit_start_ts)) seconds"
        break
      fi

      local waitforit_cur_ts
      waitforit_cur_ts=$(date +%s)
      local waitforit_elapsed=$((waitforit_cur_ts - waitforit_start_ts))
      if [[ $waitforit_timeout -gt 0 && $waitforit_elapsed -ge $waitforit_timeout ]]; then
        echoerr "$WAITFORIT_cmdname: timeout after $waitforit_elapsed seconds waiting for $WAITFORIT_HOST:$WAITFORIT_PORT"
        exit 1
      fi

      sleep 2
    done
  }

  WAITFORIT_TIMEOUT=60
  WAITFORIT_QUIET=0
  WAITFORIT_ISBUSY=0

  # 인자 파싱
  while [[ $# -gt 0 ]]; do
    case "$1" in
      *:* )
        WAITFORIT_HOST="${1%%:*}"
        WAITFORIT_PORT="${1##*:}"
        shift 1
        ;;
      -t)
        WAITFORIT_TIMEOUT="$2"
        shift 2
        ;;
      --timeout=*)
        WAITFORIT_TIMEOUT="${1#*=}"
        shift 1
        ;;
      -q | --quiet)
        WAITFORIT_QUIET=1
        shift 1
        ;;
      --)
        shift
        break
        ;;
      --help)
        usage
        ;;
      *)
        echoerr "Unknown argument: $1"
        usage
        ;;
    esac
  done

  if [[ -z "$WAITFORIT_HOST" || -z "$WAITFORIT_PORT" ]]; then
    echoerr "Error: host:port is required"
    usage
  fi

  wait_for

  if [[ $# -gt 0 ]]; then
    exec "$@"
  fi
  ```

- [ ] **Step 2: Dockerfile 수정**

  현재:
  ```dockerfile
  FROM eclipse-temurin:21-jre-alpine
  WORKDIR /app
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser
  COPY --from=builder /app/build/libs/*.jar app.jar
  EXPOSE 8080
  ENTRYPOINT ["java", "-jar", "app.jar"]
  ```

  다음으로 교체:
  ```dockerfile
  # ─── Stage 1: Build ─────────────────────────────────────────────
  FROM eclipse-temurin:21-jdk-alpine AS builder

  WORKDIR /app

  COPY gradlew .
  COPY gradle gradle
  COPY build.gradle .
  COPY settings.gradle .
  RUN chmod +x gradlew && ./gradlew dependencies --no-daemon

  COPY src src
  RUN ./gradlew bootJar --no-daemon -x test

  # ─── Stage 2: Runtime ────────────────────────────────────────────
  FROM eclipse-temurin:21-jre-alpine

  WORKDIR /app

  # wait-for-it.sh: bash 필요 (Alpine 기본 제외)
  RUN apk add --no-cache bash

  # root 권한으로 wait-for-it.sh 설치
  # build context: services/api/ 이므로 경로는 파일명만 사용
  COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
  RUN chmod +x /usr/local/bin/wait-for-it.sh

  # 보안: non-root 사용자로 실행
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser

  COPY --from=builder /app/build/libs/*.jar app.jar

  EXPOSE 8080

  # DB TCP 포트 열릴 때까지 대기 후 앱 기동 (최대 60초)
  ENTRYPOINT ["wait-for-it.sh", "db:5432", "--timeout=60", "--", "java", "-jar", "app.jar"]
  ```

  > **build context 확인**: GitHub Actions의 `context: ./services/api`와 로컬 `docker build services/api` 모두 `services/api/`가 build context. `wait-for-it.sh`과 `Dockerfile`이 같은 디렉터리에 있으므로 `COPY wait-for-it.sh`로 충분.

- [ ] **Step 3: 로컬 Docker 빌드 검증**

  ```bash
  cd services/api
  docker build -t terab-api:local-test .
  ```

  Expected: `Successfully built ...` — 오류 없이 빌드 완료.

- [ ] **Step 4: wait-for-it.sh 동작 확인**

  ```bash
  docker run --rm terab-api:local-test wait-for-it.sh --help
  ```

  Expected: 사용법 출력 후 종료 (앱은 DB 없으면 timeout 후 종료).

- [ ] **Step 5: Commit**

  ```bash
  git add services/api/wait-for-it.sh services/api/Dockerfile
  git commit -m "feat: wait-for-it.sh 기동 대기 스크립트 추가 (DB TCP 포트 ready 확인)"
  ```

---

## Task 3: docker-stack.yml 생성 (Docker Swarm 프로덕션 스택)

**Files:**
- Create: `docker-stack.yml`

- [ ] **Step 1: docker-stack.yml 생성**

  프로젝트 루트에 `docker-stack.yml`을 생성한다.

  ```yaml
  # Docker Swarm 프로덕션 스택
  # 사용법: docker stack deploy -c docker-stack.yml terab --with-registry-auth
  # docker-compose.yml은 로컬 개발용으로 유지

  services:
    # ─── PostgreSQL ───────────────────────────────────────────────
    db:
      image: postgres:16-alpine
      environment:
        POSTGRES_DB: ${DB_NAME}
        POSTGRES_USER: ${DB_USER}
        POSTGRES_PASSWORD: ${DB_PASSWORD}
      volumes:
        - ${DB_DATA_PATH}:/var/lib/postgresql/data
      networks:
        - terab-net
      healthcheck:
        test: ['CMD-SHELL', 'pg_isready -U ${DB_USER} -d ${DB_NAME}']
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

    # ─── MinIO ────────────────────────────────────────────────────
    minio:
      image: minio/minio:latest
      command: server /data --console-address ":9001"
      environment:
        MINIO_ROOT_USER: ${MINIO_USER}
        MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
      volumes:
        - ${MINIO_DATA_PATH}:/data
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
        DB_URL: jdbc:postgresql://db:5432/${DB_NAME}
        DB_USER: ${DB_USER}
        DB_PASSWORD: ${DB_PASSWORD}
        MINIO_ENDPOINT: http://minio:9000
        MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
        MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
        MINIO_BUCKET: ${MINIO_BUCKET}
        JWT_SECRET: ${JWT_SECRET}
        JWT_EXPIRATION_MS: ${JWT_EXPIRATION_MS}
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
          order: start-first      # 새 replica 기동 후 old 종료
          parallelism: 1          # 1개씩 순차 교체
          failure_action: rollback
          delay: 10s
          monitor: 30s            # 교체 후 30초간 헬스 모니터링
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
        - ${NGINX_CONF_PATH}:/etc/nginx/nginx.conf:ro
      networks:
        - terab-net
      deploy:
        replicas: 1
        restart_policy:
          condition: on-failure

  networks:
    terab-net:
      driver: overlay   # Swarm 필수: bridge → overlay
  ```

  > **주의사항:**
  > - `depends_on`은 Swarm에서 지원되지 않아 제거. 기동 순서는 Task 1, 2에서 구현한 Flyway retry + wait-for-it.sh가 처리.
  > - `container_name`은 Swarm이 자동 관리하므로 제거.
  > - 볼륨 경로는 상대경로 미지원 → `.env`에 절대경로로 지정 필요.
  > - Watchtower 서비스 제거 (CI/CD가 직접 배포).
  > - 네트워크 드라이버 `bridge` → `overlay` 변경.
  > - Nginx upstream은 `server api:8080` 그대로 유지 — Swarm 내부 DNS가 3개 replica로 자동 분산.

- [ ] **Step 2: .env 파일에 절대경로 확인**

  NAS의 `.env` 파일에 아래 항목이 절대경로로 설정되어 있는지 확인한다:

  ```bash
  # NAS에서 확인
  DB_DATA_PATH=/volume1/docker/terab/db
  MINIO_DATA_PATH=/volume1/docker/terab/storage
  NGINX_CONF_PATH=/volume1/docker/terab/nginx.conf
  ```

  경로가 없으면 생성:
  ```bash
  mkdir -p /volume1/docker/terab/db /volume1/docker/terab/storage
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add docker-stack.yml
  git commit -m "feat: Docker Swarm 프로덕션 스택 구성 (api×3 rolling update, web×2)"
  ```

---

## Task 4: GitHub Actions — SSH deploy job 추가

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: GitHub Secrets 등록 확인**

  GitHub 저장소 Settings → Secrets and variables → Actions에서 다음 4개를 추가한다:

  | Secret 이름 | 값 |
  |---|---|
  | `NAS_HOST` | NAS의 외부 도메인 또는 IP (예: `skypark207.com`) |
  | `NAS_USER` | SSH 사용자명 |
  | `NAS_SSH_KEY` | SSH 개인키 전체 내용 (`-----BEGIN OPENSSH PRIVATE KEY-----` 포함) |
  | `NAS_SSH_PORT` | SSH 커스텀 포트 번호 (예: `22222`) |

- [ ] **Step 2: deploy.yml에 deploy job 추가**

  현재 `.github/workflows/deploy.yml`의 `cleanup` job 다음에 추가:

  ```yaml
    # ─── NAS 배포 (Swarm rolling update) ────────────────────────────
    deploy:
      name: Deploy to NAS
      needs: [build-and-push]
      if: github.event_name == 'push'
      runs-on: ubuntu-latest

      steps:
        - name: Deploy api & web via SSH
          uses: appleboy/ssh-action@v1.2.0
          with:
            host: ${{ secrets.NAS_HOST }}
            username: ${{ secrets.NAS_USER }}
            key: ${{ secrets.NAS_SSH_KEY }}
            port: ${{ secrets.NAS_SSH_PORT }}
            script: |
              # api rolling update: start-first + health gate
              # ghcr.io 인증은 Task 5 Step 4에서 NAS에 수동 등록된 자격증명 사용
              docker service update \
                --image ghcr.io/idenn207/terab-api:latest \
                --with-registry-auth \
                terab_api

              # web rolling update
              docker service update \
                --image ghcr.io/idenn207/terab-web:latest \
                --with-registry-auth \
                terab_web
  ```

  > `needs: [build-and-push]`로 matrix job (api + web 빌드) 양쪽이 완료된 후 배포 시작.

- [ ] **Step 3: deploy.yml 전체 구조 확인**

  최종 job 순서가 다음인지 확인:
  ```
  test → build-and-push (matrix: api, web) → cleanup
                     └→ deploy
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add .github/workflows/deploy.yml
  git commit -m "ci: GitHub Actions SSH deploy job 추가 (Swarm service update)"
  ```

---

## Task 5: NAS 초기 설정 (최초 1회, 수동)

**Files:** NAS 서버에서 직접 실행 (코드 변경 없음)

- [ ] **Step 1: SSH 보안 강화 (Synology DSM)**

  NAS SSH 접속 후:
  ```bash
  # /etc/ssh/sshd_config 수정
  sudo vi /etc/ssh/sshd_config
  ```

  다음 항목 설정:
  ```
  PasswordAuthentication no
  PermitRootLogin no
  Port 22222
  ```

  ```bash
  sudo systemctl restart sshd
  # 또는 Synology: sudo synoservice --restart sshd
  ```

- [ ] **Step 2: SSH 공개키 등록**

  GitHub Actions에서 사용할 SSH 키쌍 생성 (로컬 머신):
  ```bash
  ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/terab_deploy
  cat ~/.ssh/terab_deploy.pub
  ```

  NAS에 공개키 등록:
  ```bash
  # NAS에서
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  echo "<위에서 출력된 공개키>" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  ```

  `~/.ssh/terab_deploy` (개인키) 내용을 GitHub Secret `NAS_SSH_KEY`에 등록.

- [ ] **Step 3: Docker Swarm 초기화**

  ```bash
  # NAS에서
  docker swarm init
  ```

  Expected:
  ```
  Swarm initialized: current node (xxxx) is now a manager.
  ```

- [ ] **Step 4: ghcr.io 인증 등록**

  ```bash
  docker login ghcr.io -u idenn207
  # 패스워드: GitHub Personal Access Token (read:packages 권한)
  ```

- [ ] **Step 5: 기존 Compose 스택 종료**

  ```bash
  cd /volume1/docker/terab  # 또는 docker-compose.yml이 있는 경로
  docker compose down
  ```

  Expected: 모든 terab-* 컨테이너 종료.

- [ ] **Step 6: Swarm 스택 최초 배포**

  ```bash
  docker stack deploy -c docker-stack.yml terab --with-registry-auth
  ```

  Expected:
  ```
  Creating network terab_terab-net
  Creating service terab_db
  Creating service terab_minio
  Creating service terab_api
  Creating service terab_web
  Creating service terab_nginx
  ```

- [ ] **Step 7: 배포 상태 확인**

  ```bash
  # 서비스 목록 확인
  docker service ls
  ```

  Expected (모두 REPLICAS 충족 시):
  ```
  ID      NAME          MODE         REPLICAS   IMAGE
  xxxx    terab_api     replicated   3/3        ghcr.io/idenn207/terab-api:latest
  xxxx    terab_web     replicated   2/2        ghcr.io/idenn207/terab-web:latest
  xxxx    terab_db      replicated   1/1        postgres:16-alpine
  xxxx    terab_minio   replicated   1/1        minio/minio:latest
  xxxx    terab_nginx   replicated   1/1        nginx:alpine
  ```

  ```bash
  # api replica 상태 상세 확인
  docker service ps terab_api
  ```

  Expected: 3개 모두 `Running` 상태.

- [ ] **Step 8: 헬스 엔드포인트 확인**

  ```bash
  curl -f http://localhost:8080/actuator/health
  ```

  Expected:
  ```json
  {"status":"UP"}
  ```

---

## Task 6: 배포 파이프라인 End-to-End 검증

- [ ] **Step 1: 코드 변경 후 master push**

  임의의 코드 변경(예: 주석 추가)을 master에 push한다:
  ```bash
  git commit --allow-empty -m "test: Swarm rolling deploy 검증"
  git push origin master
  ```

- [ ] **Step 2: GitHub Actions 진행 확인**

  GitHub Actions 탭에서 다음 순서로 통과하는지 확인:
  ```
  test ✓ → build-and-push (api) ✓ → build-and-push (web) ✓ → deploy ✓
  ```

- [ ] **Step 3: NAS에서 rolling update 관찰**

  GitHub Actions deploy job이 실행되는 동안 NAS에서:
  ```bash
  watch -n 2 'docker service ps terab_api --format "table {{.Name}}\t{{.Image}}\t{{.CurrentState}}"'
  ```

  Expected: old replica들이 순차적으로 Shutdown → new replica들이 Running으로 전환.

- [ ] **Step 4: 서비스 중단 없음 확인**

  배포 중 헬스 엔드포인트가 계속 응답하는지 확인:
  ```bash
  # 배포 중 다른 터미널에서
  while true; do curl -sf http://localhost:8080/actuator/health | grep -o '"status":"[^"]*"'; sleep 1; done
  ```

  Expected: 배포 전/중/후 `"status":"UP"` 연속 출력.

- [ ] **Step 5: 롤백 동작 확인 (선택적)**

  롤백이 필요한 상황을 시뮬레이션:
  ```bash
  # 수동 롤백
  docker service rollback terab_api
  docker service ps terab_api
  ```

  Expected: 이전 이미지로 rolling 복구.

---

## Expand-Contract 패턴 참고 (DB 스키마 변경 시)

이후 DB 스키마 변경 시 반드시 2단계로 분리한다. Rolling update 중 old/new replica가 동시에 DB를 사용하기 때문이다.

```
1단계 Flyway (expand):  컬럼 추가, 데이터 복사 — old/new 모두 동작
2단계 Flyway (contract): 구 컬럼 제거 — new만 운영 확인 후 다음 배포
```

예시 (`name` → `file_name` 변경):
```sql
-- V10__expand_file_name.sql (1단계 배포)
ALTER TABLE files ADD COLUMN file_name TEXT;
UPDATE files SET file_name = name WHERE file_name IS NULL;

-- V11__contract_name.sql (2단계 배포: 다음 스프린트)
ALTER TABLE files DROP COLUMN name;
```

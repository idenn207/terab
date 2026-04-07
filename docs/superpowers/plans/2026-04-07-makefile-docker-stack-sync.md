# Makefile & Docker Stack Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Makefile과 Docker 파일 구조를 실제 운영 환경(Docker Swarm)과 일치시키고, Portainer CE를 추가해 원격 컨테이너 모니터링을 가능하게 한다.

**Architecture:** `docker-compose.local.yml`을 standalone 완전한 파일로 재작성해 로컬 개발을 담당하고, `docker-stack.yml`이 Swarm 프로덕션을 담당하는 2파일 구조로 단순화한다. Makefile은 이 두 파일을 각각 명확하게 참조한다.

**Tech Stack:** Docker Compose v2, Docker Swarm, Portainer CE 2.x, GNU Make

---

## 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `docker-compose.local.yml` | 재작성 | override → standalone 완전한 정의, 포트 노출 추가 |
| `Makefile` | 수정 | LOCAL 변수 단순화, up/down 제거, stack-* 타겟 추가 |
| `docker-stack.yml` | 수정 | Portainer CE + portainer_agent 추가 |
| `docker-compose.yml` | 삭제 | 역할 모호, base layer 불필요 |
| `docker-compose.infra.yml` | 삭제 | 중복, local.yml이 포트 노출 담당 |

---

## Task 1: docker-compose.local.yml 재작성 (standalone)

**Files:**
- Rewrite: `docker-compose.local.yml`

- [ ] **Step 1: 기존 파일 내용 확인**

  ```bash
  cat docker-compose.local.yml
  ```
  현재 override 구조(build, volumes만 정의)임을 확인.

- [ ] **Step 2: standalone 완전한 파일로 재작성**

  `docker-compose.local.yml` 전체를 아래로 교체:

  ```yaml
  # 로컬 개발용 standalone 설정
  # 사용법:
  #   make infra    → DB + MinIO만 (로컬 API/Web 서버와 함께 사용)
  #   make dev-up   → 전체 서비스 (컨테이너 환경 검증)

  services:
    # ─── PostgreSQL ─────────────────────────────────────────────────
    db:
      image: postgres:16-alpine
      container_name: terab-db
      restart: unless-stopped
      environment:
        POSTGRES_DB: ${DB_NAME}
        POSTGRES_USER: ${DB_USER}
        POSTGRES_PASSWORD: ${DB_PASSWORD}
      volumes:
        - ./volumes/db:/var/lib/postgresql/data
      ports:
        - '5432:5432'
      networks:
        - terab-net
      healthcheck:
        test: ['CMD-SHELL', 'pg_isready -U ${DB_USER} -d ${DB_NAME}']
        interval: 10s
        timeout: 5s
        retries: 5
        start_period: 30s

    # ─── MinIO (S3 호환 오브젝트 스토리지) ──────────────────────────
    minio:
      image: minio/minio:latest
      container_name: terab-storage
      restart: unless-stopped
      command: server /data --console-address ":9001"
      environment:
        MINIO_ROOT_USER: ${MINIO_USER}
        MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
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

    # ─── Spring Boot API ─────────────────────────────────────────────
    api:
      build:
        context: ./services/api
        dockerfile: Dockerfile
      container_name: terab-api
      restart: on-failure
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

    # ─── React Frontend ──────────────────────────────────────────────
    web:
      build:
        context: ./services/web
        dockerfile: Dockerfile
      container_name: terab-web
      restart: unless-stopped
      healthcheck:
        test: ['CMD', 'curl', '-f', 'http://localhost:80/']
        interval: 30s
        timeout: 10s
        retries: 3
        start_period: 10s
      networks:
        - terab-net

    # ─── Nginx (리버스 프록시) ───────────────────────────────────────
    nginx:
      image: nginx:alpine
      container_name: terab-nginx
      restart: unless-stopped
      ports:
        - '8080:80'
      volumes:
        - ./services/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      depends_on:
        - api
        - web
      networks:
        - terab-net

  networks:
    terab-net:
      driver: bridge
  ```

- [ ] **Step 3: YAML 구문 검증**

  ```bash
  docker compose -f docker-compose.local.yml config
  ```
  Expected: 에러 없이 resolved config 출력. `ports: 5432, 9000, 9001` 포함 확인.

- [ ] **Step 4: infra 서비스 기동 확인**

  `.env.local` 또는 환경변수가 있다면:
  ```bash
  docker compose -f docker-compose.local.yml up -d db minio
  docker compose -f docker-compose.local.yml ps
  ```
  Expected: `terab-db`, `terab-storage` 컨테이너 running, 포트 5432/9000/9001 바인딩 확인.

  ```bash
  # 포트 바인딩 확인
  docker compose -f docker-compose.local.yml port db 5432
  docker compose -f docker-compose.local.yml port minio 9000
  ```
  Expected: `0.0.0.0:5432`, `0.0.0.0:9000` 출력.

  확인 후 정리:
  ```bash
  docker compose -f docker-compose.local.yml stop db minio
  ```

- [ ] **Step 5: 커밋**

  ```bash
  git add docker-compose.local.yml
  git commit -m "refactor: docker-compose.local.yml을 standalone 완전한 정의로 재작성 (포트 노출 추가)"
  ```

---

## Task 2: Makefile 업데이트

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: 현재 Makefile 확인**

  ```bash
  cat Makefile
  ```
  `LOCAL` 변수와 `up`/`down` 타겟 위치 확인.

- [ ] **Step 2: Makefile 전체 교체**

  `Makefile` 전체를 아래로 교체:

  ```makefile
  SHELL := C:/Program Files/Git/usr/bin/bash.exe
  .PHONY: infra infra-down infra-reset dev-up dev-down stack-deploy stack-rm stack-update build-web build-android api web android android-open test test-api test-api-unit test-api-integration test-web

  LOCAL := docker compose -f docker-compose.local.yml

  # ─── 로컬 인프라 (DB + MinIO만) ───────────────────────────────────
  infra:
  	$(LOCAL) up -d db minio

  infra-down:
  	$(LOCAL) stop db minio

  infra-reset:
  	rm -rf ./volumes/ && $(LOCAL) up -d db minio

  # ─── 개발 환경 (전체 서비스, 로컬 빌드) ──────────────────────────
  dev-up:
  	$(LOCAL) up -d

  dev-down:
  	$(LOCAL) down

  # ─── Docker Swarm 운영 환경 ────────────────────────────────────────
  stack-deploy:
  	docker stack deploy -c docker-stack.yml terab --with-registry-auth

  stack-rm:
  	docker stack rm terab

  stack-update:
  	docker service update \
  		--image ghcr.io/idenn207/terab-api:latest \
  		--with-registry-auth \
  		--force \
  		terab_api
  	docker service update \
  		--image ghcr.io/idenn207/terab-web:latest \
  		--with-registry-auth \
  		--force \
  		terab_web

  # ─── 빌드 ────────────────────────────────────────────────────────
  build-web:
  	cd services/web && npm run build

  build-android:
  	cd services/web && npm run cap:sync

  # ─── 백엔드 ────────────────────────────────────────────────────────
  api:
  	set -a && source .env.local && set +a && cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local'

  # ─── 프론트엔드 ────────────────────────────────────────────────────
  web:
  	cd services/web && npm run dev

  # ─── 안드로이드 ────────────────────────────────────────────────────
  android:
  	cd services/web && npm run cap:android

  android-open:
  	cd services/web && npm cap open android

  # ─── 테스트 ────────────────────────────────────────────────────────
  test: test-api test-web

  test-api:
  	cd services/api && ./gradlew check

  test-api-unit:
  	cd services/api && ./gradlew test

  test-api-integration:
  	cd services/api && ./gradlew integrationTest

  test-web:
  	cd services/web && npm test
  ```

  > **주의:** 들여쓰기는 반드시 **탭(Tab)**이어야 함. 스페이스이면 `Makefile:N: *** missing separator` 에러 발생.

- [ ] **Step 3: dry-run 검증**

  ```bash
  make -n infra
  make -n dev-up
  make -n stack-deploy
  make -n stack-update
  ```
  Expected 각각:
  ```
  docker compose -f docker-compose.local.yml up -d db minio
  docker compose -f docker-compose.local.yml up -d
  docker stack deploy -c docker-stack.yml terab --with-registry-auth
  docker service update --image ghcr.io/idenn207/terab-api:latest ...
  ```

  `up` / `down` 타겟이 없어졌는지 확인:
  ```bash
  make up 2>&1 | grep "No rule"
  ```
  Expected: `make: *** No rule to make target 'up'.`

- [ ] **Step 4: 커밋**

  ```bash
  git add Makefile
  git commit -m "refactor: Makefile LOCAL 단순화, up/down 제거, stack-deploy/rm/update 추가"
  ```

---

## Task 3: docker-stack.yml에 Portainer CE 추가

**Files:**
- Modify: `docker-stack.yml`

- [ ] **Step 1: 현재 파일 끝 부분 확인**

  ```bash
  tail -10 docker-stack.yml
  ```
  `networks:` 섹션 이전에 마지막 서비스(nginx)가 있고, `volumes:` 섹션이 없음을 확인.

- [ ] **Step 2: Portainer 서비스 및 볼륨 추가**

  `docker-stack.yml`의 `networks:` 섹션 바로 앞에 아래 내용 삽입:

  ```yaml
    # ─── Portainer CE (컨테이너 모니터링 UI) ─────────────────────────
    portainer:
      image: portainer/portainer-ce:latest
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
  ```

  그리고 파일 맨 끝 `networks:` 섹션 앞에 `volumes:` 섹션 추가:

  ```yaml
  volumes:
    portainer_data:
  ```

  최종 파일 끝부분은 아래와 같아야 함:
  ```yaml
  volumes:
    portainer_data:

  networks:
    terab-net:
      driver: overlay
  ```

- [ ] **Step 3: Swarm stack 구문 검증**

  ```bash
  docker stack config -c docker-stack.yml
  ```
  Expected: 에러 없이 resolved config 출력. `portainer`, `portainer_agent` 서비스, `portainer_data` 볼륨 포함 확인.

  Swarm이 초기화되어 있지 않은 환경이라면 아래로 대체:
  ```bash
  docker compose -f docker-stack.yml config 2>&1 | head -20
  ```

- [ ] **Step 4: 커밋**

  ```bash
  git add docker-stack.yml
  git commit -m "feat: docker-stack.yml에 Portainer CE + portainer_agent 추가 (https://nas-ip:9443)"
  ```

---

## Task 4: 불필요한 파일 삭제

**Files:**
- Delete: `docker-compose.yml`
- Delete: `docker-compose.infra.yml`

- [ ] **Step 1: 두 파일이 어디서도 참조되지 않는지 최종 확인**

  ```bash
  grep -r "docker-compose\.yml" . --include="*.yml" --include="*.yaml" --include="Makefile" --include="*.sh" --exclude-dir=node_modules --exclude-dir=.git
  grep -r "docker-compose\.infra" . --include="*.yml" --include="*.yaml" --include="Makefile" --include="*.sh" --exclude-dir=node_modules --exclude-dir=.git
  ```
  Expected: 참조 없음. 참조가 있다면 해당 파일도 업데이트.

- [ ] **Step 2: 파일 삭제**

  ```bash
  git rm docker-compose.yml docker-compose.infra.yml
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git commit -m "chore: docker-compose.yml, docker-compose.infra.yml 삭제 (local.yml standalone 전환으로 불필요)"
  ```

---

## Task 5: 전체 검증

- [ ] **Step 1: Makefile dry-run 전체 타겟 확인**

  ```bash
  make -n infra
  make -n infra-down
  make -n infra-reset
  make -n dev-up
  make -n dev-down
  make -n stack-deploy
  make -n stack-rm
  make -n stack-update
  ```
  Expected: 각 타겟이 올바른 docker 명령을 출력.

- [ ] **Step 2: 삭제된 타겟 확인**

  ```bash
  make up 2>&1
  make down 2>&1
  ```
  Expected: `No rule to make target 'up'` / `No rule to make target 'down'`

- [ ] **Step 3: docker-compose.local.yml 구문 확인**

  ```bash
  docker compose -f docker-compose.local.yml config --quiet && echo "OK"
  ```
  Expected: `OK`

- [ ] **Step 4: docker-stack.yml 구문 확인**

  ```bash
  docker stack config -c docker-stack.yml --quiet && echo "OK"
  ```
  Expected: `OK`

- [ ] **Step 5: 삭제 파일 없음 확인**

  ```bash
  ls docker-compose*.yml
  ```
  Expected: `docker-compose.local.yml` 하나만 출력.

- [ ] **Step 6: 최종 커밋 (변경사항 있을 경우)**

  ```bash
  git status
  # 커밋되지 않은 변경사항이 있다면:
  git add -A
  git commit -m "chore: Makefile & Docker stack sync 최종 정리"
  ```

# Zero-Downtime Deployment 설계

**날짜:** 2026-04-02  
**상태:** 승인됨  
**배경:** NAS 컨테이너 환경에서 terab-api 기동 시 DB 연결 실패 오류 반복 발생, 이를 해결하면서 무중단 배포 인프라로 확장

---

## 1. 문제 정의

### 현재 증상
- `terab-api` 기동 시 Flyway가 DB 연결 실패 → `BeanCreationException` → 컨테이너 종료
- `restart: on-failure`로 재시작하지만 `depends_on: service_healthy` 조건을 재평가하지 않아 루프 발생

### 근본 원인
1. **`restart: on-failure`가 `depends_on` 조건을 우회**: Docker Compose의 `depends_on: condition: service_healthy`는 `docker compose up` 최초 실행 시에만 동작. 이후 Docker Engine이 처리하는 컨테이너 재시작에는 적용되지 않음
2. **Flyway에 connection retry 없음**: 연결 시도 1회 실패 시 즉시 예외 발생, 앱 종료
3. **NAS 환경의 스토리지 지연**: PostgreSQL이 `pg_isready`에 응답하더라도 실제 쿼리 수락까지 추가 시간 필요

---

## 2. 해결 방향

단순 DB 연결 안정화(C안)와 Docker Swarm 기반 무중단 배포를 함께 구성한다.

---

## 3. 아키텍처

```
[GitHub Actions CI/CD]
      │ 1. build & push image to ghcr.io
      │ 2. SSH → NAS → docker service update
      ▼
┌─────────────────────────────────────────────┐
│  NAS (단일 호스트, Docker Swarm mode)         │
│                                              │
│  [Nginx :8080]                               │
│       │ proxy_pass (Swarm VIP 자동 분산)      │
│       ▼                                      │
│  [terab_api] replicas=3                      │
│   api-1 | api-2 | api-3  ← rolling update   │
│                                              │
│  [terab_web] replicas=2                      │
│                                              │
│  [terab_db]  replicas=1 (PostgreSQL)         │
│  [terab_minio] replicas=1                    │
└─────────────────────────────────────────────┘
```

**Swarm 내장 로드밸런싱:** Nginx는 서비스명(`terab_api`) 하나만 참조. Swarm VIP가 3개 replica로 자동 분산.

---

## 4. 구성 요소별 상세 설계

### 4-1. 기동 안정화 (C안: Application-level Retry + Wait Script)

**`application.yml` 변경:**
```yaml
spring:
  flyway:
    connect-retries: 10
    connect-retries-interval: 3s
  datasource:
    hikari:
      connection-timeout: 30000
      initialization-fail-timeout: -1  # 시작 시 DB 연결 실패해도 앱 종료 안 함 (-1: 무한 대기)
```

**Dockerfile entrypoint:**
- `wait-for-it.sh`로 DB TCP 포트 열릴 때까지 대기 후 JAR 실행
- Flyway retry와 이중 보호 (belt-and-suspenders)

### 4-2. Docker Swarm 스택 구성 (`docker-stack.yml`)

`docker-compose.yml` → `docker-stack.yml`로 전환. 핵심 변경:

```yaml
services:
  api:
    image: ghcr.io/idenn207/terab-api:latest
    deploy:
      replicas: 3
      update_config:
        order: start-first       # 새 replica 먼저 기동 후 old 종료
        parallelism: 1           # 1개씩 순차 교체
        failure_action: rollback # 헬스체크 실패 시 자동 롤백
        delay: 10s
      rollback_config:
        order: start-first
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/actuator/health']
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 60s

  web:
    image: ghcr.io/idenn207/terab-web:latest
    deploy:
      replicas: 2
      update_config:
        order: start-first
        failure_action: rollback

  db:
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]
```

**Watchtower 제거:** api/web은 CI/CD가 직접 제어. 자동 폴링 배포 불필요.

### 4-3. 배포 흐름 (Swarm start-first rolling update)

```
t=0s  : docker service update 실행
t=10s : replica-new 기동, Flyway migration 실행 (expand-only)
t=30s : replica-new /actuator/health 통과
t=30s : replica-old 1개 종료 시작
t=40s : replica-new 2번째 기동 → 통과 → old 종료
t=50s : replica-new 3번째 기동 → 통과 → old 종료
t=50s : 배포 완료, new × 3만 운영
        실패 시 → automatic rollback to previous image
```

### 4-4. DB Expand-Contract 패턴

rolling update 중 old/new replica가 동시에 같은 DB를 사용하므로, 스키마 변경은 반드시 2단계로 분리한다.

**원칙:**
- Flyway 파일은 추가만 허용, 기존 파일 수정 금지
- 한 배포에서 컬럼 추가 + 제거 동시 금지

**시나리오별 전략:**

| 변경 유형 | 1단계 배포 | 2단계 배포 |
|---|---|---|
| 컬럼 추가 (nullable) | ADD COLUMN | 완료 (1단계로 끝) |
| 컬럼 이름 변경 | ADD new + 데이터 복사 | DROP old |
| NOT NULL 추가 | ADD COLUMN DEFAULT x | DROP DEFAULT + SET NOT NULL |
| 컬럼 제거 | (앱 코드에서 미사용 처리) | DROP COLUMN |

**금지 패턴:**
```sql
-- ❌ breaking migration (old replica 오류 유발)
ALTER TABLE files RENAME COLUMN name TO file_name;
ALTER TABLE files ADD COLUMN owner_id BIGINT NOT NULL; -- DEFAULT 없이

-- ✅ expand-contract
ALTER TABLE files ADD COLUMN file_name TEXT;           -- 1단계
UPDATE files SET file_name = name;
-- (다음 배포) DROP COLUMN name;                        -- 2단계
```

### 4-5. CI/CD 파이프라인 (GitHub Actions)

**현재:** Push → build/push → Watchtower 12시간 폴링  
**변경:** Push → build/push → SSH to NAS → docker service update

```yaml
# .github/workflows/deploy.yml 추가 스텝
- name: Deploy to NAS
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.NAS_HOST }}
    username: ${{ secrets.NAS_USER }}
    key: ${{ secrets.NAS_SSH_KEY }}
    port: ${{ secrets.NAS_SSH_PORT }}   # 커스텀 포트 사용
    script: |
      docker service update \
        --image ghcr.io/idenn207/terab-api:latest \
        --with-registry-auth \
        terab_api
      docker service update \
        --image ghcr.io/idenn207/terab-web:latest \
        --with-registry-auth \
        terab_web
```

**GitHub Secrets 추가 필요:**
- `NAS_HOST`: NAS 외부 IP 또는 도메인
- `NAS_USER`: SSH 사용자
- `NAS_SSH_KEY`: SSH 개인키
- `NAS_SSH_PORT`: 커스텀 SSH 포트

### 4-6. Home NAS SSH 보안

인터넷에 SSH를 노출하는 구성이므로 최소 보안 설정 필수:

```
# /etc/ssh/sshd_config
PasswordAuthentication no        # 키 인증만 허용
Port 22222                       # 기본 포트 변경 (예시)
PermitRootLogin no
```

GitHub Actions IP 대역으로 접근 제한 (NAS 방화벽 또는 DSM 보안 설정):
- GitHub Actions IP 범위: <https://api.github.com/meta> (hooks 항목)
- 해당 IP 대역만 SSH 포트 허용

### 4-7. 롤백

```bash
# 자동: 헬스체크 실패 시 Swarm이 자동 rollback
# 수동:
docker service rollback terab_api
docker service rollback terab_web

# 상태 확인
docker service ps terab_api --no-trunc
```

---

## 5. 초기 전환 절차 (최초 1회)

```bash
# 1. Docker Swarm 초기화
docker swarm init

# 2. ghcr.io 인증
docker login ghcr.io

# 3. 기존 Compose 스택 종료
docker compose down

# 4. Swarm 스택 배포
docker stack deploy -c docker-stack.yml terab --with-registry-auth

# 5. 상태 확인
docker service ls
docker service ps terab_api
```

---

## 6. 구현 범위 요약

| 항목 | 파일 | 내용 |
|---|---|---|
| 기동 안정화 | `application.yml` | Flyway retry, HikariCP timeout |
| 기동 안정화 | `Dockerfile` | wait-for-it.sh entrypoint 추가 |
| Swarm 전환 | `docker-stack.yml` | docker-compose.yml 대체 |
| 자동 배포 | `.github/workflows/deploy.yml` | SSH deploy 스텝 추가, Watchtower 제거 |
| 보안 | NAS 설정 | SSH 키 인증, 커스텀 포트, IP 제한 |

# Docker Secrets 적용 설계

**날짜:** 2026-04-07  
**브랜치:** feat/zero-downtime-deployment  
**목적:** Docker Swarm에서 `${}` 환경변수 미치환 문제 해결 + 운영 표준 시크릿 관리 적용

---

## 배경 및 문제

`docker stack deploy`는 `docker-compose`와 달리 `.env` 파일을 자동으로 로드하지 않는다.  
`${DB_DATA_PATH}` 등이 빈 문자열로 처리되어 아래 오류가 발생:

```
'Volumes[0]' invalid spec: :/var/lib/postgresql/data: empty section between colons
```

---

## 적용 방식: Docker Secrets + Entrypoint Wrapper

### 시크릿 분류

| 구분 | 항목 | 처리 방식 |
|------|------|----------|
| 민감 (시크릿) | DB_PASSWORD | `docker secret create terab_db_password` |
| 민감 (시크릿) | MINIO_PASSWORD (= MINIO_SECRET_KEY) | `docker secret create terab_minio_password` |
| 민감 (시크릿) | JWT_SECRET | `docker secret create terab_jwt_secret` |
| 비민감 | DB_NAME, DB_USER, MINIO_USER, MINIO_BUCKET, JWT_EXPIRATION_MS | stack 파일에 직접 기입 |
| 경로 (고정값) | DB_DATA_PATH, MINIO_DATA_PATH, NGINX_CONF_PATH | stack 파일에 하드코딩 |

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `docker-stack.yml` | secrets 블록 추가, `_FILE` 환경변수 적용, 경로 하드코딩 |
| `services/api/Dockerfile` | `docker-entrypoint.sh` 복사 및 ENTRYPOINT 교체 |
| `services/api/docker-entrypoint.sh` | 신규 - 시크릿 파일 검증 + env 변환 후 앱 기동 |
| `scripts/check-secrets.sh` | 신규 - 배포 전 Swarm 시크릿 등록 여부 확인 |
| `.env` | 시크릿 값 제거, 로컬 개발 전용 파일로 목적 분리 |

---

## 상세 설계

### 1. Docker Secrets 등록 (NAS에서 1회 실행)

```bash
echo "<DB_PASSWORD>"    | docker secret create terab_db_password -
echo "<MINIO_PASSWORD>" | docker secret create terab_minio_password -
echo "<JWT_SECRET>"     | docker secret create terab_jwt_secret -
```

### 2. `docker-stack.yml` 변경

**db 서비스:**
```yaml
environment:
  POSTGRES_DB: terab_db
  POSTGRES_USER: terab_user
  POSTGRES_PASSWORD_FILE: /run/secrets/terab_db_password  # 네이티브 지원
secrets:
  - terab_db_password
volumes:
  - /volume2/docker/terab/volumes/db:/var/lib/postgresql/data  # 하드코딩
```

**minio 서비스:**
```yaml
environment:
  MINIO_ROOT_USER: minioadmin
  MINIO_ROOT_PASSWORD_FILE: /run/secrets/terab_minio_password  # 네이티브 지원
secrets:
  - terab_minio_password
volumes:
  - /volume1/storage:/data  # 하드코딩
```

**api 서비스:**
```yaml
environment:
  DB_URL: jdbc:postgresql://db:5432/terab_db
  DB_USER: terab_user
  MINIO_ENDPOINT: http://minio:9000
  MINIO_ACCESS_KEY: minioadmin
  MINIO_BUCKET: terab-files
  JWT_EXPIRATION_MS: 86400000
  # DB_PASSWORD, MINIO_SECRET_KEY, JWT_SECRET → entrypoint wrapper가 주입
secrets:
  - terab_db_password
  - terab_minio_password
  - terab_jwt_secret
```

**최하단 secrets 블록:**
```yaml
secrets:
  terab_db_password:
    external: true
  terab_minio_password:
    external: true
  terab_jwt_secret:
    external: true
```

### 3. `services/api/docker-entrypoint.sh` (신규)

```sh
#!/bin/sh
set -e

# 레이어 2: 시크릿 파일 마운트 검증
REQUIRED_SECRET_FILES="terab_db_password terab_minio_password terab_jwt_secret"
for f in $REQUIRED_SECRET_FILES; do
  [ -f "/run/secrets/$f" ] || { echo "FATAL: secret '$f' not mounted"; exit 1; }
done

# 시크릿 파일 → 환경변수 변환
export DB_PASSWORD=$(cat /run/secrets/terab_db_password)
export MINIO_SECRET_KEY=$(cat /run/secrets/terab_minio_password)
export JWT_SECRET=$(cat /run/secrets/terab_jwt_secret)

exec wait-for-it.sh db:5432 --timeout=60 -- java -jar app.jar
```

### 4. `services/api/Dockerfile` 변경

```dockerfile
# wrapper 스크립트 추가 (USER 전환 전, root 권한으로)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
```

### 5. `scripts/check-secrets.sh` (신규)

```bash
#!/bin/bash
# 배포 전 Swarm 시크릿 등록 여부 확인
REQUIRED_SECRETS=("terab_db_password" "terab_minio_password" "terab_jwt_secret")
MISSING=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  docker secret inspect "$secret" > /dev/null 2>&1 || MISSING+=("$secret")
done

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "ERROR: 누락된 시크릿: ${MISSING[*]}"
  echo "등록 방법: echo '<value>' | docker secret create <name> -"
  exit 1
fi
echo "모든 시크릿 확인 완료. 배포를 진행합니다."
```

### 6. 배포 흐름

```bash
# NAS SSH 접속 후
./scripts/check-secrets.sh && \
docker stack deploy -c docker-stack.yml terab --with-registry-auth
```

---

## 검증 포인트

- [ ] `docker secret ls`에서 3개 시크릿 확인
- [ ] `docker stack deploy` 시 volume 오류 없음
- [ ] `docker service logs terab_api`에서 "FATAL: secret" 메시지 없음
- [ ] API `/actuator/health` 200 응답
- [ ] MinIO 콘솔 로그인 정상
- [ ] PostgreSQL `pg_isready` 통과

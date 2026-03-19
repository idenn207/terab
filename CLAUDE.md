# 프로젝트 개요

NAS 전용 커스텀 클라우드 스토리지 서비스 (오픈소스).
파일 업로드/다운로드, 공유 기능을 제공하며, 미디어 스트리밍은 별도 마이크로서비스로 확장 예정.
현재는 개인/가족/친구 단위 소규모 사용자 대상.

## 인프라

| 레이어 | 기술 |
| ------ | ---- |
| Backend | Spring Boot 3.3 (Java 21, Gradle) |
| Frontend | React 19 (TypeScript, Vite) |
| Storage | MinIO (S3 호환) |
| Database | PostgreSQL 16 |
| Infra | Docker Compose, Nginx (리버스 프록시) |

### 디렉토리 구조

```text
nas-drive/
├── services/
│   ├── api/          # Spring Boot 백엔드
│   ├── web/          # React 프론트엔드
│   └── nginx/        # Nginx 설정
├── volumes/          # Docker 볼륨 (DB, 스토리지)
├── docker-compose.yml        # 운영 (전체 서비스)
└── docker-compose.local.yml  # 로컬 개발 (DB + MinIO만)
```

## 빌드 & 실행

### 로컬 개발 환경

```bash
# 인프라 (DB + MinIO) 실행
docker-compose -f docker-compose.local.yml up -d

# 백엔드 실행
cd services/api && ./gradlew bootRun

# 프론트엔드 실행
cd services/web && npm run dev
```

### 운영 환경

```bash
docker-compose -f docker-compose.yml up -d
```

### 테스트

```bash
# 백엔드 단위 + Slice 테스트
cd services/api && ./gradlew test

# 백엔드 통합 테스트 (Testcontainers)
cd services/api && ./gradlew integrationTest

# 백엔드 전체 (unit + integration)
cd services/api && ./gradlew check

# 프론트엔드 테스트
cd services/web && npm test

# 프론트엔드 워치 모드
cd services/web && npm run test:watch
```

## 코딩 규칙

### 공통

- 커밋 메시지: **Conventional Commits** 준수 (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- 라이브러리/프레임워크 문법이 불확실할 때는 **Context7 플러그인**으로 최신 공식 문서를 조회하여 확인
- Claude가 실수하거나 개발 완료/수정사항이 생겼을 때 **CLAUDE.md도 함께 업데이트**
- 주요 파일(`docker-compose.yml`, `build.gradle`, `CLAUDE.md` 등 핵심적이고 자주 바뀌지 않는 파일) 수정 시 **반드시 사용자에게 수정 이유를 먼저 확인**받을 것

### Frontend (React/TypeScript)

- 린터/포매터: **ESLint + Prettier**
- 테스트: Vitest + React Testing Library
- 패키지 매니저: npm
- 디렉토리 구조: _미정 (추후 확정)_

### Backend (Spring Boot/Java)

- DB 마이그레이션: Flyway (`src/main/resources/db/migration/`)
- 테스트: JUnit 5 + Testcontainers (통합 테스트는 `src/intTest/`)
- 보일러플레이트: Lombok 사용
- 포매터: _미정 (추후 확정)_
- 패키지 구조: _미정 (추후 확정)_

### 문서

- Markdown 린터: markdownlint

## 환경변수

- `.env` 파일에 평문 비밀값 직접 기록 금지
- 변수명은 `docker-compose.yml`과 통일
- Spring 프로필 최소화, `set -a` 필수

## 워크플로우

### 브랜치 전략

```text
feature/* ──→ dev ──→ PR ──→ master
hotfix/*  ──→ dev ──→ PR ──→ master
```

- 모든 변경은 반드시 `dev` 브랜치를 거쳐 `master`로 PR
- hotfix도 예외 없이 `dev`를 경유

### 배포

- **현재**: 로컬 Docker Desktop 개발 서버
- **Beta 이후**: NAS에 직접 배포 + 초기 설정
- **이후**: GitHub Actions 자동 배포 (master 브랜치 변경 감지), 점진적 배포 방식

### CI/CD

- _추가 예정_

## 도메인 용어

기획 확정 후 작성 예정

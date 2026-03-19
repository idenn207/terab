# 프로젝트 개요

NAS 전용 커스텀 클라우드 스토리지 서비스 (오픈소스).
파일 업로드/다운로드, 공유 기능을 제공하며, 미디어 스트리밍은 별도 마이크로서비스로 확장 예정.
현재는 개인/가족/친구 단위 소규모 사용자 대상.

## 인프라

| 레이어   | 기술                                  |
| -------- | ------------------------------------- |
| Backend  | Spring Boot 3.3 (Java 21, Gradle)     |
| Frontend | React 19 (TypeScript, Vite)           |
| Storage  | MinIO (S3 호환)                       |
| Database | PostgreSQL 16                         |
| Infra    | Docker Compose, Nginx (리버스 프록시) |

### 디렉토리 구조

```text
nas-drive/
├── services/
│   ├── api/          # Spring Boot 백엔드
│   ├── web/          # React 프론트엔드
│   └── nginx/        # Nginx 설정
├── volumes/          # Docker 볼륨 (DB, 스토리지)
├── Makefile                  # 빌드/실행 단축 명령
├── docker-compose.yml        # 운영 (전체 서비스)
└── docker-compose.local.yml  # 로컬 개발 (DB + MinIO만)
```

## 빌드 & 실행

프로젝트 루트의 `Makefile`을 통해 모든 명령을 실행합니다.

### 로컬 개발 환경

```bash
make infra          # 인프라 (DB + MinIO) 실행
make infra-down     # 인프라 중지
make api            # 백엔드 실행 (.env.local 자동 로드)
make web            # 프론트엔드 실행
```

### 운영 환경

```bash
make up             # 전체 서비스 실행
make down           # 전체 서비스 중지
```

### 테스트

```bash
make test                # 전체 테스트 (백엔드 + 프론트엔드)
make test-api            # 백엔드 전체 (unit + integration)
make test-api-unit       # 백엔드 단위 + Slice 테스트
make test-api-integration  # 백엔드 통합 테스트 (Testcontainers)
make test-web            # 프론트엔드 테스트
```

## 코딩 규칙

### 공통

- 파일 생성 시 줄바꿈은 **CRLF** 방식 사용
- 커밋 메시지: **Conventional Commits** 준수 (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- 라이브러리/프레임워크 문법이 불확실할 때는 **Context7 플러그인**으로 최신 공식 문서를 조회하여 확인
- Claude가 실수하거나 개발 완료/수정사항이 생겼을 때 **CLAUDE.md도 함께 업데이트**
- 주요 파일(`docker-compose.yml`, `build.gradle`, `CLAUDE.md` 등 핵심적이고 자주 바뀌지 않는 파일) 수정 시 **반드시 사용자에게 수정 이유를 먼저 확인**받을 것

### Frontend (React/TypeScript)

- 린터/포매터: **ESLint + Prettier**
- 코드 작성 시 세미콜론(`;`)을 **반드시** 사용
- 코드 작성/수정 전 **Prettier · ESLint 설정 파일을 검토**하여 현재 규칙에 맞게 작성
- 테스트: Vitest + React Testing Library
- 패키지 매니저: npm
- 디렉토리 구조: _미정 (추후 확정)_

### Backend (Spring Boot/Java)

- DB 마이그레이션: Flyway (`src/main/resources/db/migration/`)
- 테스트: JUnit 5 + Testcontainers (통합 테스트는 `src/intTest/`)
- 보일러플레이트: Lombok 사용
- 포매터: _미정 (추후 확정)_
- 패키지 구조: _미정 (추후 확정)_

### Notion 페이지 작성

- **사용자 승인 없이 Notion API 호출 금지** — 반드시 초안을 보여주고 승인 후 적용
- 개발항목/마일스톤 생성 시 필수 항목이 누락되면 **먼저 사용자에게 확인**
- 페이지 구조: `개요 → 변경 내용 → 관련 파일` 순서
- Notion 마크다운 스펙 준수 (테이블은 `<table>` 태그, 실제 줄바꿈 사용)
- 상세 규칙은 `.claude/rules/` 참조:
  - `notion-content-style.md` — 콘텐츠 작성 스타일 및 절차
  - `notion-dev-item.md` — 개발항목 필수/선택 항목 및 생성 워크플로우
  - `notion-milestone.md` — 마일스톤 필수/선택 항목
- **셀프 검토 체크리스트** (Notion API 호출 후 반드시 수행):
  1. 워크플로우 절차를 순서대로 수행했는가? (필수 항목 확인 → 초안 검토 → 승인 → 적용)
  2. 필수 속성(마일스톤, 마감일, 상태, 우선순위, 규모)에 비어있는 항목이 없는가?
  3. API 응답에서 오류가 발생하지 않았는가?
  4. 콘텐츠가 `notion-content-style.md` 템플릿 구조(개요 → 변경 내용 → 관련 파일)를 따르는가?
  5. Notion 마크다운 스펙을 준수했는가? (테이블 `<table>` 태그, 실제 줄바꿈 등)

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

### PR 프로세스

- PR 생성 시 `.claude/rules/pr-process.md`의 워크플로우를 **반드시** 순서대로 따를 것
- PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md` 템플릿 구조를 준수
- 라벨은 `.github/release.yml` 카테고리와 연동 — 커밋 프리픽스 기반으로 자동 매핑
- 머지 방식: **Squash merge** 권장

### 배포

- **현재**: 로컬 Docker Desktop 개발 서버
- **Beta 이후**: NAS에 직접 배포 + 초기 설정
- **이후**: GitHub Actions 자동 배포 (master 브랜치 변경 감지), 점진적 배포 방식

### CI/CD

- _추가 예정_

## 도메인 용어

기획 확정 후 작성 예정

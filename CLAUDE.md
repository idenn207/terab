# CLAUDE.md

## 프로젝트 개요

NAS에서 동작하는 셀프호스팅 파일 관리 서비스.

| 레이어 | 기술 |
|--------|------|
| API | Spring Boot 4.x / Java 25 |
| Web | React 19 + Vite / TypeScript |
| Mobile | Capacitor (Android WebView) |
| Notification MS | Spring Boot 4.x / RabbitMQ + Firebase FCM |
| DB | PostgreSQL 16 |
| Object Storage | MinIO (S3 호환) |
| 인프라 | Docker Swarm + Nginx |

### 주요 명령어

**로컬 개발**
```bash
make setup-local  # 최초 클론 후 1회 실행 (local.env → properties 변환)
make infra        # DB/MinIO 컨테이너 기동
make api          # API 개발 서버 실행
make web          # Web 개발 서버 실행
make notification # Notification MS 개발 서버 실행
```

**운영 (NAS)**
```bash
make setup        # Docker Config/Secret 등록 (configs.env + secrets.env 필요)
make stack-deploy # Docker Swarm 스택 배포
make stack-update # API/Web 이미지 롤링 업데이트
make stack-rm     # 스택 제거
```

## 디렉토리 구조

```
services/
  api/          # Spring Boot — 세부 컨벤션은 services/api/CLAUDE.md 참조
  web/          # React + Vite — 세부 컨벤션은 services/web/CLAUDE.md 참조
  notification/ # Notification MS (RabbitMQ + FCM) — 별도 Spring Boot 서비스
  nginx/        # 리버스 프록시 설정
docs/           # 기획/설계 문서
scripts/        # 빌드/배포 자동화 스크립트
.worktrees/     # Git worktree 작업 디렉토리 (커밋 대상 제외)
```

## 도메인 용어

코드, 주석, 커밋 메시지에서 아래 명칭을 일관되게 사용한다.

| 한글 | 영문 (코드) | 설명 |
|------|------------|------|
| 파일 | File | 사용자가 업로드한 개별 파일 |
| 폴더 | Folder | 파일을 담는 디렉토리 단위 |
| 드라이브 | Drive | 사용자에게 할당된 최상위 저장 공간 |
| 사용자 | User | 서비스 계정 |
| 권한 | Permission | 파일/폴더에 대한 접근 권한 |
| 역할 | Role | RBAC 기반 사용자 역할 |
| 공유 | Share | 파일/폴더를 타 사용자에게 공유하는 행위 |

## 코드 컨벤션

> 세부 규칙은 `services/api/CLAUDE.md`, `services/web/CLAUDE.md` 참조.

### 공통 원칙

- 인코딩: UTF-8
- 줄바꿈: 기본 CRLF (Windows 개발 환경, EOL은 `.gitattributes`로 명시) — Linux 환경에서 실행되는 파일은 LF 사용 (아래 기준 참조)
- 코드 식별자(변수명, 함수명, 파일명, 브랜치명)는 영어로 작성
- 네이밍은 역할이 명확히 드러나도록 작성 (약어 지양)
- 매직 넘버/문자열은 상수로 추출
- 함수/메서드는 단일 책임 원칙 준수

### 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 스펙을 따른다.

- subject는 한글 작성, 명사형 또는 동사 원형으로 종결
- 예: `feat: 파일 업로드 API 추가`, `fix: 토큰 갱신 오류 수정`

### 브랜치 네이밍

```
<type>/<short-description>
```

- type은 커밋 컨벤션과 동일 (`feat`, `fix`, `chore` 등)
- description은 영어, kebab-case
- 예: `feat/file-upload`, `fix/token-refresh-error`

## 주석 정책

- 코드 자체가 의도를 설명해야 한다 — 주석은 **왜(why)**를 설명할 때만 작성
- 무엇을(what) 설명하는 주석은 작성하지 않는다
- 주석은 한글로 작성한다
- 잘못된 예: `// 유저 목록을 가져온다`
- 올바른 예: `// 만료된 토큰도 포함 — 관리자 감사 로그 요건`
- `/** */` 패턴 규칙은 각 서비스 CLAUDE.md에서 정의한다

## Claude 행동 지침

### 페르소나

- 유지보수성·성능·실무 표준을 중심으로 판단하는 시니어 개발자로 행동한다
- 더 나은 패턴·구조가 있다면 구현 전 계획 단계에서 먼저 제안한다
- 유지보수성 또는 성능 향상이 명확하고 실무/운용 표준에 부합한다면
  기존 패턴과 달라도 해당 방향으로 진행한다
- 변경 범위가 커질 경우 영향 범위를 먼저 설명하고 사용자 확인 후 진행한다
- 코드 스타일(네이밍, 포맷)은 기존 코드와 일관성을 유지한다

### 코드 작성 spec

- 코드 작성·수정 전 반드시 해당 파일과 인접 파일을 읽고 기존 스타일을 파악한다
- 새 코드는 주변 코드의 네이밍, 구조, 패턴을 그대로 따른다
- 요청 범위를 벗어난 리팩토링, 주석 추가, 기능 확장 금지
- 기존 파일의 설정값(비밀번호, 포트 등)을 추측이나 예시값으로 덮어쓰기 금지
- 보안에 민감한 파일(`*.env`, `secrets.*`, `application-*.properties`) 수정 전 반드시 확인
- 새 파일 생성 시 줄바꿈은 기본 CRLF; 단, 아래 조건 중 하나라도 해당하면 LF로 저장한다
  - Docker 이미지 빌드에 포함되는 파일 (`Dockerfile`, 컨테이너 내 shell script 등)
  - GitHub Actions / CI runner에서 직접 실행되는 파일 (`.github/workflows/*.yml`, `scripts/*.sh` 등)
  - Linux 서버에서 직접 실행되는 shell script

### 응답

- 기본 응답 언어는 한글
- 코드 블록 내 식별자·명령어는 영어 그대로 유지

### Git

- 커밋은 사용자 명의로만 생성 (`Co-Authored-By` 태그 추가 금지)
- 파괴적인 Git 명령(`reset --hard`, `push --force`, `branch -D`)은 사용자 명시 요청 시에만 실행

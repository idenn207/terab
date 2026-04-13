# CLAUDE.md 설계 문서

**작성일**: 2026-04-14  
**대상 파일**: `/CLAUDE.md` (루트)  
**범위**: 프로젝트 전체 공통 설정. API/Web 세부 컨벤션은 각 서비스 CLAUDE.md에서 별도 구현.

---

## 목표

Claude Code가 terab 프로젝트에서 일관된 코드 품질, 올바른 도메인 용어, 프로젝트 컨텍스트를 바탕으로 작업할 수 있도록 루트 수준의 공통 지침을 제공한다.

---

## 구조 결정

**방식 A — 컨텍스트 우선형** 채택.

```
프로젝트 개요 → 디렉토리 구조 → 도메인 용어 → 코드 컨벤션 → 주석 정책 → Claude 행동 지침
```

Claude가 위에서부터 읽으며 프로젝트를 이해한 뒤 규칙을 적용하는 흐름.  
섹션이 명확히 분리되어 서비스별 CLAUDE.md와 일관성 유지가 용이하다.

---

## 섹션별 설계

### 섹션 1: 프로젝트 개요 & 디렉토리 구조

- 스택 테이블: API(Spring Boot 3.x / Java 21), Web(React 19 + Vite), DB(PostgreSQL 16), Object Storage(MinIO), 인프라(Docker Swarm + Nginx)
- 로컬 명령어: `make setup-local`, `make infra`, `make api`, `make web`
- 운영 명령어: `make setup`, `make stack-deploy`, `make stack-update`, `make stack-rm`
- 디렉토리: `services/api`, `services/web`, `services/nginx`, `docs`, `scripts`, `.worktrees`
- 각 서비스 CLAUDE.md 참조 링크 명시

### 섹션 2: 도메인 용어

- 비즈니스 용어 한/영 대응표
- 코드·주석·커밋 메시지에서 통일 사용
- 확정 용어: 파일(File), 폴더(Folder), 드라이브(Drive), 사용자(User), 권한(Permission), 역할(Role), 공유(Share)

### 섹션 3: 코드 컨벤션 (공통)

- 인코딩: UTF-8
- 줄바꿈: CRLF (Windows 개발 환경, `.gitattributes`로 EOL 명시)
- 코드 식별자(변수명, 함수명, 파일명, 브랜치명): 영어
- 네이밍: 역할이 명확히 드러나도록, 약어 지양
- 매직 넘버/문자열: 상수 추출
- 함수/메서드: 단일 책임 원칙
- 커밋: [Conventional Commits](https://www.conventionalcommits.org/) 스펙, subject 한글
- 브랜치: `<type>/<short-description>` (영어, kebab-case)

### 섹션 4: 주석 정책

- 최소주의: 코드가 의도를 설명해야 함
- **왜(why)**를 설명할 때만 주석 작성, **무엇(what)**은 작성하지 않음
- 주석 언어: 한글
- `/** */` 패턴 규칙: 각 서비스 CLAUDE.md에서 정의 (API: Javadoc, Web: JSDoc)

### 섹션 5: Claude 행동 지침

**페르소나**
- 유지보수성·성능·실무 표준 중심으로 판단하는 시니어 개발자
- 더 나은 패턴·구조는 구현 전 계획 단계에서 먼저 제안
- 유지보수성/성능 향상이 명확하고 실무 표준에 부합하면 기존 패턴과 달라도 진행
- 변경 범위가 커질 경우 영향 범위 설명 후 사용자 확인
- 코드 스타일(네이밍, 포맷)은 기존 코드와 일관성 유지

**코드 작성 spec**
- 작성·수정 전 해당 파일과 인접 파일을 읽고 기존 스타일 파악
- 새 코드는 주변 코드의 네이밍, 구조, 패턴을 따름
- 요청 범위 외 리팩토링·주석 추가·기능 확장 금지
- 기존 설정값(비밀번호, 포트 등) 추측/예시값 덮어쓰기 금지
- 보안 민감 파일 수정 전 확인

**응답**
- 기본 응답 언어: 한글
- 코드 블록 내 식별자·명령어: 영어 유지

**Git**
- 커밋: 사용자 명의만 (`Co-Authored-By` 태그 금지)
- 파괴적 Git 명령: 사용자 명시 요청 시에만 실행

---

## 제약 조건

- 200줄 이내
- 전체 한글 작성 (코드 식별자·명령어 제외)
- API/Web 세부 컨벤션은 각 서비스 CLAUDE.md에 위임

# Notion ↔ 로컬 파일 동기화

Notion NAS Drive 서비스 페이지의 기획 산출물을 로컬 `docs/planning/` 디렉토리와 동기화합니다.
Notion을 최종본으로 간주하여 로컬 파일을 갱신합니다.

---

## 동작 절차

### 1단계: Notion 기획 산출물 조회

- NAS Drive 서비스 페이지(`327ada16-6d60-8115-9ae4-fb102c0ce339`) 하위 페이지를 조회
- 기획 산출물 페이지들의 콘텐츠를 가져옴

### 2단계: 로컬 파일과 비교

아래 파일들을 Notion 페이지와 대조:

| 로컬 파일 | Notion 페이지 |
|---|---|
| `docs/planning/service-overview.md` | 서비스 개요/Lean Canvas |
| `docs/planning/personas.md` | 페르소나 |
| `docs/planning/requirements.md` | 요구사항 정의서 |
| `docs/planning/user-stories.md` | 유저 스토리 맵 |
| `docs/planning/architecture.md` | 시스템 아키텍처 |
| `docs/planning/user-flow.md` | 유저/서비스 플로우 |
| `docs/planning/information-architecture.md` | 정보 구조 (IA) |
| `docs/planning/screen-spec.md` | 화면 명세 |
| `docs/planning/milestones.md` | 마일스톤 계획 |
| `docs/planning/release-plan.md` | 릴리스 전략 |

### 3단계: 로컬 파일 갱신

- Notion 내용이 로컬 파일과 다르면 Notion 기준으로 로컬 파일 덮어쓰기
- Notion에 존재하지만 로컬에 없는 산출물은 새로 생성
- 로컬에 존재하지만 Notion에 없는 파일은 삭제하지 않고 사용자에게 보고

### 4단계: 결과 보고

변경된 파일 목록을 사용자에게 보고:
- 갱신된 파일
- 새로 생성된 파일
- Notion에 없는 로컬 파일 (있는 경우)
- 변경 없는 파일

## 참조

- **Notion 규칙**: `.claude/rules/notion-content-style.md`
- **마일스톤 DB**: `35b2ebc8e1a546439ee605c72dc6aa3a`
- **개발 항목 DB**: `3c4689194a6c47a2adb174990771d10a`

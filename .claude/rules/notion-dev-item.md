---
description: Notion 개발항목 생성/수정 시 적용
globs:
---

# Notion 개발항목 작성 규칙

## 생성 워크플로우

> **절대 규칙**: 아래 단계를 순서대로 수행할 것. 단계를 건너뛰거나 한 번에 처리 금지.

### 1단계: 필수 항목 확인

사용자가 개발항목 추가를 요청할 때 아래 항목이 명시되지 않았으면 **먼저 질문**할 것:

- **마일스톤** — 어떤 마일스톤에 연결할지 (최신 목록은 Notion DB에서 조회)
- **마감일** — 언제까지 완료 목표인지
- **상태** — 시작 전 / 진행 중 / 완료
- **우선순위** — 긴급 / 높음 / 보통 / 낮음
- **규모** — XS (< 1h) / S (1-3h) / M (3-8h) / L (1-2d) / XL (3d+)

### 2단계: 콘텐츠 초안 작성 및 검토

- 속성 + 상세 콘텐츠 초안을 텍스트로 정리하여 사용자에게 보여줄 것
- `notion-content-style.md` 의 페이지 구조 템플릿을 따를 것
- **사용자 승인 없이 Notion API 호출 금지**

### 3단계: Notion 적용

- `notion://docs/enhanced-markdown-spec` 리소스를 조회하여 문법 확인
- 승인된 내용으로 Notion API 호출

## 선택 항목

- **유형** — 기능 / 버그 / 리팩토링 / 작업 / 조사
- **카테고리** — Backend API / Frontend / Infrastructure / Database / Security / Documentation
- **태그** — test, auth, file-ops, upload, UI, API, docker, migration, MinIO, github
- **메모** — 변경 사항 요약
- **완료 여부** — 체크박스

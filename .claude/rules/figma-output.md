---
description: Figma 기반 UX/UI 산출물 작성 시 적용
globs:
---

# Figma 출력 가이드라인

## 개요

서비스 기획 에이전트(`/plan-service`)의 UX/UI 설계 및 다이어그램 출력 단계에서
Figma MCP 도구를 활용하는 절차와 규칙을 정의한다.

## Figma MCP 도구 현황

### 기획 단계 활용 도구

| 구분 | 도구 | 용도 | 활용 시점 |
|------|------|------|-----------|
| 인증 | `whoami` | 연결 상태 및 플랜 정보 확인 | 작업 시작 전 |
| 읽기 | `get_design_context` | 디자인 구조/레이아웃/색상/타이포 조회 | 기존 디자인 참조 시 |
| 읽기 | `get_screenshot` | 선택 영역 스크린샷 캡처 | 디자인 검증/비교 시 |
| 읽기 | `get_metadata` | 레이어 구조(XML) 조회 | 대규모 디자인 분석 시 |
| 읽기 | `get_variable_defs` | 디자인 변수(색상, 간격, 타이포) 조회 | 디자인 시스템 참조 시 |
| 읽기 | `get_figjam` | FigJam 다이어그램 메타데이터 조회 | 기존 FigJam 참조 시 |
| 쓰기 | `generate_diagram` | Mermaid → FigJam 다이어그램 생성 | 플로우/아키텍처 시각화 시 |
| 쓰기 | `generate_figma_design` | 웹 페이지를 Figma 디자인으로 변환 | UI 프로토타입 생성 시 |
| 설정 | `create_design_system_rules` | 디자인 시스템 규칙 파일 생성 | 프로젝트 초기 설정 시 |

### 구현 단계 전용 도구 (기획 단계에서 사용하지 않음)

| 도구 | 용도 |
|------|------|
| `get_code_connect_map` | Figma 노드 ↔ 코드 컴포넌트 매핑 조회 |
| `add_code_connect_map` | 매핑 생성 |
| `get_code_connect_suggestions` | Code Connect 매핑 제안 |
| `send_code_connect_mappings` | Code Connect 매핑 확정 |

## 도구 가용성 확인

Figma MCP 도구는 항상 사용 가능하지 않을 수 있다.

1. 작업 시작 전 `whoami` 도구 호출로 연결 상태 확인
2. 도구를 사용할 수 없는 경우 **텍스트 기반 화면 명세**로 대체 (경로 B 참조)
3. 도구 호출 실패 시에도 동일하게 텍스트 폴백으로 전환
4. Rate limit 초과 시에도 경로 B로 전환

## 출력 워크플로우

> **절대 규칙**: Figma MCP 도구 가용 여부에 따라 아래 두 경로 중 하나를 따를 것. 경로를 건너뛰거나 혼합하지 않는다.

### 경로 A: Figma MCP 연동 시

#### 1단계: 연결 확인

- `whoami` 호출로 인증 상태 및 플랜 정보 확인
- 실패 시 경로 B로 전환

#### 2단계: 기존 Figma 파일 확인

- 사용자에게 기존 Figma 프로젝트/파일 URL이 있는지 확인
- 있으면 `get_metadata`로 기존 구조 파악 후 작업
- 없으면 새 디자인 생성 진행

#### 3단계: UX/UI 산출물 생성

용도에 따라 적절한 도구 선택:

- **와이어프레임/목업 참조**: `get_design_context` + `get_screenshot`
- **다이어그램 (플로우, IA 등)**: `generate_diagram` (Mermaid 입력)
- **웹 UI를 Figma로 캡처**: `generate_figma_design`
- **디자인 토큰 추출**: `get_variable_defs`

#### 4단계: 사용자 검토

- 생성/조회한 산출물을 사용자에게 보여주고 피드백 반영
- **사용자 승인 후 최종 확정**

#### 5단계: Figma 참조 정보 기록

- `docs/planning/figma-references.md`에 Figma URL, 페이지/프레임 매핑 기록 (아래 템플릿 참조)

### 경로 B: 텍스트 기반 폴백

Figma MCP를 사용할 수 없을 때 텍스트 기반 화면 명세로 대체한다.

#### 화면 명세 형식

`docs/planning/screen-spec.md`에 아래 구조로 작성:

```markdown
## [화면명]

### 화면 개요
- 목적: ...
- 진입 경로: ...
- 사용자: ...

### 레이아웃 구조
- 영역 구성 (헤더, 사이드바, 메인 콘텐츠, 푸터 등)
- 각 영역의 대략적 비율/위치

### 구성 요소
| 요소 | 타입 | 설명 | 상태 |
|------|------|------|------|
| ... | 버튼/입력/목록/... | ... | 기본/호버/비활성 |

### 인터랙션
- 사용자 액션 → 시스템 반응 목록

### 반응형 동작
- 데스크톱/태블릿/모바일 차이점
```

## Figma 참조 정보 파일

Figma(클라우드)와 로컬 `docs/planning/` 사이의 추적 파일이다.
Figma 작업 결과물이 생길 때마다 `docs/planning/figma-references.md`를 업데이트한다.

### 템플릿

```markdown
# Figma 참조 정보

| 산출물 | Figma 파일 URL | 페이지/프레임 | 설명 | 최종 수정일 |
|---|---|---|---|---|
| (예시) 와이어프레임 - 메인 화면 | https://figma.com/design/... | UX/FileExplorer | 파일 탐색기 메인 | 2026-03-20 |
```

## Notion 연동

### Figma 산출물 → Notion 임베드

1. Figma 파일 URL을 확보 (Figma MCP 작업 결과 또는 사용자 제공)
2. NAS Drive 서비스 페이지 하위에 "UX/UI 설계" 페이지 생성
3. Notion 페이지 콘텐츠에 Figma 파일 링크를 embed 블록으로 삽입
4. `.claude/rules/notion-content-style.md` 규칙 준수

### FigJam 다이어그램 → Notion

1. `generate_diagram`으로 생성된 FigJam URL 확보
2. 해당 산출물(아키텍처, 유저 플로우 등)의 Notion 페이지에 embed

### 텍스트 폴백 → Notion

1. `docs/planning/screen-spec.md` 내용을 Notion 페이지로 변환
2. 화면별로 섹션을 나누어 구조적으로 작성
3. 추후 Figma 파일 생성 시 embed로 교체

## 네이밍 규칙

### Figma 파일 네이밍

- 프로젝트명: `NAS Drive`
- 페이지 네이밍: `[단계] - [내용]` (예: `UX - 와이어프레임`, `UI - 메인 화면`)
- 프레임 네이밍: PascalCase (예: `LoginPage`, `FileExplorer`, `UploadModal`)

### 로컬 파일

- 화면 명세 (텍스트 폴백): `docs/planning/screen-spec.md`
- Figma 참조 정보: `docs/planning/figma-references.md`

## 에셋 처리 규칙

- Figma MCP가 localhost URL로 이미지/SVG 에셋을 반환하면 **해당 URL을 직접 사용**
- 새 아이콘 패키지를 추가하지 않음 — 모든 에셋은 Figma 페이로드에 포함
- localhost 소스가 제공된 경우 **플레이스홀더를 생성하지 않음**

## Rate Limit

| 플랜 | 제한 | 비고 |
|------|------|------|
| Starter / View / Collab seat | 월 6회 | 읽기 도구에만 적용 |
| Dev / Full seat (Professional+) | 분당 제한 | Figma REST API Tier 1 동일 |

- `generate_figma_design`, `generate_diagram` 등 **쓰기 도구는 rate limit 면제**
- Rate limit 초과 시 자동으로 **경로 B(텍스트 폴백)** 로 전환

## 셀프 검토 체크리스트

> Figma MCP 도구 호출 후 반드시 수행

### 경로 A 사용 시

1. `whoami`로 연결 상태를 먼저 확인했는가?
2. 사용자에게 기존 Figma 파일 URL 여부를 확인했는가?
3. 용도에 맞는 도구를 선택했는가? (와이어프레임 → `get_design_context`, 다이어그램 → `generate_diagram` 등)
4. 쓰기 도구(`generate_figma_design`, `generate_diagram`) 호출 전 사용자 승인을 받았는가?
5. Figma MCP 도구 응답에서 오류가 발생하지 않았는가?
6. 에셋 처리 규칙을 준수했는가? (localhost URL 직접 사용, 플레이스홀더 미생성)
7. `docs/planning/figma-references.md`에 Figma URL과 프레임 매핑을 기록했는가?
8. Notion embed가 필요한 경우 `notion-content-style.md` 규칙을 준수했는가?

### 경로 B 사용 시

1. 경로 B 전환 사유가 명확한가? (MCP 미연결 / 도구 호출 실패 / Rate limit 초과)
2. `docs/planning/screen-spec.md`가 화면 명세 템플릿 구조를 따르는가? (화면 개요 → 레이아웃 → 구성 요소 → 인터랙션 → 반응형)
3. 구성 요소 테이블에 요소명, 타입, 설명, 상태가 모두 포함되어 있는가?
4. 텍스트 폴백 사유를 사용자에게 안내했는가?

### 공통

1. 산출물을 사용자에게 보여주고 승인을 받았는가?
2. 기획 단계에 맞는 수준인가? (와이어프레임 수준, 고해상도 목업은 별도 진행)
3. Rate limit 현황을 고려했는가? (Starter 플랜 월 6회 제한)
4. 구현 단계 전용 도구(Code Connect 관련)를 잘못 사용하지 않았는가?

## 주의사항

1. **Figma MCP 가용성은 보장되지 않음** — 항상 텍스트 폴백을 준비할 것
2. **사용자 승인 없이 Figma 파일 수정 금지** — `generate_figma_design` 등 쓰기 도구는 사용자 확인 후 호출
3. **기획 단계에서는 와이어프레임 수준** — 고해상도 목업은 UX/UI 설계 확정 후 별도 진행
4. **`frontend-design` 플러그인은 Figma MCP와 무관** — 코드 미학 가이드 플러그인이므로, Figma 파일 조작과 혼동하지 말 것
5. **대규모 디자인은 분할 처리** — 큰 선택 영역은 `get_metadata`로 구조를 먼저 파악한 뒤, 필요한 노드만 `get_design_context`로 조회
6. **Rate limit 초과 시 경로 B로 전환** — 추가 호출을 시도하지 않고 텍스트 기반 화면 명세로 대체

---
name: services-web-feature-parity-phase1-design-spike
description: services/web 기능 패리티 PRD의 Phase 1 — 디자인 방향 결정·토큰 분리·와이어프레임·UseCase 시나리오 N개 확정
status: done
created: 2026-05-26
---

# Plan: services/web Feature Parity — Phase 1 Design Spike

## Summary

services/web 기능 phase(2~10)가 디자인 결정에 흔들리지 않도록, **(a) 디자인 방향 1개 채택, (b) 디자인 토큰 분리, (c) 핵심 4화면 와이어프레임, (d) UseCase 시나리오 5~7개**를 한 번에 잠근다. 코드 변경은 토큰 분리(`tokens.css` 신규 + `index.css` 슬림화) 1건으로 최소화하고, 나머지는 모두 `docs/design/` 산하 문서 산출물이다.

## User Story

As **모바일↔PC 를 오가는 1인 개발자 본인**,
I want **디자인 방향·토큰·핵심 화면 와이어프레임·UseCase 가 spike 단계에서 한 번에 결정되기를**,
so that **Phase 2 이후 도메인 슬라이스 작업이 디자인 결정 변경으로 재작업 도미노를 일으키지 않는다**.

## Problem → Solution

**현재 상태**: `pages/drive/ui/Drive.tsx`(193행)와 `widgets/sidebar/ui/Sidebar.tsx`가 각각 다른 더미 사이드바("Tom Cook" / "Tera B")를 들고 공존. 디자인 방향이 미정이라 어느 것이 진짜인지 판정 불가. 디자인 토큰은 `src/index.css`의 `@theme` 블록에 평면적으로 묻혀있어 phase 진행 중 토큰만 갱신하는 회귀가 어려움.

**목표 상태**: 1개 디자인 방향 채택 + `shared/styles/tokens.css` 단일 토큰 진입점 + drive 페이지의 모바일/데스크톱 와이어프레임 + 자동화 가능한 UseCase N개. Phase 2가 Drive.tsx를 widgets로 분해할 때 의존할 reference가 모두 갖춰진 상태.

## Metadata

- **Complexity**: Small (코드 변경 토큰 1쌍, 나머지 산출물은 결정/문서)
- **Source PRD**: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)
- **PRD Phase**: Phase 1 — Design Spike
- **Estimated Files**: 7 (CREATE 5, UPDATE 2)
- **Estimated Duration**: 1~2일 (방향 비교 0.5일 + 토큰 분리 0.25일 + 와이어프레임 0.5일 + UseCase 0.5일)

---

## UX Design

이 phase는 사용자 대상 UI **변경이 없는** 결정/문서 단계다. 토큰 분리 전/후 모든 화면이 시각적으로 동일해야 한다 — 시각 회귀 0건이 검수 조건.

산출물 자체는 **후속 phase가 참조할 UX 정의**다:
- `docs/design/direction.md` — 채택안의 시각적 톤
- `docs/design/wireframes.md` — drive 페이지 모바일/데스크톱 레이아웃
- `docs/design/usecases.md` — Phase 6 E2E의 입력

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 사용자 화면 | (no change) | (no change) | 시각 회귀 0건이 검수 조건 |
| 디자인 토큰 진입점 | `src/index.css` `@theme` | `src/shared/styles/tokens.css` | Phase 2~10이 참조할 단일 출처 |
| 디자인 결정 근거 | 미문서화 | `docs/design/direction.md` | 후속 phase의 의사결정 reference |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md) | all | 디자인 방향 / UseCase 개수 / MVP one-liner — 모두 이 spike 의 input |
| P0 | [services/web/src/index.css](../../services/web/src/index.css) | 1-45 | 현재 토큰 진입점. `@theme` 블록 그대로 옮기는 게 1차 안전책 |
| P0 | [services/web/src/pages/drive/ui/Drive.tsx](../../services/web/src/pages/drive/ui/Drive.tsx) | 33-193 | 정적 템플릿 현 상태 — 와이어프레임은 이걸 대체할 형태로 그림 |
| P0 | [services/web/src/widgets/sidebar/ui/Sidebar.tsx](../../services/web/src/widgets/sidebar/ui/Sidebar.tsx) | all | 또 다른 더미 사이드바. Phase 2 정리 전에 와이어프레임이 통합 형태를 선언해야 함 |
| P1 | [.claude/rules/ecc/web/design-quality.md](../rules/ecc/web/design-quality.md) | all | "Anti-Template Policy" — 후보 4개 모두 default-looking 금지 기준에 부합해야 함 |
| P1 | [services/web/CLAUDE.md](../../services/web/CLAUDE.md) | 8-56, 304-400 | FSD 레이어 / `shared/ui/catalyst/` 무수정 정책 / Tailwind 4 토큰 규칙 |
| P1 | [services/web/src/shared/ui/catalyst/](../../services/web/src/shared/ui/catalyst/) | dir | Catalyst UI 컴포넌트 카탈로그 — 채택안이 표현 가능해야 함 |
| P2 | [docs/adr/INDEX.md](../../docs/adr/INDEX.md) | all | docs/ 산하 문서 컨벤션 (Nygard 5섹션 등) — design 문서가 따라야 할 형식 reference |
| P2 | [docs/spikes/](../../docs/spikes/) | dir | 기존 spike 문서 컨벤션 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Tailwind 4 `@theme` 토큰 | https://tailwindcss.com/docs/theme | `@theme` 블록의 `--color-*`/`--font-*`/`--spacing-*` 키가 그대로 utility class 로 노출. 토큰 이름 = utility 이름 |
| Catalyst UI 토큰 호환성 | services/web/src/shared/ui/catalyst/ 소스 | Catalyst 컴포넌트는 zinc-* 팔레트 + headlessui 기반. 채택안의 컬러 토큰은 zinc 의미가 유지되도록 매핑 필요 |
| design-quality.md 안티 패턴 | .claude/rules/ecc/web/design-quality.md "Banned Patterns" | 회피해야 할 default 패턴 8가지. 채택안 평가 표에 항목별 체크 필요 |

---

## Patterns to Mirror

### TOKEN_BLOCK
SOURCE: services/web/src/index.css:32-40
```css
@theme {
  --font-sans: 'Inter', sans-serif, system-ui;
  --font-sans--font-feature-settings: 'cv11';

  /* 모바일 */
  --spacing-safe-top: env(safe-area-inset-top);
  --spacing-safe-bottom: env(safe-area-inset-bottom);
}
```

### CSS_CUSTOM_PROPERTIES
SOURCE: .claude/rules/ecc/web/coding-style.md "CSS Custom Properties"
```css
:root {
  --color-surface: oklch(98% 0 0);
  --text-base: clamp(1rem, 0.92rem + 0.4vw, 1.125rem);
  --space-section: clamp(4rem, 3rem + 5vw, 10rem);
  --duration-normal: 300ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DOCS_FRONTMATTER
SOURCE: docs/adr/0001-ts-rest-removal-swagger-migration.md, .claude/plans/README.md
```yaml
---
name: kebab-slug-here
description: 한 줄 요약 (검색용)
status: pending | in-progress | done | archived
created: YYYY-MM-DD
---
```

### DOCS_LOCATION
SOURCE: docs/adr/, docs/audits/, docs/spikes/, docs/planning/ 패턴
- 도메인별 1개 디렉토리 + 내부 마크다운. 신규 도메인은 `docs/{topic}/` 신설 + 가능하면 INDEX.md 또는 README.md 1개

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `services/web/src/shared/styles/tokens.css` | CREATE | 디자인 토큰 단일 진입점 |
| `services/web/src/index.css` | UPDATE | `tokens.css` import + `@theme` 슬림화 (시각 회귀 0건 유지) |
| `docs/design/README.md` | CREATE | docs/design/ 디렉토리 목적·archive 정책·문서 색인 (1 페이지) |
| `docs/design/direction.md` | CREATE | 후보 비교 + 채택 + 근거 + 모바일-퍼스트 적용 가이드 |
| `docs/design/wireframes.md` | CREATE | drive 페이지 모바일/데스크톱 + 3개 추가 핵심 화면 |
| `docs/design/usecases.md` | CREATE | UseCase 시나리오 5~7개, 자동화 가능한 형태 |
| `.claude/prds/services-web-feature-parity.prd.md` | UPDATE | Phase 1 status = in-progress, PRP 칼럼 = 이 plan 경로 |

## NOT Building (Phase 1 out of scope)

- `widgets/sidebar` 와 `pages/drive` 코드 분해 — Phase 2 영역
- `widgets/drive-layout` / `widgets/drive-sidebar` 신설 — Phase 2 영역
- `entities/file` / `entities/folder` / `entities/trash` 신설 — Phase 2 영역
- 신규 `features/*` 슬라이스 — Phase 3+
- 사이드바 메뉴에서 "최근·즐겨찾기" 항목 실제 삭제 — Phase 2 영역 (와이어프레임에는 "삭제" 로 표기만)
- 채택안의 컴포넌트 단위 적용 — Phase 2 이후 features/widgets 작업에서 차차 적용
- iOS Capacitor 빌드 — PRD `Won't`
- Catalyst UI 컴포넌트 직접 수정 — 무수정 정책 ([services/web/CLAUDE.md L182](../../services/web/CLAUDE.md))

---

## Step-by-Step Tasks

### Task 1: 디자인 방향 후보 4개 평가표 작성
- **ACTION**: Editorial / Minimal / Glassmorphism / Bento 4개 후보를 평가 표로 비교
- **IMPLEMENT**: `docs/design/direction.md` Section 1 — 각 후보별 (a) 1-2 문장 설명, (b) 모바일 적합도, (c) Catalyst UI 호환도, (d) design-quality.md "Required Qualities" 10개 중 4개+ 충족 여부, (e) 1인 사용자 운영 비용
- **MIRROR**: DOCS_FRONTMATTER + docs/adr/ 의 5섹션 스타일 (Context / Decision / Status / Consequences / Alternatives)
- **IMPORTS**: 없음 (마크다운)
- **GOTCHA**: design-quality.md "Banned Patterns" 의 default card grid / 회색-white 도배 / library default 등은 후보 자체에서 배제. **본인 취향만으로 1개를 고르지 말고 평가 기준에 점수 부여**해서 후일 재검토 가능하게 남길 것
- **VALIDATE**: 4개 후보가 5개 평가 기준 모두에 대해 짧은 평가를 가짐. 점수 없는 칸 0개

### Task 2: 디자인 방향 1개 채택 + 근거 + 모바일-퍼스트 가이드
- **ACTION**: Task 1 평가표를 근거로 1개 채택, 채택 근거 1단락 + 모바일-퍼스트 적용 가이드 작성
- **IMPLEMENT**: `direction.md` Section 2 — 채택안 / 채택 근거 / Rejected 후보별 1줄 이유 / 모바일-퍼스트 적용 가이드 (sidebar 동작 / 타이포 스케일 / interaction 우선순위 / 다크모드 처리)
- **MIRROR**: docs/adr/0002-twofa-strategy-pattern.md "Decision" 섹션 — 채택안을 명사구로 한 줄 + 근거 단락
- **IMPORTS**: 없음
- **GOTCHA**: PRD "Decisions Log" 표에 행 추가가 PRD 변경을 수반 — Task 7 에서 한 번에 처리하므로 여기서는 PRD 건드리지 않음. **방향 변경 시 토큰 갱신으로 80% 흡수**가 채택안 기준 중 하나여야 함
- **VALIDATE**: 채택안이 design-quality.md "Required Qualities" 중 4개+ 충족 명시. Phase 2~10 각 phase별로 어떻게 적용될지 한 줄 가이드 포함

### Task 3: 디자인 토큰 파일 신규 생성
- **ACTION**: `services/web/src/shared/styles/tokens.css` 신규 생성
- **IMPLEMENT**: 토큰 카테고리 5개로 정리 — `--color-*` (zinc 스케일 + 채택안 accent), `--font-*` + `--text-*` (clamp 기반 fluid), `--space-*` (safe-area 포함), `--radius-*`, `--motion-duration-*` + `--motion-ease-*`. **현재 `index.css` `@theme` 블록의 모든 키를 무손실로 옮기되 누락 0건**
- **MIRROR**: TOKEN_BLOCK + CSS_CUSTOM_PROPERTIES 패턴. Tailwind 4 `@theme` 블록 형식 유지 (utility class 자동 노출)
- **IMPORTS**: 없음 (CSS)
- **GOTCHA**: Tailwind 4 의 `@theme` 키 이름이 utility class 명에 직결 — `--color-surface` 는 `bg-surface` 가 됨. **기존 zinc-* utility 가 깨지면 안 됨** → Catalyst UI 가 zinc 팔레트에 의존하므로 zinc-* 토큰은 건드리지 않고, 신규 토큰만 추가. `--font-sans--font-feature-settings: 'cv11'` 같은 modifier 키 형식 유지
- **VALIDATE**: `npm --prefix services/web run build` 통과. tokens.css 만 있는 상태에서 dev 서버 기동 → /login, /drive 시각 회귀 0건

### Task 4: src/index.css 슬림화 + tokens.css 연결
- **ACTION**: `src/index.css` 에서 `@theme {}` 블록 제거, `tokens.css` import 로 대체
- **IMPLEMENT**: `@import './shared/styles/tokens.css';` 를 `@import 'tailwindcss';` 바로 다음 줄에 추가. `@theme {}` 블록 삭제. `@custom-variant dark` 와 `html` 규칙은 유지
- **MIRROR**: TOKEN_BLOCK (이동만, 변형 금지)
- **IMPORTS**: CSS `@import`
- **GOTCHA**: import 순서 중요 — `tailwindcss` 가 먼저, `tokens.css` 가 다음. `@custom-variant dark (&:where(.dark, .dark *));` 는 글로벌 variant 정의이므로 `tokens.css` 로 옮기지 말고 `index.css` 에 남길 것
- **VALIDATE**: `npm --prefix services/web run build` 통과 + dev 서버에서 `/login`, `/drive`, `/register/:token` 3 개 화면이 토큰 분리 전 스크린샷과 픽셀 동일 (수동)

### Task 5: drive 페이지 와이어프레임 + 핵심 4화면
- **ACTION**: `docs/design/wireframes.md` 작성 — drive 페이지 모바일(<=768) / 데스크톱(>=1024) 와이어프레임 + 추가 3 화면(login, upload-flow, preview)
- **IMPLEMENT**: ASCII 박스 표기 사용. 각 화면은 (a) breakpoint 명시, (b) 영역 라벨(sidebar / toolbar / list / grid / preview / footer), (c) 들어갈 features 슬라이스 이름(미래 Phase 3+)
- **MIRROR**: PRD "User Flow (Critical Path)" 의 ASCII 흐름 표기 스타일
- **IMPORTS**: 없음
- **GOTCHA**: PRD 가 "최근/즐겨찾기 sidebar 항목 제거" 명시 — 와이어프레임 sidebar 에 이 항목 누락. **모바일에서 sidebar 는 drawer 형태**, **데스크톱에서 collapsed icon-only 또는 full** — Drive.tsx 현 구현이 이미 모바일=drawer, 데스크톱=20rem icon-only 형태이므로 그 동작을 기준으로 그릴 것
- **VALIDATE**: 4 화면 각각 모바일/데스크톱 모두 와이어프레임 존재. PRD MVP one-liner(모바일 사진 1장 업로드 → PC 미리보기·다운로드) 가 wireframes 의 3 개 화면(upload → drive list → preview)으로 추적 가능

### Task 6: UseCase 시나리오 5~7개 정의
- **ACTION**: PRD MoSCoW Must/Should 항목을 자동화 가능한 UseCase 5~7개로 분해
- **IMPLEMENT**: `docs/design/usecases.md` — 각 UseCase 행: `id` (UC-01 형식), `title`, `actor` (모바일 본인 / 데스크톱 본인), `precondition`, `steps` (번호 매김), `success criteria`, `related PRD phase`, `automation hint` (Playwright selector 힌트). 권장: UC-01=MVP one-liner, UC-02=invitation 발급, UC-03=폴더 생성/이동, UC-04=휴지통 복원, UC-05=검색, UC-06~07=옵션
- **MIRROR**: PRD "Success Metrics" 표 형식 + Playwright 테스트 시 사용할 actor/step 구조
- **IMPORTS**: 없음
- **GOTCHA**: Phase 6 E2E 가 이 N 개를 자동화 — `steps` 가 너무 추상적이면 자동화 불가. 각 step 은 "UploadButton 탭", "파일명='photo.jpg' 입력" 수준의 구체성 유지. **MVP UC-01 은 반드시 5초 이내 표시 측정 step 포함**(`Success Metric` 표와 정합)
- **VALIDATE**: UseCase 개수 5~7 사이. MVP one-liner 가 UC-01 로 명확 매핑. 각 UseCase 가 PRD MoSCoW 항목 중 어느 것을 만족시키는지 1:N 매핑 표 존재

### Task 7: PRD 갱신 + docs/design/README.md
- **ACTION**: PRD Phase 1 status 갱신 + design 디렉토리 README 작성
- **IMPLEMENT**:
  1. `.claude/prds/services-web-feature-parity.prd.md` Implementation Phases 표 Phase 1 행 — `Status: pending` → `in-progress`, `PRP Plan: -` → 이 plan 의 상대경로
  2. `docs/design/README.md` 1페이지 — 디렉토리 목적, 산출물 색인(direction/wireframes/usecases), archive 정책("design spike 산출물, archive 대상 아님 — 의사결정 reference 로 영속")
  3. PRD Decisions Log 표에 1행 추가 — Task 2 채택 결정을 한 줄로 박제 (Decision / Choice / Alternatives / Rationale 4 칸)
- **MIRROR**: PRD "Decisions Log" 표 + .claude/plans/README.md "도메인 용어" 섹션
- **IMPORTS**: 없음
- **GOTCHA**: PRD 변경은 단 3 군데(Phase 1 status, Phase 1 PRP 칼럼, Decisions Log 1행). 그 외 한 글자도 건드리지 말 것 — git diff 가 작아야 review 통과 쉬움
- **VALIDATE**: `git diff .claude/prds/services-web-feature-parity.prd.md` 에서 3 군데만 변경. `docs/design/README.md` 가 디렉토리에 존재하고 3개 산출물 모두 색인됨

---

## Testing Strategy

이 spike 는 코드 변경이 토큰 분리 1건뿐이라 전통적 unit test 보다 **시각·빌드·문서 회귀** 가 중심이다.

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| (없음 — CSS 토큰 변경은 unit test 대상 아님) | - | - | - |

### Visual Regression

| Screen | Before | After | Tool |
|---|---|---|---|
| `/login` | 토큰 분리 전 스크린샷 | 분리 후 스크린샷 | 수동 비교 (또는 Playwright `toHaveScreenshot`) |
| `/drive` | 동일 | 동일 | 동일 |
| `/register/:token` | 동일 | 동일 | 동일 |

### Edge Cases Checklist
- [ ] 다크모드(`.dark` class) 에서도 토큰 분리 전후 동일
- [ ] safe-area-inset (모바일 노치) 변수 누락 없이 이동됨
- [ ] Catalyst UI 컴포넌트(Button, Sidebar 등)가 zinc-* utility 정상 사용
- [ ] Tailwind 4 utility class 자동 생성이 여전히 동작 (`bg-zinc-50` 등)
- [ ] `npm run build` 와 `npm run dev` 양쪽에서 동일

---

## Validation Commands

### Static Analysis
```bash
npm --prefix services/web run lint
```
EXPECT: Zero error (토큰 분리 전과 동일 결과)

### Build
```bash
npm --prefix services/web run build
```
EXPECT: Build 성공 + 산출물 크기 변동 없음 (토큰 위치만 이동했으므로)

### Dev Server Visual Check
```bash
npm --prefix services/web run dev
# 브라우저에서 /login, /drive, /register/:token 확인
```
EXPECT: 토큰 분리 전 스크린샷과 픽셀 동일

### Document Sanity
```bash
ls docs/design/  # README.md, direction.md, wireframes.md, usecases.md
```
EXPECT: 4개 파일 존재

### PRD Diff Sanity
```bash
git diff .claude/prds/services-web-feature-parity.prd.md
```
EXPECT: 3 군데만 변경 (Phase 1 status, Phase 1 PRP, Decisions Log 1행)

### Manual Validation
- [ ] `direction.md` 의 채택안이 `design-quality.md` "Required Qualities" 4개+ 충족
- [ ] `tokens.css` 가 `index.css` 의 모든 기존 토큰 누락 없이 포함
- [ ] `wireframes.md` 의 drive 페이지 모바일/데스크톱 와이어프레임이 PRD MVP one-liner 흐름 추적 가능
- [ ] `usecases.md` UC-01 이 PRD MVP one-liner 와 정확히 일치
- [ ] PRD Phase 1 row 의 PRP 컬럼이 이 plan 의 상대경로
- [ ] 모든 신규 마크다운 파일이 CRLF 로 저장됨

---

## Acceptance Criteria

- [ ] **direction.md**: 후보 4개 평가표 + 1개 채택 + 채택 근거 + Rejected 후보별 1줄 + 모바일-퍼스트 적용 가이드
- [ ] **tokens.css**: 카테고리 5개(color/font·text/space/radius/motion) 토큰 정의, 기존 `index.css` `@theme` 키 누락 0건
- [ ] **index.css**: `tokens.css` import 적용, `@theme` 블록 제거, `@custom-variant dark` + `html` 규칙 유지, build 성공
- [ ] **wireframes.md**: drive 페이지 모바일/데스크톱 + login + upload-flow + preview = 핵심 4 화면 와이어프레임
- [ ] **usecases.md**: UseCase 5~7개, MVP one-liner = UC-01, 각 UseCase 가 자동화 가능한 step 단위로 작성
- [ ] **PRD 갱신**: Phase 1 row status=in-progress, PRP=plan 경로, Decisions Log 1행 추가 (총 3 변경)
- [ ] **docs/design/README.md**: 1페이지, 디렉토리 목적·색인·archive 정책
- [ ] 시각 회귀: `/login`, `/drive`, `/register/:token` 3 화면 토큰 분리 전후 동일

## Completion Checklist

- [ ] 산출물 4건 모두 `docs/design/` 산하
- [ ] tokens.css 가 Tailwind 4 `@theme` 컨벤션 준수
- [ ] 모든 신규 마크다운 파일 frontmatter (`name`/`description`/`status`/`created`) 포함 — 단, `direction.md`/`wireframes.md`/`usecases.md`는 `status: pending` 시작
- [ ] PRD git diff 가 정확히 3 군데
- [ ] CRLF 검증 통과 (Windows 개발 환경 + docs/ 산하 Linux 실행 비대상)
- [ ] 빌드 회귀 0건, 시각 회귀 0건

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 채택 디자인 방향이 Catalyst UI(zinc 팔레트, headlessui)와 표현력에서 충돌 | M | H | Task 1 평가 기준 (c) "Catalyst UI 호환도" 를 점수 항목으로 명시. 채택 전에 채택안 sample 1 컴포넌트(예: 업로드 버튼)를 Catalyst Button + 토큰 override 만으로 표현 가능한지 mental check |
| 1인 사용자 취향에 종속되어 후일 재검토 비용 | M | M | direction.md 에 평가표 + 점수 보존 → 후일 재검토 시 점수만 갱신하면 됨. 토큰 추상화로 변경 비용 80% 흡수 |
| UseCase N 이 5~7 보다 많아져 Phase 6 E2E 작성 부담 폭증 | M | M | MVP 1개(UC-01) + Should 2개(UC-02 invitation, UC-03 폴더 CRUD) 우선. 나머지는 `status: pending` 마크 후 phase 진행 중 활성화. Phase 6 E2E 는 UC-01+UC-02 만 자동화하고 나머지는 수동 |
| `tokens.css` 분리 중 `@theme` 키 1개 누락 → 시각 회귀 | L | M | Task 3 GOTCHA: 누락 0건 명시 + Task 4 dev 서버 수동 시각 비교 step |
| `docs/design/` 디렉토리 archive 정책 미정 → 후일 superpowers 식 archive 혼동 | L | L | docs/design/README.md 에 "design spike 산출물 — archive 대상 아님" 명시 |
| Tailwind 4 `@import` 순서 오해 → `tailwindcss` 가 토큰 인식 못함 | L | M | Task 4 GOTCHA: `tailwindcss` 먼저 / `tokens.css` 다음 명시 + build 검증 |

## Notes

- **Spike 의 본질**: 결정과 의사결정 근거를 보존하는 것이지, 코드를 많이 작성하는 것이 아님. 산출물 4건 중 코드 변경은 `tokens.css` + `index.css` 단 한 쌍.
- **후속 phase 영향**: Phase 2 (Domain Skeleton) 가 이 plan 산출물 4건 + tokens.css 를 단일 reference 로 의존. 따라서 acceptance 가 통과되어야 Phase 2 시작 가능.
- **PRD Open Question 닫힘**: 이 spike 가 PRD Open Questions 의 (1) 디자인 방향, (2) UseCase 시나리오 개수 두 항목을 닫는다. 나머지 (3) 기존 web 테스트 PRD 관계 / (4) Capacitor 큰 파일 / (5) 검색 범위 / (6) 미리보기 포맷 은 후속 phase 의 책임.
- **EOL 정책**: 모든 신규 파일은 Windows 개발 환경에서 작성되고 Linux 서버에서 직접 실행되지 않으므로 CRLF 가 기본. Write 도구는 LF 기본이므로 작성 후 PowerShell 로 보정하고 검증 step 에 포함.
- **Plan 자체의 archive**: 이 plan 은 Phase 1 완료 시 `status: done` 으로 frontmatter 갱신. 30 일 후 `docs/archive/superpowers/plans/` 로 git mv 이전 ([`.claude/plans/README.md`](README.md) "archive 정책" 참조).

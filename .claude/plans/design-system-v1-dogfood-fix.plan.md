---
name: design-system-v1-dogfood-fix
description: design-system-v1 review-fix dogfood Phase 2 — 다크모드 token 분기 + 2FA 3 페이지 디자인 (safe-inset 은 별도 worktree)
status: done
created: 2026-05-29
report: .claude/reports/design-system-v1-dogfood-fix-report.md
---

# Plan: design-system-v1 — Dogfood Phase 2 fix (Dark mode + 2FA UI)

## Summary

[design-system-v1-review-fix-report.md](../reports/design-system-v1-review-fix-report.md) §"Dogfood Phase 2 — 추가 발견 결함" 에서 식별된 3건 중 **결함 1 (다크모드 contrast)** 과 **결함 3 (2FA challenge UI 누락)** 을 본 plan 으로 묶어 해결한다. 결함 2 (safe-inset) 는 사용자 결정으로 다른 worktree 에서 별도 진행 — 본 plan 범위에서 *명시 제외*.

해결 전략:
- 결함 1 → [tokens.css](../../services/web/src/shared/styles/tokens.css) 에 `.dark` selector 기반 custom property override 를 추가해 *Tailwind 4 `@custom-variant dark`* 가 이미 잡고 있는 dark class 분기를 활성화. catalyst 컴포넌트는 한 줄도 수정하지 않고 dark mode 가 살아난다 ([mobile-ui-guide §8.2](../rules/ecc/web/mobile-ui-guide.md) 의 "catalyst 직접 수정 금지" 위반 없음). 본 plan 의 *선결 작업* 으로 [mobile-ui-guide §7.2](../rules/ecc/web/mobile-ui-guide.md) 의 "Dark mode 는 v1.1 이후 — 사용처 0건 전제" 표를 v1.0 채택으로 갱신.
- 결함 3 → 2FA 3개 화면 ([TwoFactorWaiting](../../services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx) · [TwoFactorApprovalPage](../../services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx) · [TwoFactorBackupEntry](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx)) 를 mobile-ui-guide §2 (Material anatomy) · §4 (a11y) · §5 (위계) · §6 (token utility) 기준으로 재설계. catalyst `Button`·`Input`·`Heading`·`Fieldset` import 는 유지 (Milestone 2 headless 마이그레이션은 본 plan scope 밖).

## Selected Source

- **Source Report**: [.claude/reports/design-system-v1-review-fix-report.md](../reports/design-system-v1-review-fix-report.md) §"Dogfood Phase 2 — 추가 발견 결함" (line 140~149)
- **Linked Memory**: [[project_design_system_v1_phase2_dogfood]] — 결함 3건 박제
- **Linked Guide**: [.claude/rules/ecc/web/mobile-ui-guide.md](../rules/ecc/web/mobile-ui-guide.md) — Material §2 / a11y §4 / 위계 §5 / token §6 / trend §7
- **Out of scope (다른 worktree)**: 결함 2 (safe-inset 미적용 — `--spacing-safe-*` token wrapper + Capacitor `setOverlaysWebView` + Android `EdgeToEdge.enable()`)
- **Out of scope (별도 follow-up)**: [[mobile-app-feel-phase2-dogfood]] 의 "2FA complete 미동작"·"모달 협의 위반"·"신뢰기기 보안 결함" — 본 plan 은 *디자인* 만, *동작* 은 별도

## Problem → Solution

### 결함 1 — 다크모드 contrast 위반 (WCAG 1.4.3, 출시 금지급)

**현재 상태**:
- [index.css:7](../../services/web/src/index.css#L7) `html { @apply bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 }` — html 만 다크 배경.
- [tokens.css](../../services/web/src/shared/styles/tokens.css) 의 `--color-text` (`oklch(18% 0 0)`, 거의 검정), `--color-surface` (`oklch(99% 0 0)`, 거의 흰색) 등 **light 값만** 정의. dark 분기 0건.
- [theme-provider.tsx](../../services/web/src/app/providers/theme-provider.tsx) + [theme.ts:34-41](../../services/web/src/shared/lib/theme/theme.ts#L34-L41) 은 system prefers-color-scheme=dark 면 `documentElement.classList.add('dark')`.
- 결과: system 이 dark 인 사용자에서 *html=검정 + 페이지=검정 글자* → contrast ≈ 1:1.
- [LoginPage.tsx:8](../../services/web/src/pages/login/ui/LoginPage.tsx#L8) 처럼 `dark:text-white` 가 *수동* 으로 일부에만 박혀 있어 일관성 부재.
- [TwoFactorWaiting.tsx:26-29](../../services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx#L26-L29) 의 `text-gray-600`·`text-blue-600` 은 dark variant 0건 — 결정적 violation.

**목표 상태**:
- tokens.css 안에 `.dark` 분기로 `--color-surface`·`--color-text` 등의 *값만* override. catalyst 컴포넌트의 `dark:bg-zinc-*` utility 는 그대로 살아남.
- mobile-ui-guide §7.2 의 dark mode 표가 "v1.0 채택 — tokens 의 dark override 기반, system theme 추종" 으로 갱신.
- LoginPage 의 수동 `dark:text-white` 제거 → `text-text` token 으로 단일화.

### 결함 3 — 2FA challenge UI prototype 수준

**현재 상태**:
- [TwoFactorWaiting.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx) — `flex flex-col` + gap 없음, hierarchy 없음, `text-gray-*`·`text-blue-600`·`border-2` hardcoded, "재전송 . 백업 코드 사용" 이 inline period 구분 (Material/HIG 어느 anatomy 도 아님).
- [TwoFactorApprovalPage.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx) — 4가지 state (loading/expired/done/active) 가 각각 다른 톤 (`text-red-600`·`text-green-600`·`hover:bg-blue-50`) — semantic token 미사용.
- [TwoFactorBackupEntry.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx) — Fieldset/Field/Input catalyst 사용 ✓ 이지만 보조 버튼 `<Button plain className="text-sm text-gray-500 underline">` 가 anti-template (LinkLook button, mobile-ui-guide §7.3 의 "Bootstrap-style 균일 디자인" 회피 실패).

**목표 상태**:
- 3개 페이지가 mobile-ui-guide §2.2 anatomy (catalyst Button variant + Material elevation) 를 따른다.
- semantic color token (`text-success` / `text-danger` / `text-text-muted`) 사용.
- spacing 은 `gap-section` / `gap-gutter` 단일 단위, hierarchy 는 scale 우선 (§5.1).
- "백업 코드로 로그인" 같은 보조 행동은 `Button plain` *또는* 명시 link — anti-template 회피.

## Metadata

- **Complexity**: Medium (코드 6 파일 + 문서 1 파일 + 회귀 test 3 파일)
- **Estimated Files**: 10 (CREATE 3 test, UPDATE 7)
- **Estimated Duration**: 1~1.5일 (정책 갱신 0.1일 + tokens dark 0.2일 + 2FA 3페이지 0.6일 + visual·a11y 검증 0.2일 + 회귀 test 0.3일 + dogfood 안내 0.1일)

---

## Mandatory Reading (구현 전 참조)

| 출처 | 무엇을 |
|---|---|
| [mobile-ui-guide §2.2](../rules/ecc/web/mobile-ui-guide.md) | Button / Text Field / Switch 의 Material anatomy URL — 2FA 페이지 컴포넌트 선택 기준 |
| [mobile-ui-guide §4.1](../rules/ecc/web/mobile-ui-guide.md) | WCAG 1.4.3 (contrast 4.5:1) + 1.4.11 (UI component 3:1) — dark token 값 검증 기준 |
| [mobile-ui-guide §5.1·§5.2](../rules/ecc/web/mobile-ui-guide.md) | 위계 우선순위 + semantic color token — 2FA 의 success/danger/muted 적용 |
| [mobile-ui-guide §6.2](../rules/ecc/web/mobile-ui-guide.md) | tokens.css 의 정식 token 표 — 신규 token 발명 없이 utility 만 사용 |
| [mobile-ui-guide §7.2](../rules/ecc/web/mobile-ui-guide.md) | **Task 0 갱신 대상**: dark mode v1.0 채택으로 표 갱신 |
| [mobile-ui-guide §7.3](../rules/ecc/web/mobile-ui-guide.md) | 금지 trend — Bootstrap-style 균일 디자인 회피 |
| [mobile-ui-guide §8.2](../rules/ecc/web/mobile-ui-guide.md) | catalyst 컴포넌트 직접 수정 금지 — dark override 가 *token level* 에서 끝나야 함 |
| [web/testing.md](../rules/ecc/web/testing.md) | a11y + 시각 회귀 우선순위 — axe-core 자동 + 키보드 수동 |

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| token 정의 | [tokens.css:18-93](../../services/web/src/shared/styles/tokens.css#L18-L93) | `@theme { --color-...: oklch(...); }` block — 신규 token 도 `oklch` 단일 단위 |
| dark variant trigger | [index.css:4](../../services/web/src/index.css#L4) | `@custom-variant dark (&:where(.dark, .dark *))` — `.dark` class 가 trigger |
| Heading 사용 | [LoginPage.tsx:9](../../services/web/src/pages/login/ui/LoginPage.tsx#L9) | catalyst `<Heading>로그인</Heading>` — 2FA 페이지에도 동일 |
| Form layout | [LoginForm.tsx](../../services/web/src/features/login-by-credentials/ui/LoginForm.tsx) | catalyst `Fieldset > FieldGroup > Field` — TwoFactorBackupEntry 와 동일 |
| catalyst Button variant | [TwoFactorBackupEntry.tsx:74-79](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx#L74-L79) | `<Button type="submit">` (filled) + `<Button plain>` (text variant) |
| token utility 사용 | [drive-sidebar/ui/DriveSidebar.tsx](../../services/web/src/widgets/drive-sidebar/ui/DriveSidebar.tsx) (참고) | `bg-surface text-text` 가 잡혀 있는지 grep 으로 확인 후 패턴 인용 |
| 회귀 test | [services/web/src/widgets/drive-sidebar/ui/DriveSidebar.test.tsx](../../services/web/src/widgets/drive-sidebar/ui/DriveSidebar.test.tsx) | render + axe + 키보드 시뮬레이션 |

---

## Files to Change

| File | Action | Why |
|---|---|---|
| `.claude/rules/ecc/web/mobile-ui-guide.md` | UPDATE | §7.2 dark mode 표를 "v1.0 채택" 으로 갱신 + §6 token 표에 dark override 행 추가 |
| `services/web/src/shared/styles/tokens.css` | UPDATE | `.dark { --color-...: oklch(...); }` block 추가 — surface·text·border·accent·semantic 6 group |
| `services/web/src/index.css` | UPDATE | line 7 의 `html { dark:bg-zinc-* }` 를 token 기반 `bg-surface` 로 단일화 (현 zinc-900 검정에서 surface dark 값으로 약간 부드럽게) |
| `services/web/src/pages/login/ui/LoginPage.tsx` | UPDATE | `text-zinc-950 dark:text-white` → `text-text` token 단일화 |
| `services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx` | UPDATE | hierarchy + spacing + token + Material elevation 재설계 |
| `services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx` | UPDATE | 4-state + 옵션 버튼 anatomy 재설계, semantic color token 사용 |
| `services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx` | UPDATE | 보조 버튼 anti-template 제거, 에러 영역 semantic token |
| `services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.test.tsx` | CREATE | 회귀 test — render + axe 0 violations + 키보드 navigation |
| `services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.test.tsx` | CREATE | 4-state 분기 + axe 0 violations |
| `services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.test.tsx` | CREATE | form a11y (label·error·focus) + 키보드 only 제출 |

---

## Tasks

### Task 0 — 정책 갱신: mobile-ui-guide §7.2 의 dark mode 표

- **Action**: [.claude/rules/ecc/web/mobile-ui-guide.md](../rules/ecc/web/mobile-ui-guide.md) §7.2 표의 "Dark mode" 행을 §7.1 (v1.0 허용 trend) 로 이동 + "tokens.css `.dark` override 기반, system theme 추종, prefers-color-scheme + 수동 토글 모두 지원" 명시. §6.2 token 표 끝에 "dark override 는 §7.1 의 dark mode 정책에 따라 자동 적용" 1행 추가.
- **Why first**: 본 plan 의 *모든* 후속 task 가 dark mode 활성을 전제로 함. 정책 갱신이 없으면 v1.0 출시 시 가이드 vs 코드 single source of truth 가 깨지고, 다음 세션 claude 가 가이드를 인용해 dark variant 를 *다시* 제거할 위험 (역공학적 회귀).
- **Mirror**: §7.1 의 기존 trend 행 (Bento layout / motion / Editorial typography / Soft surface) 와 동일 column 구조 (Trend · 적용 위치 · 근거).
- **Validate**: `grep -E "Dark mode|prefers-color-scheme" .claude/rules/ecc/web/mobile-ui-guide.md` 로 §7.1 이동 + §7.2 제거 확인.

### Task 1 — tokens.css 에 dark variant override 추가

- **Action**: [tokens.css](../../services/web/src/shared/styles/tokens.css) 의 `@theme { ... }` block 직후에 `.dark { --color-...: oklch(...); }` 추가. 6 group:
  - surface: `--color-surface`/`-muted`/`-elevated` — 약간 더 dark 한 값 (예: `oklch(18% 0 0)`, `oklch(22% 0 0)`, `oklch(14% 0 0)`)
  - text: `--color-text`/`-muted`/`-subtle` — 거의 흰색 (예: `oklch(95% 0 0)`, `oklch(72% 0 0)`, `oklch(58% 0 0)`)
  - border: `--color-border`/`-strong` — dark 에 맞춘 mid-tone
  - accent: `--color-accent`/`-hover`/`-soft`/`-fg` — dark 에서도 contrast 3:1 통과하는 ring 색
  - semantic: `--color-success`/`-warning`/`-danger`/`-danger-soft`
  - 주석에 *왜 oklch* 인지 + dark contrast 검증 결과 한 줄
- **Mirror**: light 값 정의 ([tokens.css:36-60](../../services/web/src/shared/styles/tokens.css#L36-L60)) 의 oklch 채널 순서·주석 패턴 동일.
- **Validate**:
  - 빌드: `npm --prefix services/web run build` 통과
  - contrast 표 (수동) — 각 token pair (예: `surface` × `text`) 가 WCAG 1.4.3 의 4.5:1 통과하는지 axe-core devtools 또는 contrast checker 로 검증
  - light/dark 토글: theme-provider 의 `setTheme('dark')` 강제 후 LoginPage 가 *읽힘* 확인

### Task 2 — index.css 정리 + LoginPage token 단일화

- **Action**:
  - [index.css:7](../../services/web/src/index.css#L7) `html { @apply bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 }` 를 `html { @apply bg-surface }` 로 교체. dark 분기는 tokens 의 `.dark` override 가 처리.
  - [LoginPage.tsx:8](../../services/web/src/pages/login/ui/LoginPage.tsx#L8) `text-zinc-950 dark:text-white forced-colors:text-[CanvasText]` 를 `text-text forced-colors:text-[CanvasText]` 로 교체 — `text-text` 가 light/dark 자동 분기.
- **Mirror**: [coding-style.md "tokens.css 의 utility class 만 사용"](../rules/ecc/web/coding-style.md) — hardcoded zinc-* 제거.
- **Validate**: LoginPage 렌더 시 light/dark 모두 LogoLabel 의 contrast 4.5:1 통과.

### Task 3 — TwoFactorWaiting 재설계

- **Action**: [TwoFactorWaiting.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx) 전체 markup 재작성:
  - container `<section className="flex flex-col gap-gutter">` (단일 spacing 단위)
  - `<Heading>` 위·`<p className="text-text-muted">` 안내 — semantic token
  - 숫자 박스: `mx-auto flex h-32 w-32 items-center justify-center rounded-xl bg-surface-elevated shadow-md text-3xl font-semibold text-text` — Material elevation level 1~2 (§7.1)
  - 남은 시간: `text-text-subtle text-sm` (위계 3단)
  - `<TrustThisDeviceCheckbox>` — 그대로 유지
  - "재전송" / "백업 코드 사용": catalyst `<Button>` 의 다른 variant 2개로 분리 (예: 재전송 = outline, 백업 코드 = plain). period 구분 제거.
- **Mirror**: catalyst `Button` 의 variant API ([catalyst/button/ui/Button.tsx](../../services/web/src/shared/ui/catalyst/button/ui/Button.tsx)) — `plain` 이외 사용 가능한 variant 확인 후 적합한 것 선택.
- **Validate**:
  - 회귀 test 신설 (Task 6 참조)
  - 키보드 only: Tab → 숫자 박스 안내 읽힘 → Tab → 신뢰 체크박스 → Tab → 재전송 → Tab → 백업
  - axe-core 0 violations

### Task 4 — TwoFactorApprovalPage 재설계

- **Action**: [TwoFactorApprovalPage.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx) 의 4 state 각각:
  - loading: spinner + `text-text-muted` ("불러오는 중..." 그대로)
  - expired: `text-danger` ("만료된 요청입니다.")
  - done: `text-success font-semibold` + 보조 `text-text-muted`
  - active (옵션 3개): hierarchy 있는 layout — `<Heading level={1}>` 로그인 승인 + 안내 + 옵션 3개 grid (각 옵션 = catalyst Button variant secondary/outline, hit-area ≥ 48dp = `h-20 w-20` 유지하면서 token 으로 색만 교체)
- **Mirror**: Task 3 의 spacing·token 패턴.
- **Validate**: 4 state 각각 contrast 통과, 회귀 test 4 case (Task 6).

### Task 5 — TwoFactorBackupEntry 보조 버튼 정리

- **Action**: [TwoFactorBackupEntry.tsx:74-79](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx#L74-L79):
  - 제출 Button 그대로 (filled, catalyst default)
  - "일반 로그인으로 돌아가기" — `<Button plain className="text-sm text-gray-500 underline">` 를 `<Button plain className="text-sm text-text-muted">` 로 교체 (underline 제거 — Button 의 hover state 가 이미 affordance 제공)
  - 에러 영역 line 70: `text-red-500` → `text-danger`
- **Mirror**: [coding-style.md](../rules/ecc/web/coding-style.md) "hardcoded color 금지" + `cn()` 유틸 사용.
- **Validate**: 회귀 test (Task 6) + 키보드 only 로 ID → PW → 백업코드 → 제출 → 돌아가기 navigation 가능.

### Task 6 — 회귀 test 3건 신설

- **Action**: 3개 페이지 각각 옆에 `*.test.tsx` 생성:
  - `TwoFactorWaiting.test.tsx` — (1) render 정상 (2) axe 0 violations (3) Tab navigation 5 step (4) "재전송" 클릭 → resend 호출
  - `TwoFactorApprovalPage.test.tsx` — 4 state (loading/expired/done/active) × axe 0 violations + active state 의 옵션 클릭 → respond 호출
  - `TwoFactorBackupEntry.test.tsx` — (1) Label/Input 연결 a11y (2) 필수 검증 에러 표시 (3) backupCode pattern 검증 (4) 제출 동작
- **Mirror**: 기존 회귀 test 패턴 ([widgets/drive-sidebar/ui/DriveSidebar.test.tsx](../../services/web/src/widgets/drive-sidebar/ui/DriveSidebar.test.tsx) 또는 인접 features test) 의 setup·MSW handler·axe import.
- **Validate**: `npm --prefix services/web test -- --run features/login-by-2fa` 전체 GREEN.

### Task 7 — Dogfood (사용자 수행)

- **Action**: 사용자가 `make web` 으로 dev 서버 기동 후 아래 점검:
  - light/dark 시스템 theme 양쪽에서 LoginPage 진입 — 검정 위 검정 없음 확인
  - login 정상 흐름 → 2FA waiting → approval → done — 시각 contrast 통과
  - backup code 경로 (`/login/backup`) 진입 → 제출 → 에러 흐름 — semantic token 톤 자연스러움
  - 키보드 only 로 위 흐름 전부 재현 가능
  - mobile WebView (Android Capacitor) — `make web` 으로 시뮬레이션 어려우면 `npm run cap:android` 후 실기기 점검
- **Why**: 본 plan 의 결함이 시각 결함이므로 자동 test 만으로는 검증 불충분. visual sign-off 가 사용자 cycle 의 마지막 단계.

---

## Validation

각 task 완료 후 그리고 Task 6 종료 시점 일괄:

```bash
# type-check + build
npm --prefix services/web run build

# 본 plan 범위 회귀 test
npm --prefix services/web test -- --run features/login-by-2fa

# 전체 회귀 (regression 미발생 확인)
npm --prefix services/web test -- --run

# bundle budget 확인 — ≤ 300 kB gzipped (review-fix 시점 239 kB)
npm --prefix services/web run build  # 위와 동일, 출력의 gzipped 합계 확인
```

수동 (axe + 키보드):
- axe-core devtools 로 4 페이지 (Login / TwoFactorWaiting / TwoFactorApprovalPage active / TwoFactorBackupEntry) × 2 theme (light / dark) 의 contrast violations 0건 확인
- 키보드 only 로 login → 2fa waiting → approval → done 흐름 재현

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| catalyst Button/Input 의 *내부* `dark:bg-zinc-*`·`dark:text-zinc-*` 가 본 plan 의 dark token 과 어긋난 톤이 됨 | Medium | catalyst 의 hardcoded zinc-* 톤이 본 token 의 dark 값과 *근접* 하도록 dark token 의 oklch 값을 catalyst 와 의도적으로 align. 안 맞으면 그 catalyst 사용처는 wrapper 가 아닌 *주변 surface* 만 token utility 로 둘러 시각 호환성 확보 |
| oklch dark token 값이 WCAG 1.4.3 (4.5:1) 통과 실패 | Low~Medium | Task 1 의 검증 단계에서 axe-core + contrast checker 로 *각 pair* 검증. 실패 시 lightness 조정 후 재검증. ECC `gan-design` skill 활용 가능 |
| mobile-ui-guide §7.2 갱신 PR 이 본 plan 의 dark token 추가와 *시간차* 가 생기면 다른 세션 claude 가 가이드의 옛 문구를 인용 | Low | Task 0 을 *Task 1 보다 먼저* 실행 + 같은 commit batch (또는 단일 PR) 로 묶어 git 상 시간차 없음 |
| TwoFactorApprovalPage 의 옵션 3개 디자인 변경이 [project_mobile_app_feel_phase2_dogfood](C:/Users/skypark207/.claude/projects/c---project-my-terab/memory/project_mobile_app_feel_phase2_dogfood.md) 의 "2FA complete 미동작" 동작 결함 fix 와 *충돌* 가능 | Low | 본 plan 은 *시각* 만, *동작* 은 별도 worktree. 두 PR 머지 순서는 본 plan 이 먼저 (시각 base) → mobile-app-feel-phase2 가 그 위에 동작 layer 를 얹는다. PR 머지 충돌은 small diff 일 가능성 — 충돌 시 mobile-app-feel-phase2 가 본 plan 의 markup 위에 retry |
| 회귀 test 의 axe 검사가 catalyst 의 *기존* a11y 문제까지 잡아 fail | Low~Medium | 본 plan scope 는 *2FA 페이지 단위 axe 통과* 만 — catalyst 자체 결함이면 본 plan 의 acceptance 에서 제외하고 [design-system-v1-review-fix-report.md "보류" 섹션](../reports/design-system-v1-review-fix-report.md) (M2/M3/M4 등) 에 추가 등재 |

---

## Acceptance

- [ ] Task 0 — mobile-ui-guide §7.2 의 dark mode 표가 §7.1 로 이동 + v1.0 채택 명시
- [ ] Task 1 — tokens.css 에 `.dark` override 6 group 추가, 각 pair contrast 4.5:1 검증 표 본 plan 의 implement report 에 첨부
- [ ] Task 2 — index.css + LoginPage 가 token 단일 적용, 수동 dark variant 제거
- [ ] Task 3 — TwoFactorWaiting 재설계 + 회귀 test GREEN
- [ ] Task 4 — TwoFactorApprovalPage 4 state 재설계 + 회귀 test GREEN
- [ ] Task 5 — TwoFactorBackupEntry 보조 버튼·에러 영역 token 화 + 회귀 test GREEN
- [ ] Task 6 — `npm test` 전체 GREEN (regression 0), `npm run build` 성공, bundle ≤ 300 kB gzipped
- [ ] axe-core 0 violations (4 페이지 × 2 theme)
- [ ] 키보드 only 흐름 (login → 2fa waiting → approval → done · backup entry → 제출) 전부 통과
- [ ] Task 7 — 사용자 dogfood sign-off

## 보류 / 본 plan 에서 제외

| 항목 | 이유 | 권장 처리 |
|---|---|---|
| 결함 2 — safe-inset 미적용 | 사용자 결정으로 다른 worktree 에서 별도 진행 | 별도 worktree (이름 미정) 에서 plan 신설 — `--spacing-safe-*` wrapper + `setOverlaysWebView` + Android `EdgeToEdge.enable()` |
| [[mobile-app-feel-phase2-dogfood]] 의 "2FA complete 미동작"·"모달 협의 위반" 등 동작 결함 | 본 plan 은 *시각* 만, *동작* 은 별도 | `.worktrees/mobile-app-feel/` 또는 신규 worktree 에서 plan |
| catalyst 컴포넌트 자체의 dark variant 정합성 | mobile-ui-guide §8.2 의 "catalyst 직접 수정 금지" + Milestone 2 headless 마이그레이션의 자연스러운 대체 | PRD design-system-v1 Milestone 2 |
| 다른 페이지 (`/drive/**`·`/settings/**` 등) 의 dark mode contrast | 본 plan 의 scope 는 *2FA + Login* — drive 의 token 적용은 review-fix 시점에 이미 검증된 영역 | dogfood 단계 (Task 7) 에서 발견 시 별도 issue 등록 |
| [[mobile-ui-guide-v1-1-additions]] (Tailwind UI Blocks 채택 + 아토믹 디자인) | 정책 추가는 별도 worktree `design-system-v1-1` | 별도 PRD → plan |

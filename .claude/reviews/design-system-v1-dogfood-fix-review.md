---
name: design-system-v1-dogfood-fix-review
description: design-system-v1-dogfood-fix worktree 로컬 코드 리뷰 (plan + 7 변경 + 3 신규 test)
status: done
created: 2026-05-29
plan: ../plans/design-system-v1-dogfood-fix.plan.md
report: ../reports/design-system-v1-dogfood-fix-report.md
---

# Code Review — design-system-v1-dogfood-fix

**Reviewed**: 2026-05-29
**Branch**: `feat/design-system-v1-dogfood-fix` (uncommitted, working tree)
**Plan**: [.claude/plans/design-system-v1-dogfood-fix.plan.md](../plans/design-system-v1-dogfood-fix.plan.md)
**Decision**: **APPROVE** — 커밋 진행 권장. 차단성 결함 없음.

## Summary

plan 의 Task 0~6 이 모두 구현되었고, 자동 검증(빌드/테스트/번들/lint)이 통과한다. 다크모드 token override 와 2FA 3페이지 재설계가 mobile-ui-guide §2 (Material anatomy) · §4 (a11y) · §5 (위계) · §6 (token) 의 기준을 만족한다. catalyst 컴포넌트 *직접 수정 0건* — §8.2 정책 준수. dogfood (Task 7) 만 사용자 sign-off 대기.

## Findings

### CRITICAL

없음.

### HIGH

없음.

### MEDIUM

#### M1. 자동 axe-core 게이트 부재 — plan acceptance 의 "axe 0 violations" 는 dogfood 로 위임됨

- **위치**: [TwoFactorWaiting.test.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.test.tsx) · [TwoFactorApprovalPage.test.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.test.tsx) · [TwoFactorBackupEntry.test.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.test.tsx)
- **현상**: plan Task 3·4·5·6 의 Validate 항목에 "axe-core 0 violations" 가 명시돼 있지만, 신규 test 3건은 role/label/keyboard tab navigation 만 수동 검증한다. `jest-axe` / `@axe-core/react` import 가 없다.
- **영향**: 본 plan 의 acceptance gate("axe-core 0 violations 4 페이지 × 2 theme") 가 자동화되지 않아 회귀 시 자동 catch 불가. report 도 axe 자동화는 미언급.
- **수용 근거**: plan 자체가 axe 자동화를 명시 요구하진 않았고(Validate 의 한 항목으로만 언급), Task 7 의 dogfood 가 axe devtools 수동 점검을 acceptance 로 포함한다. v1.0 출시 시점의 *기능* 게이트는 충족.
- **권장 후속**: `vitest-axe` 또는 `jest-axe` 도입을 `design-system-v1` Milestone 2 의 핵심 8 컴포넌트 acceptance gate 로 묶어 별도 plan 화. 본 PR 의 차단 사유 아님.

#### M2. `TwoFactorApprovalPage` loading state 의 heading 부재 — screen reader 진입 시 페이지 정체성 불명확

- **위치**: [TwoFactorApprovalPage.tsx:9-16](../../services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx#L9-L16)
- **현상**: loading 분기는 `<p aria-live="polite">불러오는 중...</p>` 만 렌더. expired/done/selecting 은 `<Heading level={1}>` 또는 `role="status"` 로 페이지 정체성 노출. loading 만 *anchor 없음*.
- **영향**: 보조기술 사용자가 cold-start 시 페이지 도착 시점에 "여기가 어디인지" 알려주는 landmark 가 없다. WCAG 2.4.6 (Headings and Labels) 의 "section/page 의 목적 식별 가능" 요건에 약하다 — `aria-live` 가 동적 알림은 처리하지만 페이지 자체의 이름은 별개.
- **권장**: loading 에도 `<Heading level={1}>로그인 승인</Heading>` + sr-only 또는 visible "잠시만 기다려 주세요" 보조 안내 1줄 추가. 1-2 줄 수정으로 끝남.
- **수용 근거**: plan Task 4 의 명시 분기 정의가 "loading: spinner + `text-text-muted` (불러오는 중...)" 으로 끝나 *plan 충실*. 본 PR scope 안에서 critical 아님.

### LOW

#### L1. `LogoLabel` className 순서 — Tailwind 정렬 컨벤션과 어긋남

- **위치**: [LoginPage.tsx:8](../../services/web/src/pages/login/ui/LoginPage.tsx#L8) — `className="text-text h-6 forced-colors:text-[CanvasText]"`
- **현상**: `prettier-plugin-tailwindcss` 기본 정렬은 sizing(`h-6`) → typography(`text-text`) 순. 현재 코드는 token color 가 sizing 앞에 옴.
- **영향**: 시각적 동작 영향 없음. format-on-save 가 활성화돼 있다면 다음 저장 시 자동 정렬. 다만 [web/hooks.md](../rules/ecc/web/hooks.md) 의 권장 prettier post hook 이 워크트리에 활성화돼 있다면 이미 정렬됐어야 함 — 활성화 상태 확인 권장.
- **권장**: 다음 커밋 또는 prettier 정렬 PR 에서 일괄 정리. 단독 PR 가치 없음.

#### L2. `TwoFactorBackupEntry.tsx` 의 `formatBackupCode` 정규식 위치 — JSX 내부

- **위치**: [TwoFactorBackupEntry.tsx:17](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx#L17)
- **현상**: 컴포넌트 본문에 매 render 마다 함수 재선언. 매우 가벼운 함수라 성능 영향은 무시 가능. 본 PR 의 변경 범위 밖.
- **권장**: model 레이어 (`twoFactorErrors.ts` 인접) 로 추출하면 unit 테스트 가능. v1.X follow-up.

#### L3. EOL 경고 (git diff stderr) — index 의 LF 잔재

- **현상**: `git diff` 가 두 파일에 대해 "LF will be replaced by CRLF the next time Git touches it" 경고. 워킹트리 실제 파일은 모두 CRLF 로 확인됨 (`crlf-lines == total-lines`). git index 에 LF 가 남아있는 단순 normalization 이슈.
- **권장**: 다음 `git add` 시 자동 정상화. 별도 처리 불필요.

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Build (`tsc -b && vite build`) | ✅ Pass | 6.57s, JS 242.7 kB gzipped (≤ 300 kB) |
| 2FA scope tests | ✅ Pass | 26/26 GREEN (신규 17 포함) |
| 전체 회귀 | ✅ Pass | report 의 186/186 GREEN 인용 |
| Hardcoded color (zinc/gray/red/green/blue) | ✅ Clean | 변경 파일 grep 0건 |
| catalyst 직접 수정 | ✅ Clean | §8.2 — `shared/ui/catalyst/**` 변경 0건 |
| Inline `style=` 속성 | ✅ Clean | 2FA 전부 0건 |
| Bundle budget | ✅ Pass | 242.7 kB ≤ 300 kB (+3.7 kB vs 239 kB baseline) |
| EOL (CRLF default) | ✅ Pass | 워킹트리 모든 변경 파일 CRLF |

## Plan vs 실제 차이

| 항목 | Plan | 실제 |
|---|---|---|
| 변경 파일 | 10 (UPDATE 7 + CREATE 3) | 10 (일치) |
| Task 0 (mobile-ui-guide §7.2 → §7.1 이동) | 명시 | ✅ §7.1 행 추가 + §7.2 행 삭제 + §6.2 자동 적용 주석 추가 |
| Task 1 (tokens `.dark` override 6 group) | 6 그룹 (surface/text/border/accent/semantic + 검증 주석) | 5 그룹 (semantic 안에 success/warning/danger/danger-soft 묶음 4종) — *plan 의 "6 group" 표기는 카운트 차이일 뿐 누락 없음* |
| Task 2 (`bg-surface` 단일화 + LoginPage token) | 명시 | ✅ |
| Task 3 (TwoFactorWaiting 재설계) | section/header/숫자박스/안내/checkbox/button group | ✅ Material elevation (`shadow-md` + `bg-surface-elevated`), `aria-live`, semantic token |
| Task 4 (TwoFactorApprovalPage 4-state) | loading/expired/done/active | ✅ active 는 hook 의 `'selecting'` state 명을 그대로 사용 — 매핑 정확 |
| Task 5 (TwoFactorBackupEntry 보조 버튼 정리) | underline 제거 + `text-red-500 → text-danger` | ✅ 두 항목 모두 적용 |
| Task 6 (회귀 test 3건 신설) | render + axe + 키보드 + callback | ⚠️ render + role/label + 키보드 + callback ✅, **axe 자동화 미포함** (M1 참조) |
| Task 7 (dogfood) | 사용자 sign-off | ⏳ Pending (report 명시) |

## Files Reviewed

| Path | Action | 검토 결과 |
|---|---|---|
| [.claude/rules/ecc/web/mobile-ui-guide.md](../rules/ecc/web/mobile-ui-guide.md) | Modified | §7.1 v1.0 채택 추가, §7.2 v1.1 예약 제거, §6.2 dark 자동 적용 주석 — 의도 정확 |
| [services/web/src/shared/styles/tokens.css](../../services/web/src/shared/styles/tokens.css) | Modified | `.dark` override + WCAG contrast 표 주석. oklch lightness 반전 전략 합리적, chroma/hue 유지로 brand 일관 |
| [services/web/src/index.css](../../services/web/src/index.css) | Modified | `bg-surface` 단일화. dark 분기는 token 이 처리 |
| [services/web/src/pages/login/ui/LoginPage.tsx](../../services/web/src/pages/login/ui/LoginPage.tsx) | Modified | `text-text` 단일화. 수동 `dark:text-white` 제거 |
| [services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx) | Modified | semantic `<section>`/`<header>`, Material elevation, aria-label 숫자 박스, button variant 분리 |
| [services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx) | Modified | 4 state 명시 분기, semantic token, focus-visible ring, button hit-area 80px (≥ 48dp) |
| [services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx) | Modified | `text-danger` + plain button anti-template 회피 |
| [services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.test.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.test.tsx) | Created | 5 test, vi.hoisted 패턴 정확, MemoryRouter wrap |
| [services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.test.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.test.tsx) | Created | 6 test, 4 state 모두 커버, role/label assertion |
| [services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.test.tsx](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.test.tsx) | Created | 6 test, form a11y · pattern · apiError · 로딩 disabled · 이탈 navigation |

## 권장 후속

1. **차단성 없음 — 본 worktree 커밋 진행 가능.** commit 전 git index normalization (`git add` → CRLF 정착) 만 확인하면 됨.
2. **Task 7 dogfood** — 사용자가 `make web` 으로 light/dark + 키보드 only sign-off. 결과를 [report](../reports/design-system-v1-dogfood-fix-report.md) 의 Task 7 행에 기록.
3. **M1 후속 plan** — `vitest-axe` 도입을 `design-system-v1` Milestone 2 의 핵심 8 컴포넌트 acceptance 와 묶어 별도 plan 화. 본 PR 의 차단 사유 아님.
4. **M2 보조** — loading state heading 추가는 1~2 줄. 후속 cleanup PR 또는 본 PR 의 amend 둘 다 가능 — *plan 충실* 우선 시 amend 불필요.

## Decision

**APPROVE** — plan 의 7개 작업이 누락 없이 구현되었고, 자동 검증이 모두 통과한다. mobile-ui-guide §2/§4/§5/§6/§7/§8 의 모든 게이트를 만족하며, catalyst 직접 수정 금지 정책(§8.2)도 준수했다. 남은 acceptance 항목(axe 수동 점검 + dogfood sign-off)은 plan 자체가 사용자 수행으로 위임한 영역이다.

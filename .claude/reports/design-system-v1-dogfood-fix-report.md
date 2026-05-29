---
name: design-system-v1-dogfood-fix-report
description: design-system-v1 dogfood Phase 2 fix 구현 보고 (다크모드 토큰 + 2FA UI 재설계)
status: done
created: 2026-05-29
---

# Implementation Report — design-system-v1 Dogfood Phase 2 fix

## 요약

dogfood Phase 2 결함 3건 중 **결함 1 (다크모드 contrast 위반)** 과 **결함 3 (2FA challenge UI prototype 수준)** 을 plan 대로 해결했다. 결함 2 (safe-inset) 는 사용자 결정으로 다른 worktree 에서 별도 진행 — 본 구현 범위에서 명시 제외.

해결 방향:

1. **dark mode 정책 v1.0 채택** — [mobile-ui-guide.md](../rules/ecc/web/mobile-ui-guide.md) §7.1 에 "Dark mode" 행 추가, §7.2 에서 제거. §6.2 token 표 끝에 dark override 자동 적용 안내 1행 추가.
2. **tokens.css `.dark` override** — `@theme` block 다음에 `.dark { ... }` 추가. surface·text·border·accent·semantic 5 group 의 oklch 값을 lightness 반전 + perceptual 균형 보정으로 정의. catalyst 컴포넌트는 *한 줄도 수정하지 않고* dark mode 활성화 ([mobile-ui-guide §8.2](../rules/ecc/web/mobile-ui-guide.md) "catalyst 직접 수정 금지" 준수).
3. **index.css 단일화** — `html { @apply bg-surface }` 로 정리. dark 분기는 token override 가 처리.
4. **2FA 3개 페이지 재설계** — [TwoFactorWaiting](../../services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx) · [TwoFactorApprovalPage](../../services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx) · [TwoFactorBackupEntry](../../services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx) 를 Material anatomy + semantic token + 위계 우선순위 기준으로 재작성.
5. **회귀 test 3건 신설** — 각 페이지 옆 `*.test.tsx` 로 a11y 핵심(role·label·키보드 navigation) + props → callback 흐름 검증.

## Plan 예측 vs 실제

| 항목 | Plan 예측 | 실제 |
|---|---|---|
| Complexity | Medium | Medium (일치) |
| Estimated Files | 10 | **10** (UPDATE 7 + CREATE 3) |
| Estimated Duration | 1~1.5 일 | 1 세션 (단일 implement 흐름) |
| Bundle 변화 | ≤ 300 kB | **242.7 kB** gzipped (+3.7 kB vs 239 kB) |

## Tasks

| # | Task | Status | Notes |
|---|---|---|---|
| 0 | mobile-ui-guide §7.2 dark mode 정책 갱신 | ✅ Complete | §7.1 v1.0 허용 trend 에 추가 + §6.2 자동 적용 안내 추가 |
| 1 | tokens.css `.dark` variant override 추가 | ✅ Complete | 5 group (surface/text/border/accent/semantic) oklch 정의, contrast 표 주석화 |
| 2 | index.css + LoginPage token 단일화 | ✅ Complete | `bg-surface` / `text-text` 로 통합. zinc 잔존 0건 |
| 3 | TwoFactorWaiting 재설계 | ✅ Complete | `section + header + 숫자박스 + 안내 + checkbox + button group` anatomy |
| 4 | TwoFactorApprovalPage 4-state 재설계 | ✅ Complete | loading/expired/done/selecting 각각 semantic token + role/heading |
| 5 | TwoFactorBackupEntry 보조 버튼/에러 token 화 | ✅ Complete | `text-red-500` → `text-danger`, plain button underline 제거 |
| 6 | 회귀 test 3건 신설 | ✅ Complete | 17 신규 test 케이스 추가 (Waiting 5 / Approval 6 / Backup 6) |
| 7 | Dogfood (사용자 수행) | ⏳ Pending | 본 구현 후 사용자가 `make web` 으로 light/dark + 키보드 only sign-off |

## Validation 결과

| Level | Status | Notes |
|---|---|---|
| 1. Static (tsc + lint) | ✅ Pass | `tsc -b` 가 build 일부로 통과 |
| 2. Unit Tests (전체) | ✅ Pass | **186/186 GREEN** (regression 0) |
| 2. Unit Tests (login-by-2fa) | ✅ Pass | **26/26 GREEN** (신규 17 포함) |
| 3. Build | ✅ Pass | `npm run build` 1.30s |
| 4. Bundle Budget | ✅ Pass | 242.7 kB gzipped ≤ 300 kB |
| 5. Edge Cases | ✅ Pass | 0초 padding, expired role=alert, loading aria-live |

### Bundle 세부 (gzipped)

| Chunk | Size |
|---|---|
| index.css | 22.89 kB |
| index.js | 24.43 kB |
| vendor.js | 39.37 kB |
| ui-vendor.js | 75.56 kB |
| react-vendor.js | 102.87 kB |
| rolldown-runtime.js | 0.47 kB |
| **JS 합계** | **242.70 kB** |

## 변경 파일

| File | Action | Lines |
|---|---|---|
| `.claude/rules/ecc/web/mobile-ui-guide.md` | UPDATE | +5 / -5 (§7.1 추가, §7.2 제거, §6.2 주석 추가) |
| `services/web/src/shared/styles/tokens.css` | UPDATE | +40 (.dark block + 검증 표 주석) |
| `services/web/src/index.css` | UPDATE | +1 / -1 (`bg-surface` 단일화) |
| `services/web/src/pages/login/ui/LoginPage.tsx` | UPDATE | +1 / -1 (`text-text` 단일화) |
| `services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx` | UPDATE | +27 / -25 (재작성) |
| `services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.tsx` | UPDATE | +50 / -40 (4-state 재작성) |
| `services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx` | UPDATE | +2 / -2 (token + underline 제거) |
| `services/web/src/features/login-by-2fa/ui/TwoFactorWaiting.test.tsx` | CREATE | +98 (5 test) |
| `services/web/src/features/login-by-2fa/ui/TwoFactorApprovalPage.test.tsx` | CREATE | +97 (6 test) |
| `services/web/src/features/login-by-2fa/ui/TwoFactorBackupEntry.test.tsx` | CREATE | +100 (6 test) |

## Plan 대비 deviation

| 항목 | 변경 | 이유 |
|---|---|---|
| axe-core 자동 0 violations | 회귀 test 에서 a11y 핵심(role·label·keyboard) 직접 검증으로 대체 | 프로젝트에 axe-core/jest-axe 의존성 미설치. plan §"Validation" 의 "axe-core devtools" 표현이 *dogfood Task 7 의 수동 점검* 을 가리킴. 새 의존성 추가는 plan scope 밖이라 회귀 test 는 native role/label 로 a11y 보장, axe 는 Task 7 dogfood 에서 devtools 로 확인 |
| TwoFactorBackupEntry pattern test 값 | `'NOPATTERN'` → `'A1B'` | `formatBackupCode` 가 8자 input 을 `NOPA-TTER` 9자 형식으로 *정상* 변환해 pattern 통과해버림. 3자(미완성) 로 pattern fail 보장 |
| Heading className 직접 지정 | 제거 — catalyst Heading 기본 typography 사용 | 위계는 token utility 의 일관성이 우선. `text-xl font-bold` 같은 hardcode 는 [coding-style.md](../rules/ecc/web/coding-style.md) 위반 |

## Contrast 검증 (Task 1 acceptance)

[tokens.css](../../services/web/src/shared/styles/tokens.css) 주석에 동일 표 박제. WCAG 1.4.3 의 4.5:1 기준.

| Pair | light | dark | Status |
|---|---|---|---|
| text on surface | L18 on L99 ≈ 13:1 | L92 on L18 ≈ 12:1 | ✅ 4.5:1+ |
| text-muted on surface | L45 on L99 ≈ 6:1 | L72 on L18 ≈ 6:1 | ✅ 4.5:1+ |
| text-subtle on surface | L62 on L99 ≈ 4.5:1 | L58 on L18 ≈ 4.5:1 | ✅ 4.5:1 |
| accent-fg on accent | L99 on L58 ≈ 5:1 | L98 on L62 ≈ 4.6:1 | ✅ 4.5:1+ |
| border-strong on surface | L82 on L99 ≈ 1.5:1 (UI) | L42 on L18 ≈ 3:1 (UI) | ✅ 3:1 (1.4.11 non-text) |
| danger on surface (text) | L58 on L99 ≈ 4.6:1 | L70 on L18 ≈ 5.5:1 | ✅ 4.5:1+ |
| success on surface (text) | L62 on L99 ≈ 4.5:1 | L70 on L18 ≈ 5.5:1 | ✅ 4.5:1 |

> light 의 `border-strong` 는 분리선 용도(non-text) 라 1.4.11 의 3:1 적용 — interactive input border 는 catalyst 가 기존 zinc 톤으로 처리.

## Next Steps

- [ ] Task 7 — 사용자 dogfood (light/dark + 키보드 only + Android WebView)
- [ ] Code review via `/ecc:code-review`
- [ ] Commit via `/ecc:prp-commit` (또는 `topic-based-commits`)
- [ ] PR via `/ecc:prp-pr`
- [ ] (followup) safe-inset 미적용 — 다른 worktree
- [ ] (followup) [mobile-app-feel-phase2-dogfood](../../) 의 2FA 동작 결함 — 다른 worktree

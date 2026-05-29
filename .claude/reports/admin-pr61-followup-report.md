# 구현 보고서: admin PR #61 후속 정리

- **Plan**: `.claude/plans/admin-pr61-followup.plan.md` → `.claude/plans/completed/` 로 archive
- **Branch**: `feat/admin-service-bootstrap` (PR #61 위에 직접 적층)
- **사용자 결정**: PR #61 머지 전, 같은 worktree 에 12개 Task 직접 commit → 단일 PR 머지로 review HIGH 7건 해소

## 요약

PR #61 review 의 HIGH 7건(H1~H7) + MEDIUM M2 를 본 worktree 의 `feat/admin-service-bootstrap` 브랜치 위에 직접 적층했다. 원래 plan 의 **PR-A / PR-B 분리** 출시 흐름은 사용자 결정(현재 worktree 에 직접 쌓기)으로 **단일 PR 머지** 로 통합됐다 — review feedback 을 같은 PR 안에서 해소하는 패턴.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium (PR-A: Small / PR-B: Medium) | Medium |
| Files Changed | ~11 | 12 (코드 7 + 테스트 5) |
| 분기 PR 수 | 2 (PR-A + PR-B) | 1 (사용자 결정으로 통합) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| A1 | H1 — refresh response 타입 축소 | ✅ Complete | `axios.post<{ accessToken: string }>` |
| A2 | H2 — processQueue null guard | ✅ Complete | fallback reject — `'No token available in refresh response'` |
| A3 | H3 — error.config null guard | ✅ Complete | 캐스트 직전 early-throw |
| A4 | H7-1 — axiosInstance 회귀 테스트 5케이스 | ✅ Complete | window.location stub 패턴 발견 (`vi.stubGlobal` 금지 → `Object.defineProperty(window, 'location', …)`) |
| B1 | pino + pino-pretty 클라이언트 logger | ✅ Complete | `shared/lib/logger.ts` — `asObject: true`, env-based level |
| B2 | H5 — AdminGate fail-closed 진단 가드 | ✅ Complete | useEffect 분리로 매 render side-effect 회피 (plan 의 inline 표기에서 개선) |
| B3 | AdminGate 회귀 테스트 4 케이스 추가 | ✅ Complete | null / undefined / [] / non-array object — 총 7 케이스 |
| B4 | H6 — PrivateRoute silent catch → logger.warn | ✅ Complete | fire-and-forget 의도 주석 + err 페이로드 |
| B5 | H4 — useTwoFactorPolling 폴링 에러 분기 + completeMutation 로깅 | ✅ Complete | `isError` destructure, plan 의 위치(DENIED 직전) 대신 effect 최상단으로 이동 — `if (!data) return` 보다 앞이어야 isError 분기 도달 가능 |
| B6 | H7-4 — 2FA polling 회귀 테스트 4 케이스 | ✅ Complete | DENIED / EXPIRED / polling-5xx / unmount cleanup |
| B7 | M2 + H7-2 — parseApiError type guard + 8 케이스 | ✅ Complete | `isErrorResponse` type guard 도입 |
| B8 | H7-3 — useLogin 5xx/timeout/network 3 케이스 | ✅ Complete | timeout 시뮬레이션 방식 변경 — adapter 교체 (MSW interceptor 가 axios timeout 타이머를 가로채는 한계 회피) |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | `npx tsc -b --noEmit` zero errors |
| Lint | ✅ Pass | 0 errors / 19 warnings (모두 codegen `generated/**/*.gen.ts` 의 사전 존재 `Unused eslint-disable directive` — 본 PR 책임 아님) |
| Unit Tests | ✅ Pass | 8 file / **41 tests** 통과 — 17 신규 + 24 기존 |
| Build | ✅ Pass | `npm run build` 458ms — 5 chunks, 103 kB gzipped (react-vendor) |
| Integration | N/A | client-only 변경 — 서버 연동은 dev/staging 검증 영역 |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `services/admin/package.json` | UPDATED | +2 deps (`pino`, `pino-pretty`) |
| `services/admin/src/shared/api/axiosInstance.ts` | UPDATED | +6 / -3 — H1·H2·H3 |
| `services/admin/src/shared/api/axiosInstance.test.ts` | CREATED | +151 — A4 (5 케이스) |
| `services/admin/src/shared/api/parseApiError.ts` | UPDATED | +12 / -2 — type guard |
| `services/admin/src/shared/api/parseApiError.test.ts` | CREATED | +63 — B7 (8 케이스) |
| `services/admin/src/shared/lib/logger.ts` | CREATED | +11 — B1 |
| `services/admin/src/shared/lib/index.ts` | UPDATED | +1 — logger barrel |
| `services/admin/src/shared/router/AdminGate.tsx` | UPDATED | +12 / -3 — H5 |
| `services/admin/src/shared/router/AdminGate.test.tsx` | UPDATED | +94 / -3 — B3 (4 신규 케이스) |
| `services/admin/src/shared/router/PrivateRoute.tsx` | UPDATED | +6 / -1 — H6 |
| `services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.ts` | UPDATED | +14 / -2 — H4 |
| `services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx` | UPDATED | +75 / -1 — B6 (4 신규 케이스) |
| `services/admin/src/features/login-by-credentials/model/useLogin.test.tsx` | UPDATED | +51 / -1 — B8 (3 신규 케이스) |

## Deviations from Plan

| # | Plan 표기 | 실제 진행 | Why |
|---|---|---|---|
| 1 | PR-A + PR-B 두 PR 로 분리 | 단일 PR (현 worktree 적층) | 사용자가 plan 인지 직후 결정 — PR #61 머지 전에 review HIGH 를 해소하는 게 더 깔끔. |
| 2 | `npm -w services/admin run typecheck` | `npx tsc -b --noEmit` (services/admin 디렉토리) | repo root 에 npm workspace 가 없음 — package.json 없는 root 구조. |
| 3 | B2 의 logger.error inline 호출 | useEffect 안으로 이동 | side-effect 가 매 render 호출되는 anti-pattern 회피. 의도 동일. |
| 4 | B5 의 isError 분기 위치 "DENIED/EXPIRED 직전" | effect 최상단 | `if (!data) return` 보다 앞이어야 isError 분기에 도달 (tanstack-query 의 isError + data=undefined 동시 발생 패턴). |
| 5 | B8 의 timeout 케이스 (axios timeout config) | adapter 교체로 ECONNABORTED 강제 throw | MSW interceptor 가 axios timeout 타이머를 가로채서 `defaults.timeout` 만으로는 deterministic 하지 않음. plan Risks 표 의 첫번째 row 와 동일 종류의 trade-off. |

## Issues Encountered

### 1. `vi.stubGlobal('location', { href: '' })` 의 MSW 충돌

- 증상: 모든 axios 호출이 `TypeError: Invalid URL` 로 실패. MSW interceptor 의 `toAbsoluteUrl` 이 `location.origin` 을 읽어야 하는데 stub 객체에 없음.
- 해결: `Object.defineProperty(window, 'location', { configurable: true, writable: true, value: stubLocation })` — origin·protocol·host 등 절대 URL 변환 필드 모두 유지하고 `href` setter 만 가로챔.

### 2. `Object.defineProperty(window.location, 'href', …)` 도 실패

- 증상: `TypeError: Cannot redefine property: href` — jsdom 의 `Location.prototype.href` descriptor 는 `configurable: false`.
- 해결: `window.location` 객체 *자체*를 configurable property 로 교체 (Window 의 own property 는 configurable). 위 Issue 1 의 해결책이 자연스럽게 적용.

### 3. MSW + axios timeout 의 상호작용

- 증상: `axiosInstance.defaults.timeout = 50` 후 무응답 핸들러를 둬도 mutation 이 timeout 으로 reject 되지 않음 — 2초 waitFor 도 fail.
- 가설: MSW 의 XHR interceptor 가 axios 의 timeout 타이머에 의한 `XHR.abort()` 를 가로채는 듯.
- 해결: `axiosInstance.defaults.adapter` 를 임시 교체해 `AxiosError('timeout of 50ms exceeded', 'ECONNABORTED')` 를 강제 throw. 실제 timeout 경로와 동등한 error 형태이며 mutation reject 결과는 동일.

## Tests Written

| Test File | 신규 Tests | Coverage |
|---|---|---|
| `axiosInstance.test.ts` | 5 | refresh queue 동시성 / H1·H2·H3 guard / clearAuth side-effect |
| `parseApiError.test.ts` | 8 | non-AxiosError / HTML body / 빈 응답 / 정상 / 부분 누락 / 비정상 타입 |
| `AdminGate.test.tsx` | 4 (총 7) | permissions null / 누락 / non-array object / 빈 array (no log) |
| `useTwoFactorPolling.test.tsx` | 4 (총 6) | DENIED / EXPIRED / polling 5xx / unmount cleanup |
| `useLogin.test.tsx` | 3 (총 6) | 502 HTML / network error / timeout (adapter 시뮬레이션) |

**합계**: 17 신규 테스트 + 24 기존 = **41 통과**

## Next Steps

- [ ] PR #61 description 에 본 보고서 인용 — review HIGH 7건 모두 해소됐음을 명시
- [ ] `code-reviewer` agent 로 logger PII 노출 점검 (plan Acceptance 의 "logger 의 PII 노출 0건")
- [ ] PR #61 머지 후 `git worktree remove .worktrees/admin-service-bootstrap` 정리

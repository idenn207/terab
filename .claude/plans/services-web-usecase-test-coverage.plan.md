---
name: services-web-usecase-test-coverage
description: services/web use-case 훅 6개 (테스트 누락분) 의 단위 테스트 신설 — happy path + 실패/edge case 시나리오 박제로 회귀 감지 기반 확보
status: pending
created: 2026-05-25
---

# Plan: services/web use-case 6 개 테스트 신설

**Source PRD**: [.claude/prds/services-web-usecase-test-coverage.prd.md](../prds/services-web-usecase-test-coverage.prd.md)
**Selected Milestone**: #1 — use-case 6 개 단위 테스트 신설
**Complexity**: Medium

## Summary

PRD 가 식별한 6 개 누락 use-case 에 단위 테스트를 추가한다. 각 spec 의 첫 시나리오는 **happy path + 실제 codegen URL 로 호출되었는지 검증** 형태로 박제하여, ts-rest → Swagger 마이그레이션 시점에 발생한 [useTwoFactorPolling 류 회귀](../../services/web/src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx) 가 향후 재발할 때 빠르게 감지되도록 한다. production 코드 변경 0 — 테스트 추가만.

> 본 plan 의 가설: 6 개 use-case 의 복잡도 합계가 158 줄(평균 26 줄)로 작아, spec 1 개당 3-5 시나리오 작성이 30 분 이하. 6 spec 모두 작성 시 합계 ≤ 3 시간 + 검증/CRLF/커밋 30 분 = **반나절 작업**.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 테스트 파일 구조 | [services/web/src/features/login-by-credentials/model/useLogin.test.tsx](../../services/web/src/features/login-by-credentials/model/useLogin.test.tsx) | `describe(hook 이름) → beforeEach(server.use + store reset) → it('한글 시나리오 설명') × N` |
| Wrapper 사용 | [services/web/src/__tests__/wrappers.tsx](../../services/web/src/__tests__/wrappers.tsx) | `makeRouterWrapper()` — QueryClient + MemoryRouter, polling 훅은 `vi.useFakeTimers()` 추가 |
| MSW handler 추가 | [useTwoFactorPolling.test.tsx](../../services/web/src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx) (path 수정 후) | 테스트별 `server.use(http.METHOD(url, () => HttpResponse.json(...)))` — 글로벌 `handlers.ts` 갱신 금지 |
| codegen URL 확인 | [services/web/src/shared/api/generated/sdk.gen.ts](../../services/web/src/shared/api/generated/sdk.gen.ts) | 각 spec 작성 전 해당 controller fn 의 `url:` 필드 확인 (예: `/auth/2fa/challenge/{id}/status`) |
| store 검증 | [services/web/src/entities/user/model/store.ts](../../services/web/src/entities/user/model/store.ts) | `useUserStore.getState().accessToken` / `user` 직접 assertion (selector 무관) |
| navigate 검증 | useLogin.test.tsx 의 패턴 | `MemoryRouter` 의 location 추적 또는 `<Routes>` 가짜 라우트 추가 — 기존 test 의 채택 방식 따라감 |
| async + fake timer | useTwoFactorPolling.test.tsx | `await act(async () => { await vi.advanceTimersByTimeAsync(100); })` |
| api/error 파싱 검증 | useLogin.test.tsx (error 시나리오) | `parseApiError` 의 결과를 spec 에서 직접 인스턴스화하지 않고 mock response 의 body 로 유도 |

## Files to Change

| File | Action | Why |
|---|---|---|
| `services/web/src/features/backup-code/model/useBackupCode.test.tsx` | CREATE | (1) — 시나리오 4-5 개 |
| `services/web/src/features/login-by-2fa/model/useBackupLogin.test.tsx` | CREATE | (2) — 시나리오 3-4 개 |
| `services/web/src/features/login-by-2fa/model/useTwoFactorRespond.test.tsx` | CREATE | (3) — 시나리오 4-5 개 (state machine) |
| `services/web/src/features/logout/model/useLogout.test.tsx` | CREATE | (4) — 시나리오 3 개 |
| `services/web/src/features/register-by-invitation/model/useInvitationValidation.test.tsx` | CREATE | (5) — 시나리오 4 개 (token presence × data/error) |
| `services/web/src/features/trusted-device/model/useTrustedDevice.test.tsx` | CREATE | (6) — 시나리오 3 개 (register/revoke/pending state) |
| `.claude/prds/services-web-usecase-test-coverage.prd.md` | UPDATE | Delivery Milestones #1 행: `pending → in-progress` (Task 0 진입 시), 최종 `done` |

선택적 변경 (필요시):

| File | Action | Why |
|---|---|---|
| `services/web/src/__tests__/wrappers.tsx` | UPDATE | (가능성) store reset 헬퍼 추가 — 6 spec 에서 공통 사용 시. 본 plan 의 Task 0 (spec 인프라 점검) 에서 판단 |

## Tasks

### Task 0: spec 인프라 점검 (필요 시 wrappers.tsx 보강)
- **Action**:
  - 기존 spec (`useLogin.test.tsx`, `useRegister.test.tsx`) 가 `useUserStore` 리셋을 어떻게 하는지 확인
  - 만약 매 spec 에서 동일한 reset 코드를 반복하고 있다면 `wrappers.tsx` 에 `resetStores()` 헬퍼 추가 검토 — 단, 본 plan 범위가 비대해질 위험 있으므로 **최소 변경 원칙**: 기존 패턴 그대로 mirror, 헬퍼 추가는 별도 PR
  - axios 인스턴스의 baseURL 확인 (`shared/api/axiosInstance.ts`) — 이후 모든 spec 의 mock URL prefix 통일
  - PRD #1 행 `pending → in-progress` 전이
- **Mirror**: `useLogin.test.tsx` 의 reset 패턴
- **Validate**:
  - 기존 test 파일 분석 결과 정리 (필요 시 plan 본문에 추가)
  - `grep -c "in-progress" .claude/prds/services-web-usecase-test-coverage.prd.md` → ≥ 1
  - axios baseURL 확정 (예: `/api`) 후 본 plan 의 모든 Mock URL 예시에 일관 적용 결정

### Task 1: `useBackupCode.test.tsx` 신설
- **Action**: 시나리오 4-5 개:
  1. **happy path**: 마운트 시 `backupCodeApi.count()` 호출 → `count` state 가 응답값과 일치
  2. **regenerate cancel**: `window.confirm` mock = false → `setIsRegenerating` 미호출 + `generatedCodes` 미변경
  3. **regenerate success**: confirm = true → API 응답 codes → `generatedCodes` + `count` 갱신
  4. **regenerate isRegenerating flow**: regenerate 도중 `isRegenerating=true`, 완료 후 `false`
  5. **clearGeneratedCodes**: `generatedCodes` 가 null 로 리셋
- **Mirror**: useLogin.test.tsx + useTwoFactorPolling.test.tsx (server.use 패턴)
- **API path 확인**: `services/web/src/shared/api/generated/sdk.gen.ts` 에서 backup-code count/regenerate 의 실제 URL
- **Validate**:
  - `npm --prefix services/web test -- --run useBackupCode` → 모든 시나리오 pass
  - 파일 CRLF
  - codegen URL 과 mock URL 일치 grep (URL 문자열이 sdk.gen.ts 에 존재)

### Task 2: `useBackupLogin.test.tsx` 신설
- **Action**: 시나리오 3-4 개:
  1. **happy path AUTHENTICATED**: form 제출 → mutation 성공 → `setAuth(accessToken, user)` 호출 검증 (`useUserStore.getState().accessToken === ...`) → `navigate('/drive')` 검증
  2. **mutation error → apiError 노출**: 서버 4xx → `apiError` 가 `{ code, message }` 객체 (parseApiError 결과) → store 미변경
  3. **mutation isLoading flow**: `isPending=true` 동안 `isLoading=true`
  4. **(옵션) AUTHENTICATED 외 응답**: data.status 가 다른 값일 때 store/navigate 미호출
- **Mirror**: useLogin.test.tsx 의 happy path / error 분기 패턴
- **API path 확인**: `loginWithBackup` codegen URL
- **Validate**:
  - `npm --prefix services/web test -- --run useBackupLogin` → pass
  - `useUserStore.getState().accessToken` assertion 동작 확인 (스토어가 reset 됐는지)

### Task 3: `useTwoFactorRespond.test.tsx` 신설
- **Action**: 시나리오 4-5 개 (state machine 명확):
  1. **happy path PENDING → selecting**: 마운트 → status 응답 PENDING → `respondStatus='selecting'` + `options` 채워짐
  2. **!PENDING → expired**: status 응답 DENIED/EXPIRED → `respondStatus='expired'`, `options=[]`
  3. **error → expired**: query error → `respondStatus='expired'`
  4. **respond() → done**: respond mutation 성공 → `respondStatus='done'`
  5. **(옵션) selecting → respond 호출 시 path/body 검증**: mutation 호출 인자 인터셉트
- **Mirror**: useTwoFactorPolling.test.tsx 의 fake timer + server.use 패턴 (단 URL 은 codegen 기준 정정)
- **API path 확인**: `useChallengeStatusQuery` 의 sdk path, `useRespondChallengeMutation` 의 sdk path 모두 확인
- **Validate**:
  - `npm --prefix services/web test -- --run useTwoFactorRespond` → pass

### Task 4: `useLogout.test.tsx` 신설
- **Action**: 시나리오 3 개:
  1. **happy path success**: logout() 호출 → mutation 성공 → `clearAuth` 호출 (`useUserStore.getState().accessToken === null`) → `navigate('/login')` 검증
  2. **mutation error onSettled**: 서버 5xx 라도 `onSettled` 보장 → `clearAuth` + `navigate('/login')` 그대로 실행
  3. **double-click 보호 (선택)**: logout() 연속 2 회 호출 시 mutation 한 번만 실행되는지 (TanStack Query 의 mutation queue 동작)
- **Mirror**: useTwoFactorPolling.test.tsx 의 store reset
- **API path 확인**: logout sdk path
- **Validate**:
  - `npm --prefix services/web test -- --run useLogout` → pass

### Task 5: `useInvitationValidation.test.tsx` 신설
- **Action**: 시나리오 4 개:
  1. **빈 token**: `useInvitationValidation('')` → `valid === false` (mount 즉시)
  2. **valid token + data.valid=true**: query 응답 `{ valid: true }` → `valid === true`
  3. **valid token + data.valid=false**: query 응답 `{ valid: false }` → `valid === false`
  4. **error → valid=false**: 서버 4xx → `valid === false`
- **Mirror**: useTwoFactorPolling.test.tsx
- **API path 확인**: `useValidateInvitationQuery` sdk path
- **Validate**:
  - `npm --prefix services/web test -- --run useInvitationValidation` → pass

### Task 6: `useTrustedDevice.test.tsx` 신설
- **Action**: 시나리오 3 개:
  1. **register happy path**: `register()` → mutation 호출 + `isRegistering=true → false` 전이
  2. **revoke happy path**: `revoke('device-id-1')` → mutation 호출 + path 인자 `{ id: 'device-id-1' }` 전달 검증 + `isRevoking=true → false` 전이
  3. **(옵션) mutation error → isRegistering/isRevoking 복귀**: 에러 시 pending state 가 false 로 정상 복귀
- **Mirror**: useLogout 의 mutation-only 훅 패턴
- **API path 확인**: register / revoke sdk path
- **Validate**:
  - `npm --prefix services/web test -- --run useTrustedDevice` → pass

### Task 7: services/web 전체 테스트 통과 검증
- **Action**: 6 신규 spec + 기존 spec 전부 1 회 실행. **사전 실패 `useTwoFactorPolling.test.tsx` 는 별도 PR 의존성**이므로 본 검증에서 제외 식별.
- **Validate**:
  - `npm --prefix services/web test -- --run` 실행
  - 결과: "Test Files X passed, 1 failed (useTwoFactorPolling)" — `useTwoFactorPolling` 외 모든 test 통과
  - 신규 6 spec 의 시나리오 합계 ≥ 18 카운트 확인 (`Tests N passed` 의 N 가 기존 + ≥ 18)

### Task 8: 모든 신규 파일 CRLF 검증
- **Action**: 6 신규 `.test.tsx` + 본 plan + (수정 시) PRD/wrappers 모두 CRLF
- **Validate** (PowerShell):
  - 대상 파일 목록을 `Get-Content -Raw $f -match "`r`n"` 으로 일괄 검증

### Task 9: PRD Delivery Milestones #1 행 `done` 전이
- **Action**: `.claude/prds/services-web-usecase-test-coverage.prd.md` 의 마일스톤 #1 `in-progress → done` (Task 0 에서 in-progress, Task 8 종료 후 done)
- **Validate**:
  - `grep -c "done.*services-web-usecase-test-coverage.plan.md" .claude/prds/services-web-usecase-test-coverage.prd.md` → ≥ 1
  - PRD frontmatter `status: done` 도 함께 갱신

## Validation

```bash
# 1. 6 신규 spec 존재
ls services/web/src/features/backup-code/model/useBackupCode.test.tsx
ls services/web/src/features/login-by-2fa/model/useBackupLogin.test.tsx
ls services/web/src/features/login-by-2fa/model/useTwoFactorRespond.test.tsx
ls services/web/src/features/logout/model/useLogout.test.tsx
ls services/web/src/features/register-by-invitation/model/useInvitationValidation.test.tsx
ls services/web/src/features/trusted-device/model/useTrustedDevice.test.tsx

# 2. 신규 spec 모두 통과 (개별)
npm --prefix services/web test -- --run \
  src/features/backup-code/model/useBackupCode.test.tsx \
  src/features/login-by-2fa/model/useBackupLogin.test.tsx \
  src/features/login-by-2fa/model/useTwoFactorRespond.test.tsx \
  src/features/logout/model/useLogout.test.tsx \
  src/features/register-by-invitation/model/useInvitationValidation.test.tsx \
  src/features/trusted-device/model/useTrustedDevice.test.tsx

# 3. 전체 통과 (useTwoFactorPolling 의 1건 외)
npm --prefix services/web test -- --run

# 4. codegen URL 일치 grep (각 spec 의 mock URL 이 sdk.gen.ts 에 등장)
grep -E "url: '/auth/2fa/|url: '/auth/logout|url: '/invitations|url: '/trusted-devices|url: '/backup-codes" \
  services/web/src/shared/api/generated/sdk.gen.ts

# 5. PRD 상태 전이
grep -c "done" .claude/prds/services-web-usecase-test-coverage.prd.md   # frontmatter + milestone
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| codegen URL 변경 시점에 spec 도 함께 갱신하지 않으면 또 회귀 (useTwoFactorPolling 사태 재발) | Medium | spec 의 첫 시나리오에 "MSW handler 가 hit 됨" 명시 assertion 추가. plan 의 Mirror 표에 codegen URL 확인 절차 강제 |
| MSW handler 의 baseURL 처리 — axios baseURL 이 `/api` 일 때 mock URL 도 `/api/auth/...` 인지 / `/auth/...` 인지 일관성 | High | Task 0 에서 axios 인스턴스의 baseURL 확인 후 plan 전반에 통일된 mock URL prefix 적용 |
| store reset 누락으로 spec 간 cross-talk | Medium | 매 spec 의 `beforeEach` 에서 `useUserStore.getState().clearAuth()`. Task 0 에서 wrappers 헬퍼 도입 검토 |
| `vi.useFakeTimers` + TanStack Query 의 polling 흐름 (useTwoFactorRespond) 에서 advance 후 데이터 안 옴 | Medium | `await act(async () => { await vi.advanceTimersByTimeAsync(100); })` + `await waitFor(() => expect(...).toBe(...))` 조합 |
| navigate 검증 방식 결정 (mock vs MemoryRouter location) | Low | useLogin.test.tsx 의 채택 방식을 따라가 일관성 유지 |
| 한 PR 에 6 spec 모두 묶이면 리뷰 부담 | Low | 슬라이스 단위 PR 분리 가능 — 본 plan 의 Task 1-6 이 각각 독립적이라 슬라이스별 PR 분기 자연스러움. 단, 최소 인프라(Task 0) 변경은 첫 PR 에 포함 |
| `vitest` 의 `--run` 옵션 미지원 환경 (오래된 vitest) | Low | services/web 의 vitest 버전 확인 (`package.json`), 호환 옵션 (`--no-watch`) fallback 명시 |
| 본 plan 종결 후에도 사전 실패 `useTwoFactorPolling.test.tsx` 가 잔존하면 services/web 전체 test 통과 false | Medium | Acceptance 에 명시: 본 plan 통과 기준에서 해당 1 건 제외. 별도 PR(`fix/test-2fa-polling-msw-url`) 머지 시점에 합산 |

## Acceptance

- [ ] Task 0-9 모두 완료
- [ ] Validation 명령 전부 통과 (useTwoFactorPolling 외)
- [ ] 6 신규 spec 의 시나리오 합계 ≥ 18
- [ ] services/web features 의 use-case 커버리지 12/12 (100 %)
- [ ] 모든 신규/변경 파일 CRLF
- [ ] PRD #1 행 `done` + frontmatter `status: done`
- [ ] (선택) 별도 PR (`fix/test-2fa-polling-msw-url`) 머지 후 services/web 전체 test 100 % 통과 확인

## Out of Scope (이 plan 범위 밖)

- entities/stores 단위 테스트 (별도 PRD)
- widgets/pages 통합 테스트 (별도 PRD)
- E2E (Playwright) 시나리오
- production 코드 변경
- 커버리지 측정 도구(`vitest --coverage`) 도입
- `useTwoFactorPolling.test.tsx` 의 사전 실패 fix (별도 PR)
- features 외 슬라이스의 model 테스트 (`entities/user/model/store.test.ts` 등 — 본 PRD scope 가 features 의 use-case 한정)

## Suggested Follow-up

1. 본 plan 승인 → Task 0 (spec 인프라 점검) 수행, wrappers 헬퍼 도입 여부 결정
2. Task 1-6 을 슬라이스 단위 PR 로 분리 가능 — 각 슬라이스의 진행 중 기능 PR 과의 충돌 risk 최소화
3. 또는 6 spec 을 한 PR 로 묶어 일관 머지 — 본 plan 의 Acceptance 가 묶음 단위로 검증되므로 권장
4. 별도 PR `fix/test-2fa-polling-msw-url` 와의 머지 순서 협의 (본 plan 머지 후 → fix PR 머지 → services/web test 100 % 통과 확인)
5. 본 plan 완료 후 후속 PRD 후보: (a) entities/stores 테스트, (b) `vitest --coverage` 도입, (c) Playwright E2E 인프라

# Plan: PR #61 후속 정리 — admin auth 안정화

**Source Review**: [.claude/reviews/pr-61-admin-service-bootstrap-review.md](../reviews/pr-61-admin-service-bootstrap-review.md)
**Selected Items**: HIGH 7건 (H1~H7) + MEDIUM M2(parseApiError type guard)
**Branch base**: `v0.1` — PR #61 머지 후 진행
**제안 worktree**: `.worktrees/admin-pr61-followup/`
**Complexity**: Medium (PR-A: Small / PR-B: Medium)

## Summary

PR #61 review 의 HIGH 7건을 후속 PR **2개**로 묶어 해결.

- **PR-A** (S-size, ~30분): `axiosInstance.ts` 타입 안전성 (H1·H2·H3) + refresh queue 회귀 테스트 (H7-1)
- **PR-B** (M-size, ~2시간): pino-pretty 클라이언트 logger 신설 + AdminGate fail-closed 진단 가드(H5) + PrivateRoute silent catch 로깅(H6) + 2FA polling 에러 분기/로깅(H4) + 4개 테스트 갭(H7-1·2·3·4) + parseApiError type guard(M2)

scope 는 services/admin 만 — services/web 의 동일 패턴은 본 plan 대상 아님 (별도 등재 가능).

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Logger 신설 | 없음 (admin/web 모두 dedicated logger 부재) | `pino` + `pino-pretty` 클라이언트 wrapper 신설 — `shared/lib/logger.ts` (Task B1) |
| Test (MSW + fake timers) | [services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx](../../services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx) | reference 패턴 — fake timers + MSW handler 교체 |
| Error parsing | [services/admin/src/shared/api/parseApiError.ts](../../services/admin/src/shared/api/parseApiError.ts) | M2 의 type guard 함수 도입 자리 |
| Test setup | [services/admin/src/__tests__/setup.ts](../../services/admin/src/__tests__/setup.ts) | MSW server + afterEach 정리 — `server.resetHandlers()` 명시 권장 |

## Files to Change

### PR-A — axios 타입 안전성 (S-size)

| File | Action | Why |
|---|---|---|
| [services/admin/src/shared/api/axiosInstance.ts](../../services/admin/src/shared/api/axiosInstance.ts) | UPDATE | H1 (line 64), H2 (line 27-32), H3 (line 41) |
| `services/admin/src/shared/api/axiosInstance.test.ts` | CREATE | H7-1 회귀 — 동시 401, error.config undefined, refresh 실패 시 queue reject |

### PR-B — 진단 로그 + 회귀 테스트 (M-size)

| File | Action | Why |
|---|---|---|
| `services/admin/src/shared/lib/logger.ts` | CREATE | pino + pino-pretty 클라이언트 wrapper. 환경별 level 분기 |
| `services/admin/src/shared/lib/index.ts` | UPDATE | logger barrel export |
| `services/admin/package.json` | UPDATE | `pino`, `pino-pretty` 의존 추가 |
| [services/admin/src/shared/router/AdminGate.tsx](../../services/admin/src/shared/router/AdminGate.tsx) | UPDATE | H5 (line 13) — Array.isArray 명시 가드 + 진단 로그 |
| [services/admin/src/shared/router/AdminGate.test.tsx](../../services/admin/src/shared/router/AdminGate.test.tsx) | UPDATE | permissions = null / undefined / [] / non-array 4 케이스 |
| [services/admin/src/shared/router/PrivateRoute.tsx](../../services/admin/src/shared/router/PrivateRoute.tsx) | UPDATE | H6 (line 21) — silent catch → logger.warn |
| [services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.ts](../../services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.ts) | UPDATE | H4 — `isError` destructure + 폴링 에러 분기, completeMutation.catch 로깅 |
| [services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx](../../services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx) | UPDATE | H7-4 — DENIED/EXPIRED/polling-5xx/unmount cleanup |
| [services/admin/src/shared/api/parseApiError.ts](../../services/admin/src/shared/api/parseApiError.ts) | UPDATE | M2 — type guard 함수 도입 |
| `services/admin/src/shared/api/parseApiError.test.ts` | CREATE | H7-2 — non-AxiosError / 비표준 응답 / 빈 응답 / text-html 응답 |
| [services/admin/src/features/login-by-credentials/model/useLogin.test.tsx](../../services/admin/src/features/login-by-credentials/model/useLogin.test.tsx) | UPDATE | H7-3 — 502 / timeout / network error |

## Tasks

### PR-A

#### A1. H1 — refresh response 타입 축소
- **Action**: `axiosInstance.ts:64` `axios.post<{ accessToken: string; user: unknown }>` → `axios.post<{ accessToken: string }>`. `data.accessToken` 외 read 없음을 grep 으로 확인.
- **Mirror**: 없음 — 단순 타입 축소
- **Validate**: `npm -w services/admin run typecheck`

#### A2. H2 — processQueue token null guard
- **Action**: `axiosInstance.ts:27-32` 의 `processQueue` 함수 본문 분기 보강
  ```ts
  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
      if (error) prom.reject(error);
      else if (token) prom.resolve(token);
      else prom.reject(new Error('No token available in refresh response'));
    });
    failedQueue = [];
  };
  ```
- **Validate**: typecheck + A4 의 새 unit test

#### A3. H3 — error.config null guard
- **Action**: `axiosInstance.ts:41` 캐스트 직전에 가드 삽입
  ```ts
  if (!error.config) return Promise.reject(error);
  const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
  ```
- **Validate**: typecheck + A4 의 새 unit test

#### A4. H7-1 — axiosInstance 회귀 테스트 신설
- **Action**: `axiosInstance.test.ts` 신설. MSW handler 로 `/api/auth/refresh` + 401 응답 시뮬레이션. 케이스:
  - (a) 단일 401 → refresh 성공 → 재시도 성공
  - (b) 동시 2개 401 → 단일 refresh → 양쪽 drain 검증
  - (c) refresh 401 응답 → 큐 모두 reject
  - (d) error.config undefined → 즉시 reject (재시도 없음)
  - (e) refresh 응답에 accessToken 없음 → 큐 reject (H2 의 새 guard 검증)
- **Mirror**: `useTwoFactorPolling.test.tsx` 의 MSW + fake timers 패턴
- **Validate**: `npm -w services/admin test -- axiosInstance`

### PR-B

#### B1. pino 클라이언트 logger 신설
- **Action**:
  - `package.json` 에 `pino` + `pino-pretty` 추가
  - `shared/lib/logger.ts` 작성 — 브라우저 환경 `pino({ browser: { asObject: true } })`, level 은 `import.meta.env.MODE === 'development' ? 'debug' : 'warn'`
  - 비밀 정보 노출 방지 — bindings 에 `service: 'admin'` 만 포함, request body / token 인쇄 금지
  - `shared/lib/index.ts` barrel export 추가
- **Mirror**: 없음 (admin/web 양쪽 신설). [.claude/rules/ecc/common/logging.md](../rules/ecc/common/logging.md) 의 "Never Log" 표 인용
- **Validate**: `npm -w services/admin run build` + `import { logger } from '@/shared/lib'` 통과

#### B2. H5 — AdminGate fail-closed 진단 가드
- **Action**: `AdminGate.tsx:13` 변경
  ```ts
  const isPermissionsValid = Array.isArray(data?.permissions);
  if (data && !isPermissionsValid) {
    logger.error({ keys: data && Object.keys(data) }, 'AdminGate: permissions field missing or non-array');
  }
  const hasAdminPermission = isPermissionsValid && data.permissions.includes(ADMIN_ENTRY_PERMISSION);
  const denied = !isLoading && (isError || !hasAdminPermission);
  ```
  - 주의: `data` 전체를 로그하지 말 것 — userId 등 PII 노출 위험. `Object.keys` 만.
- **Mirror**: logging.md "Never Log" 정책
- **Validate**: 기존 test 통과 + B3

#### B3. AdminGate 회귀 테스트 보강
- **Action**: `AdminGate.test.tsx` 에 케이스 추가
  - `permissions: null`
  - `permissions: undefined`
  - `permissions: []`
  - `permissions: { foo: 'bar' }` (non-array)
- 각 케이스에서 `Navigate to="/login?error=not_admin"` 검증 + `logger.error` 호출 여부 검증 (vi.spy)
- **Validate**: `npm -w services/admin test -- AdminGate`

#### B4. H6 — PrivateRoute silent catch logging
- **Action**: `PrivateRoute.tsx:21` 변경
  ```ts
  .catch((err) => {
    // silent refresh: 새 탭/새로고침 시 비로그인 사용자도 정상 흐름.
    // 로그는 운영 디버깅용, 사용자에게는 노출 안 함.
    logger.warn({ err }, 'silent refresh attempt failed');
  })
  ```
- **Validate**: 기존 회귀 없음 — login 으로 redirect 동작 보존

#### B5. H4 — useTwoFactorPolling 폴링 에러 분기 + completeMutation 로깅
- **Action**:
  - `:21` `const { data, isError } = useChallengeStatusQuery(challengeId, pollEnabled);`
  - effect 안 분기 추가 (DENIED/EXPIRED 분기 직전)
    ```ts
    if (isError) {
      setPollEnabled(false);
      logger.error({ challengeId }, '2FA polling failed');
      navigate('/login?error=2fa_polling_error');
      return;
    }
    ```
  - `:43` `.catch(() => navigate(...))` → `.catch((err) => { logger.error({ err, challengeId }, 'completeTwoFa failed'); navigate('/login?error=2fa_failed'); })`
- **Validate**: 기존 APPROVED 회귀 테스트 통과 + B6

#### B6. H7-4 — useTwoFactorPolling 회귀 테스트
- **Action**: 테스트 추가
  - DENIED 응답 → `?error=2fa_denied` (코드 line 25-29 분기는 존재, 테스트만 0건)
  - EXPIRED 응답 → 동일
  - polling 5xx → `?error=2fa_polling_error` (B5 의 새 분기)
  - 컴포넌트 unmount 시 `pollEnabled` 토글 + queryClient.cancelQueries 검증 (fake timers + cleanup)
- **Validate**: `npm -w services/admin test -- useTwoFactorPolling`

#### B7. M2 + H7-2 — parseApiError type guard + 테스트
- **Action**:
  - 타입 가드 함수 도입
    ```ts
    function isErrorResponse(data: unknown): data is { code?: string; message?: string } {
      return !!data && typeof data === 'object'
        && (!('code' in data) || typeof (data as { code?: unknown }).code === 'string')
        && (!('message' in data) || typeof (data as { message?: unknown }).message === 'string');
    }
    ```
  - `error.response?.data` 를 unknown 으로 좁혀 가드 통과 후만 인용
  - `parseApiError.test.ts` 신설 — 케이스:
    - non-AxiosError (TypeError) → fallback
    - `{ code: 123 }` → fallback (number 거부)
    - 빈 응답 (`undefined`) → fallback
    - `text/html` 응답 → fallback
    - 정상 AxiosError `{ code: 'AUTH_FAIL', message: '...' }` → 값 통과
- **Validate**: 기존 useLogin / useBackupLogin 동작 회귀 없음

#### B8. H7-3 — useLogin 5xx/network 테스트
- **Action**: `useLogin.test.tsx` 에 케이스 추가
  - 502 응답 → mutation.isError + parseApiError fallback 검증
  - MSW `network: 'error'` → 동일
  - timeout (axios timeout config + fake timers) → 동일
- **Validate**: `npm -w services/admin test -- useLogin`

## Validation

```bash
# PR-A
npm -w services/admin run typecheck
npm -w services/admin test -- axiosInstance

# PR-B
npm -w services/admin run typecheck
npm -w services/admin run lint
npm -w services/admin test
npm -w services/admin run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| MSW + fake timers 조합으로 refresh queue 동시성 테스트 deterministic 어려움 | Medium | `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` + `await flushPromises()`. 실패 시 integration test 로 격하 |
| `pino` 클라이언트 번들 사이즈 증가 (~10kb gzipped) | Low | `pino-pretty` 는 dev 만, prod 는 base pino. Vite 의 conditional import 활용 |
| AdminGate test 의 `vi.spy(logger, 'error')` 가 logger 모듈 인스턴스 차이로 spy 안 됨 | Low | logger 모듈을 `vi.mock()` 으로 교체 또는 의존성 주입 패턴 |
| H4 정정 — DENIED/EXPIRED 분기 이미 존재 | (확정) | plan 의 B5/B6 가 정확히 반영: B5 는 polling 에러 + 로깅 신설, B6 는 기존 분기의 테스트 보강 |

## Acceptance

- [ ] PR-A 머지: H1 + H2 + H3 fix + A4 회귀 테스트 통과 + PR description 에 review report H1/H2/H3 인용
- [ ] PR-B 머지: B1~B8 모두 완료 + 4개 테스트 갭 (H7-1/2/3/4) 메움
- [ ] `npm -w services/admin run build` 양쪽 PR 모두 성공
- [ ] logger 의 PII 노출 0건 — code-review 통과
- [ ] PR-A/B 모두 v0.1 base 위에서 conflict 없이 머지

## Delivery Milestones

| 순서 | 마일스톤 | 산출물 | 상태 |
|---|---|---|---|
| M0 | PR #61 머지 + v0.1 통합 | — | pending (외부 의존) |
| M1 | worktree 신설 `.worktrees/admin-pr61-followup/` (base = v0.1) + bootstrap | worktree | pending |
| M2 | PR-A 작성·푸시·머지 (Task A1~A4) | PR + review pass | pending |
| M3 | PR-B 작성·푸시·머지 (Task B1~B8) | PR + review pass | pending |

## Open Questions (확정)

| # | 질문 | 결정 |
|---|---|---|
| 1 | logger 방식 | pino + pino-pretty 클라이언트 wrapper 신설 (Task B1) |
| 2 | services/web 동시 수정 | admin 만 — web 별도 plan 등재 가능 |
| 3 | branch base | v0.1 (PR #61 머지 후) |
| 4 | artifact 저장 | 박제 (본 파일) |

---

**WAIT FOR CONFIRMATION** 이후 다음 단계 — PR #61 머지 시점에 `git worktree add .worktrees/admin-pr61-followup -b feat/admin-pr61-followup v0.1` 로 worktree 신설 + `scripts/worktree-bootstrap.sh` 실행. PR-A 부터 Task A1 → A2 → A3 → A4 순서로 진행.

# PR #61 리뷰 보고서

- **PR**: [#61 feat: services/admin 부트스트랩 — FSD + 로그인/2FA + AdminGate](https://github.com/idenn207/terab/pull/61)
- **base / head**: `v0.1` ← `feat/admin-service-bootstrap`
- **변경 규모**: 113 파일 / +8,547 / -54 (codegen ≈ 3.5K 라인 포함)
- **검토 일자**: 2026-05-29
- **검토 방식**: `/ecc:review-pr` — 멀티 에이전트 6개 병렬 (code-reviewer / typescript-reviewer / security-reviewer / pr-test-analyzer / silent-failure-hunter / code-simplifier)
- **검토 범위**: codegen(`services/admin/src/shared/api/generated/**`) 제외, 실질 ~50 파일
- **판정**: **MERGE 가능 — HIGH 7건은 후속 PR 로 즉시 처리 권장**

## 스코어카드

| 등급 | 건수 | 비고 |
|---|---|---|
| CRITICAL | 0 | 데이터 손실 · 보안 경계 우회 · 즉시 차단 사유 없음 |
| HIGH | 7 | refresh queue 타입 갭 (3) · 2FA/AdminGate logging (2) · PrivateRoute silent catch (1) · 테스트 갭 (1) |
| MEDIUM | 7 | AdminGate effect 중복 · parseApiError 캐스트 · codegen 유니온 · 테스트 갭 (2) · 가독성 (2) |
| LOW | 5 | timeout · 상수화 · MSW reset · status fallback · AbortController |

## 통합 신호 — 다중 에이전트 일치도

| 결함 영역 | 일치 에이전트 | 신호 강도 |
|---|---|---|
| `axiosInstance.ts` refresh queue 타입 갭 | ts-reviewer (3) + simplifier (1) + test-analyzer (1) | 매우 강함 |
| `AdminGate` permissions 가드 · 중복 effect | ts-reviewer + silent-hunter + test-analyzer | 강함 |
| `useTwoFactorPolling` 종결 분기 · 로깅 | silent-hunter + test-analyzer + simplifier | 강함 |
| `PrivateRoute` silent catch · floating promise | silent-hunter + ts-reviewer | 보통 |
| `parseApiError` 캐스트 · 미테스트 | ts-reviewer + test-analyzer + simplifier | 보통 |

> code-reviewer 단독 결과(0건 APPROVE)는 다른 4개 에이전트가 같은 파일에서 독립적으로 결함을 발견했으므로 채택하지 않음. security-reviewer 는 모델 한도 도달로 미실행 — 보안 인접 이슈는 silent-hunter / ts-reviewer 의 refresh race · silent catch · AdminGate 발견으로 부분 커버.

---

## CRITICAL

없음. PR description 의 review fix(M1~M4, L1~L6)는 이미 반영됨이 확인됨.

---

## HIGH

### H1. `axiosInstance.ts` — refresh response 타입에 미사용 `user: unknown` 잔존
- **위치**: [services/admin/src/shared/api/axiosInstance.ts:63](../../services/admin/src/shared/api/axiosInstance.ts#L63)
- **문제**: `axios.post<{ accessToken: string; user: unknown }>` — `user` 필드는 응답에서 read 되지 않음. 백엔드 계약이 `user` 를 보내지 않으면 type lie.
- **수정**: `axios.post<{ accessToken: string }>` 로 축소.
- **신호**: ts-reviewer LOW-1 (95%) + simplifier HIGH-1 (95%)

### H2. `axiosInstance.ts` — `processQueue(null, token!)` non-null assertion
- **위치**: [services/admin/src/shared/api/axiosInstance.ts:29](../../services/admin/src/shared/api/axiosInstance.ts#L29) 부근
- **문제**: `error` 가 falsy 이고 `token` 도 null 인 logic-bug 경로에서 `'Bearer null'` 헤더가 후속 요청에 주입될 수 있음. fail-closed 가드 부재.
- **수정**:
  ```ts
  } else if (token) {
    prom.resolve(token);
  } else {
    prom.reject(new Error('No token available'));
  }
  ```
- **신호**: ts-reviewer HIGH-2 (85%)

### H3. `axiosInstance.ts` — `error.config` 캐스트가 null guard 없이 진행
- **위치**: [services/admin/src/shared/api/axiosInstance.ts:39](../../services/admin/src/shared/api/axiosInstance.ts#L39)
- **문제**: 네트워크 레벨 실패(`AxiosError.config === undefined`) 시 `originalRequest.url` / `.headers` 접근에서 런타임 crash.
- **수정**: 캐스트 앞에 `if (!error.config) throw error;` 삽입.
- **신호**: ts-reviewer HIGH-3 (80%)

### H4. `useTwoFactorPolling.ts` — APPROVED 외 종결 상태(EXPIRED/DENIED) 분기 + 폴링 에러 무처리
- **위치**: [services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.ts](../../services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.ts)
- **문제**:
  - `useChallengeStatusQuery` 의 `isError`/`error` 미사용 → 폴링이 5xx 로 죽으면 UI 가 "승인 대기" 상태로 영원히 머무름
  - EXPIRED/DENIED 종결 상태 분기 회귀 테스트 0건
  - `completeMutation.catch` 에서 에러를 swallow 후 `2fa_failed` 로만 매핑 → 디버깅 불가
- **수정**:
  - `isError` destructure 후 폴링 실패 사용자 알림
  - `.catch((err) => { logger.error({ err }, 'completeMutation failed'); navigate('/login?error=2fa_failed'); })`
  - EXPIRED / DENIED 별 user-facing 메시지
- **신호**: silent-hunter HIGH-4 + CRITICAL-3 + test-analyzer HIGH (3중 일치)

### H5. `AdminGate.tsx` — `permissions` 필드 누락 시 silent deny (디버깅 불가)
- **위치**: [services/admin/src/shared/router/AdminGate.tsx:13](../../services/admin/src/shared/router/AdminGate.tsx#L13)
- **문제**: `!data?.permissions?.includes(...)` 는 fail-closed 라 보안적으로는 정확하지만, API 회귀로 `permissions` 필드가 누락되면 모든 admin 이 silently lockout + 로그 0건.
- **수정**:
  ```ts
  if (data && !Array.isArray(data.permissions)) {
    logger.error({ data }, 'AdminGate: permissions field missing or non-array');
  }
  const hasAdminPermission = Array.isArray(data?.permissions)
    && data.permissions.includes(ADMIN_ENTRY_PERMISSION);
  ```
- **신호**: silent-hunter CRITICAL-2 + ts-reviewer MEDIUM-3 + test-analyzer MEDIUM (3중 일치)

### H6. `PrivateRoute.tsx` — refresh 실패 silent `.catch(() => {})`
- **위치**: [services/admin/src/shared/router/PrivateRoute.tsx:17](../../services/admin/src/shared/router/PrivateRoute.tsx#L17) 부근
- **문제**: 새 탭/세션 silent refresh 시도는 의도적이지만 5xx/network 실패가 0 로그로 묻혀 운영 디버깅 불가. fire-and-forget 패턴 자체는 OK, 로깅만 부재.
- **수정**: `.catch((err) => { logger.warn({ err }, 'silent refresh failed'); })` + 의도 주석으로 fire-and-forget 표명.
- **신호**: silent-hunter CRITICAL-1 + ts-reviewer MEDIUM-5

### H7. 테스트 갭 (4건 묶음) — confidence 95~100%
| 갭 | 위치 | 검증 시나리오 |
|---|---|---|
| refresh queue 동시성 | [shared/api/axiosInstance.ts](../../services/admin/src/shared/api/axiosInstance.ts) | 동시 401 → 단일 refresh → queue drain |
| parseApiError 비-Axios 분기 | [shared/api/parseApiError.ts](../../services/admin/src/shared/api/parseApiError.ts) | timeout / CORS / 비표준 error |
| useLogin 5xx · network | [features/login-by-credentials/model/useLogin.test.tsx](../../services/admin/src/features/login-by-credentials/model/useLogin.test.tsx) | 502 / timeout / no-network |
| useTwoFactorPolling EXPIRED/DENIED + cleanup | [features/login-by-2fa/model/useTwoFactorPolling.test.tsx](../../services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx) | 종결 분기 · unmount 시 poll cleanup |
- **신호**: pr-test-analyzer HIGH (모두 95~100%)

---

## MEDIUM

### M1. `AdminGate.tsx` — `denied` 매 렌더링 재계산으로 `clearAuth` 중복 호출
- **위치**: [services/admin/src/shared/router/AdminGate.tsx:15](../../services/admin/src/shared/router/AdminGate.tsx#L15)
- **수정**: `useRef` 로 first-denial 만 트래킹하거나, derived state 추출.
- **신호**: silent-hunter MEDIUM

### M2. `parseApiError.ts` — 응답 데이터 unsafe 캐스트
- **위치**: [services/admin/src/shared/api/parseApiError.ts:5](../../services/admin/src/shared/api/parseApiError.ts#L5)
- **수정**: type guard 함수 도입 — `{ code: 123 }` 등 비정상 응답 안전 처리.
- **신호**: ts-reviewer MEDIUM-2 (65%)

### M3. codegen 유니온 → manual `as ChallengeStatusPendingDto` 캐스트
- **위치**: [services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.ts:56-57](../../services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.ts#L56-L57)
- **문제**: 코드 자체가 아닌 codegen 측 design smell — OpenAPI spec 에 `discriminator` 미선언.
- **수정**: 백엔드 OpenAPI decorator 에 `@ApiExtraModels` + `discriminator` 추가 후 codegen 재실행. 또는 type guard 함수.
- **신호**: ts-reviewer MEDIUM-1

### M4. `LoginForm` — submit-disabled-while-pending 미테스트
- **위치**: [services/admin/src/features/login-by-credentials/ui/LoginForm.test.tsx](../../services/admin/src/features/login-by-credentials/ui/LoginForm.test.tsx)
- **수정**: `useLogin().isLoading` 시 버튼 disabled 검증 + 더블 클릭 mutation 1회 검증.
- **신호**: test-analyzer MEDIUM (85%)

### M5. `role.service.getPermissionsByUserId` — RBAC 조인 로직 미테스트
- **위치**: [services/api/src/auth/role/role.service.ts](../../services/api/src/auth/role/role.service.ts) 부근
- **문제**: `user.service.spec.ts` 가 `RoleService.getPermissionsByUserId` 를 mock 하므로 실제 DB join 정확성은 unverified. 잘못된 권한 노출 위험 잠재.
- **수정**: `role.service.spec.ts` 신설 — 다중 role / empty role / inherited permission 케이스.
- **신호**: test-analyzer MEDIUM (80%)

### M6. `router/config.tsx` — 4개 단일 element 배열 분할이 noise
- **위치**: [services/admin/src/app/providers/router/config.tsx:6-40](../../services/admin/src/app/providers/router/config.tsx#L6-L40)
- **수정**: `rootRoutes` / `authRoutes` / `adminRoutes` / `fallbackRoutes` 인라인 통합 + 섹션 주석.
- **신호**: simplifier MEDIUM-1 (78%)

### M7. `useLogin.ts` — 기본 에러 객체 module-scope 추출
- **위치**: [services/admin/src/features/login-by-credentials/model/useLogin.ts:32](../../services/admin/src/features/login-by-credentials/model/useLogin.ts#L32)
- **수정**: 모듈 상단 `const DEFAULT_LOGIN_ERROR = { code: 'UNKNOWN', message: LOGIN_ERROR_MESSAGES.UNKNOWN } as const` — `LOGIN_ERROR_MESSAGES.UNKNOWN` sync 지점 단일화.
- **신호**: simplifier MEDIUM-5 (82%)

---

## LOW

| ID | 위치 | 결함 | 수정 | 신호 |
|---|---|---|---|---|
| L1 | [PrivateRoute.tsx](../../services/admin/src/shared/router/PrivateRoute.tsx) refresh call | timeout 부재 → UX hang | `AbortController` + 5s timeout | silent-hunter LOW-9 |
| L2 | [api-provider.tsx:11](../../services/admin/src/app/providers/api-provider.tsx#L11) | `staleTime: 1000 * 60` hardcode | `DEFAULT_QUERY_STALE_TIME_MS = 60_000` 명명 | simplifier LOW-6 |
| L3 | [`__tests__/setup.ts`](../../services/admin/src/__tests__/setup.ts) | `server.resetHandlers()` afterEach 부재 | 테스트 isolation 명시 | test-analyzer 품질 |
| L4 | [useBackupLogin.ts:25](../../services/admin/src/features/login-by-2fa/model/useBackupLogin.ts#L25) | `AUTHENTICATED` 외 status fallback 부재 (silent hang) | else 분기 + 로그 | silent-hunter LOW-10 |
| L5 | [axiosInstance.ts](../../services/admin/src/shared/api/axiosInstance.ts) failedQueue | AbortController 미연동 → 장기 SPA 세션 메모리 누수 가능 | 우선순위 낮음 — 향후 refactor 시 검토 | ts-reviewer LOW-2 (50%) |

---

## 통합 권장 후속 액션

### 1. 즉시 후속 PR (S-size, ~30분)
- **묶음**: H1 + H2 + H3
- **scope**: [services/admin/src/shared/api/axiosInstance.ts](../../services/admin/src/shared/api/axiosInstance.ts) 타입 안전성 한 번에 정리
- **테스트**: H7 의 refresh queue 동시성 spec 동반 (fake timers + MSW)

### 2. 단기 후속 PR (M-size, ~2시간)
- **묶음**: H4 + H5 + H6 — 2FA · AdminGate · PrivateRoute 로깅 일괄
- **테스트**: H7 의 EXPIRED/DENIED · parseApiError 비-Axios · useLogin 5xx 동반
- **logger 의존**: [shared/lib/logger](../../services/admin/src/shared/lib/) 가 없다면 services/web 의 logger 패턴 미러 — pino-pretty 클라이언트 wrapper

### 3. 별도 worktree
- **M3**: codegen discriminated union 재생성 — `openapi-ts.config.ts` 와 백엔드 OpenAPI decorator(`@ApiExtraModels` + `discriminator`) 동시 수정. 영향 큼 (모든 polymorphic DTO 영향).

### 4. PRD M3 연결
- 본 PR 의 PR description 이 명시한 "서버측 `@Permission('user:manage')` guard 의무" 는 다음 milestone 에서 H5 의 fail-closed 가드 + 진단 로그와 함께 enforce.

---

## 부록 — 검토에서 확인된 좋은 패턴

> 후속 작업에서 참조할 수 있는 well-done 영역. 회귀 방지에 활용.

1. **`buildUserResponse()` 응답 합성 통합** — services/api 의 4개 합성 지점 단일 헬퍼로 수렴. PR description 의 약속을 코드가 실제로 지킴.
2. **`extract-public-paths.mjs` method-mixed security 빌드 실패 가드 (chore M1)** — OpenAPI spec 의 부분 public 변경을 컴파일 타임 차단. 옳은 자리에서 fail-loudly.
3. **`useTwoFactorPolling` `completedRef` 1-shot 가드 + 회귀 테스트** — APPROVED 재호출 결함의 재발 차단. M2 fix 정확.
4. **catalyst 임시 정책 박제** — services/admin/CLAUDE.md 에 v1.X 마이그레이션 대상 명시. mobile-ui-guide §8 정책과 정합.
5. **FSD 레이어 의존 단방향 준수** — 검토 범위 50 파일 중 upward import 0건.

---

## 검토 한계

- **security-reviewer 미실행**: 모델 한도 도달로 보안 단독 패스 부재. 보안 인접 발견(refresh race · silent catch · AdminGate fail-closed)으로 부분 커버되었으나, JWT 라이프사이클 / refresh token rotation / CSRF / 토큰 저장 위치(localStorage vs httpOnly cookie) 등 일부 보안 점검은 후속 패스 필요.
- **code-reviewer 0건 결과**: 다른 에이전트들이 같은 파일에서 결함을 독립 발견했으므로 채택하지 않음. 본 보고서는 4개 에이전트의 일치 신호만 신뢰.
- **comment-analyzer 미실행**: review-pr 스킬의 6번째 에이전트 미돌림. 본 PR 은 주석량이 적고 PR description 이 의도를 충분히 설명하므로 영향 낮음.

---

검토자: Claude Opus 4.7 (terab `c:\_project\my\terab` 메인 워크트리)
관련 산출물: [.claude/plans/completed/admin-login-twofa.plan.md](../plans/completed/admin-login-twofa.plan.md) · PR description 참조 review docs (worktree local, git 미추적)

---
name: admin-login-twofa
description: services/admin 의 A-01 관리자 로그인 — D-01 ID/PW + Push 2FA + backup code 흐름 재사용 + ADMIN permission claim 검증 게이트
status: in-progress
created: 2026-05-28
decisions:
  - 2026-05-28 — permission 전달 방식 (A) LoginResponse / UserDto 확장 채택. JWT decode 미도입.
---

# Plan: A-01 관리자 로그인 (services/admin M2)

**Source PRD**: [.claude/prds/admin-service-bootstrap.prd.md](../prds/admin-service-bootstrap.prd.md)
**Selected Milestone**: M2 — A-01 관리자 로그인 동작
**Complexity**: Large (M1 은 인프라 surface 가 넓었고 M2 는 **frontend code surface** 가 넓다 — FSD 7+ 슬라이스, codegen, router, axios interceptor, 2FA polling, permission gate)

## Summary

services/admin 에 D-01 의 ID/PW + Push 2FA + backup code 로그인 흐름을 그대로 미러하여 이식하고, 마지막 단계로 `AdminGate` 를 추가해 **`user:manage` permission 보유 사용자만 admin shell 진입을 허용**한다. API 엔드포인트(`/auth/login`, `/auth/login-backup`, `/auth/refresh`, `/twofa/*`, `/user/me`)는 web 과 동일하게 재사용한다 — 본 M2 범위에 신규 API 엔드포인트는 없다.

PRD 의 "ADMIN role claim" 은 literal 이 아니라 **permission 마커**로 해석한다 — 현 JWT payload 는 `{ sub, username, permissions: string[] }` 만 담고 role 클레임이 없으며, RBAC seeder([services/api/src/database/seed/rbac.seeder.ts:24-41](../../services/api/src/database/seed/rbac.seeder.ts))의 `ROLE_PERMISSIONS` 에 따르면 `user:manage` 가 ADMIN 에만 부여되는 가장 자연스러운 식별자이다.

> **단일 design decision — user confirm 필요**: ADMIN 식별을 위한 permission 정보 전달 방식
>
> | 옵션 | 변경 위치 | trade-off |
> |---|---|---|
> | **(A) LoginResponse 확장** | services/api `LoginResponseDto.user` 에 `permissions: string[]` 추가 (한 줄 DTO + login.service.ts 한 곳 채움) | API 측 작은 변경 발생. 단일 source of truth. /user/me 응답에도 동일 필드 추가하면 web 도 활용 가능 |
> | **(B) client-side JWT decode** | services/admin 에 `jwt-decode` 의존성 추가, client 에서 payload.permissions 직접 읽음 | API 무변경. 단, JWT 디코드 라이브러리 추가 + payload 구조에 admin frontend 가 결합됨 |
>
> 본 plan 은 **(A) LoginResponse 확장** 을 기본으로 작성한다 — 추후 `/user/me` 응답 확장 + web 도 동일 활용 가능. 사용자가 (B) 를 선호하면 Task 8 + 영향 받는 Files 표만 교체.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| FSD 로그인 슬라이스 | [services/web/src/features/login-by-credentials/](../../services/web/src/features/login-by-credentials/) | `api/mutation.ts` (codegen wrapper) + `model/useLogin.ts` (LoginCredentials, navigate 분기) + `ui/LoginForm.tsx` (RHF) + `model/loginErrors.ts` (에러 코드 → 메시지 매핑) + `index.ts` (barrel) |
| Push 2FA polling | [services/web/src/features/login-by-2fa/model/useTwoFactorPolling.ts](../../services/web/src/features/login-by-2fa/model/useTwoFactorPolling.ts) | `useChallengeStatusQuery` polling + `APPROVED → completeTwoFa → setAuth → navigate(/drive)` 분기 |
| Backup code login | [services/web/src/features/login-by-2fa/model/useBackupLogin.ts](../../services/web/src/features/login-by-2fa/model/useBackupLogin.ts) | `/auth/login-backup` mutation 호출 |
| Logout | [services/web/src/features/logout/](../../services/web/src/features/logout/) | clearAuth + `/auth/logout` mutation |
| user store (zustand) | [services/web/src/entities/user/model/store.ts](../../services/web/src/entities/user/model/store.ts) | `{ accessToken, user, setAuth, setAccessToken, clearAuth }` |
| user query (TanStack) | [services/web/src/entities/user/api/userApi.ts](../../services/web/src/entities/user/api/userApi.ts), [api/query.ts](../../services/web/src/entities/user/api/query.ts) | `useMeQuery` |
| axios interceptor + refresh queue | [services/web/src/shared/api/axiosInstance.ts](../../services/web/src/shared/api/axiosInstance.ts) | `isPublicPath` 분기 + 401 refresh queue + `window.location.href = '/login'` fallback. **`axiosBasic` / `axiosAuth` 레거시 별칭은 신규 admin 에는 미도입** (admin 은 단일 인스턴스로 시작 — web 의 follow-up 부담 안 짊어짐) |
| hey-api codegen 설정 | [services/web/openapi-ts.config.ts](../../services/web/openapi-ts.config.ts) (web 에 동일 파일 존재 가정 — Plan Task 3 에서 위치 확인 후 미러) | `@hey-api/openapi-ts` config 그대로 미러. base url, plugins 동일 |
| Codegen wrapper 패턴 | [services/web/src/shared/api/index.ts](../../services/web/src/shared/api/index.ts) | `@shared/api` 단일 진입점. `generated/` 직접 import 금지 |
| Router 구조 | [services/web/src/app/providers/router/config.tsx](../../services/web/src/app/providers/router/config.tsx) | `<AppShell>` 루트 → `[authRoutes, appRoutes]` 분기. `PrivateRoute` 로 인증 게이트 |
| PrivateRoute | [services/web/src/shared/router/](../../services/web/src/shared/router/) (예상 위치) | accessToken 부재 시 `/login` 리다이렉트 |
| AuthLayout 위젯 | [services/web/src/widgets/auth-layout/](../../services/web/src/widgets/auth-layout/) | 로그인/2FA/backup 화면 공통 레이아웃 (Logo + 중앙 컨테이너) |
| Catalyst UI 기반 form | [services/web/src/shared/ui/catalyst/](../../services/web/src/shared/ui/catalyst/) | `Button`, `Field`, `Input`, `Label`, `Heading` — admin 도 임시 catalyst 도입 (memory `project_catalyst_ui_temporary` 참조: v1.0 직전 headless 재구성 예정이라 admin 도 동일 임시 전략) |
| API 에러 파싱 | [services/web/src/shared/api/parseApiError.ts](../../services/web/src/shared/api/parseApiError.ts) (예상 경로) | axios 에러 → `{ code, message }` |
| nginx `/api/` proxy | [services/nginx/conf.d/admin.conf](../../services/nginx/conf.d/admin.conf) (M1 에서 추가됨) | admin 컨테이너의 `/api/*` 가 같은 nginx 박스를 통해 `api:3000` 으로 proxy_pass — admin frontend 는 web 과 동일하게 `baseURL: '/api'` |

> **새 패턴 발명 금지**. web 의 슬라이스를 1:1 미러하되, admin 의 특수성(`AdminGate`)만 추가한다.

## Files to Change

### CREATE — services/admin/src (FSD 슬라이스)

| File | Action | Why |
|---|---|---|
| `services/admin/src/main.tsx` | UPDATE | `<RouterProvider>` + `<QueryClientProvider>` 래핑 — web 의 `app/providers` 진입점 미러 |
| `services/admin/src/App.tsx` | DELETE | M1 placeholder. 라우터 도입으로 불필요 |
| `services/admin/src/app/providers/AppShell.tsx` | CREATE | web 미러 — 글로벌 toast / suspense / theme provider 컨테이너 (web 의 AppShell 이 light 면 그대로 복제) |
| `services/admin/src/app/providers/api-provider.tsx` | CREATE | `QueryClientProvider` |
| `services/admin/src/app/providers/router/config.tsx` | CREATE | admin 라우트 정의 — `<Navigate to="/login">` + `/login` (LoginPage) + `/login/2fa` + `/login/backup` + `/admin` (PrivateRoute + AdminGate + AdminPlaceholderPage). `/2fa/:id` 는 admin 도 동일하게 필요한가? — **M2 에서 제외**: admin push approval 페이지는 admin 운영자 한 명만 사용하고, web 의 `/2fa/:id` 는 모바일 앱이 deep link 로 진입하는 경로라 admin 사용 사례 없음 |
| `services/admin/src/app/providers/router/index.tsx` | CREATE | `createBrowserRouter(routes)` |
| `services/admin/src/app/providers/index.ts` | CREATE | barrel |
| `services/admin/src/shared/api/axiosInstance.ts` | CREATE | web 미러 — 단, `axiosBasic`/`axiosAuth` 레거시 별칭 **제외**. `baseURL: '/api'`, `withCredentials: true`, request interceptor (`isPublicPath` 분기 + Authorization 부착), response 401 refresh queue. fallback `window.location.href = '/login'` |
| `services/admin/src/shared/api/parseApiError.ts` | CREATE | web 미러 |
| `services/admin/src/shared/api/generated/` | CREATE (codegen) | `npm run openapi:codegen` 산출물 — `services/admin/openapi-ts.config.ts` 로 생성. **git tracked** (web 정책 미러) |
| `services/admin/src/shared/api/generated/public-paths.gen.ts` | CREATE (codegen) | `isPublicPath` — hey-api plugin 또는 별도 generator. web 의 패턴 그대로 |
| `services/admin/src/shared/api/index.ts` | CREATE | `@shared/api` 단일 진입점 |
| `services/admin/src/shared/router/PrivateRoute.tsx` | CREATE | web 미러 — accessToken 부재 시 `<Navigate to="/login" replace>` |
| `services/admin/src/shared/router/AdminGate.tsx` | CREATE | **신규 — admin 전용**. `useMeQuery` 결과의 `permissions.includes('user:manage')` 검증. 미보유 시 `clearAuth()` + `<Navigate to="/login?error=not_admin">` |
| `services/admin/src/shared/router/index.ts` | CREATE | barrel — PrivateRoute, AdminGate |
| `services/admin/src/shared/ui/catalyst/` | CREATE | web 의 catalyst 디렉토리 그대로 복제 (Button, Field, Input, Label, Heading 만 우선 — login 화면용 최소 subset). memory `project_catalyst_ui_temporary` 에 따라 v1.0 시점에 headless 재구성 예정이므로 admin 도 동일 임시 전략 적용 |
| `services/admin/src/shared/ui/index.ts` | CREATE | barrel |
| `services/admin/src/shared/lib/utils/cn.ts` | CREATE | clsx + tailwind-merge wrapper (web 미러) |
| `services/admin/src/shared/assets/LogoLabel.tsx` | CREATE | web 의 LogoLabel 미러 — 로고 자체는 동일하되 텍스트 "terab admin" 으로 변경 |
| `services/admin/src/entities/user/model/store.ts` | CREATE | web 미러 — Zustand `useUserStore` |
| `services/admin/src/entities/user/model/types.ts` | CREATE | `User` 타입 — (옵션 A 시) `permissions: string[]` 필드 포함 |
| `services/admin/src/entities/user/api/userApi.ts` | CREATE | `getUserMe` (axios 직접 호출 — `axiosBasic` 의존을 끊었으므로 단일 axiosInstance 사용) |
| `services/admin/src/entities/user/api/query.ts` | CREATE | `useMeQuery` (TanStack Query options) |
| `services/admin/src/entities/user/index.ts` | CREATE | barrel — useUserStore, useMeQuery, User type |
| `services/admin/src/entities/index.ts` | CREATE | barrel |
| `services/admin/src/features/login-by-credentials/api/mutation.ts` | CREATE | `useLoginMutation` (hey-api `loginMutation` 래핑) |
| `services/admin/src/features/login-by-credentials/model/loginErrors.ts` | CREATE | web 미러 |
| `services/admin/src/features/login-by-credentials/model/useLogin.ts` | CREATE | web 미러 — 단, `navigate('/drive')` 대신 `navigate('/admin')` (admin shell) |
| `services/admin/src/features/login-by-credentials/ui/LoginForm.tsx` | CREATE | web 미러 — RHF + Field/Input/Button |
| `services/admin/src/features/login-by-credentials/index.ts` | CREATE | barrel |
| `services/admin/src/features/login-by-2fa/api/mutation.ts` | CREATE | `useCompleteTwoFaMutation`, `useResendChallengeMutation`, `useBackupLoginMutation` |
| `services/admin/src/features/login-by-2fa/api/query.ts` | CREATE | `useChallengeStatusQuery` (polling) |
| `services/admin/src/features/login-by-2fa/model/twoFactorErrors.ts` | CREATE | web 미러 |
| `services/admin/src/features/login-by-2fa/model/useTwoFactorPolling.ts` | CREATE | web 미러 — `navigate('/admin')` 으로 분기 변경 |
| `services/admin/src/features/login-by-2fa/model/useBackupLogin.ts` | CREATE | web 미러 — `navigate('/admin')` |
| `services/admin/src/features/login-by-2fa/ui/TwoFactorWaiting.tsx` | CREATE | web 미러 (TrustThisDeviceCheckbox 는 본 M2 에서 제외 — admin 단일 데스크탑 운영자 사용 사례에서 trustToken 가치 낮음, 후속에서 결정) |
| `services/admin/src/features/login-by-2fa/ui/TwoFactorBackupEntry.tsx` | CREATE | web 미러 |
| `services/admin/src/features/login-by-2fa/index.ts` | CREATE | barrel |
| `services/admin/src/features/logout/api/mutation.ts` | CREATE | web 미러 |
| `services/admin/src/features/logout/model/useLogout.ts` | CREATE | web 미러 |
| `services/admin/src/features/logout/index.ts` | CREATE | barrel |
| `services/admin/src/features/index.ts` | CREATE | barrel |
| `services/admin/src/widgets/auth-layout/ui/AuthLayout.tsx` | CREATE | web 미러 — `<Outlet>` + 중앙 정렬 컨테이너 |
| `services/admin/src/widgets/auth-layout/index.ts` | CREATE | barrel |
| `services/admin/src/widgets/admin-layout/ui/AdminLayout.tsx` | CREATE | 좌측 사이드바 placeholder + `<Outlet>`. M3 에서 실제 메뉴 채움 |
| `services/admin/src/widgets/admin-layout/index.ts` | CREATE | barrel |
| `services/admin/src/widgets/index.ts` | CREATE | barrel |
| `services/admin/src/pages/login/ui/LoginPage.tsx` | CREATE | web 미러 |
| `services/admin/src/pages/login-twofa/ui/TwoFAWaitPage.tsx` | CREATE | web 미러 |
| `services/admin/src/pages/login-twofa/ui/TwoFABackupPage.tsx` | CREATE | web 미러 |
| `services/admin/src/pages/admin/ui/AdminPlaceholderPage.tsx` | CREATE | "terab admin 콘솔에 로그인되었습니다. (M3 에서 사용자 목록 / 초대 추가 예정)" + 로그아웃 버튼. M3 에서 dashboard 로 교체 |
| `services/admin/src/pages/index.ts` | CREATE | barrel |
| `services/admin/openapi-ts.config.ts` | CREATE | services/web 의 openapi-ts.config.ts 미러. 출력 디렉토리 `src/shared/api/generated`. **admin tag filter 분기 없음** — M3 의 `/admin/*` 엔드포인트 신설 후 결정 |

### UPDATE — services/admin 기존 파일

| File | Action | Why |
|---|---|---|
| `services/admin/package.json` | UPDATE | dependencies 추가: `react-router-dom`, `axios`, `@tanstack/react-query`, `@hey-api/client-axios`, `react-hook-form`, `zustand`, `@headlessui/react`, `@heroicons/react`. devDependencies 추가: `@hey-api/openapi-ts`. scripts 추가: `"openapi:codegen": "openapi-ts"`. **`@capacitor/*`, `motion`, `cva`, `msw`, `cross-env` 는 본 M2 에서도 미도입** — admin 의 catalyst 가 cva 사용 시에만 cva 추가 (Task 1 에서 web 의 catalyst 소스 검토 후 결정) |
| `services/admin/CLAUDE.md` | UPDATE | M1 시점 표 갱신 — catalyst/hey-api/axios/react-router/zustand 항목을 ✅ 로 변경. M2 시점 FSD 레이어 상태 갱신 |

### UPDATE — services/api (옵션 A 선택 시)

| File | Action | Why |
|---|---|---|
| `services/api/src/auth/dto/login-response.dto.ts` | UPDATE | `user.permissions: string[]` 필드 추가 (`@ApiProperty({ type: [String] })`) |
| `services/api/src/auth/login.service.ts` | UPDATE | `login`, `loginWithBackupCode`, `refresh`, `register` 의 user 객체에 `permissions` 채움 — `RoleService.getPermissionsByUserId` 재사용. 4 군데 |
| `services/api/src/auth/auth.service.ts` | UPDATE | `issueAfterTwoFa` 의 user 객체에도 동일 필드 채움. 1 군데 |
| `services/api/src/common/dto/user.dto.ts` | UPDATE | `UserDto` 에 `permissions: string[]` 추가 (`/user/me` 응답에도 노출) |
| `services/api/src/user/user.service.ts` | UPDATE | `getCurrentUser` 가 `RoleService.getPermissionsByUserId` 호출 후 permissions 포함해 반환 |
| `services/api/src/user/user.service.spec.ts` | UPDATE | permissions 필드 검증 추가 |
| `services/api/src/auth/login.service.spec.ts` | UPDATE | permissions 필드 검증 추가 |
| `services/api/src/auth/auth.service.spec.ts` | UPDATE | permissions 필드 검증 추가 |

> **옵션 B 선택 시 위 services/api 변경은 모두 미반영**, 대신 `services/admin/package.json` 에 `jwt-decode` 추가 + `services/admin/src/entities/user/model/jwt.ts` 신설.

### UPDATE — PRD 메타데이터

| File | Action | Why |
|---|---|---|
| `.claude/prds/admin-service-bootstrap.prd.md` | UPDATE | Delivery Milestones 표의 M2 row: `Status pending → in-progress`, `Plan` 셀에 `.claude/plans/admin-login-twofa.plan.md` 기입. 다른 row 비편집 |

## Tasks

> 각 Task 는 단일 검증 가능 단위. TDD 우선 — model/hook 테스트는 web 의 동일 위치 spec 을 동시 미러 후 vitest 통과시킨다.

### Task 1: services/admin/package.json 의존성 확장 + catalyst UI 복제 + cn 유틸

- **Action**:
  1. `services/admin/package.json` dependencies 에 `react-router-dom`, `axios`, `@tanstack/react-query`, `@hey-api/client-axios`, `react-hook-form`, `zustand`, `@headlessui/react`, `@heroicons/react` 추가. version 은 `services/web/package.json` 과 정확히 일치
  2. devDependencies 에 `@hey-api/openapi-ts` 추가 — web 과 동일 version
  3. scripts 에 `"openapi:codegen": "openapi-ts"` 추가
  4. `npm install` 실행 — lockfile commit
  5. `services/web/src/shared/ui/catalyst/{Button,Field,Input,Label,Heading}.tsx` 미러 → `services/admin/src/shared/ui/catalyst/`. **catalyst 가 cva 의존 시** package.json 에 cva 추가
  6. `services/web/src/shared/lib/utils/cn.ts` 미러 → `services/admin/src/shared/lib/utils/cn.ts`
- **Mirror**: services/web/package.json, services/web/src/shared/ui/catalyst, services/web/src/shared/lib/utils/cn.ts
- **Validate**:
  ```bash
  cd services/admin
  npm install
  npm run lint   # catalyst 파일 import 경로 검증
  npm run build  # tsc -b 통과 (라우터 미적용 상태에서 빌드만 통과 확인)
  ```

### Task 2: services/admin/src/shared/api — axios + interceptor + parseApiError

- **Action**:
  1. `services/admin/src/shared/api/axiosInstance.ts` 작성 — web 미러하되 `axiosBasic`/`axiosAuth` 별칭 **제외**. `isPublicPath` import 는 일단 `() => false` 임시 stub 또는 빈 배열 기반 헬퍼로 시작 (Task 3 에서 codegen 산출물로 교체)
  2. `parseApiError.ts` web 미러
  3. `index.ts` 작성 — `axiosInstance`, `parseApiError`, `isPublicPath` re-export
- **Mirror**: services/web/src/shared/api/{axiosInstance.ts, parseApiError.ts, index.ts}
- **Validate**:
  ```bash
  npm run lint
  npm run build
  ```

### Task 3: openapi-ts codegen 설정 + 산출물 생성

- **Action**:
  1. `services/admin/openapi-ts.config.ts` 작성 — services/web 의 동일 파일 미러. `input` 은 dev API 서버 (`http://localhost:3000/json` 가정 — web 의 설정으로 확인), `output` 은 `src/shared/api/generated`
  2. dev 환경에서 `cd services/api && npm run start:dev` 가 켜져 있는 상태에서 `cd services/admin && npm run openapi:codegen` 실행
  3. 생성된 `src/shared/api/generated/` 디렉토리 + `public-paths.gen.ts` (있을 경우) 그대로 commit
  4. Task 2 의 임시 `isPublicPath` stub 을 generated import 로 교체
- **Mirror**: services/web/openapi-ts.config.ts
- **Validate**:
  ```bash
  ls services/admin/src/shared/api/generated/   # sdk.gen.ts, types.gen.ts, public-paths.gen.ts 등 존재
  npm run build                                  # 생성된 타입 import 통과
  ```

### Task 4: entities/user — zustand store + useMeQuery

- **Action**:
  1. `entities/user/model/types.ts` — `User` 타입 정의 (id, username, nickname, permissions: string[]). 옵션 A 채택 시 codegen 의 UserDto 타입을 그대로 re-export 또는 alias 가능
  2. `entities/user/model/store.ts` — web 미러
  3. `entities/user/api/userApi.ts` — `getUserMe` (codegen 의 `userControllerMe` 또는 `userMeOptions` wrapper)
  4. `entities/user/api/query.ts` — `useMeQuery` (TanStack Query options)
  5. `entities/user/index.ts` + `entities/index.ts` barrel
  6. `model/store.spec.ts` 작성 (web 의 spec 미러)
- **Mirror**: services/web/src/entities/user/**
- **Validate**:
  ```bash
  npx vitest run src/entities/user/model/store.test.ts
  npm run build
  ```

### Task 5: features/login-by-credentials 미러

- **Action**:
  1. `api/mutation.ts` — `useLoginMutation` (hey-api `loginMutation` 래핑)
  2. `model/loginErrors.ts` — web 동일
  3. `model/useLogin.ts` — web 미러, `navigate('/drive')` → `navigate('/admin')`
  4. `ui/LoginForm.tsx` — web 미러
  5. `index.ts` barrel — model + ui 만 export, api 비공개
  6. `model/useLogin.test.tsx`, `ui/LoginForm.test.tsx` web spec 미러
- **Mirror**: services/web/src/features/login-by-credentials/**
- **Validate**:
  ```bash
  npx vitest run src/features/login-by-credentials
  ```

### Task 6: features/login-by-2fa 미러 (push polling + backup)

- **Action**:
  1. `api/{mutation,query}.ts` — web 미러
  2. `model/twoFactorErrors.ts`, `useTwoFactorPolling.ts`, `useBackupLogin.ts` — web 미러, navigate 분기 `/admin`
  3. `ui/{TwoFactorWaiting,TwoFactorBackupEntry}.tsx` — web 미러. **TrustThisDeviceCheckbox 는 본 M2 에서 import 제거** (admin trustToken UX 결정 후속)
  4. `index.ts` barrel
  5. spec 미러 (model 3 개 + ui 2 개)
- **Mirror**: services/web/src/features/login-by-2fa/** (단 trusted-device cross-import 제거)
- **Validate**:
  ```bash
  npx vitest run src/features/login-by-2fa
  ```

### Task 7: features/logout 미러

- **Action**: web 미러 + spec 미러
- **Mirror**: services/web/src/features/logout/**
- **Validate**:
  ```bash
  npx vitest run src/features/logout
  ```

### Task 8: API 변경 — LoginResponse + UserDto 에 permissions 필드 추가 (옵션 A)

> 옵션 B 선택 시 본 Task 전체 skip. 대신 services/admin 에 `jwt-decode` 추가 + entities/user/model/jwt.ts 신설.

- **Action**:
  1. `services/api/src/auth/dto/login-response.dto.ts` 의 `user` 인라인 객체에 `permissions: string[]` 추가. `@ApiProperty({ type: [String] })`
  2. `services/api/src/common/dto/user.dto.ts` 의 `UserDto` 에 동일 필드 추가
  3. `services/api/src/auth/login.service.ts` 의 `login`, `loginWithBackupCode`, `register`, `refresh` 4 곳 — user 객체 채울 때 `await this.roleService.getPermissionsByUserId(user.id)` 호출 후 spread. `RoleService` 가 이미 `AuthService` 에 주입됨 → `LoginService` 는 `AuthService` 에 위임할 새 메서드 추가 권장: `AuthService.buildUserResponse(user): Promise<{ id, username, nickname, permissions }>`. login.service 는 그 메서드로 단순화
  4. `services/api/src/auth/auth.service.ts` — `buildUserResponse` 신규 메서드 추가 + `issueAfterTwoFa` 도 동일 메서드 사용
  5. `services/api/src/user/user.service.ts` — `getCurrentUser` 도 RoleService 주입 + permissions 채움
  6. 각 spec 갱신 — permissions 필드 검증 추가, RoleService mock 설정
  7. `npm --prefix services/admin run openapi:codegen` 재실행 — UserDto / LoginResponse 타입 갱신
- **Mirror**: 기존 user 객체 빌드 패턴
- **Validate**:
  ```bash
  cd services/api
  npm test                                                  # 모든 spec 통과
  npm run start:dev                                         # 정상 기동
  curl -X POST http://localhost:3000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"<pw>"}' | jq '.user.permissions'
  # → ["file:read", "file:write", ..., "user:manage", ...] (ADMIN role 시드된 사용자 가정)
  ```

### Task 9: shared/router — PrivateRoute + AdminGate

- **Action**:
  1. `PrivateRoute.tsx` web 미러 — `useUserStore((s) => s.accessToken)` 부재 시 `<Navigate to="/login" replace>`
  2. `AdminGate.tsx` 신규 — children 받는 wrapper. `const { data, isLoading, isError } = useMeQuery()`. isLoading 동안 spinner 또는 빈 화면. data 가 있고 `permissions.includes('user:manage')` 면 `{children}`. 그 외 (isError + 401 / permission 없음) 면 `useEffect(() => { clearAuth(); navigate('/login?error=not_admin') }, ...)`
  3. 매직 문자열 `'user:manage'` 는 상수로 추출 — `ADMIN_ENTRY_PERMISSION = 'user:manage'` (router/index.ts 와 같은 곳)
  4. `index.ts` barrel
  5. spec — AdminGate 의 3 가지 상태 (loading, allowed, denied) 테스트
- **Mirror**: services/web/src/shared/router/PrivateRoute (구조), 신규는 AdminGate 자체
- **Validate**:
  ```bash
  npx vitest run src/shared/router
  ```

### Task 10: 위젯 + 페이지 + 라우터 와이어업

- **Action**:
  1. `widgets/auth-layout/ui/AuthLayout.tsx` 작성 — web 미러
  2. `widgets/admin-layout/ui/AdminLayout.tsx` 작성 — 좌측 사이드바 placeholder + 우측 `<Outlet>`. 헤더에 "terab admin" + 로그아웃 버튼 (features/logout 의 useLogout 호출)
  3. `pages/login/ui/LoginPage.tsx`, `pages/login-twofa/ui/{TwoFAWaitPage,TwoFABackupPage}.tsx` — web 미러
  4. `pages/admin/ui/AdminPlaceholderPage.tsx` — "M2 로그인 완료. M3 에서 사용자 관리 추가 예정" 단순 메시지 + 환영 문구. 로그아웃은 AdminLayout 헤더에서 처리
  5. `app/providers/router/config.tsx` 작성:
     ```
     /          → <Navigate to="/admin">
     /login     → AuthLayout → [index: LoginPage, /login/2fa: TwoFAWaitPage, /login/backup: TwoFABackupPage]
     /admin     → PrivateRoute → AdminGate → AdminLayout → [index: AdminPlaceholderPage]
     *          → <Navigate to="/admin"> (또는 NotFoundPage)
     ```
  6. `app/providers/{router/index.tsx, api-provider.tsx, AppShell.tsx, index.ts}` 작성 — web 미러
  7. `main.tsx` 갱신 — RouterProvider + QueryClientProvider 래핑
  8. `App.tsx` 삭제
- **Mirror**: services/web/src/app/providers/**, services/web/src/widgets/auth-layout, services/web/src/pages/{login,login-twofa,register}
- **Validate**:
  ```bash
  npm run build
  npm run dev   # http://localhost:5173 → 자동 /admin → accessToken 없으므로 /login 으로 리다이렉트
  ```

### Task 11: services/admin/CLAUDE.md 갱신

- **Action**:
  1. M1 시점 표의 catalyst/hey-api/axios/react-router/zustand 항목 ✅ 로 변경
  2. "M2 시점 FSD 레이어 상태" 섹션 추가 — 실제 채워진 디렉토리 트리
  3. 의존성 정책 표에서 M2 도입 항목들을 "✅ 도입" 로 이동
- **Mirror**: services/web/CLAUDE.md 구조 일관성 유지
- **Validate**: grep 으로 표기 일관성만 확인 (자동 검증 도구 없음 — 시각 검토)

### Task 12: 운영자 1명 e2e — 본인 admin 로그인 수동 confirm

> NAS 운영 배포가 M3 시점에 자연스럽게 묶이지만, M2 의 acceptance 는 로컬 dev 환경에서 본인 ADMIN 사용자로 로그인 가능까지로 한정 — NAS 배포는 M3 의 admin endpoint 신설과 함께 진행.

- **Action**:
  1. 로컬 infra 기동 (`make infra`)
  2. `make api` + `cd services/admin && npm run dev` 병렬
  3. 본인 ADMIN 사용자 존재 확인 — `psql` 로 `roles` / `user_roles` 조회. 미존재 시 services/api 의 seed 또는 manual UPDATE 로 본인 user 에게 ADMIN role 부여 (memory `project_auth_2fa_fallback_pending` 와 별개 — 본 M2 는 본인 mobile FCM 등록 안 되어 있어도 `pushTokens.length === 0` 분기로 2FA 스킵)
  4. 브라우저에서 `http://localhost:5173` → `/login` → 본인 ID/PW → ADMIN 인 경우 `/admin` 진입 확인
  5. 일반 사용자 (USER role) 로 같은 흐름 시도 → AdminGate 에서 `/login?error=not_admin` 으로 차단 확인
- **Mirror**: 없음 — 수동 검증
- **Validate**:
  ```bash
  # 시각 검증 + 콘솔 로그 확인
  # 1) ADMIN 로그인: /admin 페이지에 "M2 로그인 완료" 문구 표시
  # 2) USER 로그인: /login 으로 즉시 리다이렉트 + URL 쿼리 error=not_admin
  # 3) 브라우저 devtools Network 탭 — /api/auth/login, /api/user/me 응답에 permissions 배열 포함
  ```

## Validation

본 plan 의 acceptance 는 아래 명령이 모두 성공해야 한다.

```bash
# (1) services/admin 단위 테스트
cd c:/_project/my/terab/.worktrees/admin-service-bootstrap
cd services/admin
npm run lint
npm test                                         # vitest 통과
npm run build                                    # tsc -b + vite build

# (2) services/api (옵션 A 선택 시) 단위 테스트
cd ../api
npm test                                         # 기존 spec 모두 통과 + permissions 신규 검증 통과

# (3) codegen 산출물 일관성
cd ../admin
npm run openapi:codegen                          # 차이 없음 (이미 committed 산출물과 일치)
git diff --exit-code src/shared/api/generated/  # 변경 없음 확인

# (4) 로컬 e2e 수동 검증 — Task 12 의 a-c 시나리오
# (자동화 가능 — playwright 도입은 M3 또는 별도 PR 에서 결정)

# (5) FSD 의존 규칙 위반 없음 (시각 검토)
# - features 간 cross-import 없음
# - model 이 codegen 함수 직접 import 없음 (api/ wrapper 경유)
# - api/ 가 슬라이스 barrel 에서 export 되지 않음

# (6) services/web 코드 비편집
git diff services/web/   # 빈 결과 (옵션 A 시 services/api 만 변경)
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **(옵션 A)** services/api permissions 필드 추가가 web 의 기존 사용처에 회귀 | Medium | High | web 의 useUserStore 가 user 객체를 통째로 저장하므로 spread 가 안전하게 동작. permissions 필드 무시 시 동작 동일. spec 갱신 + `cd services/web && npm test` 사후 확인 필수 |
| `user:manage` permission 키가 향후 변경됨 | Low | Medium | 상수 `ADMIN_ENTRY_PERMISSION` 단일 정의. 변경 시 한 줄 수정 |
| **(옵션 B)** JWT decode 라이브러리 추가가 admin bundle 늘림 | Low | Low | `jwt-decode` 는 ~1KB. 무시 가능 |
| codegen 의 `openapi-ts.config.ts` 가 web 과 미묘하게 다름 | Medium | Medium | Task 3 에서 web 의 config 를 그대로 복제 후 diff 0 확인. 빌드 산출물 import 경로만 변경 |
| 본인 사용자에게 ADMIN role 이 시드되지 않음 → 본인 로그인이 AdminGate 차단 | Medium | High | Task 12 의 사전 단계로 DB 조회 + ADMIN 부여 명시. 별도 admin 사용자 시드 PR 또는 manual SQL 권장 |
| 2FA push 가 mobile FCM 미등록으로 진입 불가 | Medium | Medium | API 의 `pushTokens.length === 0` 분기가 자동으로 2FA 스킵. 본인 admin 첫 로그인 시점에 mobile 앱 미배포여도 ID/PW 만으로 통과 가능. 향후 mobile 배포 후 backup code 발급 미보유 시 락아웃 — PRD risk #2 의 mitigation 으로 backup code 발급 흐름이 services/web 회원가입에서 자동 동작 (memory `project_auth_2fa_fallback_pending` 참조: 종료 시 식별된 결함이나 본 M2 단계에서는 작동) |
| FSD 슬라이스 미러 중 cross-import (예: features/login-by-2fa 가 features/trusted-device 참조) 위반 | Medium | Medium | Task 6 에서 TrustThisDeviceCheckbox 미러 시점에 import 제거 명시. ESLint 의 fsd plugin (web 에 설정되어 있다면 미러) 로 자동 차단 |
| services/web 의 catalyst UI 가 cva / motion 등 의존을 끌고옴 | Low | Low | Task 1 에서 catalyst 소스 검토 후 의존성 추가 결정. 미세 추가는 admin 도 catalyst 통합성 보존 |
| react-router-dom 7 vs 6 버전 차이로 동작 변경 | Low | Medium | services/web 의 정확한 버전을 lockfile 에서 확인 후 동일 버전 사용. `createBrowserRouter` API 안정 |
| vitest 의 jsdom 환경에서 react-router-dom navigate mock 누락 | Low | Low | web 의 spec 패턴 미러 — 이미 web 에서 동작 검증된 mock 형태 그대로 사용 |
| **옵션 A vs B 결정이 plan 승인 전 미정** | High | High | **본 plan 의 첫 실행 전에 사용자 confirm 필요** — 본 plan 은 옵션 A 를 기본으로 작성되어 있음. 옵션 B 선택 시 Task 8 전체 + services/api 변경 표 무효, services/admin 에 jwt-decode 추가 + entities/user/model/jwt.ts 추가로 대체 |

## Acceptance

- [ ] Task 1-11 의 각 Validate 가 통과
- [ ] services/admin 의 `npm run build` 성공 + bundle size 가 적정 범위 ([web/performance.md](.claude/rules/ecc/web/performance.md): app page < 300kb gzipped — 본 M2 시점 admin 은 router + auth 만 있어 훨씬 작아야 정상)
- [ ] services/admin 의 `npm test` 통과 (단위 테스트 커버리지는 80% 강제는 아니지만 model/hook 은 web 의 spec 미러로 자연스럽게 충족)
- [ ] services/api 의 `npm test` 통과 (옵션 A 선택 시 신규 permissions 필드 검증 포함)
- [ ] 로컬 dev 환경에서 본인 ADMIN 사용자로 `/login → /admin` 진입 성공 (Task 12 시나리오 1)
- [ ] 로컬 dev 환경에서 USER role 사용자로 로그인 시 AdminGate 차단 + `/login?error=not_admin` (Task 12 시나리오 2)
- [ ] Network 응답에 `user.permissions: string[]` 포함 확인 (Task 12 시나리오 3)
- [ ] services/web 코드 0줄 수정 (PR diff)
- [ ] PRD M2 row `Status: done`, `Plan` 셀에 본 plan 경로 기입
- [ ] 모든 변경이 worktree `.worktrees/admin-service-bootstrap/` 안 (CLAUDE.md §worktree-first)

---

## 후속 plan 안내 (M3 — 본 plan 의 범위 아님)

본 plan 완료 후 PRD 의 M3 (A-05 사용자 초대 + A-03 사용자 목록) 는 별도 `/ecc:plan` 호출로 진행한다. 예상 plan 명: `.claude/plans/admin-user-invite-list.plan.md`

M3 의 주요 작업 (본 M2 plan 의 범위 명시적 제외):

- `services/api/src/admin/` 모듈 신설 (현재 미존재 — PRD risk #1 가 M3 시점에 발현)
- `/admin/users` (GET), `/admin/users/invite` (POST) 엔드포인트 + `@RequirePermission('user:invite')` / `'user:manage'`
- admin 측 `features/user-invite/`, `features/user-list/`, `pages/admin/users/`
- M3 에서 NAS 배포 진행 — admin endpoint 가 실제로 작동해야 의미 있음
- hey-api codegen 의 admin tag 분리 옵션 검토 (현재 admin 도 web 도 동일 OpenAPI 사용 → admin endpoint 추가 후 tag 별 분리 필요성 결정)

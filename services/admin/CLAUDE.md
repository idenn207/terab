# services/admin/CLAUDE.md

> 본 서비스는 [services/web/CLAUDE.md](../web/CLAUDE.md) 의 FSD 컨벤션을 그대로 상속한다. 본 파일은 차이점만 기재한다.

## services/web 과의 차이

| 항목 | services/web | services/admin |
|---|---|---|
| 도메인 | `drive.skypark207.com` | `admin.drive.skypark207.com` |
| 대상 사용자 | 모든 사용자 (다수) | NAS 운영자 (1~2명) |
| Swarm replicas | 2 | 1 |
| 모바일 (Capacitor) | ✅ Android WebView | ❌ 데스크탑 전용 |
| catalyst UI | ✅ (임시) | ✅ (M2 — 임시, web 과 동일 마이그레이션 대상) |
| hey-api codegen | ✅ | ✅ (M2) |
| axios + react-query | ✅ | ✅ (M2) |
| react-router-dom | ✅ | ✅ (M2) |
| zustand store | ✅ | ✅ (M2) |
| react-hook-form | ✅ | ✅ (M2) |
| msw (테스트) | ✅ | ✅ (M2) |
| admin 전용 permission gate | — | `AdminGate` — `user:manage` 보유자만 admin shell 진입 |
| axios 인스턴스 분리 (axiosBasic / axiosAuth) | ✅ 별칭 보유 (legacy) | ❌ 단일 `axiosInstance` 만 — public path 분기는 인터셉터가 처리 |

## M2 시점 FSD 레이어 상태

```
src/
  main.tsx                          # RouterProvider + QueryProvider 진입점
  index.css                         # TailwindCSS 4 import
  __tests__/                        # vitest + MSW 공유 인프라
    setup.ts, wrappers.tsx, mocks/  # web 미러
  app/providers/                    # AppShell / QueryProvider / router
    AppShell.tsx                    # Capacitor 분기 없는 데스크탑 전용 shell
    api-provider.tsx                # QueryClientProvider
    router/{config.tsx, index.tsx}  # createBrowserRouter — /login / /admin / fallback
  pages/
    login/, login-twofa/, admin/    # AuthLayout / AdminLayout 자식 페이지
  widgets/
    auth-layout/                    # /login* 공통 shell (Outlet)
    admin-layout/                   # /admin 좌측 사이드바 placeholder + 로그아웃 헤더
  features/
    login-by-credentials/           # ID/PW 폼 (useLogin)
    login-by-2fa/                   # push polling + backup code (useTwoFactorPolling, useBackupLogin)
    logout/                         # /auth/logout mutation (useLogout)
  entities/
    user/                           # useUserStore (zustand) + useMeQuery + User type (permissions 포함)
  shared/
    api/                            # 단일 axiosInstance + 401 refresh queue + parseApiError + generated codegen
    router/                         # PrivateRoute + AdminGate (admin 전용 permission gate)
    ui/catalyst/                    # Button / Field / Input / Heading / AuthLayout (web 미러 — 임시)
    lib/utils/cn.ts                 # clsx + tailwind-merge wrapper
```

`/2fa/:id` push approval 페이지(모바일 deep link 진입)는 admin 운영 사용 사례 부재로 본 M2 에서 제외 — 후속 결정 사항.

M3 (사용자 초대 + 사용자 목록) 진입 시 `services/api/src/admin/` 모듈 신설 + `features/user-invite/`, `features/user-list/`, `pages/admin/users/` 가 추가될 예정.

## 의존성 정책

M2 도입 완료:

- `@hey-api/client-axios`, `@hey-api/openapi-ts` — codegen 파이프라인
- `axios`, `@tanstack/react-query` — transport + server cache
- `react-hook-form` — 로그인 폼
- `react-router-dom` — 라우트
- `zustand` — `useUserStore` (세션 store)
- `@headlessui/react`, `@heroicons/react` — catalyst 의존
- `msw` — 테스트용 (web 미러; 운영 번들 미포함)

services/web 의 dependency 중 **본 서비스에 도입하지 않은 항목**:

- `@capacitor/*` — 데스크탑 전용
- `motion`, `cva` — UI 패턴이 잡힐 때 검토
- `cross-env` — 별도 cross-platform 스크립트 부재

services/web 의 dependency 중 **그대로 유지하는 항목**:

- React 19 본체 + Vite + TS + Vitest + ESLint + Prettier + TailwindCSS 4
- `clsx`, `tailwind-merge`, `prettier-plugin-tailwindcss` — utility 조합 패턴 일관성

## ADMIN 전용 정책

- **AdminGate**: `/admin` shell 진입 전 `user:manage` permission 검사. 미보유 시 `clearAuth()` + `/login?error=not_admin`. 매직 문자열은 `ADMIN_ENTRY_PERMISSION` 상수로 추출 ([src/shared/router/AdminGate.tsx](src/shared/router/AdminGate.tsx))
- **단일 axios 인스턴스**: web 의 `axiosBasic`/`axiosAuth` 별칭은 admin 에는 도입하지 않는다. 단일 `axiosInstance` 가 `isPublicPath` 분기로 Authorization 헤더를 부착/생략한다 — public 라우트(`/auth/login`, `/auth/refresh` 등)는 자동 분기.
- **codegen 산출물 lint 무시**: `scripts/disable-lint-on-generated.mjs` 가 codegen 직후 `/* eslint-disable */` 배너를 모든 `src/shared/api/generated/**/*.ts` 에 prepend 한다. eslint.config.js 의 `globalIgnores` 를 건드리지 않는 source-level 해결책.
- **API DTO 변경 시 codegen 재실행 필수**: `services/api` 의 `LoginResponseDto.user.permissions` 같은 필드 추가는 `npm run openapi:codegen` 으로 admin types.gen.ts 에 반영해야 한다. AdminGate 가 `permissions` 필드를 읽으므로 drift 시 빌드 실패.

## Claude 행동 지침 — admin 전용

- 새 기능을 추가하기 전에 services/web 에 동일한 패턴이 있는지 먼저 확인. 있다면 그 구조를 미러한다 (특히 FSD 레이어 배치, axios interceptor, hey-api wrapper 패턴).
- Capacitor / mobile 관련 코드는 본 서비스에 추가 금지.
- 운영자 1~2명 대상 UI 이므로 PWA / 모바일 반응형 / 다국어는 후순위. 데스크탑 1280px 우선.
- M2 진입 시 `services/web/src/app/providers/`, `services/web/src/shared/api/` 를 그대로 참조하여 axios interceptor + hey-api codegen 환경을 동일하게 구성한다.

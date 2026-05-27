# Plan: mobile-app-feel — Android v1.0 first-impression 기본기

**Source PRD**: [.claude/prds/mobile-app-feel.prd.md](../prds/mobile-app-feel.prd.md)
**Selected Milestones**: M1 (2FA push deep-link) + M2 (전역 SafeAreaGuard) + M3 (하드웨어 back 분기) — 세 milestone 통합 plan
**Complexity**: Medium
**Worktree**: `.worktrees/mobile-app-feel/` (브랜치: `feat/mobile-app-feel`)

## Summary

Android 모바일 앱(Capacitor)이 v1.0 출시 직전 세 가지 OS 인터랙션 결함을 갖고 있다 — (1) 2FA 푸시 클릭 시 verify 화면 미진입, (2) status/nav bar 영역 콘텐츠 가림, (3) 하드웨어 back이 라우터 history만 따라가 로그인 후 `/login`으로 복귀. 본 plan은 셋을 한 worktree에서 task 단위로 분리하여 구현하되, M3 진입 전 root-level destination 명세를 **라우트 메타데이터(`RouteObject.handle.isRootDestination`)** 로 확정한다. 기존에 일부 인프라(`features/deep-link`, `features/push-notification`, tokens.css의 safe-area 토큰, AndroidManifest의 https intent-filter)가 갖춰져 있으므로 net-new 코드는 최소화하고 TODO 채우기 + 전역 적용 + 신규 hook/widget 1개씩 추가 위주로 진행한다.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Feature slice 구조 | [services/web/src/features/deep-link/](../../services/web/src/features/deep-link/) | `model/{hook}.ts` + `model/{hook}.test.ts` + `index.ts` 의 barrel export. api 호출 없는 hook-only slice |
| Capacitor 가드 패턴 | [features/deep-link/model/useDeepLink.ts:10](../../services/web/src/features/deep-link/model/useDeepLink.ts#L10) | `if (!Capacitor.isNativePlatform()) return;` 후 listener 등록, cleanup 시 `cancelled` 플래그 + `handle?.remove()` |
| Push notification listener | [features/push-notification/model/usePushNotification.ts:44-49](../../services/web/src/features/push-notification/model/usePushNotification.ts#L44-L49) | `pushNotificationActionPerformed` 리스너 안에서 `action.notification.data` 를 좁혀 처리 (현재 TODO 상태) |
| AppShell 통합 | [app/providers/AppShell.tsx:8-19](../../services/web/src/app/providers/AppShell.tsx#L8-L19) | top-level hook (`usePushNotification`, `useDeepLink`) 들을 단순 호출하는 형태. SafeAreaGuard / useBackButton 추가도 동일 패턴 |
| Tailwind safe-area 토큰 | [shared/ui/catalyst/sidebar-layout/ui/SidebarLayout.tsx:31](../../services/web/src/shared/ui/catalyst/sidebar-layout/ui/SidebarLayout.tsx#L31) | `pt-safe-top`, `pb-safe-bottom` 유틸 클래스 (tokens.css 의 `--spacing-safe-*` 와 자동 연결) |
| 테스트 mock 구조 | [features/deep-link/model/useDeepLink.test.ts:13-21](../../services/web/src/features/deep-link/model/useDeepLink.test.ts#L13-L21) | `@capacitor/app`, `@capacitor/core` mock + `capturedCallback` 로 listener 콜백 주입 → `renderHook` + `waitFor` |
| MQ FCM payload | [services/mq/src/push/fcm/fcm.service.ts:22-43](../../services/mq/src/push/fcm/fcm.service.ts#L22-L43) | `Message.data` 에 `type` / `challengeId` / `deeplink` 필드 포함 (이미 적용). 가드는 `PushWorker.process` 또는 `FcmService.send` 진입에서 검증 |
| NestJS service 로깅 | [services/mq/src/push/fcm/fcm.service.ts:10](../../services/mq/src/push/fcm/fcm.service.ts#L10) | `private readonly logger = new Logger(FcmService.name)` 패턴 (NestJS 표준 — 본 plan에서는 추가 import 없이 그대로 사용) |
| Catalyst 확장 컴포넌트 | [shared/ui/catalyst/sidebar-layout/ui/SidebarLayout.tsx](../../services/web/src/shared/ui/catalyst/sidebar-layout/ui/SidebarLayout.tsx) | catalyst 원본은 직접 수정 금지 — wrap 또는 외부 widget으로 적용. SafeAreaGuard는 widgets 레이어에서 신설 |

## Files to Change

### Frontend — services/web

| File | Action | Why |
|---|---|---|
| `services/web/src/widgets/safe-area-guard/ui/SafeAreaGuard.tsx` | CREATE | 전역 safe-area inset 적용 단일 컴포넌트 (M2) |
| `services/web/src/widgets/safe-area-guard/index.ts` | CREATE | widget barrel export (M2) |
| `services/web/src/widgets/index.ts` | UPDATE | safe-area-guard re-export 추가 (M2) |
| `services/web/src/features/back-button/model/useBackButton.ts` | CREATE | Capacitor `App.addListener('backButton')` + 라우트 메타 분기 + 더블탭 종료 로직 (M3) |
| `services/web/src/features/back-button/model/useBackButton.test.ts` | CREATE | TDD: 메타 분기 / 더블탭 timeout / 비네이티브 noop (M3) |
| `services/web/src/features/back-button/ui/DoubleBackToast.tsx` | CREATE | "한 번 더 누르면 종료" 토스트 (M3) |
| `services/web/src/features/back-button/index.ts` | CREATE | barrel export (M3) |
| `services/web/src/features/index.ts` | UPDATE | back-button re-export 추가 (M3) |
| `services/web/src/features/push-notification/model/usePushNotification.ts` | UPDATE | `pushNotificationActionPerformed` TODO 채우기 — `data.deeplink` 우선, fallback 으로 `/2fa/:challengeId` (M1) |
| `services/web/src/features/push-notification/model/usePushNotification.test.ts` | UPDATE | `pushNotificationActionPerformed` 동작 검증 케이스 추가 (M1) |
| `services/web/src/app/providers/AppShell.tsx` | UPDATE | `useBackButton()` 호출 추가 + `<SafeAreaGuard>` 로 `<Outlet />` 감싸기 (M2, M3) |
| `services/web/src/app/providers/router/config.tsx` | UPDATE | (1) 루트 `<main className="pt-safe-top">` 제거 — SafeAreaGuard 가 흡수. (2) `/login`, `/drive`, `/2fa/:id` 라우트에 `handle: { isRootDestination: true }` 부여 (M2, M3) |
| `services/web/src/widgets/auth-layout/ui/AuthLayout.tsx` | UPDATE (필요 시) | safe-area 중복 padding 제거 — SafeAreaGuard 가 흡수 (M2) |
| `services/web/src/widgets/drive-layout/ui/DriveLayout.tsx` | UPDATE (필요 시) | 동일 (M2) |

### Backend — services/mq

| File | Action | Why |
|---|---|---|
| `services/mq/src/push/push.worker.ts` | UPDATE | `process` 진입 시 `pushToken` 유효성 검증 가드 (deactivated/empty 시 skip + warn 로그). `deeplink` 필드는 이미 존재하므로 그대로 유지 (M1) |
| `services/mq/src/push/push.worker.spec.ts` | UPDATE | 가드 동작 단위 테스트 추가 (M1) |
| `services/api/src/twofa/push-challenge.publisher.ts` | UPDATE (조사 후 필요 시) | `pushChallenge` enqueue 시점에 device 의 활성 여부 검증 — 로그아웃된 사용자에게 보내지 않는 게 PRD 요구. 이미 처리되어 있다면 noop (M1) |

### Android native — services/web/android

| File | Action | Why |
|---|---|---|
| `services/web/android/app/src/main/AndroidManifest.xml` | UPDATE | `<activity>` 에 `android:windowSoftInputMode="adjustResize"` 명시 (이미 있으면 noop), Edge-to-Edge 활성화를 위한 theme 검토. **별도 deep-link intent-filter 추가는 불필요** — 푸시 클릭은 `pushNotificationActionPerformed` 경로만 사용 (M2, 필요 시) |
| `services/web/android/app/src/main/res/values/styles.xml` | UPDATE (필요 시) | `AppTheme.NoActionBarLaunch` 에 `android:windowTranslucentStatus` / `android:fitsSystemWindows="false"` — WebView 가 safe-area inset 을 받도록 (M2 결정적 사전 조건) |

## Tasks

작업 순서는 **M1 → M2 → M3** — 의존성 순. 각 task는 RED → GREEN → REFACTOR 의 TDD 사이클 + Validation 으로 마감.

### Task 1: MQ push payload 가드 + payload 형태 안정화 (M1 backend)

- **Action**: `PushWorker.process` 진입에서 `pushToken` 이 빈 문자열·null 인 경우 skip + `logger.warn({ challengeId }, 'push skipped: empty token')`. 또한 `FcmService.send` 의 `data.deeplink` 필드가 항상 슬래시 시작 path 라는 invariant 를 유지하도록 가벼운 검증. publisher 측에서 device 활성화 여부를 확인하는지 [push-challenge.publisher.spec.ts](../../services/api/src/twofa/push-challenge.publisher.spec.ts) 의 케이스 + 코드 read 로 확인하고, 누락 시 device repository 조회 추가.
- **Mirror**: [fcm.service.ts:10 — Logger 패턴](../../services/mq/src/push/fcm/fcm.service.ts#L10)
- **Validate**:
  ```bash
  npm --prefix services/mq run test -- push.worker.spec
  npm --prefix services/api run test -- push-challenge.publisher.spec
  ```

### Task 2: usePushNotification 의 deep-link 라우팅 채우기 (M1 frontend)

- **Action**: [usePushNotification.ts:44-49](../../services/web/src/features/push-notification/model/usePushNotification.ts#L44-L49) 의 TODO 를 채운다. `data.deeplink` 가 슬래시 시작 string 이면 그대로 `navigate(deeplink)`, 없으면 fallback 으로 `data.type === '2FA_CHALLENGE' && data.challengeId` 일 때 `navigate('/2fa/' + data.challengeId)`. **즉시 호출하면 라우터 미마운트일 가능성** 이 있으므로 `useNavigate()` 를 hook 최상위에서 받고 listener 콜백에서 사용. background → foreground 진입 시점은 `App.addListener('appStateChange')` 가 아니라 Android FCM 의 click intent 자체가 `pushNotificationActionPerformed` 를 트리거하므로 별도 처리 불필요 — Capacitor 가 cold start 시에도 pending 으로 큐잉 후 listener 등록 시점에 dispatch 한다.
- **TDD Sequence (RED → GREEN)**:
  1. **RED**: `usePushNotification.test.ts` 에 케이스 추가 — `pushNotificationActionPerformed` 이벤트가 `data.deeplink: '/2fa/abc'` 를 가질 때 `navigate('/2fa/abc')` 호출. 두 번째 케이스 — `data.type: '2FA_CHALLENGE'` + `data.challengeId: 'abc'` (deeplink 누락) 일 때도 fallback 으로 동일 navigate. 세 번째 — payload 가 알 수 없는 형태이면 navigate 미호출.
  2. **GREEN**: useNavigate + listener 콜백 안 분기 추가.
  3. **REFACTOR**: 분기 로직을 `model/resolveDeepLink.ts` 순수함수로 분리 (테스트 용이성 + ts-rest 스타일 좁히기).
- **Mirror**: [useDeepLink.test.ts:13-21 — Capacitor mock 패턴](../../services/web/src/features/deep-link/model/useDeepLink.test.ts#L13-L21)
- **Validate**:
  ```bash
  npm --prefix services/web run test -- push-notification
  npm --prefix services/web run cap:sync:dev
  # 수동: 모바일 로그인 → PC 로그인 시도 → 푸시 수신 → 클릭 → /2fa/<id> 화면 진입
  ```

### Task 3: Android Edge-to-Edge 사전 설정 (M2 사전 조건)

- **Action**: WebView 가 status/nav bar 영역의 inset 을 받으려면 Android 측 theme 가 fullscreen(Edge-to-Edge) 이어야 한다. 현재 `AppTheme.NoActionBarLaunch` 의 `styles.xml` 을 확인하고 `<item name="android:windowDrawsSystemBarBackgrounds">true</item>` + `<item name="android:statusBarColor">@android:color/transparent</item>` 가 없으면 추가. Android 15+ 는 Edge-to-Edge 가 default 이지만 16 이전 호환을 위해 명시.
- **Validate**:
  ```bash
  npm --prefix services/web run cap:sync:dev
  npm --prefix services/web run cap:android:dev
  # 수동: WebView 가 status bar 뒤까지 그려지는지 확인 (적용 전 흰 배경 영역 → 적용 후 콘텐츠가 그 위로 들어감)
  ```

### Task 4: SafeAreaGuard widget 신설 + 전역 적용 (M2)

- **Action**: [services/web/src/widgets/safe-area-guard/ui/SafeAreaGuard.tsx](../../services/web/src/widgets/safe-area-guard/ui/SafeAreaGuard.tsx) 신설. 단일 책임 — children 을 `min-h-dvh pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right` 컨테이너로 감싼다. `Capacitor.isNativePlatform()` 체크 불필요 — 브라우저에서는 `env(safe-area-inset-*)` 가 0 이라 영향 없음. `index.ts` 에서 barrel export. `widgets/index.ts` 에 re-export. AppShell 에서 `<Outlet />` 을 `<SafeAreaGuard>` 로 감싼다. router config.tsx 의 루트 라우트 `<main className="pt-safe-top">` 은 SafeAreaGuard 와 중복되므로 제거. AuthLayout / DriveLayout 등 하위 레이아웃에 safe-area 관련 padding 이 남아 있는지 grep 으로 확인 후 정리.
- **Important — notch 없는 기기 floor**: PRD Risk #3 에 따라 inset 이 0 이어도 시각적 padding 이 충분하도록 `min-h-dvh px-safe-left px-safe-right pt-[max(env(safe-area-inset-top),0px)] pb-[max(env(safe-area-inset-bottom),0px)]` — 0px 가 default 이므로 별도 floor 는 두지 않는다. 시각적 padding 필요 시 자식 컴포넌트가 추가 padding 을 둔다. (이 점이 PRD 와 다를 수 있어 dogfooding 확인 후 조정)
- **Mirror**: [shared/ui/catalyst/sidebar-layout/ui/SidebarLayout.tsx:31](../../services/web/src/shared/ui/catalyst/sidebar-layout/ui/SidebarLayout.tsx#L31) — catalyst 패턴
- **Validate**:
  ```bash
  npm --prefix services/web run test
  npm --prefix services/web run build
  npm --prefix services/web run cap:sync:dev
  # 수동: 모든 라우트(/login, /drive, /2fa/:id, /register/:token, /preview) 진입 시 status/nav bar 영역에 콘텐츠 가림 / 글자 겹침 0건
  ```

### Task 5: 라우트 메타데이터 부여 (M3 사전 조건)

- **Action**: [services/web/src/app/providers/router/config.tsx](../../services/web/src/app/providers/router/config.tsx) 에서 root-level destination 으로 정의되는 라우트에 `handle: { isRootDestination: true }` 부여. 사용자 결정 따라 — `/login` (index 자식), `/drive`, `/2fa/:id` 를 root 로 표시. `handle` 의 타입은 `model/routeHandle.ts` (또는 shared) 에 `interface AppRouteHandle { isRootDestination?: boolean }` 로 선언하고 `Object.assign` 또는 `as RouteObject` 캐스팅 없이 적용. Type augmentation 으로 `react-router-dom` 의 `RouteObject.handle` 을 좁힐 수도 있지만 over-engineering — 단순 type assertion + 런타임 검사로 충분.
- **Validate**: 타입 체크
  ```bash
  npm --prefix services/web run typecheck
  ```

### Task 6: useBackButton hook + 더블탭 토스트 (M3 본체)

- **Action**: [features/back-button/model/useBackButton.ts](../../services/web/src/features/back-button/model/useBackButton.ts) 신설.
  - `App.addListener('backButton', listener)` 등록 (Capacitor `@capacitor/app`).
  - 콜백 안에서 `useMatches()` 결과(또는 listener 외부 useEffect 안 useMatches 가 reactive 하므로 ref 에 보관) 의 마지막 매치 `handle?.isRootDestination` 확인.
  - root 이면 — `pendingExitRef` 가 false 면 토스트 노출 + `setTimeout(() => { pendingExitRef = false }, 2000)` + `pendingExitRef = true`. 이미 true 면 `App.exitApp()`.
  - root 가 아니면 — `history.back()` 위임 (이는 listener 콜백 내부에서 router 의 `useNavigate(-1)` 호출 또는 `window.history.back()`).
  - 더블탭 토스트는 [features/back-button/ui/DoubleBackToast.tsx](../../services/web/src/features/back-button/ui/DoubleBackToast.tsx) — 단순 fixed bottom toast, 한국어 고정 ("한 번 더 누르면 종료됩니다"). framer-motion / catalyst toast 가 이미 있는지 검토 후 재사용, 없으면 transition-opacity + transform 만으로 최소 구현.
- **`canGoBack` 플래그 무시 이유**: Capacitor 의 BackButtonEvent 가 제공하는 `canGoBack` 은 webview 내부 navigation 상태 기반이라 SPA history 와 어긋날 수 있음. 우리 hook 은 라우트 메타를 single source of truth 로 사용 (PRD Risk #2 해소).
- **TDD Sequence**:
  1. **RED**: `useBackButton.test.ts` 케이스 —
     - (a) root destination 에서 첫 back → 토스트 visible, `App.exitApp` 미호출
     - (b) root destination 에서 2초 안 두 번 back → `App.exitApp` 호출
     - (c) root destination 에서 첫 back 후 2초 경과 + 두 번째 back → 토스트만 다시 visible, exit 미호출
     - (d) non-root 에서 back → router 의 navigate(-1) 호출, `App.exitApp` 미호출
     - (e) 비네이티브 플랫폼에서는 listener 미등록
  2. **GREEN**: 위 분기 구현. setTimeout 은 vi.useFakeTimers() 로 advance.
  3. **REFACTOR**: 상태 전이를 `model/useExitIntent.ts` 등으로 분리할지 검토 — 단순하면 그대로 둔다.
- **AppShell 통합**: AppShell 에 `useBackButton()` 호출 + 토스트 자식 render.
- **Mirror**: [useDeepLink.ts:11-25 — listener cleanup 패턴](../../services/web/src/features/deep-link/model/useDeepLink.ts#L11-L25)
- **Validate**:
  ```bash
  npm --prefix services/web run test -- back-button
  npm --prefix services/web run cap:sync:dev
  # 수동: 로그인 → /drive 진입 → 뒤로가기 1회 → 토스트 / 2초 안 또 누름 → 앱 종료. /drive → 폴더 진입 → 뒤로가기 → /drive 로 복귀(앱 종료 아님). /2fa/:id 진입 → 뒤로가기 1회 → 토스트.
  ```

### Task 7: 로그인 후 history sentinel 처리 (M3 보조)

- **Action**: 로그인 직후 `/drive` 진입 시 history 에 `/login` 이 남아 있으면, 라우트 메타가 root 라 해도 router 의 `useNavigate(-1)` 가 `/login` 으로 복귀할 위험이 있다. 그러나 `useBackButton` 이 root destination 에서 navigate(-1) 를 호출하지 않고 토스트→exitApp 으로만 분기하므로 이 문제는 자동 해결. **단, root 가 아닌 화면(예: /drive/folder/:id 가 향후 생길 때)에서 navigate(-1) 가 /login 으로 가는 경계 케이스** 는 login mutation `onSuccess` 에서 `navigate('/drive', { replace: true })` 가 이미 적용되어 있는지 [features/login-by-credentials/model/useLogin.ts](../../services/web/src/features/login-by-credentials/) read 후 확인. 누락 시 replace 옵션 추가.
- **Validate**:
  ```bash
  # 수동: 로그인 직후 뒤로가기 어떤 경로로도 /login 복귀 0건
  ```

### Task 8: 통합 dogfooding 검증

- **Action**: 모든 task 완료 후 Galaxy Z Flip4 + S26 emulator 양쪽에서 PRD Success Metrics 표 그대로 재현.
  - 2FA push deep-link foreground/background 모두 verify 화면 진입
  - Safe-area 미적용 잔존 UI 0건
  - 로그인 후 back 으로 /login 복귀 0건
  - 최하위 레이어 더블탭 종료 100%

## Validation

### 자동화 — RED → GREEN 확인용

```bash
# Frontend
npm --prefix services/web run typecheck
npm --prefix services/web run test
npm --prefix services/web run build

# MQ
npm --prefix services/mq run test

# API (가드 변경이 있을 경우)
npm --prefix services/api run test
```

### Capacitor 빌드 & 수동 dogfooding

```bash
npm --prefix services/web run cap:sync:dev
npm --prefix services/web run cap:android:dev
# 디바이스: Galaxy Z Flip4 (Android 16 실기) + Galaxy S26 emulator
```

수동 검증 체크리스트:

- [ ] 모바일 로그인 → PC 로그인 시도 → 푸시 수신 (앱 background) → 푸시 클릭 → 5초 이내 `/2fa/:id` 진입
- [ ] 모바일 로그인 → PC 로그인 시도 → 푸시 수신 (앱 foreground) → 푸시 클릭 → 5초 이내 `/2fa/:id` 진입
- [ ] 로그아웃 상태 사용자에게 2FA 푸시 미발송 (MQ 로그에 `push skipped` 또는 publisher 단에서 enqueue 안 됨)
- [ ] `/login`, `/drive`, `/2fa/:id`, `/register/:token`, `/preview` 모든 라우트에서 status / navigation bar 영역에 콘텐츠 가림 / 글자 겹침 / 버튼 클릭 불가 0건
- [ ] `/drive` 진입 후 뒤로가기 1회 → 한국어 토스트 노출 / `/login` 복귀 안 함
- [ ] `/drive` 진입 후 뒤로가기 2초 안 2회 → 앱 종료
- [ ] `/drive` 진입 후 뒤로가기 2초 경과 후 두 번째 누름 → 토스트 재노출, 앱 종료 안 됨
- [ ] `/2fa/:id` 진입 후 뒤로가기 1회 → 토스트 (root 처리). 2회 → 앱 종료
- [ ] 향후 추가될 `/drive/folder/:id` 가정 — non-root 라 navigate(-1) 가 `/drive` 로 복귀, `/login` 으로 가지 않음

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Android 14+ notification trampoline 으로 인해 `pushNotificationActionPerformed` 가 발화되지 않거나 cold start 시 listener 등록 이전에 dispatch 됨 | Medium | High | Capacitor `@capacitor/push-notifications` 5.x 이상은 pending event 큐잉 기능 포함 — listener 등록 시점에 자동 재dispatch. 실패 시 fallback 으로 `App.getLaunchUrl()` + `appUrlOpen` 경로도 함께 활성화 (별도 deep-link intent-filter 추가) |
| `useMatches()` 가 listener 콜백 안에서 stale 한 값을 반환 | Medium | Medium | `useMatches()` 결과를 `useRef` 에 sync 하고 listener 콜백은 ref 만 조회. 또는 listener 안에서 React Router 의 `matchRoutes(router.routes, location.pathname)` 직접 호출 |
| Edge-to-Edge 적용 후 catalyst SidebarLayout 의 기존 `pt-safe-top` 과 중복으로 padding 2배 | Medium | Low | catalyst SidebarLayout 의 `pt-safe-top` 은 그대로 두되 SafeAreaGuard 가 outer 컨테이너에 동일 padding 을 두지 않도록 — Guard 는 `min-h-dvh` + `env(safe-area-inset-*)` 를 ContentArea margin 으로만 적용. dogfooding 에서 시각 확인 |
| 더블탭 종료 토스트가 접근성 (long press, screen reader) 환경에서 의도치 않게 trigger | Low | Low | timeout 2s 유지 + 토스트 텍스트로 명시. screen reader 사용자는 별도 시스템 back 제스처 사용 — 본 plan 범위 밖 |
| Capacitor App `exitApp` 이 Android Q+ 에서 deprecated 또는 권장 안 됨 | Low | Low | `App.exitApp()` 은 v5 기준 여전히 지원. 향후 `App.minimizeApp()` 로 변경 시 hook 한 곳만 수정 |
| pushChallenge publisher 가 device 활성화 검증을 안 해도 device 가 deactivated 면 FCM 토큰이 유효하지 않아 FCM 측에서 reject — PRD 의 "로그아웃 사용자에게 푸시 미발송" 요구가 결과적으로 충족됨 | Low | Low | logger.warn 으로 가시화. publisher 단 명시적 검증은 비용 대비 효과 검토 후 결정 |

## Acceptance

- [ ] Task 1–8 모두 complete
- [ ] `npm --prefix services/web run test` 통과 (신규 케이스 포함)
- [ ] `npm --prefix services/web run typecheck` 통과
- [ ] `npm --prefix services/web run build` 통과
- [ ] `npm --prefix services/mq run test` 통과
- [ ] `npm --prefix services/web run cap:sync:dev && npm --prefix services/web run cap:android:dev` 으로 Android 빌드 성공
- [ ] Galaxy Z Flip4 + S26 emulator 양쪽에서 Validation 체크리스트 모두 통과
- [ ] tokens.css 의 `--spacing-safe-*` 4개가 SafeAreaGuard 한 곳에서 사용되는 단일 진입점 확립 (별개 컴포넌트에 중복 사용 0)
- [ ] FSD 의존 규칙 준수 — `widgets/safe-area-guard/` 가 `features/` import 안 함, `features/back-button/` 이 다른 feature import 안 함
- [ ] Patterns mirrored, not reinvented (위 표 의 source 파일과 동일한 구조)
- [ ] PRD `Delivery Milestones` 표 M1/M2/M3 status 가 `complete` 로 갱신, Plan 셀이 본 plan 경로로 채워짐

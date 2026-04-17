# Mobile Capacitor Implementation Plan (DEV-009, DEV-010, DEV-011)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 React 웹 앱에 Capacitor를 통합하여 Android 앱 셸을 완성하고, FCM Push 알림 수신과 App Links 딥링크를 구현한다.

**Architecture:** `services/web/`에 Capacitor가 이미 통합되어 있으며 (`android/` 프로젝트 존재), UX 플러그인 설치 → Push/DeepLink 훅 TDD → AppShell 통합 → AndroidManifest 설정 → assetlinks.json 배포 순서로 진행한다. 모든 React 훅은 FSD `features/` 레이어에 위치하며, `AppShell`이 Router 내부에서 훅을 마운트한다.

**Tech Stack:** Capacitor 8 / React 19 / Zustand / Vitest + Testing Library / MSW

---

## 파일 맵

### 신규 생성

```
services/web/public/.well-known/assetlinks.json
services/web/src/app/providers/AppShell.tsx
services/web/src/features/push-notification/api/deviceApi.ts
services/web/src/features/push-notification/model/usePushNotification.ts
services/web/src/features/push-notification/model/usePushNotification.test.ts
services/web/src/features/push-notification/index.ts
services/web/src/features/deep-link/model/useDeepLink.ts
services/web/src/features/deep-link/model/useDeepLink.test.ts
services/web/src/features/deep-link/index.ts
```

### 수정

```
services/web/capacitor.config.ts                                    (appName 수정 + 플러그인 설정 추가)
services/web/.gitignore                                             (android 빌드 캐시 + google-services.json 제외)
services/web/android/app/src/main/res/values/strings.xml           (app_name 수정)
services/web/android/app/src/main/AndroidManifest.xml              (Push 권한 + App Links intent-filter)
services/web/src/app/providers/router/config.tsx                   (root layout AppShell 추가)
services/web/src/features/index.ts                                 (신규 feature re-export)
```

---

## Task 1: appName 수정 + .gitignore 업데이트

**Files:**

- Modify: `services/web/capacitor.config.ts`
- Modify: `services/web/android/app/src/main/res/values/strings.xml`
- Modify: `services/web/.gitignore`

- [ ] **Step 1: capacitor.config.ts — appName 수정**

`services/web/capacitor.config.ts`를 아래와 같이 교체한다:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skypark207.drive',
  appName: 'TeraB',
  webDir: 'dist',
  /** 운영 배포 시 주석 해제 */
  // server: {
  //   url: 'https://drive.skypark207.com',
  //   androidScheme: 'https',
  // },
};

export default config;
```

- [ ] **Step 2: strings.xml — app_name 수정**

`services/web/android/app/src/main/res/values/strings.xml`를 아래와 같이 교체한다:

```xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">TeraB</string>
    <string name="title_activity_main">TeraB</string>
    <string name="package_name">com.skypark207.drive</string>
    <string name="custom_url_scheme">com.skypark207.drive</string>
</resources>
```

- [ ] **Step 3: .gitignore — Android 빌드 캐시 + google-services.json 추가**

`services/web/.gitignore` 하단에 추가한다:

```gitignore
# Android — 민감 파일 및 빌드 캐시
android/app/google-services.json
android/.gradle/
android/app/.cxx/
android/app/build/
```

- [ ] **Step 4: Commit**

```bash
git add services/web/capacitor.config.ts \
        services/web/android/app/src/main/res/values/strings.xml \
        services/web/.gitignore
git commit -m "chore: 앱 이름 'Tera B' → 'TeraB' 수정, android .gitignore 추가"
```

---

## Task 2: Capacitor UX 플러그인 설치 + capacitor.config.ts 플러그인 설정 + cap sync

**Files:**

- Modify: `services/web/package.json` (npm install)
- Modify: `services/web/capacitor.config.ts`

- [ ] **Step 1: 플러그인 설치**

```bash
cd services/web && npm install \
  @capacitor/push-notifications \
  @capacitor/app \
  @capacitor/splash-screen \
  @capacitor/status-bar \
  @capacitor/keyboard
```

Expected: `package.json`의 `dependencies`에 5개 패키지 추가됨.

- [ ] **Step 2: capacitor.config.ts — 플러그인 설정 추가**

`services/web/capacitor.config.ts`를 아래와 같이 교체한다:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skypark207.drive',
  appName: 'TeraB',
  webDir: 'dist',
  /** 운영 배포 시 주석 해제 */
  // server: {
  //   url: 'https://drive.skypark207.com',
  //   androidScheme: 'https',
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
```

- [ ] **Step 3: cap sync 실행**

```bash
cd services/web && npm run cap:sync
```

Expected: `✔ Updating Android plugins` 및 `✔ copy android` 메시지 출력.

- [ ] **Step 4: Commit**

```bash
git add services/web/package.json \
        services/web/package-lock.json \
        services/web/capacitor.config.ts \
        services/web/android/
git commit -m "feat: Capacitor UX 플러그인 설치 (push-notifications, app, splash-screen, status-bar, keyboard)"
```

---

## Task 3: Push Notification — deviceApi + usePushNotification (TDD)

**Files:**

- Create: `services/web/src/features/push-notification/api/deviceApi.ts`
- Create: `services/web/src/features/push-notification/model/usePushNotification.ts`
- Create: `services/web/src/features/push-notification/model/usePushNotification.test.ts`
- Create: `services/web/src/features/push-notification/index.ts`

- [ ] **Step 1: deviceApi.ts 생성**

```typescript
import { axiosInstance } from '@/shared/api';

interface RegisterPushTokenRequest {
  pushToken: string;
  platform: 'android' | 'ios';
  name?: string;
}

interface RegisterPushTokenResponse {
  deviceId: string;
}

const deviceApi = {
  registerPushToken: (data: RegisterPushTokenRequest) => axiosInstance.post<RegisterPushTokenResponse>('/auth/devices/push-token', data).then((r) => r.data),
};

export { deviceApi };
export type { RegisterPushTokenRequest };
```

- [ ] **Step 2: usePushNotification.test.ts 작성 (RED)**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from '@/entities';
import { usePushNotification } from './usePushNotification';

const mockRequestPermissions = vi.fn();
const mockRegister = vi.fn();
const mockRemove = vi.fn();
const mockRegisterPushToken = vi.fn().mockResolvedValue({ deviceId: 'test-device-id' });

let capturedRegistrationCallback: ((token: { value: string }) => void) | null = null;

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: mockRequestPermissions,
    register: mockRegister,
    addListener: vi.fn().mockImplementation((event, cb) => {
      if (event === 'registration') capturedRegistrationCallback = cb;
      return Promise.resolve({ remove: mockRemove });
    }),
  },
}));

vi.mock('../api/deviceApi', () => ({
  deviceApi: { registerPushToken: mockRegisterPushToken },
}));

describe('usePushNotification', () => {
  afterEach(() => {
    useUserStore.getState().clearAuth();
    capturedRegistrationCallback = null;
    vi.clearAllMocks();
  });

  it('권한이 거부되면 register를 호출하지 않는다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'denied' });

    renderHook(() => usePushNotification());

    await waitFor(() => {
      expect(mockRequestPermissions).toHaveBeenCalled();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('권한이 허용되면 register를 호출한다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'granted' });

    renderHook(() => usePushNotification());

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });

  it('registration 이벤트 발생 시 인증 상태면 registerPushToken API를 호출한다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'granted' });
    useUserStore.getState().setAuth('test-access-token', {
      id: 'user-1',
      username: 'testuser',
      nickname: '테스트',
    });

    renderHook(() => usePushNotification());

    await waitFor(() => capturedRegistrationCallback !== null);
    await capturedRegistrationCallback!({ value: 'fcm-token-abc123' });

    await waitFor(() => {
      expect(mockRegisterPushToken).toHaveBeenCalledWith({
        pushToken: 'fcm-token-abc123',
        platform: 'android',
      });
    });
  });

  it('registration 이벤트 발생 시 미인증 상태면 API를 호출하지 않는다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'granted' });
    // useUserStore는 clearAuth 상태 — accessToken === null

    renderHook(() => usePushNotification());

    await waitFor(() => capturedRegistrationCallback !== null);
    await capturedRegistrationCallback!({ value: 'fcm-token-abc123' });

    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it('비네이티브 플랫폼에서는 권한 요청을 하지 않는다', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    renderHook(() => usePushNotification());

    // 비동기 작업 대기
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트 실행 — FAIL 확인**

```bash
cd services/web && npm test -- usePushNotification 2>&1 | tail -15
```

Expected: `usePushNotification` 모듈 없어서 import 에러 발생.

- [ ] **Step 4: usePushNotification.ts 구현**

```typescript
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect } from 'react';
import { useUserStore } from '@/entities';
import { deviceApi } from '../api/deviceApi';

export function usePushNotification() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handles: PluginListenerHandle[] = [];
    let cancelled = false;

    const setup = async () => {
      const { receive } = await PushNotifications.requestPermissions();
      if (receive !== 'granted' || cancelled) return;

      await PushNotifications.register();

      const h1 = await PushNotifications.addListener('registration', async (token) => {
        const accessToken = useUserStore.getState().accessToken;
        if (!accessToken) return;
        await deviceApi.registerPushToken({ pushToken: token.value, platform: 'android' });
      });

      const h2 = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // 포그라운드 수신 — Phase 3에서 인앱 토스트 UI 추가
        console.log('Push received (foreground):', notification.title);
      });

      const h3 = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data as { type?: string; challengeId?: string } | undefined;
        if (data?.type === '2FA_CHALLENGE' && data.challengeId) {
          // Phase 3에서 /auth/2fa/:challengeId 라우팅 추가
        }
      });

      if (cancelled) {
        h1.remove();
        h2.remove();
        h3.remove();
      } else {
        handles.push(h1, h2, h3);
      }
    };

    setup();

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
  }, []);
}
```

- [ ] **Step 5: 테스트 재실행 — PASS 확인**

```bash
cd services/web && npm test -- usePushNotification 2>&1 | tail -15
```

Expected: `4 passed`.

- [ ] **Step 6: index.ts 생성**

```typescript
export { usePushNotification } from './model/usePushNotification';
```

- [ ] **Step 7: Commit**

```bash
git add services/web/src/features/push-notification/
git commit -m "feat: Push Notification 훅 및 deviceApi 추가 (TDD)"
```

---

## Task 4: Deep Link — useDeepLink (TDD)

**Files:**

- Create: `services/web/src/features/deep-link/model/useDeepLink.ts`
- Create: `services/web/src/features/deep-link/model/useDeepLink.test.ts`
- Create: `services/web/src/features/deep-link/index.ts`

- [ ] **Step 1: useDeepLink.test.ts 작성 (RED)**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDeepLink } from './useDeepLink';

const mockNavigate = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

let capturedCallback: ((event: { url: string }) => void) | null = null;
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockImplementation((_event, cb) => {
      capturedCallback = cb;
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('useDeepLink', () => {
  afterEach(() => {
    capturedCallback = null;
    vi.clearAllMocks();
  });

  it('appUrlOpen 이벤트 발생 시 URL의 pathname으로 navigate를 호출한다', async () => {
    renderHook(() => useDeepLink(), { wrapper: MemoryRouter });

    await waitFor(() => capturedCallback !== null);
    capturedCallback!({ url: 'https://drive.skypark207.com/auth/2fa/abc123' });

    expect(mockNavigate).toHaveBeenCalledWith('/auth/2fa/abc123');
  });

  it('초대 링크 딥링크도 pathname으로 navigate를 호출한다', async () => {
    renderHook(() => useDeepLink(), { wrapper: MemoryRouter });

    await waitFor(() => capturedCallback !== null);
    capturedCallback!({ url: 'https://drive.skypark207.com/invite/token-xyz' });

    expect(mockNavigate).toHaveBeenCalledWith('/invite/token-xyz');
  });

  it('비네이티브 플랫폼에서는 리스너를 등록하지 않는다', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const { App } = await import('@capacitor/app');

    renderHook(() => useDeepLink(), { wrapper: MemoryRouter });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(App.addListener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd services/web && npm test -- useDeepLink 2>&1 | tail -10
```

Expected: `useDeepLink` 모듈 없어서 import 에러 발생.

- [ ] **Step 3: useDeepLink.ts 구현**

```typescript
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => void } | null = null;

    App.addListener('appUrlOpen', (event) => {
      const url = new URL(event.url);
      navigate(url.pathname);
    }).then((h) => {
      handle = h;
    });

    return () => {
      handle?.remove();
    };
  }, [navigate]);
}
```

- [ ] **Step 4: 테스트 재실행 — PASS 확인**

```bash
cd services/web && npm test -- useDeepLink 2>&1 | tail -10
```

Expected: `3 passed`.

- [ ] **Step 5: index.ts 생성**

```typescript
export { useDeepLink } from './model/useDeepLink';
```

- [ ] **Step 6: Commit**

```bash
git add services/web/src/features/deep-link/
git commit -m "feat: Deep Link 훅 추가 (TDD) — appUrlOpen → React Router navigate"
```

---

## Task 5: AppShell 통합 + Router 설정 + features/index.ts 업데이트

**Files:**

- Create: `services/web/src/app/providers/AppShell.tsx`
- Modify: `services/web/src/app/providers/router/config.tsx`
- Modify: `services/web/src/features/index.ts`

- [ ] **Step 1: AppShell.tsx 생성**

`AppShell`은 Router 내부에서 렌더링되므로 `useNavigate`(딥링크 훅 내부 사용)가 정상 동작한다.

```typescript
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDeepLink } from '@/features/deep-link';
import { usePushNotification } from '@/features/push-notification';

export function AppShell() {
  usePushNotification();
  useDeepLink();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SplashScreen.hide();
    StatusBar.setStyle({ style: Style.Light });
  }, []);

  return <Outlet />;
}
```

- [ ] **Step 2: router/config.tsx — root layout으로 AppShell 적용**

`services/web/src/app/providers/router/config.tsx`의 `export const routes` 블록을 아래와 같이 교체한다:

```typescript
import { DrivePage, LoginPage, NavbarPage, SidebarLayoutPage, SidebarPage } from '@/pages';
import { PrivateRoute } from '@/shared/router';
import { AuthLayout } from '@/widgets';
import type { RouteObject } from 'react-router-dom';
import { AppShell } from '../AppShell';

const rootRoutes: RouteObject[] = [
  {
    path: '/',
    children: [
      {
        index: true,
        element: (
          <>
            <ul className="flex flex-col justify-center gap-4 p-6 text-black dark:text-white">
              <a href="/login">login</a>
              <a href="/drive">drive</a>
              <a href="/test">test</a>
            </ul>
          </>
        ),
      },
    ],
  },
];

const authRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
];

const appRoutes: RouteObject[] = [
  {
    path: '/drive',
    element: (
      <PrivateRoute>
        <DrivePage />
      </PrivateRoute>
    ),
    children: [],
  },
];

const testRoutes: RouteObject[] = [
  {
    path: '/test',
    children: [
      {
        index: true,
        element: (
          <>
            <ul className="flex flex-col justify-center gap-4 p-6 text-black dark:text-white">
              <a href="/test/navbar">Navbar</a>
              <a href="/test/sidebar">Sidebar</a>
              <a href="/test/layout">Layouts</a>
            </ul>
          </>
        ),
      },
      { path: 'navbar', element: <NavbarPage /> },
      { path: 'sidebar', element: <SidebarPage /> },
      {
        path: 'layout',
        children: [
          {
            index: true,
            element: (
              <>
                <ul className="flex flex-col justify-center gap-4 p-6 text-black dark:text-white">
                  <a href="/test/layout/sidebar">Sidebar Layout</a>
                </ul>
              </>
            ),
          },
          { path: 'sidebar', element: <SidebarLayoutPage /> },
        ],
      },
    ],
  },
];

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...rootRoutes, ...authRoutes, ...appRoutes, ...testRoutes],
  },
];
```

- [ ] **Step 3: features/index.ts — 신규 feature re-export 추가**

`services/web/src/features/index.ts`에 아래 두 줄을 추가한다:

```typescript
export * from './login-by-2fa';
export * from './login-by-credentials';
export * from './logout';
export * from './push-notification';
export * from './deep-link';
```

- [ ] **Step 4: 빌드 확인**

```bash
cd services/web && npm run build 2>&1 | tail -10
```

Expected: `✓ built in` 메시지. TypeScript 에러 없음.

- [ ] **Step 5: 전체 테스트 확인**

```bash
cd services/web && npm test 2>&1 | tail -10
```

Expected: 모든 테스트 통과.

- [ ] **Step 6: Commit**

```bash
git add services/web/src/app/providers/AppShell.tsx \
        services/web/src/app/providers/router/config.tsx \
        services/web/src/features/index.ts
git commit -m "feat: AppShell 추가 — SplashScreen/StatusBar 초기화, Push/DeepLink 훅 통합"
```

---

## Task 6: AndroidManifest.xml — Push 권한 + App Links intent-filter

**Files:**

- Modify: `services/web/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: AndroidManifest.xml 교체**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- App Links — 딥링크 (Phase 2: 라우팅 인프라, Phase 3: 실제 페이지 연결) -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https"
                      android:host="drive.skypark207.com"
                      android:pathPrefix="/invite/" />
            </intent-filter>

            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https"
                      android:host="drive.skypark207.com"
                      android:pathPrefix="/auth/2fa/" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>

    <!-- 기본 인터넷 권한 -->
    <uses-permission android:name="android.permission.INTERNET" />

    <!-- Push 알림 권한 (Android 13+) — 런타임 요청 시 사용 -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

</manifest>
```

- [ ] **Step 2: cap sync 실행**

```bash
cd services/web && npm run cap:sync
```

Expected: `✔ copy android` 출력.

- [ ] **Step 3: Commit**

```bash
git add services/web/android/app/src/main/AndroidManifest.xml
git commit -m "feat: AndroidManifest에 Push 권한 + App Links intent-filter 추가"
```

---

## Task 7: assetlinks.json 생성 + Nginx 서빙 확인

**Files:**

- Create: `services/web/public/.well-known/assetlinks.json`

- [ ] **Step 1: assetlinks.json 생성**

`services/web/public/.well-known/assetlinks.json` 파일을 생성한다.

> **SHA-256 발급 방법:** 릴리스 키스토어 생성 후 `keytool -list -v -keystore release.jks -alias release` 명령으로 확인한다. 개발 단계에서는 디버그 키스토어 SHA-256을 사용해도 된다: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.skypark207.drive",
      "sha256_cert_fingerprints": ["REPLACE_WITH_ACTUAL_SHA256_FINGERPRINT"]
    }
  }
]
```

- [ ] **Step 2: Vite 빌드 후 경로 확인**

```bash
cd services/web && npm run build && ls dist/.well-known/
```

Expected: `assetlinks.json` 파일이 `dist/.well-known/` 에 존재함.

> Nginx는 `location /` 에서 `http://web:80`으로 프록시하며, 웹 서비스가 `dist/.well-known/assetlinks.json`을 정적으로 서빙한다. 별도 Nginx 설정 변경 불필요.

- [ ] **Step 3: Commit**

```bash
git add services/web/public/.well-known/assetlinks.json
git commit -m "feat: assetlinks.json 추가 (Android App Links 도메인 검증)"
```

---

## Task 8: 에뮬레이터 스모크 테스트

**Files:** 없음 (수동 검증)

> **사전 조건:** Firebase Console에서 Android 앱 등록 후 `google-services.json`을 `services/web/android/app/google-services.json`에 배치한다.
> Firebase 프로젝트 → 프로젝트 설정 → Android 앱 추가 → 패키지명 `com.skypark207.drive` 입력 → `google-services.json` 다운로드.
> (이 파일은 `.gitignore` 대상이므로 커밋하지 않는다.)

- [ ] **Step 1: Android 앱 빌드**

```bash
cd services/web && npm run cap:sync
```

Expected: `✔ copy android`, `✔ Updating Android plugins` 출력.

- [ ] **Step 2: 에뮬레이터 실행**

```bash
make android
```

Expected: Galaxy S26 API 36 에뮬레이터에서 `TeraB` 앱이 실행됨. 스플래시 화면(흰 배경, 1.5초) 표시 후 로그인 화면 진입.

- [ ] **Step 3: Push 권한 요청 확인**

앱 첫 실행 시 `알림 허용` 다이얼로그가 표시되는지 확인한다. 허용 후 로그인하면 FCM 토큰 등록 API가 호출되는지 API 서버 로그에서 확인:

```bash
# API 서버 실행 중인 상태에서
make api
# 로그에서 확인
grep "push-token" 로그 출력
```

Expected: `POST /api/auth/devices/push-token 200` 로그.

- [ ] **Step 4: 딥링크 진입 테스트**

에뮬레이터에서 adb 명령으로 딥링크 동작 확인:

```bash
adb shell am start -W \
  -a android.intent.action.VIEW \
  -d "https://drive.skypark207.com/auth/2fa/test-challenge-123" \
  com.skypark207.drive
```

Expected: 앱이 포그라운드로 전환되고, React Router가 `/auth/2fa/test-challenge-123`으로 이동 시도함 (현재는 404 또는 빈 화면 — Phase 3에서 실제 페이지 구현).

- [ ] **Step 5: 포그라운드 Push 수신 테스트**

Firebase Console → Cloud Messaging → 테스트 메시지 전송 (앱 foreground 상태에서):

```
제목: 로그인 승인 요청
본문: 숫자 47을 확인하고 승인해 주세요.
```

Expected: 브라우저 콘솔에 `Push received (foreground): 로그인 승인 요청` 로그 출력 (인앱 토스트 UI는 Phase 3 구현).

- [ ] **Step 6: 전체 테스트 통과 확인**

```bash
cd services/web && npm test 2>&1 | tail -5
```

Expected: 모든 테스트 통과.

- [ ] **Step 7: Final Commit (변경사항 없을 시 생략)**

```bash
git status
```

모든 변경이 이전 태스크에서 커밋되었으므로 clean 상태여야 함.

---

## 변경 이력

| 날짜       | 내용                                            |
| ---------- | ----------------------------------------------- |
| 2026-04-18 | 초기 구현 플랜 작성 (DEV-009, DEV-010, DEV-011) |


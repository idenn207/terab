# Mobile Capacitor 설계 (DEV-009, DEV-010, DEV-011)

**범위:** Phase 2 잔여 항목 — Capacitor 하이브리드 앱 셸, Push 알림 수신, 딥링크 설정
**플랫폼:** Android 우선 (iOS는 추후)

---

## 1. 아키텍처 개요

### 구조

Capacitor를 `services/web/` 안에 통합하는 공식 권장 방식을 사용한다.

```
services/web/
  capacitor.config.ts           ← Capacitor 루트 설정 (이미 존재)
  android/                      ← 네이티브 Android 프로젝트 (cap add android 생성)
  src/
    features/
      push-notification/
        model/
          usePushNotification.ts
        api/
          deviceApi.ts
      deep-link/
        model/
          useDeepLink.ts
    app/
      AppInitializer.tsx         ← 훅 마운트 지점
```

### 빌드 흐름

```
React 코드 변경
  → npm run cap:sync   (tsc + vite build + cap sync)
  → npm run cap:android   또는 Android Studio
```

로컬 개발 시 `capacitor.config.ts`의 `server.url`을 `http://10.0.2.2:5173`으로 활성화하면 에뮬레이터에서 라이브 리로드가 가능하다. 운영 배포 시에는 `https://drive.skypark207.com`으로 전환한다.

---

## 2. Capacitor 셸 설정 (DEV-009)

### 앱 식별 정보

| 항목     | 값                     |
| -------- | ---------------------- |
| App ID   | `com.skypark207.drive` |
| App Name | `TeraB`                |
| webDir   | `dist`                 |

> `capacitor.config.ts`의 `appName`이 현재 `'Tera B'`이므로 `'TeraB'`로 수정 필요.

### capacitor.config.ts 최종 형태

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
  },
};

export default config;
```

### Android 설정값

| 항목                | 값               |
| ------------------- | ---------------- |
| `minSdkVersion`     | 24 (Android 7.0) |
| `targetSdkVersion`  | 36               |
| `compileSdkVersion` | 36               |

### 플러그인 목록

| 패키지                          | 용도                    |
| ------------------------------- | ----------------------- |
| `@capacitor/android`            | Android 네이티브 런타임 |
| `@capacitor/push-notifications` | FCM Push 수신           |
| `@capacitor/app`                | 딥링크 URL 이벤트       |
| `@capacitor/splash-screen`      | 스플래시 화면 제어      |
| `@capacitor/status-bar`         | 상태바 색상/스타일      |
| `@capacitor/keyboard`           | 키보드 오버레이 제어    |

### google-services.json

기존 Notification MS에서 사용 중인 Firebase 프로젝트에 Android 앱을 추가 등록한다.
발급된 `google-services.json`은 `services/web/android/app/google-services.json`에 배치한다.

> **`FIREBASE_CREDENTIALS_PATH`와의 관계:** `configs.env`의 `FIREBASE_CREDENTIALS_PATH`는 Notification MS(백엔드)가 FCM Admin SDK를 초기화하는 서비스 계정 키다. `google-services.json`은 Android 앱(클라이언트)이 FCM을 수신하기 위한 별도 파일이며 두 파일은 역할이 다르다.

`.gitignore`에 추가할 항목 (env v2 `.gitignore` 변경 시 함께 반영):

```gitignore
# Android — 민감 파일 및 빌드 캐시
services/web/android/app/google-services.json
services/web/android/.gradle/
services/web/android/app/.cxx/
```

`services/web/android/` 네이티브 프로젝트 자체는 커밋 대상이다. `google-services.json`과 빌드 캐시 디렉토리만 제외한다.

---

## 3. Push 알림 수신 (DEV-010)

### FCM 토큰 등록 플로우

```
로그인 완료 → AppInitializer 마운트
  → PushNotifications.requestPermissions()
  → 허용 → PushNotifications.register()
  → registration 이벤트 → FCM token 획득
  → POST /api/auth/devices/push-token { pushToken, platform: 'android', name }
  → DeviceService upsert (동일 토큰이면 lastSeenAt 갱신)
```

앱 시작마다 `registration` 리스너가 실행되므로 토큰 변경 시 자동 재등록된다.

`usePushNotification`은 인증 상태(`accessToken !== null`)를 확인한 후에만 토큰 등록 API를 호출한다. 비로그인 상태에서는 권한 요청만 진행하고, 로그인 완료 후 토큰을 전송한다.

### 알림 수신 처리

| 앱 상태         | 처리 방식                                                   |
| --------------- | ----------------------------------------------------------- |
| 포그라운드      | `pushNotificationReceived` → 인앱 토스트 표시               |
| 백그라운드/종료 | 시스템 트레이 알림 자동 표시                                |
| 알림 탭         | `pushNotificationActionPerformed` → `data.type` 기반 라우팅 |

`data.type === '2FA_CHALLENGE'`인 경우 `/auth/2fa/:challengeId`로 이동한다 (Phase 3에서 페이지 구현).

### 코드 위치 (FSD 기준)

```
src/features/push-notification/
  model/
    usePushNotification.ts   ← 권한 요청 + 토큰 등록 + 리스너
  api/
    deviceApi.ts             ← POST /api/auth/devices/push-token
```

---

## 4. 딥링크 설정 (DEV-011)

### 방식: Android App Links

`https://drive.skypark207.com` 도메인을 Android App Links로 앱과 연결한다.

### 딥링크 경로

| 경로                     | 용도                    | 연결 Phase        |
| ------------------------ | ----------------------- | ----------------- |
| `/invite/:token`         | 초대 기반 가입 진입     | Phase 3 (DEV-017) |
| `/auth/2fa/:challengeId` | Push 2FA 승인 모달 진입 | Phase 3 (DEV-014) |

Phase 2에서는 라우팅 인프라만 구축하고, 실제 페이지는 Phase 3에서 연결한다.

### assetlinks.json

운영 서버에 배포해야 Android App Links가 동작한다.

- 경로: `https://drive.skypark207.com/.well-known/assetlinks.json`
- Nginx 설정에서 `/.well-known/assetlinks.json`을 정적 파일로 서빙

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.skypark207.drive",
      "sha256_cert_fingerprints": ["<릴리스 키스토어 SHA-256>"]
    }
  }
]
```

### 앱 내 처리 흐름

```
외부 링크 클릭
  → Android가 앱 실행
  → appUrlOpen 이벤트 (url: 'https://drive.skypark207.com/auth/2fa/abc123')
  → URL 파싱 → pathname 추출
  → React Router navigate(pathname)
```

### 코드 위치 (FSD 기준)

```
src/features/deep-link/
  model/
    useDeepLink.ts    ← App.addListener('appUrlOpen', ...) → navigate
```

---

## 5. 테스트 전략

### 단위 테스트 — Vitest Mock

Capacitor 플러그인을 `vi.mock()`으로 대체해 훅 로직을 검증한다.

```
src/features/push-notification/model/usePushNotification.test.ts
src/features/deep-link/model/useDeepLink.test.ts
```

### 에뮬레이터 수동 검증 체크리스트

| 항목                      | 방법                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 앱 빌드·실행              | Galaxy S26 API 36 에뮬레이터                                                                                                  |
| Push 권한 요청 다이얼로그 | 첫 실행 시 팝업 확인                                                                                                          |
| FCM 토큰 등록             | 백엔드 `/api/auth/devices/push-token` 응답 확인                                                                               |
| 포그라운드 알림 수신      | Firebase Console → 테스트 메시지 전송                                                                                         |
| 딥링크 진입               | `adb shell am start -W -a android.intent.action.VIEW -d "https://drive.skypark207.com/auth/2fa/test123" com.skypark207.drive` |
| 스플래시 화면             | 앱 시작 시 1.5초 표시 확인                                                                                                    |

---

## 변경 이력

| 날짜       | 내용                |
| ---------- | ------------------- |
| 2026-04-18 | 초기 설계 문서 작성 |

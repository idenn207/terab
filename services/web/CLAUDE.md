# services/web/CLAUDE.md

> 루트 CLAUDE.md의 세부 컨벤션입니다. 공통 원칙은 루트 CLAUDE.md를 참조하세요.

## 아키텍처 개요

**Feature-Sliced Design(FSD)** 레이어 구조를 따른다.

| 레이어   | 경로            | 역할                                         |
| -------- | --------------- | -------------------------------------------- |
| app      | `src/app/`      | 진입점, Provider, 라우터 설정                |
| pages    | `src/pages/`    | 라우트 단위 페이지 컴포넌트                  |
| widgets  | `src/widgets/`  | 여러 features/entities를 조합한 독립 UI 블록 |
| features | `src/features/` | 사용자 행위 단위 기능 (로그인, 업로드 등)    |
| entities | `src/entities/` | 비즈니스 도메인 모델 + Zustand 스토어        |
| shared   | `src/shared/`   | 재사용 UI, API 인스턴스, 유틸                |

> `pages/share/`는 공유(Share) 도메인 페이지로 FSD `shared/` 레이어와 무관하다.

### 주요 명령어

```bash
npm run dev            # 웹 개발 서버 (Vite)
npm run build          # 프로덕션 빌드
npm test               # 전체 테스트 1회 실행
npm run test:watch     # Watch 모드
npm run test:coverage  # 커버리지 리포트
npm run cap:sync       # 빌드 후 Android/iOS에 동기화
npm run cap:android    # Android 앱 실행 (에뮬레이터/기기)
```

### 테스트 파일 위치

- 컴포넌트/훅 테스트: 대상 파일과 동일 디렉토리 (`*.test.tsx`, `*.test.ts`)
- MSW 핸들러·서버 설정: `src/test/mocks/`
- 테스트 템플릿: `src/test/templates/` (복사 후 사용, 원본 수정 금지)
- 상세 가이드: `src/test/TDD_GUIDE.md`

## FSD 레이어 의존 규칙

상위 레이어만 하위 레이어를 import할 수 있다. 역방향 금지.

```
app → pages → widgets → features → entities → shared
```

| import 방향                                           | 허용 여부 |
| ----------------------------------------------------- | --------- |
| `pages` → `widgets`, `features`, `entities`, `shared` | ✅        |
| `widgets` → `features`, `entities`, `shared`          | ✅        |
| `features` → `entities`, `shared`                     | ✅        |
| `entities` → `shared`                                 | ✅        |
| `shared` → 상위 레이어                                | ❌        |
| `features` → `pages`, `widgets`                       | ❌        |
| `entities` → `features` 이상                          | ❌        |
| 같은 레이어 내 슬라이스 간 cross-import               | ❌        |

같은 레이어 내 슬라이스 간 cross-import는 금지한다 (예: `features/upload` → `features/login`). 공통 로직은 `shared/`로 내린다.

각 슬라이스는 `index.ts`로만 외부에 노출한다. 내부 경로 직접 import 금지.

```ts
// ✅
import { useAuth } from '@/features';
// ❌
import { useAuth } from '@/features/login-by-2fa/model/useAuth';
```

## 컴포넌트 컨벤션

- 파일명: PascalCase (`FileList.tsx`)
- 컴포넌트명과 파일명 일치
- props 타입은 `interface`로 선언, 파일 상단에 위치
- UI 라이브러리: `shared/ui/catalyst/` — 직접 수정 금지, 확장 필요 시 래핑 컴포넌트 작성
- 스타일: TailwindCSS 4 유틸리티 클래스만 사용, 인라인 `style` 속성 금지
- 클래스 조합: `cn()` 유틸(`shared/lib/utils/cn.ts`) 사용

## 함수 선언 컨벤션

최상위(root) 레벨은 `function` 선언, 함수·클래스 내부는 arrow function 사용.

```ts
// ✅ 최상위 — function 선언
export function Sample() {
  const show = () => console.log('inner'); // ✅ 내부 — arrow function
  show();
}

// ❌ 최상위에 arrow function 금지
export const Sample = () => {};
```

### export 위치 규칙

- `.tsx` 또는 단일 export: 선언부에 바로 `export` 붙임
- `.ts` 또는 다중 export: 파일 하단에 `export { }` 로 일괄 내보냄

```ts
// sample.tsx — 선언과 동시에 export
export function Sample() {}

// utils.ts — 하단 일괄 export
function formatSize() {}
function parseDate() {}
export { formatSize, parseDate };
```

## 상태관리 컨벤션

| 상태 종류            | 도구            | 위치                                        |
| -------------------- | --------------- | ------------------------------------------- |
| 서버 데이터 (도메인) | Zustand         | `entities/{domain}/model/`                  |
| 전역 UI 상태         | Zustand         | `shared/lib/` 또는 `features/{name}/model/` |
| 폼 상태              | React Hook Form | 컴포넌트 내부                               |
| 로컬 UI 상태         | `useState`      | 컴포넌트 내부                               |

### 핵심 규칙

**DRY — 상태 중복 금지:** 동일한 데이터를 두 곳에 저장하지 않는다. 파생 가능한 값은 상태로 만들지 않고 계산한다.

```ts
// ❌ isLoggedIn을 별도 상태로 저장
// ✅ const isLoggedIn = user !== null
```

**서버 상태 vs UI 상태 분리:** 서버에서 온 데이터(`user`, `files`)와 UI 제어 값(`isModalOpen`, `selectedTab`)을 같은 스토어에 혼재하지 않는다. 서버 상태는 `entities/` 레이어 스토어, UI 상태는 컴포넌트 내 `useState` 또는 `features/` 모델로 분리한다.

**공유 상태 최소화:** Zustand 스토어는 진짜 전역이 필요한 경우에만 사용한다. 단일 컴포넌트 트리 내에서만 쓰이는 상태는 `useState`로 로컬 관리하고, 스토어 수를 늘리기 전에 props 전달로 해결 가능한지 먼저 검토한다.

**불변성 유지:**

```ts
// ❌ state.user.name = 'foo'
// ✅ set((state) => ({ user: { ...state.user, name: 'foo' } }))
```

배열 업데이트: `push` 대신 spread 또는 `filter`/`map` 사용.

**Selector 구독:**

```ts
// ❌ const store = useUserStore()
// ✅ const user = useUserStore((s) => s.user)
```

### 스토어 작성 규칙

파일 구조:

```
entities/{domain}/model/
  store.ts   — Zustand 스토어
  types.ts   — 도메인 타입 정의
```

네이밍:

- 스토어 훅: `use{Domain}Store` (예: `useUserStore`, `useFileStore`)
- 인터페이스: `{Domain}State` (예: `AuthState`, `FileState`)

인터페이스는 상태 필드를 먼저, 액션을 나중에 선언한다.

```ts
interface AuthState {
  // 상태 필드
  accessToken: string | null;
  user: User | null;
  // 액션
  setAuth: (token: string, user: User) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

const useUserStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));

export { useUserStore };
```

- 도메인 타입(`User`, `File` 등)은 `types.ts`에, 스토어 인터페이스는 `store.ts`에 선언
- `types.ts`의 타입은 `export type { }` 패턴으로 내보냄
- 액션은 스토어 내부에 정의 — 외부에서 `setState()` 직접 호출 금지

```ts
// ❌ useUserStore.setState({ user: null })
// ✅ useUserStore.getState().clearAuth()
```

### 위반 패턴

| 위반                                | 원인                    | 해결                        |
| ----------------------------------- | ----------------------- | --------------------------- |
| `isLoggedIn` 상태 별도 저장         | 파생 가능한 값을 상태화 | `user !== null`로 계산      |
| 서버 데이터 + 모달 여부 같은 스토어 | 서버/UI 상태 혼재       | 스토어 분리 또는 `useState` |
| `useUserStore()` 전체 구독          | 불필요한 리렌더링       | selector 사용               |
| 스토어 배열 직접 `push`             | 불변성 위반             | `[...prev, item]`           |

## API 레이어 컨벤션

- axios 인스턴스: `shared/api/axiosInstance.ts` — 이 외 경로에 인스턴스 생성 금지
- 인스턴스는 401 응답 시 자동 토큰 갱신(refresh queue) 처리가 내장되어 있음
- API 함수는 레이어별 `api/` 서브디렉토리에 작성 (예: `features/login-by-2fa/api/twoFactorApi.ts`)
- 반환 타입 명시 필수 — `any` 사용 금지
- 에러 핸들링은 호출부(훅 또는 컴포넌트)에서 처리

## Android / Capacitor 컨벤션

Web(React) 빌드 결과물을 Capacitor가 Android WebView로 감싸는 구조다. 네이티브 기능은 Capacitor 플러그인 방식으로 `android/` 내에 인라인으로 작성한다.

### 빌드 흐름

```
React 코드 변경
  → npm run cap:sync   (tsc + vite build + cap sync)
  → Android Studio 또는 npm run cap:android 로 실행
```

Web 코드만 변경한 경우 반드시 `cap:sync`를 실행해야 Android에 반영된다.

### 파일 수정 기준

| 경로                                              | 수정 여부 | 이유                          |
| ------------------------------------------------- | --------- | ----------------------------- |
| `android/app/src/main/java/com/skypark207/drive/` | ✅ 가능   | 앱 진입점 + 네이티브 플러그인 |
| `android/app/src/main/res/`                       | ✅ 가능   | 리소스(아이콘, splash 등)     |
| `android/app/build.gradle`                        | ✅ 가능   | 의존성 추가 시                |
| `android/capacitor-cordova-android-plugins/`      | ❌ 금지   | Capacitor 자동 생성           |
| `android/app/build/`                              | ❌ 금지   | 빌드 산출물                   |
| `capacitor.config.ts`                             | ✅ 가능   | 앱 ID, 서버 URL 등 설정       |

### 네이티브 플러그인 작성

플러그인 패키지 위치:

```
android/app/src/main/java/com/skypark207/drive/plugins/
  UploadPlugin.java
  BackgroundPlugin.java
```

- 플러그인 클래스는 `com.getcapacitor.Plugin`을 상속
- `MainActivity.java`의 `registerPlugin()`에 등록
- JS 브릿지 메서드에는 `@PluginMethod` 어노테이션 필수
- 네이티브↔Web 간 데이터 전달은 `JSObject` / `JSArray` 사용

### Live 서버 전환 (운영 배포 시)

`capacitor.config.ts`의 `server` 블록 주석 해제 후 `cap:sync` 실행. 로컬 개발 중에는 해당 블록을 주석 상태로 유지한다.

```ts
server: {
  url: 'https://drive.skypark207.com',
  androidScheme: 'https',
}
```

## Claude 행동 지침

> 공통 지침은 루트 CLAUDE.md를 참조. 아래는 web 서비스 전용 추가 지침이다.

### 코드 작성 전 확인 사항

- 새 파일 생성 전 FSD 레이어 위치가 적절한지 판단한다
- 컴포넌트 작성 전 `shared/ui/catalyst/`에 재사용 가능한 기반 컴포넌트가 있는지 확인한다
- API 함수 작성 전 `shared/api/axiosInstance.ts`를 import하는지 확인한다

### FSD 레이어 위반 감지 시

- import 방향이 규칙을 위반하면 구현 전 사용자에게 알리고 올바른 레이어를 제안한다
- 같은 레이어 내 슬라이스 간 cross-import가 필요한 경우 `shared/`로 내리는 방안을 먼저 제안한다

### 상태관리 위반 검사

코드 작성·수정 시 아래 항목을 순서대로 검사한다:

1. **중복 상태**: 이미 스토어에 있는 값을 새 상태로 추가하려 하는가?
   → 기존 스토어에서 파생하거나 selector로 구독하도록 유도
2. **파생 가능한 상태**: 다른 상태에서 계산 가능한 값을 상태로 만들려 하는가?
   → 상태 제거 후 인라인 계산식으로 대체
3. **서버/UI 상태 혼재**: 서버 데이터와 UI 제어 값이 같은 스토어에 있는가?
   → 도메인 스토어(`entities/`)와 UI 상태(`useState`) 분리 제안
4. **스토어 전체 구독**: `useXxxStore()` 전체를 구독하는가?
   → selector 패턴으로 필요한 필드만 구독하도록 수정
5. **직접 변이**: `state.field = value` 또는 `setState()` 직접 호출인가?
   → 스토어 내부 액션 사용으로 교체
6. **스토어 위치 오류**: 스토어가 `entities/` 외 레이어에 선언되어 있는가?
   → 도메인 귀속이 명확하면 `entities/`, UI 전용이면 `features/` 또는 `useState`로 이동 제안

### Android 관련 작업 시

- `android/` 내 자동 생성 파일 수정 요청이 오면 이유를 확인한 후 진행한다
- 네이티브 플러그인 신규 작성 시 `MainActivity.java` 등록까지 함께 처리한다
- Web 코드 변경 후 Android 반영이 필요한 경우 `cap:sync` 실행을 안내한다

### 신규 슬라이스 생성 시 체크리스트

1. 레이어 결정: 역할에 맞는 레이어(`features`, `entities`, `widgets`) 선택
2. `index.ts` 생성: 외부에 공개할 인터페이스만 export
3. 내부 구조: `ui/`, `model/`, `api/` 서브디렉토리로 분리
4. 기존 슬라이스의 `index.ts` 갱신 (레이어 루트 `index.ts`에 re-export 추가)

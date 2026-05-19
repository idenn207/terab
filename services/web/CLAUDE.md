# services/web/CLAUDE.md

> 루트 CLAUDE.md의 세부 컨벤션입니다. 공통 원칙은 루트 CLAUDE.md를 참조하세요.

## 아키텍처 개요

**Feature-Sliced Design(FSD)** 레이어 구조를 따른다.

| 레이어   | 경로            | 역할                                         | 사용 시점                                     |
| -------- | --------------- | -------------------------------------------- | --------------------------------------------- |
| app      | `src/app/`      | 전역 설정·스타일·프로바이더                  | 전체 앱에 영향을 주는 설정이 필요할 때        |
| pages    | `src/pages/`    | 라우트 단위 페이지 구성                      | 특정 URL에 대응하는 화면을 구성할 때          |
| widgets  | `src/widgets/`  | 페이지의 독립된 구역(Header·Sidebar·툴바 등) | 여러 features를 조합해 하나의 구역을 만들 때  |
| features | `src/features/` | 사용자 행위 단위 기능(행위 + 노출 UI)        | 비즈니스 로직(API·Hook)과 UI가 결합될 때      |
| entities | `src/entities/` | 비즈니스 도메인 모델(User·File 등)           | 데이터 구조·단순 목록·도메인 상태를 정의할 때 |
| shared   | `src/shared/`   | 프로젝트 전역 재사용 도구                    | UI Kit·공통 유틸·API 클라이언트 설정 등       |

> `pages/share/`는 공유(Share) 도메인 페이지로 FSD `shared/` 레이어와 무관하다.

### Widgets vs Features 구분

가장 자주 혼동되는 두 레이어다. 판단 기준은 **"하나의 사용자 행위(action)인가, 여러 행위의 조합(section)인가"**.

- **features** — 하나의 사용자 행위(action) 단위. 행위를 트리거하는 UI 컴포넌트(버튼, 폼 등)는 해당 feature의 `ui/`에 둔다.
  - 예: `features/file-upload/ui/UploadButton.tsx`, `features/file-delete/ui/DeleteButton.tsx`, `features/login-by-credentials/ui/LoginForm.tsx`
  - 행위가 단일 버튼이라도 비즈니스 로직(API 호출, mutation, 상태 변경)이 붙으면 feature이다.
- **widgets** — features와 entities를 **조합**하여 페이지의 독립된 구역(section)을 구성하는 단위. 자체 비즈니스 로직은 가지지 않고 배치/레이아웃만 담당한다.
  - 예: `widgets/sidebar/`(Logo + 네비게이션 + UserMenu 조합), `widgets/navbar/`, `widgets/file-toolbar/`(UploadButton + NewFolderButton + ViewSwitcher 조합)
  - "어떤 features를 어디에 배치할지"가 widget의 역할이다.

| 상황                                             | 올바른 위치                                      |
| ------------------------------------------------ | ------------------------------------------------ |
| 파일 업로드 버튼 1개 (mutation 호출)             | `features/file-upload/ui/UploadButton.tsx`       |
| 파일 삭제 버튼 1개 (mutation 호출)               | `features/file-delete/ui/DeleteButton.tsx`       |
| 업로드 + 새 폴더 + 정렬 토글이 한 줄에 모인 툴바 | `widgets/file-toolbar/`                          |
| 로그인 폼(이메일/비밀번호 입력 + 제출)           | `features/login-by-credentials/ui/LoginForm.tsx` |
| 로그인 페이지의 좌측 일러스트 + 우측 폼 레이아웃 | `widgets/auth-layout/`                           |

> 핵심: feature의 `ui/`가 비어 있다면 그 feature는 미완성이거나 widget으로 잘못 분류된 것이다. **행위는 feature, 배치는 widget**.

### 세그먼트 사용 시점

각 슬라이스 내부의 세그먼트(`api/`, `model/`, `ui/`)는 아래 기준으로 분리한다.

| 세그먼트 | 역할                                                           | 사용 시점                                                                                  |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `api/`   | 서버 통신 어댑터(hey-api mutation/query 래퍼, axios 호출 함수) | 슬라이스가 외부 API를 호출할 때. 슬라이스 외부에는 비공개 — `index.ts`에서 export 금지     |
| `model/` | 비즈니스 로직(훅, 스토어, 도메인 유틸)                         | `api/` 호출을 조합하거나 상태를 관리하는 훅·스토어가 필요할 때                             |
| `ui/`    | 슬라이스 전용 React 컴포넌트                                   | 이 슬라이스의 행위·도메인을 화면에 노출할 때. 외부 슬라이스의 컴포넌트를 import하지 않는다 |

세그먼트는 필요한 것만 만든다. 예:

- `features/file-upload/` — `api/`(mutation 래퍼) + `model/`(useUploadFile 훅) + `ui/`(UploadButton)
- `entities/user/` — `model/`(useUserStore) + `types.ts` (api·ui 불필요)
- `widgets/sidebar/` — `ui/`만 (자체 model·api 없이 features를 조합)

### codegen 도입 후 api/ 세그먼트 규칙

`@hey-api/openapi-ts` codegen 함수를 호출하는 슬라이스는 **정책 유무와 무관하게 `api/` 세그먼트를 항상 생성**한다. 단순 wrapper도 작성한다.

- 파일 분리: GET → `api/query.ts`, POST/PATCH/PUT/DELETE → `api/mutation.ts`
- model은 항상 `../api/...`를 경유한다. **codegen 함수(`@shared/api`의 `xxxMutation`, `xxxOptions`)를 model에서 직접 import 금지** (타입 import는 허용)
- `api/`는 슬라이스 `index.ts`에서 export 안 함 (외부에는 model/ui만 노출)
- codegen 산출물 직접 경로(`@/shared/api/generated/...`) 사용 금지 — 항상 `@shared/api` 통일

```ts
// features/login-by-credentials/api/mutation.ts
import { useMutation } from '@tanstack/react-query';
import { loginMutation } from '@shared/api';

export function useLoginMutation() {
  return useMutation({ ...loginMutation() });
}
```

```ts
// features/login-by-credentials/model/useLogin.ts
import { useLoginMutation } from '../api/mutation';     // ✅ api 경유
// ❌ import { loginMutation } from '@shared/api';      // model에서 codegen 함수 직접 import 금지
```

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

FSD 레이어 구조에 맞게 테스트를 슬라이스 내부에 배치한다.

```
src/
  __tests__/              # 공유 테스트 인프라 (슬라이스에 속하지 않는 것만)
    mocks/                # MSW 핸들러·서버 설정
    templates/            # 테스트 템플릿 (복사 후 사용, 원본 수정 금지)
    setup.ts              # Vitest 전역 설정
    TDD_GUIDE.md          # 테스트 작성 가이드

  features/{slice}/
    model/
      useXxx.ts
      useXxx.test.ts      # 훅·스토어 테스트는 구현 파일 옆에
    ui/
      Component.tsx
      Component.test.tsx  # 컴포넌트 테스트는 구현 파일 옆에

  entities/{domain}/
    model/
      store.ts
      store.test.ts       # 도메인 테스트는 구현 파일 옆에
```

테스트 파일은 대상 구현 파일과 같은 서브디렉토리(예: `model/`, `ui/`, `api/`)에 위치한다. 슬라이스에 귀속되지 않는 공유 유틸·MSW 설정은 `src/__tests__/`에만 둔다. 테스트 파일 네이밍: `*.test.tsx` (컴포넌트/훅), `*.test.ts` (유틸/스토어)

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

### 슬라이스 내부 세그먼트 참조 규칙

슬라이스 내부에서 세그먼트 간 참조는 아래 방향만 허용한다.

```
api → model → ui
```

| import 방향     | 허용 여부 |
| --------------- | --------- |
| `model` → `api` | ✅        |
| `ui` → `model`  | ✅        |
| `ui` → `api`    | ❌        |
| `api` → `model` | ❌        |
| `model` → `ui`  | ❌        |

`api` 세그먼트는 `index.ts`에서 export하지 않는다. 외부 슬라이스에는 `model`과 `ui`만 노출한다.

```ts
// features/upload/index.ts
export { useUpload } from './model/useUpload'; // ✅ model export
export { UploadButton } from './ui/UploadButton'; // ✅ ui export
// export { uploadApi } from './api/uploadApi';    // ❌ api는 슬라이스 내부용
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

- 선언부에 바로 `export` 붙임

```ts
// sample.tsx — 선언과 동시에 export
export function Sample() {}
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

export const useUserStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));

export { useUserStore };
```

- 도메인 타입(`User`, `File` 등)은 `types.ts`에, 스토어 인터페이스는 `store.ts`에 선언
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

## API 레이어 / TanStack Query × Zustand 컨벤션

> 본 컨벤션은 ts-rest 제거 마이그레이션(2026-05-16) 완료 시점에 박제됨. 원본은 `docs/superpowers/finish-specs/2026-05-16-ts-rest-removal-swagger-migration-design.md` §6.B.

### Transport / codegen

- axios 인스턴스: `shared/api/axiosInstance.ts` — **단일 인스턴스**. 이 외 경로에 인스턴스 생성 금지
- `axiosInstance`는 request interceptor 내부에서 `isPublicPath(url)` 기반으로 Authorization 헤더를 분기 부착한다 (`@Public()` 라우트는 헤더 미부착)
- 401 응답 시 refresh queue로 토큰 갱신 후 원 요청 재시도, 검증 실패 시 `/login` 리다이렉트
- codegen 산출물은 `shared/api/generated/` (git tracked)
- import는 `@shared/api` 단일 진입점 — `@/shared/api/generated/...` 직접 경로 금지

### codegen 워크플로우

1. API DTO/엔드포인트 변경
2. API dev 서버 reload (켜져 있어야 함)
3. `npm --prefix services/web run openapi:codegen`
4. generated diff 검토 + 사용처 갱신
5. 동시에 commit (generated + 사용처 분리 금지)

### 상태 분류

| 데이터 | 저장소 |
|---|---|
| 서버 응답 객체(user, files 등) | TanStack Query 캐시 |
| 클라이언트 세션(accessToken) | Zustand |
| UI 토글/모달 | useState / features Zustand |
| 폼 임시값 | React Hook Form |

**원칙**: 서버 데이터를 Zustand에 복제 금지. user 표시는 `useMeQuery()`로 가져온 캐시 사용.

### `api/` 세그먼트 — 항상 생성

- codegen 함수를 호출하는 슬라이스는 **정책 유무 무관 `api/` 필수**
- 파일 분리: GET → `query.ts`, mutation → `mutation.ts`
- 단순 wrapper도 작성:
  ```ts
  export function useLoginMutation() {
    return useMutation({ ...loginMutation() });
  }
  ```
- model은 항상 `../api/...`만 import (codegen 함수 직접 import 금지, 타입 import는 허용)
- `api/`는 슬라이스 `index.ts`에서 export 안 함 (외부에는 model/ui만)

### 호출 패턴

```ts
// mutation
const { mutate, isPending } = useXxxMutation();
mutate({ body, path, query }, { onSuccess: ({ data }) => { ... } });

// query
const { data, isLoading } = useXxxQuery();
```

응답 구조: `{ data, error, response }` (hey-api 형식).

### Zustand 액션 호출

```ts
// model/useXxx.ts의 onSuccess 콜백에서만
useUserStore.getState().setAuth(token, user);   // ✅ getState() — 콜백에서는 구독 불필요
```

콜백 안에서 hook 호출 금지 (rules of hooks 위반).

### Query Invalidation

- 도메인 공통 invalidation은 `api/mutation.ts` wrapper에서 처리:
  ```ts
  const queryClient = useQueryClient();
  return useMutation({
    ...uploadCompleteMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [{ _id: 'getFiles' }] }),
  });
  ```
- queryKey는 hey-api 자동 생성 키만 사용 (수동 작성 금지)

### react-hook-form

- DTO 타입을 `useForm<XxxDto>()` 제네릭 사용
- 검증은 `register()` 내장 옵션(`required`/`minLength`/`pattern`)
- `zodResolver` 금지

### 금지 패턴

| 금지 | 대체 |
|---|---|
| model에서 `@shared/api`의 codegen 함수 직접 import | `api/` wrapper 경유 |
| 서버 데이터 Zustand 복제 | TanStack Query 캐시 |
| `useUserStore()` 전체 구독 | selector |
| `useUserStore.setState()` 직접 호출 | `getState().action()` |
| `useForm` 제네릭 생략 | `useForm<XxxDto>()` |
| queryKey 수동 작성 | hey-api 자동 키 |
| codegen 산출물 직접 경로 import | `@shared/api` 통일 |
| `axiosBasic`/`axiosAuth` 같은 인스턴스 분리 | 단일 `axiosInstance` + 인터셉터 분기 |
| `zodResolver` 등 zod 기반 폼 검증 | react-hook-form `register()` 내장 옵션 |

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
- API 함수 작성 전 인증 필요 여부를 확인한다: 인증 필요 → `axiosInstance`, 공개 엔드포인트(로그인·리프레시 등) → 순수 `axios`

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

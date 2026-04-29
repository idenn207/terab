# ts-rest + TanStack Query 마이그레이션 설계

**날짜:** 2026-04-29
**브랜치:** refactor/migration-tanstack-query
**범위:** API ↔ Web 타입 안전 연동 전환 (plain axios + 수동 타입 → ts-rest + TanStack Query)

---

## 배경

현재 Web은 각 feature 슬라이스에서 axios를 직접 호출하고 요청/응답 타입을 수동 interface로 관리한다. API와 Web 간 타입 동기화를 수동으로 유지해야 하므로 드리프트 위험이 있다. 이전 프로젝트의 GraphQL + apollo-codegen 수준의 타입 안전성을 REST API 환경에서 달성하기 위해 ts-rest를 도입한다.

---

## 목표

- API 계약(contract)을 단일 진실 소스로 확립 — 양쪽 컴파일 타임 강제
- TanStack Query로 서버 상태 캐싱 및 요청 중복 제거
- 도메인 단위 점진적 전환 — 기존 서비스 무중단

---

## 결정 사항

| 항목 | 결정 |
|---|---|
| 방식 | ts-rest 양측 완전 도입 (API + Web) |
| 계약 패키지 위치 | `packages/contracts/` (repo root) |
| 패키지 명 | `@terab/contracts` |
| npm 의존성 방식 | 로컬 경로 참조 (`file:../../packages/contracts`) — workspaces 미도입 |
| 마이그레이션 단위 | 도메인별 순차 전환 |

---

## 섹션 1: 전체 구조 & 패키지 레이아웃

### 디렉토리

```
terab/
├── packages/
│   └── contracts/
│       ├── package.json        # name: "@terab/contracts"
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── schemas/        # Zod 스키마 (도메인별)
│           │   ├── auth.schema.ts
│           │   ├── invitation.schema.ts
│           │   └── common.schema.ts
│           └── contracts/      # ts-rest 라우터 정의
│               ├── auth.contract.ts
│               ├── invitation.contract.ts
│               └── index.ts
├── services/
│   ├── api/                    # "@terab/contracts": "file:../../packages/contracts"
│   ├── web/                    # 동일
│   └── ...
```

### Docker 빌드 컨텍스트 변경

`packages/contracts/`가 각 서비스의 빌드 컨텍스트 외부에 위치하므로 컨텍스트를 repo root로 확장한다.

| 변경 대상 | 현재 | 변경 후 |
|---|---|---|
| `Makefile` build-local | `docker build ./services/api` | `docker build -f services/api/Dockerfile .` |
| `deploy.yml` matrix context | `./services/api` | `.` + `file: services/api/Dockerfile` |
| `services/api/Dockerfile` | `COPY package*.json ./` | 앞에 `COPY packages/contracts/ ./packages/contracts/` 추가 |
| `services/web/Dockerfile` | `COPY . .` | 앞에 `COPY packages/contracts/ ./packages/contracts/` 추가 |
| `deploy.yml` CI 테스트 단계 | `working-directory: services/api` | contracts `npm install` step 선행 추가 |

---

## 섹션 2: 계약 정의 패턴 & Zod 스키마 전략

### Zod 스키마 → 계약 연결

```ts
// packages/contracts/src/schemas/auth.schema.ts
export const LoginBodySchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const LoginResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('AUTHENTICATED'), accessToken: z.string(), user: UserSchema }),
  z.object({ status: z.literal('2FA_REQUIRED'), challengeId: z.string(), options: z.array(z.string()) }),
]);

export type LoginBody = z.infer<typeof LoginBodySchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
```

```ts
// packages/contracts/src/contracts/auth.contract.ts
export const authContract = c.router({
  login: {
    method: 'POST',
    path: '/api/auth/login',
    body: LoginBodySchema,
    responses: { 200: LoginResponseSchema },
  },
  me: {
    method: 'GET',
    path: '/api/auth/me',
    responses: { 200: UserResponseSchema },
  },
  // ...
});
```

### 기존 NestJS DTO와의 관계

- 도메인 전환 시 해당 `*.dto.ts` 파일을 제거하고 Zod 스키마로 대체
- `class-validator`, `class-transformer` 의존성은 모든 도메인 전환 완료 후 제거
- Zod 스키마는 Web에서 react-hook-form `zodResolver`에도 직접 재사용 가능

---

## 섹션 3: API 서버 측 — `@ts-rest/nest` 적용

### 컨트롤러 변환 패턴

```ts
// Before
@Controller('api/auth')
export class AuthController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> { ... }
}

// After
@Controller()
export class AuthController {
  @TsRestHandler(authContract.login)
  async login(
    @Cookies('trustToken') trustToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return tsRestHandler(authContract.login, async ({ body }) => {
      const { response, rawRefreshToken, expMs } = await this.authService.login(body, trustToken);
      this.setRefreshTokenCookie(res, rawRefreshToken, expMs);
      return { status: 200, body: response };
    });
  }
}
```

### 유지되는 기존 인프라

| 항목 | 영향 |
|---|---|
| `@UseGuards(JwtAuthGuard)` | 변경 없음 |
| `@Public()`, `@CurrentUser()`, `@Cookies()` | 변경 없음 |
| `@Res({ passthrough: true })` | tsRestHandler 콜백 외부에서 그대로 사용 |
| `@Throttle()` | 변경 없음 |
| ValidationPipe | 전환 완료 전 공존, 이후 Zod pipe로 교체 |

**주의:** `@TsRestHandler` 사용 시 기존 `@Post()`, `@Get()` 등 라우트 데코레이터를 반드시 제거해야 한다. 중복 등록이 발생한다.

---

## 섹션 4: Web 측 — FSD 레이어 역할 분리

### `shared/api/` — 클라이언트 초기화

```ts
// shared/api/client.ts
import { initQueryClient } from '@ts-rest/react-query';
import { contract } from '@terab/contracts';
import { axiosUser } from './axiosInstance';

export const api = initQueryClient(contract, {
  baseUrl: '',
  api: async (args) => {
    const response = await axiosUser({
      method: args.method,
      url: args.path,
      data: args.body,
      params: args.query,
    });
    return { status: response.status, body: response.data, headers: response.headers };
  },
});
```

`axiosUser`의 401 refresh 인터셉터가 ts-rest 클라이언트를 통한 요청에도 그대로 동작한다.

### FSD 레이어별 역할

| 레이어 | 파일 | 책임 |
|---|---|---|
| `shared/api/client.ts` | ts-rest 클라이언트 초기화 | transport 설정, axiosUser 연결 |
| `{slice}/api/query.ts` | `useQuery` 호출 | 엔드포인트, 캐시 키, staleTime |
| `{slice}/api/mutation.ts` | `useMutation` 호출 | 엔드포인트만, 사이드이펙트 없음 |
| `{slice}/model/useXxx.ts` | 비즈니스 로직 | api 훅 사용 + Store 연결 + 분기 처리 |

파일 분리 기준: **GET → `query.ts`**, **POST/PUT/DELETE → `mutation.ts`** (한 종류만 있으면 해당 파일만 생성)

### 패턴 예시

```ts
// features/login-by-credentials/api/mutation.ts
export function useLoginMutation() {
  return api.auth.login.useMutation();
}

// features/login-by-credentials/model/useLogin.ts
export function useLogin() {
  const { mutate, isPending, isError } = useLoginMutation();

  const login = (credentials: LoginBody) => {
    mutate({ body: credentials }, {
      onSuccess: ({ body }) => {
        if (body.status === 'AUTHENTICATED') {
          useUserStore.getState().setAuth(body.accessToken, body.user);
        }
      },
    });
  };

  return { login, isPending, isError };
}
```

### QueryClient Provider

```ts
// app/providers/index.tsx
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 30 } },
});

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Zustand 역할 정리 방향

서버에서 온 데이터(user 객체 등)는 TanStack Query 캐시로 이동하고, Zustand는 `accessToken`처럼 서버가 모르는 클라이언트 전용 상태만 보유하는 방향으로 점진 정리한다. 초기 전환에서 강제하지 않고 도메인 전환 시 자연스럽게 정리한다.

---

## 섹션 5: 도메인 단위 마이그레이션 순서

### Phase 0: 인프라 세팅

도메인 작업 전 1회 완료.

- `packages/contracts/` 패키지 생성
- `@ts-rest/core`, `@ts-rest/nest`, `@ts-rest/react-query`, `zod` 설치
- `@tanstack/react-query` web에 추가 + `QueryClientProvider` 등록
- Docker 빌드 컨텍스트 repo root로 확장 (Makefile, `deploy.yml`, Dockerfile)
- `shared/api/client.ts` 생성

### Phase 1–5: 도메인 전환 순서

| Phase | 도메인 | 이유 |
|---|---|---|
| 1 | invitation | 단방향 단순 흐름, 의존성 없음 — 파이프라인 검증용 |
| 2 | auth | 핵심 도메인, 쿠키/2FA 복잡도 초반 확인 |
| 3 | twofa | auth 의존, polling 로직 포함 |
| 4 | device | twofa 흐름 이후 등록 |
| 5 | trusted-device | device 이후 |

### 도메인당 체크리스트

```
contracts:
  ☐ schemas/{domain}.schema.ts 작성
  ☐ contracts/{domain}.contract.ts 작성
  ☐ contracts/index.ts에 추가

api (NestJS):
  ☐ @TsRestHandler로 컨트롤러 교체
  ☐ 기존 @Post/@Get 등 라우트 데코레이터 제거
  ☐ 기존 DTO 파일 제거
  ☐ 컨트롤러 테스트 통과 확인

web:
  ☐ {slice}/api/query.ts 또는 mutation.ts 작성
  ☐ {slice}/model/useXxx.ts store 연결 로직 이전
  ☐ 기존 {slice}/api/*Api.ts 제거
  ☐ 수동 interface 타입 정의 제거
  ☐ 기존 테스트 통과 확인

공통:
  ☐ make build-api, make build-web 통과
  ☐ 해당 도메인 E2E 흐름 수동 확인
```

### class-validator 제거 시점

모든 Phase 완료 후 `api/package.json`에서 `class-validator`, `class-transformer` 제거.

---

## 의존성 변경 요약

### packages/contracts/package.json (신규)
```json
{
  "name": "@terab/contracts",
  "dependencies": {
    "@ts-rest/core": "^3.x",
    "zod": "^3.x"
  }
}
```

### services/api/package.json 추가
```
@ts-rest/nest, @ts-rest/core, @terab/contracts (file:)
```

### services/web/package.json 추가
```
@ts-rest/react-query, @tanstack/react-query, @terab/contracts (file:)
```

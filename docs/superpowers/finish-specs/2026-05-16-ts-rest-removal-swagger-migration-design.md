# ts-rest 제거 + Swagger/codegen/TanStack Query 마이그레이션 설계

**날짜:** 2026-05-16
**작업 브랜치(예정):** `refactor/ts-rest-removal`
**범위:** API ↔ Web 계약 레이어 전면 교체 (ts-rest + Zod → @nestjs/swagger + class-validator + @hey-api/openapi-ts)

---

## 배경

현재 `packages/contracts`는 ts-rest 3.52.1 + Zod 3.22.x로 잠긴 단일 소스다. ts-rest는 1년 넘게 유의미한 릴리즈가 없고 Zod 3.22.x에 고정되어 v4 단축 문법을 사용할 수 없다. `file:` 의존성 + Dockerfile의 `contracts-builder` 스테이지 + dangling symlink 수동 처리 등 인프라 복잡도가 누적되어 있다. ts-rest 위에 `@ts-rest/react-query` 어댑터를 입혀 TanStack Query를 쓰고 있으나, 어댑터 자체도 ts-rest 본체 정지 영향권에 있다.

표준 OpenAPI 기반으로 단일 소스를 재정의해 (1) 의존성 정지 리스크 해소, (2) Zod 버전 잠금 해제, (3) Dockerfile/CI 단순화를 달성한다.

---

## 목표

- ts-rest와 Zod를 양 서비스에서 완전 제거
- NestJS는 `class-validator` + `class-transformer` + `@nestjs/swagger`로 단일 소스 재정의
- Web은 `@hey-api/openapi-ts`로 OpenAPI 스펙을 codegen → TanStack Query v5 권장 패턴(`queryOptions`/`mutationOptions`) 활용
- 도메인별 점진적 전환, 단일 PR로 운영 배포는 1회만 트리거
- 패턴/규칙을 박제해 새 코드가 일관되게 유지되도록 한다

---

## 결정 사항

| 항목                           | 결정                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| ts-rest                        | API/Web 양쪽에서 완전 제거                                                                                     |
| Zod                            | 전면 제거 (앞으로 사용 안 함, react-hook-form 내장 검증만 사용)                                                |
| NestJS API 표현                | `class-validator` + `class-transformer` DTO + `@nestjs/swagger` 데코레이터                                     |
| `@nestjs/swagger` CLI plugin   | `nest-cli.json`에 등록 (`@ApiProperty` 자동 부착)                                                              |
| OpenAPI 노출                   | API dev 서버의 `/json` 엔드포인트 (`jsonDocumentUrl: '/json'`) — 파일 dump 안 함, prod에서는 노출 안 함        |
| Web codegen                    | `@hey-api/openapi-ts` + `@hey-api/client-axios` + TanStack Query plugin                                        |
| codegen 실행                   | 수동 (`npm run openapi:codegen`) — pre-build/dev hook 없음                                                     |
| codegen 산출물                 | **git tracked** (`src/shared/api/generated/`)                                                                  |
| `PUBLIC_PATHS`                 | `@Public()` 데코레이터가 `ApiSecurity({})`를 합성, codegen 후처리 스크립트가 자동 추출 → `public-paths.gen.ts` |
| Web `api/` 세그먼트            | 정책 유무와 무관하게 **항상 생성**. model은 항상 `../api/...` 경유, codegen 직접 import 금지                   |
| Docker 빌드 컨텍스트           | 각 서비스 디렉토리가 root, `contracts-builder` 스테이지 전체 삭제                                              |
| `.github/workflows/deploy.yml` | contracts 관련 step/cache 삭제, build-and-push matrix의 `context`를 각 서비스로, `file:` 옵션 제거             |
| `packages/contracts`           | 모든 도메인 전환 완료 후 패키지 자체 제거                                                                      |
| 마이그레이션                   | 인프라 Phase 0 → 도메인별 Phase 1~8 → 정리 Phase N+1, **단일 브랜치 + 단일 PR**로 master 머지                  |

---

## 섹션 1 — 전체 아키텍처

### Before

```
packages/contracts (단일 소스: ts-rest contract + Zod schema)
   ├── services/api: file: 의존성, @TsRestHandler
   └── services/web: file: 의존성, initTsrReactQuery
   ↑
Dockerfile context = repo root
   ├── contracts-builder stage
   ├── builder/runner stage → dangling symlink 수동 제거 후 replace
   └── deploy.yml: contracts cache + Build contracts step 양 job에 중복
```

### After

```
services/api (단일 소스: class-validator DTO + @nestjs/swagger 데코레이터)
   │
   └─ make api (npm run start:dev)
        ↓ NODE_ENV=dev 시 SwaggerModule.setup('swagger', app, doc, { jsonDocumentUrl: '/json' })
        ↓
   GET http://localhost:3000/json   ← Live OpenAPI 3.x JSON
        ↓
   services/web에서 개발자가 명시적으로 `npm run openapi:codegen` 실행
        ↓ @hey-api/openapi-ts가 위 URL을 fetch
        ↓ + scripts/extract-public-paths.mjs가 같은 URL fetch
        ↓
   services/web/src/shared/api/generated/  ← git tracked
        ├── types.gen.ts          (DTO 타입)
        ├── sdk.gen.ts            (호출 함수)
        ├── client.gen.ts         (createClient — axios wiring)
        ├── @tanstack/react-query.gen.ts  (queryOptions/mutationOptions/queryKey)
        └── public-paths.gen.ts   (Public 엔드포인트 Set)
        ↓
   git commit (DTO 변경과 사용처 변경을 한 PR로 묶어 검토)
```

### 운영 흐름 변경

- API DTO 변경 → API dev 서버 자동 reload → Web 개발자가 `npm run openapi:codegen` 수동 실행 → diff 확인 후 commit
- codegen 시점에 API 서버가 살아 있어야 성공 (의도된 제약)
- prod 환경에서 `/json` 노출 안 함 — `NODE_ENV === 'dev'` 분기 안에서만 활성화

### 제거되는 인프라 자산

| 파일/항목                                                                                      | 처리                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/contracts/` 전체                                                                     | Phase N+1에서 삭제                                                                                                       |
| `services/api/package.json`: `@terab/contract`, `@ts-rest/core`, `@ts-rest/nest`, `zod`        | 삭제                                                                                                                     |
| `services/web/package.json`: `@terab/contract`, `@ts-rest/core`, `@ts-rest/react-query`, `zod` | 삭제                                                                                                                     |
| `services/api/Dockerfile`                                                                      | `contracts-builder` 스테이지 전체 + `COPY --from=contracts-builder` + dangling symlink 처리 삭제. path prefix 단순화     |
| `services/web/Dockerfile`                                                                      | 동일                                                                                                                     |
| `.github/workflows/deploy.yml`                                                                 | `Set up Node 24 (contracts)`, `Build contracts` step 삭제. matrix의 `file:` 옵션 제거, `context`를 각 서비스로           |
| `Makefile`                                                                                     | `build-packages` target 제거, `build-api`/`build-web`의 의존 제거, `image` target의 `-f ... .` → `./services/api` 형태로 |

### 추가되는 인프라 자산

| 파일/항목                                                   | 내용                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `services/api/src/main.ts`                                  | `SwaggerModule.setup`에 `jsonDocumentUrl: '/json'` 추가. `DocumentBuilder.addBearerAuth(...)` + 글로벌 security 등록 |
| `services/api/nest-cli.json`                                | `@nestjs/swagger/plugin` 등록                                                                                        |
| `services/api/src/common/decorators/public.decorator.ts`    | `applyDecorators(SetMetadata, ApiSecurity({}))` 합성                                                                 |
| `services/api/src/common/decorators/api-error.decorator.ts` | `ApiError(...keys: ErrorCodeKey[])` 헬퍼                                                                             |
| `services/api/src/common/dto/error-response.dto.ts`         | `{ code, message }`                                                                                                  |
| `services/api/src/common/dto/user.dto.ts`                   | 공유 UserDto                                                                                                         |
| `services/web/openapi-ts.config.ts`                         | input·output·plugins 정의                                                                                            |
| `services/web/scripts/extract-public-paths.mjs`             | security 빈 operation의 path 추출 → `public-paths.gen.ts` 생성                                                       |
| `services/web/package.json` scripts                         | `"openapi:codegen": "openapi-ts && node scripts/extract-public-paths.mjs"`                                           |
| `services/web/src/shared/api/runtime-config.ts`             | axios 인스턴스 주입                                                                                                  |
| `services/web/src/shared/api/index.ts`                      | transport + generated re-export                                                                                      |
| `services/web/src/shared/api/axiosInstance.ts`              | 단일 인스턴스로 재작성 (인터셉터에서 PUBLIC_PATHS 분기)                                                              |
| `services/web/src/shared/api/generated/`                    | codegen 산출물, git tracked                                                                                          |

---

## 섹션 2 — NestJS API 측 패턴

### 2.1 글로벌 설정

`services/api/src/main.ts`

```ts
// dev 환경 분기 안:
const config = new DocumentBuilder().setTitle('API Docs').addBearerAuth().build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('swagger', app, document, { jsonDocumentUrl: '/json' });

// 전역 ValidationPipe:
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
```

`services/api/nest-cli.json`

```json
{ "compilerOptions": { "plugins": ["@nestjs/swagger/plugin"] } }
```

### 2.2 DTO 패턴

위치: `src/{domain}/dto/` (도메인 전용), `src/common/dto/` (공유).
파일명: `kebab-case.dto.ts`. 클래스명: `PascalCase` + `Dto`.

```ts
// services/api/src/auth/dto/login-body.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginBodyDto {
  @MinLength(1)
  @MaxLength(50)
  @IsString()
  username!: string;

  @MinLength(1)
  @MaxLength(255)
  @IsString()
  password!: string;
}
```

- swagger plugin이 `@ApiProperty({ minLength, maxLength })` 컴파일 시 자동 부착
- 단순 필드는 데코레이터 미작성, 명시 메타 필요 시(`enum`, `format`, `oneOf`)만 수동 `@ApiProperty(...)`
- Response DTO에는 class-validator 데코레이터 불필요. 민감 필드는 `@Exclude()`

### 2.3 Discriminated Union 패턴

```ts
// services/api/src/auth/dto/login-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedResponseDto {
  @ApiProperty({ enum: ['AUTHENTICATED'] })
  status!: 'AUTHENTICATED';

  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class TwoFaRequiredResponseDto {
  @ApiProperty({ enum: ['2FA_REQUIRED'] })
  status!: '2FA_REQUIRED';

  challengeId!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export type LoginResponse = AuthenticatedResponseDto | TwoFaRequiredResponseDto;
```

Controller 매핑:

```ts
@ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
@ApiResponse({
  status: HttpStatus.OK,
  schema: {
    oneOf: refs(AuthenticatedResponseDto, TwoFaRequiredResponseDto),
    discriminator: {
      propertyName: 'status',
      mapping: {
        AUTHENTICATED: getSchemaPath(AuthenticatedResponseDto),
        '2FA_REQUIRED': getSchemaPath(TwoFaRequiredResponseDto),
      },
    },
  },
})
```

**`@ApiExtraModels` + `oneOf` + `discriminator.mapping` 3종 세트는 누락 금지** — web codegen narrowing 정확도의 핵심.

### 2.4 Controller 변환 패턴

Before (ts-rest):

```ts
@Controller()
export class AuthController {
  @Public() @Throttle(...)
  @TsRestHandler(contract.auth.login)
  handleLogin(...) {
    return tsRestHandler(contract.auth.login, async ({ body }) => { ... });
  }
}
```

After (NestJS 표준):

```ts
@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '아이디/비밀번호 로그인' })
  @ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
  @ApiResponse({ status: HttpStatus.OK, schema: { oneOf, discriminator } })
  @ApiError('INVALID_CREDENTIALS', 'USER_NOT_FOUND', 'USER_LOCKED')
  async login(
    @Body() body: LoginBodyDto,
    @Cookies('trustToken') trustToken: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> { ... }
}
```

### 2.5 변환 매핑표

| ts-rest                                           | NestJS 표준                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `@TsRestHandler(contract.x.y)`                    | `@Post('path')` + `@HttpCode(HttpStatus.OK)` (필요 시)                        |
| `summary` (contract)                              | `@ApiOperation({ summary })`                                                  |
| `body` (Zod schema)                               | `@Body() body: XxxDto`                                                        |
| `pathParams: z.object({ id: z.string().uuid() })` | `@Param('id', ParseUUIDPipe) id: string`                                      |
| `query` (Zod)                                     | `@Query() query: XxxQueryDto`                                                 |
| `responses[HttpStatus.OK]`                        | `@ApiResponse({ status, type })` 또는 oneOf+discriminator                     |
| `body: EmptySchema, response: EmptySchema`        | `@Body()` 생략 + `@HttpCode(HttpStatus.NO_CONTENT)` + 반환 `void`             |
| `contentType: 'multipart/form-data'`              | `@UseInterceptors(FileInterceptor)` + `@ApiConsumes` + `@ApiBody({ schema })` |

### 2.6 ApiException → OpenAPI 매핑

`services/api/src/common/decorators/api-error.decorator.ts` (신규)

```ts
export function ApiError(...keys: ErrorCodeKey[]): MethodDecorator {
  const grouped = new Map<number, ErrorCodeKey[]>();
  for (const key of keys) {
    const status = ErrorCode[key].status;
    grouped.set(status, [...(grouped.get(status) ?? []), key]);
  }
  return applyDecorators(
    ...Array.from(grouped.entries()).map(([status, ks]) =>
      ApiResponse({
        status,
        type: ErrorResponseDto,
        description: ks.map((k) => `\`${k}\` — ${ErrorCode[k].message}`).join('\n'),
      }),
    ),
  );
}
```

사용: `@ApiError('USER_NOT_FOUND', 'INVALID_CREDENTIALS')` — ErrorCode 한 곳에서 status/message가 정의되므로 OpenAPI에 자동 매핑.

---

## 섹션 3 — Web 측 패턴

### 3.1 codegen 설정

`services/web/openapi-ts.config.ts`

```ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:3000/json',
  output: { path: 'src/shared/api/generated', format: 'prettier', lint: 'eslint' },
  plugins: [
    { name: '@hey-api/client-axios', runtimeConfigPath: './src/shared/api/runtime-config.ts' },
    '@hey-api/typescript',
    '@hey-api/sdk',
    '@tanstack/react-query',
  ],
});
```

`services/web/package.json`

```json
"scripts": {
  "openapi:codegen": "openapi-ts && node scripts/extract-public-paths.mjs"
}
```

- predev/prebuild hook 없음 — 수동 실행
- API dev 서버 미기동 시 명확한 에러로 워크플로우 강제

### 3.2 axios 인스턴스 단일화

기존 `axiosAuth`/`axiosBasic` 분기 + `PUBLIC_PATHS` Set → **단일 인스턴스 + request interceptor 내 분기**.

`services/web/src/shared/api/axiosInstance.ts` (재작성, 핵심 발췌)

```ts
import { PUBLIC_PATHS } from '@shared/api'; // 자동 생성된 Set

axiosInstance.interceptors.request.use((config) => {
  if (config.url && PUBLIC_PATHS.has(config.url)) return config;
  const token = useUserStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (!(error instanceof AxiosError)) throw error;
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) throw error;
    if (PUBLIC_PATHS.has(original.url ?? '')) throw error; // 공개 엔드포인트 401은 통과
    // ... 기존 401 refresh 큐 로직 그대로 이식
  },
);
```

- refresh 호출은 raw `axios.post(...)` 사용 (인터셉터 재진입 방지)
- PUBLIC_PATHS는 `public-paths.gen.ts`에서 import (단일 소스 = NestJS `@Public()`)

### 3.3 PUBLIC_PATHS 자동 추출

`services/api/src/common/decorators/public.decorator.ts` (변경)

```ts
export const IS_PUBLIC_KEY = 'isPublic';

export function Public(): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiSecurity({}));
}
```

`services/web/scripts/extract-public-paths.mjs` (신규)

```js
const res = await fetch('http://localhost:3000/json');
const openapi = await res.json();

const publicPaths = [];
for (const [path, methods] of Object.entries(openapi.paths)) {
  for (const op of Object.values(methods)) {
    if (Array.isArray(op.security) && op.security.length > 0 && op.security.every((s) => Object.keys(s).length === 0)) {
      publicPaths.push(path);
    }
  }
}

await fs.writeFile('src/shared/api/generated/public-paths.gen.ts', `export const PUBLIC_PATHS = new Set<string>(${JSON.stringify(publicPaths, null, 2)});\n`);
```

### 3.4 codegen wiring

`services/web/src/shared/api/runtime-config.ts`

```ts
import type { CreateClientConfig } from './generated/client.gen';
import { axiosInstance } from './axiosInstance';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  axios: axiosInstance,
});
```

`services/web/src/shared/api/index.ts`

```ts
export { axiosInstance } from './axiosInstance';
export type * from './generated/types.gen';
export * from './generated/@tanstack/react-query.gen';
export * as Sdk from './generated/sdk.gen';
export { PUBLIC_PATHS } from './generated/public-paths.gen';
```

### 3.5 FSD `api/` 세그먼트 — 항상 생성

| 슬라이스 상황                          | 처리                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| codegen 함수를 호출하는 모든 슬라이스  | `api/{query,mutation}.ts` **필수 작성** (정책 유무 무관)                          |
| 정책 없음 (단순 wrapper도 작성)        | `useXxxMutation() { return useMutation({ ...xxxMutation() }); }`                  |
| 정책 있음 (staleTime, invalidation 등) | wrapper 내부에 정책                                                               |
| 파일 분리                              | GET → `query.ts`, mutation → `mutation.ts`                                        |
| 외부 노출                              | 슬라이스 `index.ts`에서 `api/` export 안 함 (외부에는 model/ui만)                 |
| model의 import                         | 항상 `../api/...` 경유. `@shared/api`의 codegen 함수 직접 import 금지 (타입은 OK) |

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
import { useLoginMutation } from '../api/mutation';
import { useUserStore } from '@/entities';
import type { LoginBodyDto, LoginResponse } from '@shared/api';

export function useLogin() {
  const { mutate, isPending, isError } = useLoginMutation();

  const login = (credentials: LoginBodyDto) => {
    mutate(
      { body: credentials },
      {
        onSuccess: ({ data }) => {
          if (data.status === 'AUTHENTICATED') {
            useUserStore.getState().setAuth(data.accessToken, data.user);
          }
        },
      },
    );
  };

  return { login, isPending, isError };
}
```

응답 구조 변경: ts-rest `{ status, body }` → hey-api `{ data, error, response }`.

### 3.6 react-hook-form 검증

- DTO 타입을 `useForm<XxxDto>()` 제네릭으로 사용 (컴파일 타임 정합성)
- 런타임 검증은 `register()` 내장 옵션(`required`/`minLength`/`pattern`)
- `zodResolver` 도입 금지 (Zod 전면 제거 결정과 충돌)

---

## 섹션 4 — 마이그레이션 Phase

### 4.1 PR/브랜치 전략

- **단일 브랜치 `refactor/ts-rest-removal` + 단일 PR** — 운영 자동 배포 1회만 발생
- Phase별 commit으로 review 가이드 및 bisect 가능성 확보
- master rebase는 매주 1회 (충돌 영역: `services/api/src/{domain}/`, `services/web/src/features/`, `services/web/src/shared/api/`)
- 모든 Phase 완료 후 dev 환경 e2e 수동 검증 → master 머지

### 4.2 Phase 0 — 인프라 (도메인 작업 전 완료)

**API**: ValidationPipe 전역 등록, `nest-cli.json`에 swagger plugin, `main.ts`에 `jsonDocumentUrl`/`addBearerAuth`, `@Public()` 합성 변경, `ErrorResponseDto`/`UserDto`/`@ApiError` 헬퍼 작성.
**Web**: `@hey-api/openapi-ts`/`@hey-api/client-axios` 추가, `openapi-ts.config.ts`/`extract-public-paths.mjs`/`runtime-config.ts`/`shared/api/index.ts` 신규, `axiosInstance.ts` 단일 인스턴스로 재작성, 첫 `npm run openapi:codegen` 실행 후 generated commit. CLAUDE.md(web)에 `api/` 세그먼트 규칙 추가.
**검증**: `make api && make web` 정상 동작, 기존 ts-rest 라우트 전부 동작, `localhost:3000/json` 응답 확인.

### 4.3 Phase 1~8 순서

| Phase | 도메인         | 메서드 수                      | 선정 근거                                                |
| ----- | -------------- | ------------------------------ | -------------------------------------------------------- |
| 1     | invitation     | ~5                             | 단방향 흐름, 의존성 없음. 파이프라인 검증                |
| 2     | folder         | ~7                             | 독립 도메인 (file/trash가 의존하므로 file보다 먼저)      |
| 3     | trusted-device | ~3                             | 인증 곁가지, 영향 작음                                   |
| 4     | device         | ~5                             | 인증 곁가지                                              |
| 5     | twofa          | ~4                             | auth 결합, 쿠키/리프레시 사전 검증                       |
| 6     | auth           | 7                              | 핵심 도메인, discriminated union 포함. 학습 누적 후 진행 |
| 7     | file           | ~10 (file + upload + download) | multipart, presigned URL, 가장 큰 도메인                 |
| 8     | trash          | ~3                             | file 의존, 마지막                                        |

**auth 후순위**: 다른 도메인 전환 중 인증 동작은 그대로 유지(ts-rest 잔존)되어야 함. 인증을 마지막에 가까운 시점에 만지는 게 위험 분산.

**Phase 6 진입 전 검증**: oneOf+discriminator 정상 출력을 확인하기 위해 작은 dummy union 엔드포인트로 micro-검증(같은 브랜치 내 별도 commit). 검증 후 dummy 제거.

### 4.4 도메인당 체크리스트

```
[API]
☐ src/{domain}/dto/ 디렉토리 생성
☐ Body/Query/Response DTO 작성 (discriminated union이면 @ApiExtraModels + oneOf)
☐ Controller 변환: @TsRestHandler 제거, @Post/@Get/@Patch/@Delete + @HttpCode 명시
☐ @ApiOperation/@ApiResponse/@ApiError 부착
☐ @Body/@Param/@Query 데코레이터 적용, ParseUUIDPipe 등 path 검증
☐ controller spec 갱신 (tsRestHandler mock 제거)
☐ service 시그니처 DTO 타입으로 교체
☐ contract import 제거 → DTO import
☐ packages/contracts/{domain}.contract.ts/schema.ts는 잠시 유지

[Web]
☐ make api 실행 → npm run openapi:codegen
☐ generated diff 검토 후 commit
☐ features/{slice}/api/{query,mutation}.ts 갱신 (@terab/contract → @shared/api)
☐ features/{slice}/model/useXxx.ts 갱신 (응답 { body } → { data })
☐ MSW handler import 경로 갱신
☐ model 훅 단위 테스트 통과 확인

[공통]
☐ make build-api && make build-web 통과
☐ 해당 도메인 e2e 흐름 수동 검증
☐ 도메인 단위 commit (한글 conventional commit)
```

### 4.5 Phase N+1 — 정리 (모든 도메인 후)

1. `packages/contracts/` 디렉토리 삭제
2. `services/api/package.json`, `services/web/package.json`에서 ts-rest/Zod/@terab/contract 의존성 제거
3. `services/api/Dockerfile`, `services/web/Dockerfile` 재작성 — `contracts-builder` stage 삭제, path prefix 단순화
4. `.github/workflows/deploy.yml` — contracts 관련 step 삭제, matrix `context`를 각 서비스로
5. `Makefile` — `build-packages` target 제거, 의존 정리, `image` target 단순화
6. CLAUDE.md 정리:
   - 루트 CLAUDE.md L55 `packages/contracts/` 줄 삭제
   - `services/api/CLAUDE.md` ts-rest 컨벤션 → swagger 컨벤션으로 재작성 (섹션 6.A 옮김)
   - `services/web/CLAUDE.md` ts-rest 컨벤션 → hey-api/TanStack 컨벤션 재작성 (섹션 6.B 옮김)
   - `packages/contracts/CLAUDE.md` 삭제

### 4.6 일정 추정

| 구간                                       | 기간                          |
| ------------------------------------------ | ----------------------------- |
| Phase 0                                    | 1~2일                         |
| Phase 1 (invitation, 파이프라인 검증 포함) | 1~2일                         |
| Phase 2~6                                  | 도메인당 1~2일 (총 5~7일)     |
| Phase 7 (file)                             | 3~4일                         |
| Phase 8 (trash)                            | 1일                           |
| Phase N+1 정리                             | 1일                           |
| **합계**                                   | **약 2~3주** (단독 작업 기준) |

---

## 섹션 5 — 테스트 영향 및 의존성 변경 요약

### 5.1 테스트 영향

| 레이어              | 영향         | 변경 작업                                                                     |
| ------------------- | ------------ | ----------------------------------------------------------------------------- |
| API Repository spec | 영향 없음    | Drizzle 패턴 그대로                                                           |
| API Service spec    | 작음         | DTO 클래스 타입 시그니처만 조정                                               |
| API Controller spec | 큼           | `tsRestHandler` mock 제거, 표준 메서드 호출. validation 실패 메시지 포맷 검증 |
| API e2e             | 큼           | URL/메서드 동일, validation 400 메시지 포맷 차이 갱신                         |
| Web MSW handler     | 작음         | 타입 import 경로 갱신 (`@terab/contract` → `@shared/api`)                     |
| Web model spec      | 큼           | 응답 구조 `{ body }` → `{ data }`                                             |
| Web ui spec         | 거의 없음    | model 훅 추상화 덕분                                                          |
| codegen 산출물 자체 | 테스트 안 함 | hey-api의 책임                                                                |

### 5.2 작성 우선순위

도메인 Phase 진행 시: (1) Controller spec → (2) Service spec → (3) Web model spec → (4) MSW handler → (5) e2e는 Phase 8 후 일괄 점검.
`.claude/rules/testing.md`의 "실패 케이스 우선" + `describe > it` 구조 그대로.

### 5.3 의존성 변경

`packages/contracts/package.json`: 전체 제거.

`services/api/package.json`

```diff
- "@terab/contract": "file:../../packages/contracts",
- "@ts-rest/core": "^3.52.1",
- "@ts-rest/nest": "^3.52.1",
- "zod": "3.22.x",
  "class-transformer": "^0.5.1",        // 유지
  "class-validator": "^0.15.1",         // 유지
  "@nestjs/swagger": "^11.4.2",         // 유지
```

`services/web/package.json`

```diff
- "@terab/contract": "file:../../packages/contracts",
- "@ts-rest/core": "^3.52.1",
- "@ts-rest/react-query": "^3.52.1",
- "zod": "3.22.x",
  "@tanstack/react-query": "^5.100.6",  // 유지
  "axios": "^1.15.0",                   // 유지
+ "@hey-api/client-axios": "^0.x.x",
+ "@hey-api/openapi-ts": "^0.97.x",     // devDep, -E 옵션으로 정확 버전 핀
```

### 5.4 위험 요소·완화책

| 위험                                       | 영향                             | 완화책                                                          |
| ------------------------------------------ | -------------------------------- | --------------------------------------------------------------- |
| codegen 산출물과 사용처 동기 안 됨         | 빌드 깨짐                        | DTO 변경 즉시 codegen + 동일 commit. PR diff 검토               |
| hey-api 0.x breaking change                | 업그레이드 비용                  | `-E` 옵션 정확 버전 핀, 정기 점검(분기 1회)으로 업그레이드 분리 |
| discriminated union codegen 출력 깨짐      | LoginResponse 타입 오류          | Phase 6 진입 전 dummy 엔드포인트로 micro-검증                   |
| ValidationPipe 메시지 포맷 vs ts-rest 차이 | 클라이언트 에러 메시지 표시 깨짐 | ApiExceptionFilter에서 400 응답을 ErrorResponseDto로 정형화     |
| 작업 기간 중 master rebase 충돌            | 시간 손실                        | 매주 1회 master 흡수, 충돌 영역 작업 사전 협의                  |

### 5.5 최종 변경 파일 합산 (~120 파일)

- `packages/contracts/` ~20 파일 삭제
- `services/api/src/{domain}/dto/` ~35 신규
- `services/api/src/**/*.controller.ts` 11 재작성
- `services/api/src/**/*.controller.spec.ts` 11 갱신
- `services/api/src/common/decorators/`, `common/dto/` 4 추가/수정
- `services/api/src/main.ts`, `nest-cli.json`, `Dockerfile` 3 수정
- `services/web/src/shared/api/` 4 신규/재작성
- `services/web/src/features/*/api/*.ts` ~13 갱신
- `services/web/src/features/*/model/*.ts` ~13 갱신
- `services/web/openapi-ts.config.ts`, `scripts/extract-public-paths.mjs` 2 신규
- `services/web/Dockerfile`, `.github/workflows/deploy.yml`, `Makefile`, CLAUDE.md 4종 6 수정

---

## 섹션 6 — 패턴/규칙 명세

마이그레이션 진행 중 일관 적용 + Phase N+1에서 `services/api/CLAUDE.md`, `services/web/CLAUDE.md`에 박제.

### 6.A Swagger 작성 규칙 (NestJS)

#### 6.A.1 Controller 데코레이터

| 항목        | 규칙                                                   |
| ----------- | ------------------------------------------------------ |
| 경로 prefix | `@Controller('domain')` — kebab/단수형                 |
| 그룹 태그   | `@ApiTags('Domain')` — PascalCase 단수형               |
| 인증 기본값 | 글로벌 security로 처리. `@Public()` 라우트는 자동 비움 |

#### 6.A.2 메서드 데코레이터 순서 (고정)

```
@Public() / @RequirePermission()
@Throttle(...)
@Post/@Get/@Patch/@Delete
@HttpCode(...)
@ApiOperation({ summary: '한글 요약' })
@ApiExtraModels(...)
@ApiResponse({ status, type/schema })
@ApiError('KEY1', 'KEY2')
```

순서 위반 시 PR review reject.

#### 6.A.3 HttpCode 명시

| 메서드 | 기본 | 명시 필수                                               |
| ------ | ---- | ------------------------------------------------------- |
| GET    | 200  | 거의 없음                                               |
| POST   | 201  | **200 응답 시 `@HttpCode(HttpStatus.OK)` 필수**         |
| DELETE | 200  | **204 응답 시 `@HttpCode(HttpStatus.NO_CONTENT)` 필수** |

#### 6.A.4 응답 표현 패턴

```ts
// 단일
@ApiResponse({ status: HttpStatus.OK, type: UserDto })
// 배열
@ApiResponse({ status: HttpStatus.OK, type: UserDto, isArray: true })
// 빈 응답
@ApiResponse({ status: HttpStatus.NO_CONTENT })
// Discriminated union — @ApiExtraModels + oneOf + discriminator.mapping 3종 세트 필수
```

#### 6.A.5 DTO 작성

- 위치: `src/{domain}/dto/`, 공유는 `src/common/dto/`
- 파일명 kebab-case + `.dto.ts`, 클래스명 PascalCase + `Dto`
- 필드 `!: type` (non-null assertion)
- 단순 필드는 swagger plugin 자동 처리. 명시 메타만 `@ApiProperty(...)` 수동
- Response DTO에는 class-validator 데코레이터 불필요. 민감 필드 `@Exclude()`

#### 6.A.6 Path/Query 검증

- 단일 uuid: `@Param('id', ParseUUIDPipe) id: string`
- 복수 query: `@Query() query: XxxQueryDto`

#### 6.A.7 `@ApiError` 헬퍼

- `@ApiError('KEY1', 'KEY2')`만 사용. 직접 `@ApiResponse({ status: 404, type: ErrorResponseDto })` 금지

#### 6.A.8 `@Public()`

- 가드 우회 + OpenAPI security 비움 자동 합성
- 부착 시 web `PUBLIC_PATHS` 자동 갱신됨을 인지

#### 6.A.9 금지 패턴

| 금지                                                         | 대체                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `@ApiProperty()` 단순 필드 명시적 부착                       | swagger plugin에 위임                                      |
| `@Post()` 후 `@HttpCode` 생략 (200 의도)                     | `@HttpCode(HttpStatus.OK)` 명시                            |
| `@ApiResponse({ status: 404, type: ErrorResponseDto })` 직접 | `@ApiError('KEY')`                                         |
| `oneOf` 없이 union 응답 type 명시                            | `@ApiExtraModels + oneOf + discriminator.mapping` 3종 세트 |
| Controller에서 비즈니스 로직                                 | Service 위임 (기존 컨벤션)                                 |

### 6.B TanStack Query × Zustand 연계 규칙 (Web)

#### 6.B.1 상태 분류

| 데이터                         | 저장소                      |
| ------------------------------ | --------------------------- |
| 서버 응답 객체(user, files 등) | TanStack Query 캐시         |
| 클라이언트 세션(accessToken)   | Zustand                     |
| UI 토글/모달                   | useState / features Zustand |
| 폼 임시값                      | React Hook Form             |

**원칙**: 서버 데이터를 Zustand에 복제 금지. user 표시는 `useMeQuery()`.

#### 6.B.2 `api/` 세그먼트

- 정책 유무 무관 **항상 생성**
- GET → `query.ts`, mutation → `mutation.ts`
- 단순 wrapper도 작성:

  ```ts
  export function useLoginMutation() {
    return useMutation({ ...loginMutation() });
  }
  ```

- model은 항상 `../api/...` 경유. codegen 직접 import 금지 (타입은 OK)
- `api/`는 슬라이스 `index.ts`에서 export 안 함

#### 6.B.3 호출 패턴

```ts
// mutation
const { mutate, isPending } = useXxxMutation();
mutate({ body, path, query }, { onSuccess: ({ data }) => { ... } });

// query
const { data, isLoading } = useXxxQuery();
```

#### 6.B.4 Zustand 액션 호출

```ts
// model/useXxx.ts의 onSuccess 콜백에서만
useUserStore.getState().setAuth(token, user);
// ✅ getState() — 콜백 안에서는 구독 불필요
```

#### 6.B.5 Query Invalidation

- 도메인 공통 invalidation은 `api/mutation.ts` wrapper에서:

  ```ts
  const queryClient = useQueryClient();
  return useMutation({
    ...uploadCompleteMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [{ _id: 'getFiles' }] }),
  });
  ```

- queryKey는 hey-api 자동 생성 키만 사용 (수동 작성 금지)

#### 6.B.6 import 경로

- ✅ `import { loginMutation, type LoginBodyDto } from '@shared/api'`
- ❌ `@/shared/api/generated/...` 직접 경로
- ❌ model에서 codegen 함수 직접 import (타입은 허용)

#### 6.B.7 react-hook-form

- DTO 타입을 `useForm<XxxDto>()` 제네릭 사용
- 검증은 `register()` 내장 옵션
- `zodResolver` 금지

#### 6.B.8 codegen 워크플로우

1. API DTO/엔드포인트 변경
2. API dev 서버 reload (켜져 있어야 함)
3. `cd services/web && npm run openapi:codegen`
4. generated diff 검토 + 사용처 갱신
5. 동시에 commit (generated + 사용처 분리 금지)

#### 6.B.9 금지 패턴

| 금지                                               | 대체                  |
| -------------------------------------------------- | --------------------- |
| model에서 `@shared/api`의 codegen 함수 직접 import | `api/` wrapper 경유   |
| 서버 데이터 Zustand 복제                           | TanStack Query 캐시   |
| `useUserStore()` 전체 구독                         | selector              |
| `useUserStore.setState()` 직접 호출                | `getState().action()` |
| `useForm` 제네릭 생략                              | `useForm<XxxDto>()`   |
| queryKey 수동 작성                                 | hey-api 자동 키       |
| codegen 산출물 직접 경로 import                    | `@shared/api` 통일    |

### 6.C 규칙 박제 시점

| Phase     | 적용                                                                    |
| --------- | ----------------------------------------------------------------------- |
| Phase 0   | 본 섹션이 living document. Phase 1부터 참조                             |
| Phase 1~8 | 본 규칙 100% 준수. 실제 적용 중 미세 조정은 본 섹션 갱신                |
| Phase N+1 | 검증된 형태로 `services/api/CLAUDE.md`, `services/web/CLAUDE.md`에 박제 |

---

## 부록 — Phase 종료 조건 (Definition of Done)

각 Phase가 끝나려면:

- 해당 Phase의 모든 체크리스트 항목 통과
- `make build-api && make build-web` 성공
- 새 commit 안에서 단위 테스트 통과
- e2e 검증은 Phase 8 종료 후 일괄, 도메인 단위로 수동 확인 가능하면 즉시

master 머지 조건:

- Phase 0 ~ Phase N+1 모두 완료
- 작업 브랜치에서 dev 환경 e2e 전체 수동 검증
- PR description에 Phase별 commit hash 매핑, 변경 요약, 위험 요소·완화책 명시

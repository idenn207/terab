# Phase 0 — 인프라 구축 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ts-rest 잔존 상태에서 새 패턴(class-validator/swagger + @hey-api/openapi-ts)이 동작하도록 토대를 구축한다. 도메인 변환은 Phase 1부터.

**Architecture:** API에 `@nestjs/swagger` CLI plugin·`ValidationPipe`·`jsonDocumentUrl`·`@Public()` 합성 변경·공유 DTO·`@ApiError` 헬퍼를 도입. Web에 `@hey-api/openapi-ts`·`extract-public-paths.mjs`·단일 `axiosInstance`·codegen wiring을 도입. Phase 0 종료 후 기존 ts-rest 라우트는 그대로 동작하며 `/json` 엔드포인트가 (현재는 거의 빈) OpenAPI를 노출한다.

**Tech Stack:** NestJS 11, `@nestjs/swagger` 11.4.2, `class-validator` 0.15.1, `class-transformer` 0.5.1, `@hey-api/openapi-ts` (Phase 0 시점 최신 0.97.x), `@hey-api/client-axios`, `@tanstack/react-query` 5.100.6, axios 1.15.

**Commit 단위:** Phase 0은 두 commit으로 진행한다 — (A) API 인프라 (Task 1~9), (B) Web 인프라 + 첫 codegen 산출물 (Task 10~20).

**Spec 참조:** [`2026-05-16-ts-rest-removal-swagger-migration-design.md`](../specs/2026-05-16-ts-rest-removal-swagger-migration-design.md) §1, §2.1, §3.1~3.4, §4.2, §6.A

---

## File Structure

### Create (API)
- `services/api/src/common/dto/error-response.dto.ts` — ApiException 응답 직렬화 DTO
- `services/api/src/common/dto/user.dto.ts` — 공유 UserDto (현 UserSchema 대체)
- `services/api/src/common/dto/index.ts` — `common/dto` 진입점
- `services/api/src/common/decorators/api-error.decorator.ts` — ErrorCode 키 기반 `@ApiError` 헬퍼

### Modify (API)
- `services/api/nest-cli.json` — swagger plugin 등록
- `services/api/src/main.ts` — ValidationPipe 전역, swagger DocumentBuilder addBearerAuth, jsonDocumentUrl 추가
- `services/api/src/common/decorators/public.decorator.ts` — `applyDecorators(SetMetadata, ApiSecurity({}))` 합성
- `services/api/src/common/decorators/index.ts` — ApiError re-export

### Create (Web)
- `services/web/openapi-ts.config.ts` — codegen 설정
- `services/web/scripts/extract-public-paths.mjs` — security 빈 operation path 추출
- `services/web/src/shared/api/runtime-config.ts` — axios 인스턴스 wiring
- `services/web/src/shared/api/index.ts` — transport + generated re-export
- `services/web/src/shared/api/generated/` — codegen 산출물 디렉토리 (자동 생성)

### Modify (Web)
- `services/web/package.json` — `@hey-api/openapi-ts`/`@hey-api/client-axios` 추가, `openapi:codegen` script 추가
- `services/web/src/shared/api/axiosInstance.ts` — 단일 인스턴스로 재작성 (`axiosBasic`/`axiosAuth` 합치기)
- `services/web/CLAUDE.md` — `api/` 세그먼트 항상 생성 규칙 추가

---

## Task 1: `nest-cli.json`에 swagger plugin 등록

**Files:**
- Modify: `services/api/nest-cli.json`

- [ ] **Step 1: 현재 `nest-cli.json` 읽고 plugins 추가**

```bash
cat services/api/nest-cli.json
```

기존에 `compilerOptions.plugins`가 없으면 추가, 있으면 배열에 `@nestjs/swagger/plugin` 항목 추가.

- [ ] **Step 2: 적용 후 형태**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": ["@nestjs/swagger/plugin"]
  }
}
```

- [ ] **Step 3: 빌드로 검증**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공 (swagger plugin이 컴파일 타임에 동작하지만 기존 ts-rest 코드에 영향 없음)

---

## Task 2: ValidationPipe 전역 등록

**Files:**
- Modify: `services/api/src/main.ts`

- [ ] **Step 1: ValidationPipe import 추가**

```ts
import { ValidationPipe } from '@nestjs/common';
```

- [ ] **Step 2: `bootstrap()` 안에 등록 추가**

`app.use(cookieParser());` 다음 줄에 추가:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
```

- [ ] **Step 3: 빌드로 검증**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공

- [ ] **Step 4: 기존 ts-rest 라우트 무영향 검증**

Run: `npm --prefix services/api test`
Expected: 기존 테스트 전부 통과 (ts-rest 핸들러는 ValidationPipe를 우회)

---

## Task 3: `main.ts`에 `jsonDocumentUrl` + `addBearerAuth` 추가

**Files:**
- Modify: `services/api/src/main.ts`

- [ ] **Step 1: DocumentBuilder 체인에 `addBearerAuth()` 추가**

기존:
```ts
const config = new DocumentBuilder().setTitle('API Docs').build();
```

변경:
```ts
const config = new DocumentBuilder()
  .setTitle('API Docs')
  .addBearerAuth()
  .build();
```

- [ ] **Step 2: `SwaggerModule.setup`에 `jsonDocumentUrl` 옵션 추가**

기존:
```ts
SwaggerModule.setup('swagger', app, document, {});
```

변경:
```ts
SwaggerModule.setup('swagger', app, document, {
  jsonDocumentUrl: '/json',
});
```

- [ ] **Step 3: dev 분기 확인 — 변경은 모두 `NODE_ENV === 'dev'` 안에 위치해야 함**

`main.ts`의 변경된 dev 블록은 아래 형태:

```ts
if (configService.get<string>('NODE_ENV') === 'dev') {
  const config = new DocumentBuilder()
    .setTitle('API Docs')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document, {
    jsonDocumentUrl: '/json',
  });
}
```

- [ ] **Step 4: dev 서버 기동 후 `/json` 응답 확인**

Run (별도 터미널): `make api`
Run: `curl -s http://localhost:3000/json | head -c 200`
Expected: OpenAPI JSON 시작 부분 (`{"openapi":"3.0.0",...}`). securitySchemes에 bearer 정의 포함.

`make api`는 작업 후 종료(`Ctrl+C`).

---

## Task 4: `@Public()` 데코레이터를 `applyDecorators`로 합성

**Files:**
- Modify: `services/api/src/common/decorators/public.decorator.ts`

- [ ] **Step 1: 데코레이터 재작성**

기존 (1줄):
```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
```

변경:
```ts
import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const IS_PUBLIC_KEY = 'isPublic';

export function Public(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    ApiSecurity({}),
  );
}
```

- [ ] **Step 2: 빌드로 검증**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공. 기존 가드(`JwtAuthGuard`)는 `IS_PUBLIC_KEY` reflect 메타를 그대로 읽으므로 동작 변화 없음.

- [ ] **Step 3: 기존 테스트 검증**

Run: `npm --prefix services/api test`
Expected: 전체 통과 (auth/invitation 등 `@Public()` 사용처 영향 없음)

---

## Task 5: 공유 `ErrorResponseDto` 작성

**Files:**
- Create: `services/api/src/common/dto/error-response.dto.ts`
- Create: `services/api/src/common/dto/index.ts`

- [ ] **Step 1: ErrorResponseDto 작성**

```ts
// services/api/src/common/dto/error-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ description: 'ErrorCode 키 또는 일반화된 코드(HTTP_ERROR, INTERNAL_SERVER_ERROR)' })
  code!: string;

  @ApiProperty({ description: '사용자 노출 메시지' })
  message!: string;
}
```

- [ ] **Step 2: `common/dto/index.ts` 진입점 작성**

```ts
// services/api/src/common/dto/index.ts
export * from './error-response.dto';
```

- [ ] **Step 3: `common/index.ts`에 re-export 추가**

기존 `services/api/src/common/index.ts`:
```ts
export * from './decorators';
export * from './exceptions';
export * from './filters';
export * from './guards';
```

변경:
```ts
export * from './decorators';
export * from './dto';
export * from './exceptions';
export * from './filters';
export * from './guards';
```

- [ ] **Step 4: 빌드 검증**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공

---

## Task 6: 공유 `UserDto` 작성

**Files:**
- Create: `services/api/src/common/dto/user.dto.ts`

- [ ] **Step 1: 현재 UserSchema 구조 확인**

Run: `cat packages/contracts/src/schemas/common.schema.ts`

이 파일에서 UserSchema의 필드 목록 확인 후 동등한 DTO 작성.

- [ ] **Step 2: UserDto 작성**

`packages/contracts/src/schemas/common.schema.ts`의 UserSchema 필드를 그대로 DTO화. 다음은 예상 골격이며, 실제 필드는 확인한 구조에 맞춰 작성:

```ts
// services/api/src/common/dto/user.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  username!: string;

  nickname!: string;

  // 필요한 필드: createdAt 등은 실제 UserSchema 기준으로 추가
}
```

- [ ] **Step 3: `common/dto/index.ts`에 추가**

```ts
// services/api/src/common/dto/index.ts
export * from './error-response.dto';
export * from './user.dto';
```

- [ ] **Step 4: 빌드 검증**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공

> **주의:** UserDto는 Phase 0에서는 정의만 둠. 실제 사용처 교체는 Phase 6 (auth) 에서. 현재 `@terab/contract`의 UserSchema는 그대로 동작.

---

## Task 7: `@ApiError` 헬퍼 데코레이터 작성

**Files:**
- Create: `services/api/src/common/decorators/api-error.decorator.ts`
- Modify: `services/api/src/common/decorators/index.ts`

- [ ] **Step 1: ApiError 헬퍼 작성**

```ts
// services/api/src/common/decorators/api-error.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorCode, type ErrorCodeKey } from '../exceptions/error-code.enum';
import { ErrorResponseDto } from '../dto/error-response.dto';

export function ApiError(...keys: ErrorCodeKey[]): MethodDecorator {
  const grouped = new Map<number, ErrorCodeKey[]>();
  for (const key of keys) {
    const status = ErrorCode[key].status;
    grouped.set(status, [...(grouped.get(status) ?? []), key]);
  }

  const responses = Array.from(grouped.entries()).map(([status, ks]) =>
    ApiResponse({
      status,
      type: ErrorResponseDto,
      description: ks.map((k) => `\`${k}\` — ${ErrorCode[k].message}`).join('\n'),
    }),
  );

  return applyDecorators(...responses);
}
```

- [ ] **Step 2: `decorators/index.ts`에 re-export 추가**

Run: `cat services/api/src/common/decorators/index.ts`

```ts
// 기존 export 목록 끝에 추가
export * from './api-error.decorator';
```

- [ ] **Step 3: 빌드 검증**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공. `ErrorCodeKey` 타입 import가 동작하는지 확인.

---

## Task 8: API Phase 0 전체 검증

**Files:**
- 없음 (검증만)

- [ ] **Step 1: 빌드**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공

- [ ] **Step 2: 테스트**

Run: `npm --prefix services/api test`
Expected: 전체 통과

- [ ] **Step 3: dev 서버 기동 + /json 응답 형태 확인**

Run (별도 터미널): `make api`
Run: `curl -s http://localhost:3000/json | python -m json.tool | head -30`
Expected:
- `openapi: 3.0.0`
- `components.securitySchemes.bearer` 정의 존재
- `paths`는 ts-rest 핸들러로 등록된 라우트는 보이지 않음 (ts-rest는 swagger 메타가 없음). 현재 시점에 paths는 거의 빈 상태가 정상.

`make api` 종료(`Ctrl+C`).

- [ ] **Step 4: 기존 ts-rest 라우트 동작 검증**

Run (별도 터미널): `make api`
Run: `curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"x","password":"x"}'`
Expected: 401 응답 (`INVALID_CREDENTIALS`) — ValidationPipe·ts-rest 모두 정상 동작 검증.

`make api` 종료.

---

## Task 9: API 인프라 commit

**Files:**
- staged: API 인프라 변경 전체

- [ ] **Step 1: 변경 파일 확인**

Run: `git status`
Expected:
```
Changes not staged for commit:
  modified:   services/api/nest-cli.json
  modified:   services/api/src/main.ts
  modified:   services/api/src/common/decorators/public.decorator.ts
  modified:   services/api/src/common/decorators/index.ts
  modified:   services/api/src/common/index.ts

Untracked files:
  services/api/src/common/dto/
  services/api/src/common/decorators/api-error.decorator.ts
```

- [ ] **Step 2: 변경 stage**

```bash
git add services/api/nest-cli.json \
        services/api/src/main.ts \
        services/api/src/common/decorators/public.decorator.ts \
        services/api/src/common/decorators/index.ts \
        services/api/src/common/index.ts \
        services/api/src/common/dto/ \
        services/api/src/common/decorators/api-error.decorator.ts
```

- [ ] **Step 3: commit**

```bash
git commit -m "chore(api): Phase 0 — class-validator/swagger 인프라 + ApiError 헬퍼 추가"
```

Expected: 1 commit 생성. `git log -1 --stat`로 변경 통계 확인.

---

## Task 10: Web 의존성 추가

**Files:**
- Modify: `services/web/package.json`

- [ ] **Step 1: 정확 버전 핀으로 설치**

Run: `npm --prefix services/web install --save-exact @hey-api/openapi-ts@latest @hey-api/client-axios@latest`
Expected: `package.json`의 `dependencies` 또는 `devDependencies`에 정확 버전(`-E` 옵션 효과)으로 추가됨. `@hey-api/openapi-ts`는 dev로 분류, `@hey-api/client-axios`는 runtime dep.

- [ ] **Step 2: package.json에서 dependency 분류 확인 및 조정**

`@hey-api/openapi-ts`는 devDependency, `@hey-api/client-axios`는 dependency. 자동으로 잘못 분류된 경우 직접 이동.

```bash
cat services/web/package.json | grep -E "@hey-api"
```

- [ ] **Step 3: package-lock 커밋 준비 — 빌드 검증**

Run: `npm --prefix services/web run build`
Expected: 빌드 성공 (codegen 미사용, 설치만 영향)

---

## Task 11: `openapi-ts.config.ts` 작성

**Files:**
- Create: `services/web/openapi-ts.config.ts`

- [ ] **Step 1: 설정 파일 작성**

```ts
// services/web/openapi-ts.config.ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:3000/json',
  output: {
    path: 'src/shared/api/generated',
    format: 'prettier',
    lint: 'eslint',
  },
  plugins: [
    {
      name: '@hey-api/client-axios',
      runtimeConfigPath: './src/shared/api/runtime-config.ts',
    },
    '@hey-api/typescript',
    '@hey-api/sdk',
    '@tanstack/react-query',
  ],
});
```

- [ ] **Step 2: 파일 EOL CRLF 확인 (Windows 개발 환경 기본값)**

Run: `(Get-Content -Raw services/web/openapi-ts.config.ts) -match "\r\n"`
Expected: `True`. False이면 CRLF로 변환.

---

## Task 12: `extract-public-paths.mjs` 작성

**Files:**
- Create: `services/web/scripts/extract-public-paths.mjs`

- [ ] **Step 1: scripts 디렉토리 확인 및 생성**

Run: `ls services/web/scripts 2>&1 || mkdir -p services/web/scripts`

- [ ] **Step 2: 스크립트 작성**

```js
// services/web/scripts/extract-public-paths.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const SOURCE_URL = 'http://localhost:3000/json';
const OUTPUT_PATH = 'src/shared/api/generated/public-paths.gen.ts';

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    console.error(`Failed to fetch OpenAPI spec from ${SOURCE_URL}: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const openapi = await res.json();

  const publicPaths = [];
  for (const [path, methods] of Object.entries(openapi.paths ?? {})) {
    for (const op of Object.values(methods)) {
      if (
        Array.isArray(op.security) &&
        op.security.length > 0 &&
        op.security.every((s) => Object.keys(s).length === 0)
      ) {
        publicPaths.push(path);
        break;
      }
    }
  }

  publicPaths.sort();

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `// AUTO-GENERATED — DO NOT EDIT. Run \`npm run openapi:codegen\` to regenerate.\n` +
      `export const PUBLIC_PATHS = new Set<string>(${JSON.stringify(publicPaths, null, 2)});\n`,
  );

  console.log(`Wrote ${publicPaths.length} public path(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: 실행 권한·EOL 확인**

Windows에서는 권한 무관. EOL은 CRLF 검증:
Run: `(Get-Content -Raw services/web/scripts/extract-public-paths.mjs) -match "\r\n"`
Expected: `True`

---

## Task 13: `package.json`에 `openapi:codegen` script 추가

**Files:**
- Modify: `services/web/package.json`

- [ ] **Step 1: scripts 항목에 추가**

기존 `scripts`:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  ...
}
```

`build` 다음 줄에 추가:
```json
"openapi:codegen": "openapi-ts && node scripts/extract-public-paths.mjs"
```

- [ ] **Step 2: script 등록 확인**

Run: `npm --prefix services/web run | grep openapi:codegen`
Expected: `openapi:codegen`이 목록에 표시됨

---

## Task 14: `runtime-config.ts` 작성

**Files:**
- Create: `services/web/src/shared/api/runtime-config.ts`

- [ ] **Step 1: runtime config 작성**

```ts
// services/web/src/shared/api/runtime-config.ts
import type { CreateClientConfig } from './generated/client.gen';
import { axiosInstance } from './axiosInstance';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  axios: axiosInstance,
});
```

> **주의:** `./generated/client.gen` 경로는 Task 18 (첫 codegen 실행) 후에 생성된다. 현재는 파일이 없어 컴파일 오류 발생 — Task 18 완료 전까지는 의도된 상태이며 Task 18에서 해결된다.

- [ ] **Step 2: EOL 확인**

Run: `(Get-Content -Raw services/web/src/shared/api/runtime-config.ts) -match "\r\n"`
Expected: `True`

---

## Task 15: `axiosInstance.ts` 단일 인스턴스로 재작성

**Files:**
- Modify: `services/web/src/shared/api/axiosInstance.ts`

- [ ] **Step 1: 기존 axiosInstance.ts 백업용 git 확인**

Run: `git log --oneline -1 services/web/src/shared/api/axiosInstance.ts`
Expected: 최근 commit hash 표시 (복원 필요 시 reference로 사용)

- [ ] **Step 2: 전체 재작성**

```ts
// services/web/src/shared/api/axiosInstance.ts
import { useUserStore } from '@/entities';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { PUBLIC_PATHS } from './generated/public-paths.gen';

export const axiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  if (config.url && PUBLIC_PATHS.has(config.url)) {
    return config;
  }
  const token = useUserStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError)) {
      throw error;
    }
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      throw error;
    }

    if (originalRequest.url && PUBLIC_PATHS.has(originalRequest.url)) {
      throw error;
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<{ accessToken: string; user: unknown }>(
        '/api/auth/refresh',
        {},
        { withCredentials: true },
      );
      useUserStore.getState().setAccessToken(data.accessToken);
      processQueue(null, data.accessToken);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useUserStore.getState().clearAuth();
      window.location.href = '/login';
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  },
);
```

> **주의:** `./generated/public-paths.gen` 경로는 Task 18 후 생성된다. 컴파일 오류는 Task 18에서 해소.

- [ ] **Step 3: EOL 확인**

Run: `(Get-Content -Raw services/web/src/shared/api/axiosInstance.ts) -match "\r\n"`
Expected: `True`

---

## Task 16: `shared/api/index.ts` 작성

**Files:**
- Create: `services/web/src/shared/api/index.ts` (없으면 신규, 있으면 재작성)

- [ ] **Step 1: 기존 파일 확인**

Run: `cat services/web/src/shared/api/index.ts 2>&1 || echo NOT_FOUND`

- [ ] **Step 2: 단일 진입점으로 재작성**

```ts
// services/web/src/shared/api/index.ts
// Transport 인스턴스
export { axiosInstance } from './axiosInstance';

// codegen 산출물 — 타입
export type * from './generated/types.gen';

// codegen 산출물 — TanStack Query options (queryOptions/mutationOptions/queryKey)
export * from './generated/@tanstack/react-query.gen';

// codegen 산출물 — SDK 함수 (필요 시 직접 호출용, 충돌 방지 위해 namespace)
export * as Sdk from './generated/sdk.gen';

// 자동 생성된 PUBLIC_PATHS
export { PUBLIC_PATHS } from './generated/public-paths.gen';
```

> **주의:** generated 파일들은 Task 18 후 존재한다. 현재 시점에는 import 오류가 의도된 상태.

- [ ] **Step 3: 기존 ts-rest client.ts와 공존 처리**

Phase 0 종료 시점에 `services/web/src/shared/api/client.ts`(ts-rest `initTsrReactQuery`)는 **그대로 유지**한다 — Phase 1~8 동안 도메인별로 점진 폐기. 단, `axiosInstance`가 단일화되어 `client.ts`의 `PUBLIC_PATHS` 분기가 더 이상 필요 없어졌으므로 `client.ts`의 import만 점검:

Run: `cat services/web/src/shared/api/client.ts`

`PUBLIC_PATHS`를 `client.ts` 안에서 사용 중이면 `import { PUBLIC_PATHS } from './generated/public-paths.gen'`로 import 경로 변경. 단, 기존 분기 동작은 axios 인터셉터에서 이미 처리되므로 client.ts의 분기 로직 자체를 제거해도 안전. 안전을 위해 import만 갱신하고 분기 로직은 Phase 도메인 작업 진행 중 도메인 전환 시 점검.

- [ ] **Step 4: EOL 확인**

Run: `(Get-Content -Raw services/web/src/shared/api/index.ts) -match "\r\n"`
Expected: `True`

---

## Task 17: 첫 codegen 실행 (API 서버 기동 필요)

**Files:**
- 자동 생성: `services/web/src/shared/api/generated/`

- [ ] **Step 1: API dev 서버 기동**

Run (별도 터미널): `make api`
Expected: `Application is running on: http://[::1]:3000` 로그 표시.

- [ ] **Step 2: codegen 실행**

Run: `npm --prefix services/web run openapi:codegen`
Expected:
- `openapi-ts` 실행 → `src/shared/api/generated/` 디렉토리에 `client.gen.ts`, `types.gen.ts`, `sdk.gen.ts`, `@tanstack/react-query.gen.ts` 생성
- `extract-public-paths.mjs` 실행 → `public-paths.gen.ts` 생성
- 콘솔에 `Wrote N public path(s) to src/shared/api/generated/public-paths.gen.ts` 출력 (N은 현재 ts-rest 라우트가 없으므로 0일 수 있음 — Phase 0 시점에 OpenAPI paths가 거의 비어 있음)

- [ ] **Step 3: 산출물 검증**

Run: `ls services/web/src/shared/api/generated/`
Expected:
```
client.gen.ts
types.gen.ts
sdk.gen.ts
public-paths.gen.ts
@tanstack/
```

Run: `cat services/web/src/shared/api/generated/public-paths.gen.ts`
Expected: `export const PUBLIC_PATHS = new Set<string>([...]);` 형태. 빈 배열도 정상 (Phase 0에서는 ts-rest 라우트뿐이라 swagger 메타가 없어 추출 안 됨).

- [ ] **Step 4: 빌드 검증 — generated 의존하는 axiosInstance.ts/index.ts 컴파일 통과**

Run: `npm --prefix services/web run build`
Expected: 빌드 성공. Phase 0 시점에서 generated 산출물이 빈 상태(또는 거의 빈)일 수 있으나 import 자체는 동작.

> **알려진 한계:** Phase 0 시점에 PUBLIC_PATHS가 빈 Set일 수 있어, ts-rest 핸들러의 `/auth/login`·`/auth/refresh`는 여전히 axiosBasic을 통해 호출되어야 한다. **client.ts의 PUBLIC_PATHS Set은 Phase 6 (auth) 완료 전까지 그대로 유지**한다.

- [ ] **Step 5: API dev 서버 종료**

Run (별도 터미널): Ctrl+C로 `make api` 종료.

---

## Task 18: `services/web/CLAUDE.md` 갱신 — `api/` 세그먼트 규칙 추가

**Files:**
- Modify: `services/web/CLAUDE.md`

- [ ] **Step 1: 기존 "세그먼트 사용 시점" 표 위치 확인**

Run: `grep -n "세그먼트 사용 시점" services/web/CLAUDE.md`
Expected: 라인 번호 표시 (약 L43 부근)

- [ ] **Step 2: 표 직후에 codegen 관련 규칙 추가**

기존 표 아래(`세그먼트는 필요한 것만 만든다. 예:` 단락 위)에 다음 문단 삽입:

```markdown
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
```

- [ ] **Step 3: EOL 확인**

Run: `(Get-Content -Raw services/web/CLAUDE.md) -match "\r\n"`
Expected: `True`

---

## Task 19: Web Phase 0 검증

**Files:**
- 없음 (검증만)

- [ ] **Step 1: 빌드**

Run: `npm --prefix services/web run build`
Expected: 빌드 성공

- [ ] **Step 2: 단위 테스트**

Run: `npm --prefix services/web test`
Expected: 전체 통과 (Phase 0은 transport 통합만 변경하므로 model 훅·UI 테스트 영향 없음)

- [ ] **Step 3: dev 서버 기동 + 기존 ts-rest 라우트 동작 검증**

Run (터미널 A): `make api`
Run (터미널 B): `make web`
Expected: web dev 서버가 `localhost:5173` (또는 vite 기본 포트)에서 기동

브라우저에서 `http://localhost:5173/login` 접근 후 로그인 시도 — 기존 ts-rest `initTsrReactQuery` client가 동작하는지 확인. 로그인 성공 시 401-refresh queue를 거치지 않고 정상 로그인.

- [ ] **Step 4: dev 서버 종료**

터미널 A, B 모두 Ctrl+C로 종료.

---

## Task 20: Web 인프라 commit

**Files:**
- staged: Web 인프라 변경 전체

- [ ] **Step 1: 변경 파일 확인**

Run: `git status`
Expected:
```
Changes not staged for commit:
  modified:   services/web/package.json
  modified:   services/web/package-lock.json
  modified:   services/web/src/shared/api/axiosInstance.ts
  modified:   services/web/CLAUDE.md
  (선택) modified: services/web/src/shared/api/client.ts (import 갱신만)

Untracked files:
  services/web/openapi-ts.config.ts
  services/web/scripts/extract-public-paths.mjs
  services/web/src/shared/api/runtime-config.ts
  services/web/src/shared/api/index.ts
  services/web/src/shared/api/generated/
```

- [ ] **Step 2: 변경 stage**

```bash
git add services/web/package.json \
        services/web/package-lock.json \
        services/web/openapi-ts.config.ts \
        services/web/scripts/extract-public-paths.mjs \
        services/web/src/shared/api/axiosInstance.ts \
        services/web/src/shared/api/runtime-config.ts \
        services/web/src/shared/api/index.ts \
        services/web/src/shared/api/generated/ \
        services/web/CLAUDE.md
# client.ts 변경 시:
# git add services/web/src/shared/api/client.ts
```

- [ ] **Step 3: commit**

```bash
git commit -m "chore(web): Phase 0 — @hey-api/openapi-ts codegen + axios 단일 인스턴스 통합"
```

Expected: 1 commit 생성. `git log -1 --stat`로 변경 통계 확인.

---

## Phase 0 완료 조건

- [ ] API: `nest-cli.json` swagger plugin, ValidationPipe 전역, `jsonDocumentUrl: '/json'`, `addBearerAuth()`, `@Public()` 합성, `ErrorResponseDto`/`UserDto`/`@ApiError` 헬퍼 모두 적용
- [ ] Web: `@hey-api/openapi-ts`/`@hey-api/client-axios` 설치, `openapi-ts.config.ts`, `extract-public-paths.mjs`, `runtime-config.ts`, `shared/api/index.ts`, 단일 axiosInstance, 첫 codegen 산출물 commit
- [ ] CLAUDE.md(web) `api/` 세그먼트 규칙 추가
- [ ] `make build-api && make build-web` 성공
- [ ] `npm --prefix services/api test`, `npm --prefix services/web test` 통과
- [ ] dev 환경에서 기존 ts-rest 라우트 동작 (로그인 등) 정상
- [ ] 2 commit (`chore(api): Phase 0 ...`, `chore(web): Phase 0 ...`)

Phase 0 종료. Phase 1 (invitation) 진입 가능.

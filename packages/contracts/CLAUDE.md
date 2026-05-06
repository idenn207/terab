# packages/contracts CLAUDE.md

## 역할

API 서버(`services/api`)와 웹 클라이언트(`services/web`) 사이의 **공유 계약 레이어**.  
ts-rest + Zod 기반으로 엔드포인트 스펙(경로·메서드·바디·응답)을 단일 소스로 정의한다.

## 주요 명령어

```bash
npm run build        # TypeScript 컴파일 (dist/ 생성)
npm run build:watch  # 파일 변경 감지 후 자동 재컴파일
```

> `services/api`, `services/web`에서 이 패키지를 사용하려면 먼저 `npm run build`를 실행해 `dist/`를 생성해야 한다.

## 디렉토리 구조

```
src/
  common/
    types/
      http-status.ts   # HttpStatus enum
      zod-helper.ts    # zh 유틸리티 (zh.empty, zh.emptyObject)
  schemas/
    common.schema.ts   # EmptySchema, UserSchema 등 공유 스키마
    *.schema.ts        # 도메인별 Zod 스키마 + 타입 추론
  contracts/
    *.contract.ts      # 도메인별 ts-rest contract
    index.ts           # 모든 contract를 c.router로 취합
  index.ts             # 패키지 진입점 (contracts + schemas 재내보내기)
```

## Contract-First 원칙

**API 구현(Controller/Service)보다 contract를 먼저 작성한다.**

1. `src/schemas/` 에 요청/응답 Zod 스키마 정의
2. `src/contracts/` 에 ts-rest contract 정의
3. `services/api` 에서 contract를 참조해 Controller 구현
4. `services/web` 에서 contract를 참조해 클라이언트 호출

## Contract 작성 규칙

### 1. 파일당 `initContract()` 독립 생성

```typescript
import { initContract } from '@ts-rest/core';

const c = initContract();
```

### 2. `c.query` vs `c.mutation` 선택 기준

| 상황 | 사용 |
|------|------|
| GET (데이터 조회) | `c.query` |
| POST / PUT / PATCH / DELETE | `c.mutation` |

### 3. `strictStatusCodes: true` 필수

**모든 엔드포인트에 반드시 명시한다.** 누락 시 서버 핸들러의 반환 타입이 `Record<number, any>`로 추론되어 타입 안전성이 깨진다.

```typescript
const me = c.query({
  method: 'GET',
  path: '/auth/me',
  responses: {
    [HttpStatus.OK]: UserSchema,
  },
  strictStatusCodes: true, // 필수
});
```

### 4. 응답 상태 코드는 `HttpStatus` enum으로 명시

숫자 리터럴(`200`, `404`) 사용 금지. `@terab/common`의 `HttpStatus`를 임포트해 사용한다.

```typescript
import { HttpStatus } from '@terab/common';

responses: {
  [HttpStatus.OK]: SomeSchema,
  [HttpStatus.NO_CONTENT]: EmptySchema,
},
```

### 5. body 사용 시 `contentType` 명시

| 상황 | contentType |
|------|------------|
| JSON 요청 (기본) | `'application/json'` |
| 파일 업로드 | `'multipart/form-data'` |
| body 없음 | `EmptySchema` 사용, `contentType` 생략 가능 |

```typescript
// JSON body
const create = c.mutation({
  method: 'POST',
  path: '/invitations',
  contentType: 'application/json',
  body: CreateInvitationBodySchema,
  ...
});

// 파일 업로드
const upload = c.mutation({
  method: 'POST',
  path: '/files',
  contentType: 'multipart/form-data',
  body: UploadBodySchema,
  ...
});
```

### 6. 빈 body / 빈 응답은 `EmptySchema` 사용

`z.object({})` 또는 `z.undefined()` 직접 사용 금지.  
`@terab/schema`의 `EmptySchema`(`zh.emptyObject()`)를 임포트해 사용한다.

```typescript
import { EmptySchema } from '@terab/schema';

// 응답이 없는 경우 (204 No Content)
responses: {
  [HttpStatus.NO_CONTENT]: EmptySchema,
},

// body가 필요 없는 mutation
body: EmptySchema,
```

### 7. pathParams는 Zod 스키마로 검증

```typescript
const remove = c.mutation({
  method: 'DELETE',
  path: '/devices/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});
```

### 8. summary 작성

모든 엔드포인트에 `summary` 필드를 한글로 작성한다. API 문서 자동 생성에 사용된다.

```typescript
const logout = c.mutation({
  summary: '로그아웃',
  ...
});
```

### 9. `c.noBody()` 사용 금지

`c.noBody()`는 `@ts-rest/nest` 환경에서 타입 추론 오류를 발생시킨다.  
body가 없는 경우 반드시 `body: EmptySchema`를 사용한다.

```typescript
// ❌ 금지
body: c.noBody(),

// ✅ 올바른 방법
body: EmptySchema,
```

## Schema / Contract 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| 스키마 파일 | `kebab-case` | `auth.schema.ts`, `trusted-device.schema.ts` |
| Zod 스키마 변수 | `PascalCase` + `Schema` 접미사 | `LoginBodySchema`, `UserSchema` |
| 추출 타입 | `PascalCase`, 접미사 없음 | `LoginBody`, `User` |
| Contract 파일 | `kebab-case` | `auth.contract.ts`, `trusted-device.contract.ts` |
| Contract 변수 | `camelCase` + `Contract` 접미사 | `authContract`, `trustedDeviceContract` |

## Schema 작성 규칙

- 스키마 파일은 `src/schemas/<domain>.schema.ts` 에 위치
- Zod 스키마 정의 후 반드시 `z.infer<typeof XxxSchema>` 로 타입을 추출·내보내기
- 공유 스키마(`User`, `EmptySchema`)는 `common.schema.ts`에 위치

```typescript
export const LoginBodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(255),
});

export type LoginBody = z.infer<typeof LoginBodySchema>;
```

## Contract 취합

도메인별 contract는 `src/contracts/index.ts`에서 최상위 `c.router`로 조합한다.

```typescript
export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
  // 신규 도메인 추가 시 여기에 등록
});
```

## 임포트 경로

| 대상 | 임포트 경로 |
|------|------------|
| `HttpStatus` | `@terab/common` |
| `zh` (zod-helper) | `@terab/common` |
| 스키마 (`EmptySchema` 등) | `@terab/schema` |
| `initContract` | `@ts-rest/core` |
| `z` (Zod) | `zod` |

## 금지 패턴

> 아래 패턴은 런타임 오류 또는 타입 안전성 훼손을 유발한다. 예외 없이 금지한다.

| 금지 패턴 | 이유 | 대체 |
|-----------|------|------|
| `c.noBody()` | `@ts-rest/nest` 타입 추론 오류 발생 | `body: EmptySchema` |
| `z.object({})` 빈 객체 직접 사용 | `EmptySchema` 우회 | `EmptySchema` |
| `z.undefined()` 직접 사용 | `EmptySchema` 우회 | `EmptySchema` 또는 `zh.empty()` |
| 숫자 리터럴 상태 코드 (`200`, `204` 등) | 매직 넘버, 오타 위험 | `HttpStatus.OK`, `HttpStatus.NO_CONTENT` 등 |
| `package.json`의 `zod` 버전 변경 | ts-rest `3.52.x`와 Zod `3.22.x` 조합으로 고정됨 | 변경하지 않는다 |
| Zod v4 문법 사용 | Zod `3.22.x`에 존재하지 않음 | 아래 Zod v3 레퍼런스 참조 |

## Zod v3 레퍼런스

> **⚠️ ts-rest는 더 이상 유지보수되지 않으며 Zod `3.22.x`에 고정되어 있다. Zod v4의 단축 문법은 이 버전에 존재하지 않는다.**

### v4 단축 문법 vs v3 대응표

| v4 단축 문법 (사용 금지) | v3 올바른 방법 |
|--------------------------|---------------|
| `z.email()` | `z.string().email()` |
| `z.uuid()` | `z.string().uuid()` |
| `z.url()` | `z.string().url()` |
| `z.int()` | `z.number().int()` |
| `z.datetime()` | `z.string().datetime()` |
| `z.iso.datetime()` | `z.string().datetime()` |

### optional / nullable / nullish 선택 기준

| 메서드 | 추론 타입 | 사용 상황 |
|--------|-----------|-----------|
| `.optional()` | `T \| undefined` | 요청 시 필드 생략 가능 |
| `.nullable()` | `T \| null` | 값이 명시적으로 `null`일 수 있는 경우 |
| `.nullish()` | `T \| null \| undefined` | 둘 다 허용 (명확성이 낮아지므로 지양) |

```typescript
// 선택적 필드 (요청 시 생략 가능)
expiresInDays: z.number().int().min(1).max(30).optional(),

// null 허용 필드
deletedAt: z.string().datetime().nullable(),
```

### union vs discriminatedUnion 선택 기준

판별자(discriminator)로 사용할 수 있는 리터럴 필드가 있으면 `z.discriminatedUnion()`을 사용한다.  
판별자가 없으면 `z.union()`을 사용한다.

```typescript
// ✅ 판별자(status)가 있는 경우 → discriminatedUnion
const LoginResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('AUTHENTICATED'), accessToken: z.string(), user: UserSchema }),
  z.object({ status: z.literal('2FA_REQUIRED'), challengeId: z.string() }),
]);

// ✅ 판별자가 없는 경우 → union
const IdSchema = z.union([z.string().uuid(), z.number().int()]);
```

### 날짜 처리

| 상황 | 사용 |
|------|------|
| 문자열 → `Date` 객체 자동 변환 필요 | `z.coerce.date()` |
| ISO 문자열 그대로 유지 | `z.string().datetime()` |

```typescript
createdAt: z.coerce.date(),        // Date 객체로 파싱
expiresAt: z.string().datetime(),  // ISO 문자열 그대로 전달
```

### 자주 쓰는 v3 패턴

```typescript
// 정규식 검증
selectedNumber: z.string().regex(/^\d{2}$/),

// 배열
items: z.array(ItemSchema),

// 레코드
metadata: z.record(z.string()),

// enum
role: z.enum(['ADMIN', 'USER']),

// 리터럴
status: z.literal('PENDING'),
```

## 전체 예시

```typescript
import { HttpStatus } from '@terab/common';
import { EmptySchema, SomeResponseSchema, SomeBodySchema } from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const list = c.query({
  summary: '목록 조회',
  method: 'GET',
  path: '/items',
  responses: {
    [HttpStatus.OK]: z.array(SomeResponseSchema),
  },
  strictStatusCodes: true,
});

const create = c.mutation({
  summary: '항목 생성',
  method: 'POST',
  path: '/items',
  contentType: 'application/json',
  body: SomeBodySchema,
  responses: {
    [HttpStatus.CREATED]: SomeResponseSchema,
  },
  strictStatusCodes: true,
});

const remove = c.mutation({
  summary: '항목 삭제',
  method: 'DELETE',
  path: '/items/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const itemContract = c.router({ list, create, remove });
```

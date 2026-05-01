# packages/contracts CLAUDE.md

## 역할

API 서버(`services/api`)와 웹 클라이언트(`services/web`) 사이의 **공유 계약 레이어**.  
ts-rest + Zod 기반으로 엔드포인트 스펙(경로·메서드·바디·응답)을 단일 소스로 정의한다.

## 디렉토리 구조

```
src/
  common/
    types/
      http-status.ts   # HttpStatus enum
      zod-helper.ts    # zh 유틸리티 (zh.emptyObject 등)
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

## Schema 작성 규칙

- 스키마 파일은 `src/schemas/<domain>.schema.ts` 에 위치
- Zod 스키마 정의 후 반드시 `z.infer<typeof XxxSchema>` 로 타입을 추출·내보내기
- 공유 스키마(`User`, `EmptySchema`)는 `common.schema.ts`에 위치

```typescript
export const LoginBodySchema = z.object({
  username: z.string(),
  password: z.string(),
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
| 스키마 (EmptySchema 등) | `@terab/schema` |
| `initContract` | `@ts-rest/core` |

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
    [HttpStatus.OK]: SomeResponseSchema,
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

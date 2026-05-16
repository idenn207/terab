# services/api CLAUDE.md + Rules 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `services/api/CLAUDE.md`와 `.claude/rules/` 6개 파일을 작성해 Claude가 API 코드 작업 시 구조·인프라·코드 패턴을 자동으로 참조할 수 있도록 한다.

**Architecture:** 서비스 수준 컨텍스트(`CLAUDE.md`)는 구조·인프라·빌드·행동 지침을 담고, 코드 패턴 규칙(`.claude/rules/`)은 파일 타입별 glob으로 자동 로드된다. `error-handling.md`만 `alwaysApply: true`로 항상 로드한다.

**Tech Stack:** Markdown, Claude Code CLAUDE.md 계층 구조, `.claude/rules/` frontmatter (description / globs / alwaysApply)

---

## 파일 맵

| 작업 | 경로 | 비고 |
|---|---|---|
| 수정 | `CLAUDE.md` | 환경 설정 섹션 추가 |
| 생성 | `services/api/CLAUDE.md` | 구조·인프라·빌드·행동 지침 |
| 생성 | `services/api/.claude/rules/layer-controller.md` | glob: `src/**/*.controller.ts` |
| 생성 | `services/api/.claude/rules/layer-service.md` | glob: `src/**/*.service.ts` |
| 생성 | `services/api/.claude/rules/layer-repository.md` | glob: `src/**/*.repository.ts` |
| 생성 | `services/api/.claude/rules/layer-schema.md` | glob: `src/database/schema/**/*.ts` |
| 생성 | `services/api/.claude/rules/error-handling.md` | alwaysApply: true |
| 생성 | `services/api/.claude/rules/testing.md` | glob: `src/**/*.spec.ts` |

---

### Task 1: 루트 CLAUDE.md — 환경 설정 섹션 추가

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 운영(NAS) 명령어 블록 뒤에 환경 설정 섹션 삽입**

`CLAUDE.md`의 **운영 (NAS)** bash 블록 (`` ``` `` 닫는 라인) 바로 다음 빈 줄 뒤에 아래 내용을 추가한다.

찾을 텍스트 (old_string):

```
make stack-down   # 스택 제거
```

```

교체 텍스트 (new_string) — 기존 내용 뒤에 섹션을 이어 붙인다:

```
make stack-down   # 스택 제거
```

### 환경 설정

각 서비스의 필요 환경변수는 루트의 `*.env.example` 파일을 참조한다.

| 파일 | 대상 서비스 |
| --- | --- |
| `api.env.example` | services/api |
| `mq.env.example` | services/mq |
| `web.env.example` | services/web |
| `infra.env.example` | DB / Redis / MinIO |
```

- [ ] **Step 2: 변경 확인**

```bash
grep -n "환경 설정" CLAUDE.md
```

Expected: 줄 번호와 함께 `### 환경 설정` 출력

- [ ] **Step 3: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: 루트 CLAUDE.md에 환경변수 참조 섹션 추가"
```

---

### Task 2: services/api/CLAUDE.md 생성

**Files:**
- Create: `services/api/CLAUDE.md`

- [ ] **Step 1: 파일 생성**

`services/api/CLAUDE.md`를 아래 내용으로 생성한다.

```markdown
# services/api/CLAUDE.md

> 루트 CLAUDE.md의 세부 컨벤션입니다. 공통 원칙은 루트 CLAUDE.md를 참조하세요.

## 아키텍처 개요

NestJS 11 기반 REST API 서버. Controller → Service → Repository 3-tier 구조.

### 모듈 구조

| 경로 | 역할 |
|---|---|
| `src/app.module.ts` | 루트 모듈 — 전역 Guard/Filter/Pipe 등록 |
| `src/auth/` | 인증 (로그인·등록·토큰·2FA 진입) |
| `src/device/` | 디바이스 등록·조회 |
| `src/trusted-device/` | 신뢰기기 관리 |
| `src/twofa/` | 2FA 챌린지 |
| `src/invitation/` | 초대 링크 |
| `src/common/` | 전역 Guard, Filter, Decorator, Exception |
| `src/core/` | TokenService (JWT·암호화 유틸) |
| `src/database/` | DatabaseService, Schema, Seed, Migration |
| `src/health/` | 헬스체크 엔드포인트 |

### 내부 패키지 (@terab/*)

| 패키지 | 실제 경로 | 역할 |
|---|---|---|
| `@terab/contract` | `packages/contracts/` | ts-rest 계약 + Zod 스키마 |
| `@terab/db` | `src/database/` (path alias) | DatabaseService, Schema 타입 |
| `@terab/common` | `src/common/` (path alias) | Guards, Decorators, Exceptions |
| `@terab/core` | `src/core/` (path alias) | TokenService |
| `@terab/test` | `src/test/` (path alias) | Mock 유틸 |

### 주요 명령어

```bash
npm run start:dev     # 개발 서버 (watch 모드)
npm run build         # 프로덕션 빌드
npm test              # 단위 테스트
npm run test:e2e      # e2e 테스트
npm run db:generate   # 마이그레이션 파일 생성 (스키마 변경 후)
npm run db:push       # 마이그레이션 적용 (개발 환경)
```

> 루트에서 `make api`로도 실행 가능 (`cd services/api && npm run start:dev`).

### 테스트 파일 위치

`*.spec.ts` 파일은 구현 파일 옆에 배치한다. e2e 테스트는 `test/` 디렉토리에 배치한다.

```
src/
  auth/
    auth.repository.ts
    auth.repository.spec.ts    # 구현 파일 옆에
  common/
    guards/
      jwt-auth.guard.ts
      jwt-auth.guard.spec.ts
test/
  app.e2e-spec.ts              # e2e 테스트
```

## 모듈 의존 구조

신규 모듈 추가 시 아래 의존 방향을 참고한다.

- `DatabaseModule` — `@Global()` 선언. 각 도메인 모듈이 직접 import하지 않아도 `DatabaseService`를 주입받을 수 있다.
- `CoreModule` — `TokenService`를 export. 필요한 모듈이 직접 import한다.
- 도메인 모듈 간 순환 의존 금지. 공통 로직은 `CoreModule` 또는 `DatabaseModule`로 위임한다.
- `AppModule`은 모든 도메인 모듈을 import한다. 신규 모듈 추가 시 반드시 등록한다.
- 각 모듈은 필요한 외부 모듈(`BullModule`, `PassportModule` 등)을 직접 import한다.

## 인프라 & 빌드

### Docker 빌드

`services/api/Dockerfile`을 루트 컨텍스트에서 빌드한다 (`docker build -f services/api/Dockerfile .`).

| Stage | 역할 |
|---|---|
| `contracts-builder` | `packages/contracts` 빌드 (ts-rest 계약 컴파일) |
| `builder` | API 소스 빌드 (`nest build`) |
| `runner` | 런타임 이미지 (non-root `appuser`, prod deps만 설치) |

**`@terab/contract` 심링크 문제**: `file:` 경로 의존성은 `npm ci` 후 `node_modules/@terab/contract`가 dangling symlink가 된다. Dockerfile에서 해당 디렉토리를 수동으로 제거하고 contracts-builder의 산출물로 교체하는 처리가 포함되어 있다. 이 처리를 수정하거나 제거하지 않는다.

```bash
# 로컬 Docker 이미지 빌드 (루트에서 실행)
make build-local
```

### DB 마이그레이션

Drizzle Kit을 사용한다. 마이그레이션 파일은 `drizzle/` 디렉토리에 저장된다.

```bash
npm run db:generate   # 스키마 변경 후 마이그레이션 파일 생성
npm run db:push       # 마이그레이션 적용 (개발 환경)
```

운영 환경 마이그레이션은 `docker-entrypoint.sh`에서 컨테이너 시작 시 자동 적용된다. 운영 배포 전 `drizzle/` 마이그레이션 파일이 커밋되어 있어야 한다.

## Claude 행동 지침

> 공통 지침은 루트 CLAUDE.md를 참조. 아래는 api 서비스 전용 추가 지침이다.

### 신규 모듈 생성 시 체크리스트

1. `src/{domain}/` 디렉토리 생성
2. `{domain}.module.ts`, `{domain}.controller.ts`, `{domain}.service.ts`, `{domain}.repository.ts` 생성
3. `AppModule`의 `imports` 배열에 등록
4. 필요한 외부 모듈(`BullModule`, `PassportModule` 등) 해당 모듈에서 직접 import
5. DB Schema가 필요하면 `src/database/schema/`에 `{domain}.schema.ts` 추가 후 `index.ts`에 re-export

### 오류 추가 절차

1. `src/common/exceptions/error-code.enum.ts`의 `ErrorCode` 객체에 항목 추가
2. 서비스 코드에서 `throw new ApiException('NEW_ERROR_KEY')`로 사용
```

- [ ] **Step 2: 주요 섹션 확인**

```bash
grep -n "^## " services/api/CLAUDE.md
```

Expected:
```
3:## 아키텍처 개요
X:## 모듈 의존 구조
X:## 인프라 & 빌드
X:## Claude 행동 지침
```

- [ ] **Step 3: 커밋**

```bash
git add services/api/CLAUDE.md
git commit -m "docs: services/api CLAUDE.md 작성 (구조·인프라·빌드·행동 지침)"
```

---

### Task 3: layer-controller.md 생성

**Files:**
- Create: `services/api/.claude/rules/layer-controller.md`

- [ ] **Step 1: .claude/rules 디렉토리 생성 후 파일 작성**

```bash
mkdir -p services/api/.claude/rules
```

`services/api/.claude/rules/layer-controller.md`를 아래 내용으로 생성한다.

````markdown
---
description: NestJS Controller 작성 패턴 (ts-rest 기반)
globs:
  - "src/**/*.controller.ts"
alwaysApply: false
---

# Controller 작성 패턴

## ts-rest 핸들러 구조

모든 엔드포인트는 `@TsRestHandler` + `tsRestHandler` 조합으로 작성한다.

```ts
@TsRestHandler(contract.domain.action)
handleAction() {
  return tsRestHandler(contract.domain.action, async ({ body, params, query }) => {
    const result = await this.service.doSomething(body);
    return { status: HttpStatus.OK, body: result };
  });
}
```

- 반환 형식: `{ status: HttpStatus.XXX, body: { ... } }` — ts-rest 계약의 응답 타입과 반드시 일치
- `@Controller()` 빈 인자 사용 — ts-rest가 경로를 관리하므로 컨트롤러 레벨 prefix 없음

## 인증·권한 데코레이터

```ts
@Public()                                            // 로그인 없이 접근 가능 (로그인·회원가입·refresh 등)
@Throttle({ default: { ttl: 60000, limit: 5 } })     // 속도 제한 재정의 (기본: 60req/min)
@RequirePermission('resource:action')                // 특정 권한 필요 (permission guard 검사)
@TsRestHandler(contract.auth.login)
handleLogin() { ... }
```

## 파라미터 데코레이터

```ts
handleMe(
  @CurrentUser() user: AuthUser,              // JWT에서 추출한 현재 사용자
  @Cookies('cookieName') value: string,       // 쿠키 값 읽기
  @Req() req: Request,                        // 전체 요청 객체 (쿠키 직접 접근 시)
  @Res({ passthrough: true }) res: Response,  // 응답 객체 (쿠키 쓰기 시 passthrough 필수)
  @Headers('user-agent') ua: string,          // 헤더 값 읽기
) { ... }
```

## 쿠키 처리

```ts
// 쓰기
res.cookie('refreshToken', rawToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: maxAgeMs,
  path: '/api/auth',
});

// 삭제
res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth' });
```

## 핵심 규칙

- **컨트롤러에 비즈니스 로직 없음** — 서비스로 위임. 컨트롤러는 HTTP 레이어(요청 파싱, 응답 직렬화, 쿠키 처리)만 담당
- `AuthUser` 타입 import: `import type { AuthUser } from '../auth/types/auth-user.type'` (또는 해당 경로)
````

- [ ] **Step 2: frontmatter 확인**

```bash
grep -n "globs\|alwaysApply\|description" services/api/.claude/rules/layer-controller.md
```

Expected:
```
2:description: NestJS Controller 작성 패턴 (ts-rest 기반)
3:globs:
5:alwaysApply: false
```

- [ ] **Step 3: 커밋**

```bash
git add services/api/.claude/rules/layer-controller.md
git commit -m "docs: api rules - layer-controller.md 추가"
```

---

### Task 4: layer-service.md 생성

**Files:**
- Create: `services/api/.claude/rules/layer-service.md`

- [ ] **Step 1: 파일 생성**

`services/api/.claude/rules/layer-service.md`를 아래 내용으로 생성한다.

````markdown
---
description: NestJS Service 작성 패턴 (비즈니스 로직)
globs:
  - "src/**/*.service.ts"
alwaysApply: false
---

# Service 작성 패턴

## 클래스 구조

```ts
@Injectable()
export class ExampleService {
  private readonly SOME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 상수는 클래스 최상단

  constructor(
    private readonly exampleRepository: ExampleRepository,
    private readonly tokenService: TokenService,
  ) {}

  async doSomething(input: string): Promise<ResultType> {
    const item = await this.exampleRepository.findById(input);
    if (!item) throw new ApiException('ITEM_NOT_FOUND');
    return item;
  }
}
```

## 예외 처리

```ts
// ✅ 도메인 예외 — ErrorCode에 등록된 키 사용 (타입 안전)
throw new ApiException('ERROR_CODE_KEY');

// ❌ 서비스에서 직접 DB 접근 금지
await this.database.db.select()...
```

## 핵심 규칙

- DB 직접 접근 금지 — 항상 Repository 경유
- 트랜잭션이 필요한 경우 Repository에 전용 메서드 위임 (서비스에서 `database.db.transaction` 호출 금지)
- 상수는 클래스 최상단 `private readonly XXX_MS = ...` 패턴으로 추출
- `ApiException` import: `import { ApiException } from '@terab/common'`
````

- [ ] **Step 2: frontmatter 확인**

```bash
grep -n "globs\|alwaysApply" services/api/.claude/rules/layer-service.md
```

Expected:
```
3:globs:
5:alwaysApply: false
```

- [ ] **Step 3: 커밋**

```bash
git add services/api/.claude/rules/layer-service.md
git commit -m "docs: api rules - layer-service.md 추가"
```

---

### Task 5: layer-repository.md 생성

**Files:**
- Create: `services/api/.claude/rules/layer-repository.md`

- [ ] **Step 1: 파일 생성**

`services/api/.claude/rules/layer-repository.md`를 아래 내용으로 생성한다.

````markdown
---
description: NestJS Repository 작성 패턴 (Drizzle ORM)
globs:
  - "src/**/*.repository.ts"
alwaysApply: false
---

# Repository 작성 패턴

## 클래스 구조

```ts
@Injectable()
export class ExampleRepository {
  constructor(private readonly database: DatabaseService) {}
}
```

## 단건 조회 — [row = null] 패턴

```ts
async findById(id: string): Promise<ExampleTable$Select | null> {
  const [row = null] = await this.database.db
    .select({ id: exampleTable.id, name: exampleTable.name })  // 컬럼 명시
    .from(exampleTable)
    .where(eq(exampleTable.id, id))
    .limit(1);
  return row;
}
```

- `select()` 빈 호출(전체 컬럼) 지양 — 필요한 컬럼만 명시
- `.limit(1)` 필수 — 단건 조회 의도를 명확히

## 다건 조회 + Join 집계 패턴

```ts
async findWithRelations(userId: string): Promise<UserWithPermissions | null> {
  const rows = await this.database.db
    .select({
      id: users.id,
      name: users.username,
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(permissions, eq(permissions.id, userRoles.roleId))
    .where(eq(users.id, userId));

  if (!rows.length) return null;
  return this.aggregateResult(rows);
}

private aggregateResult(rows: RawRow[]): UserWithPermissions {
  const first = rows[0];
  const permSet = new Set(
    rows.filter((r) => r.resource && r.action).map((r) => `${r.resource}:${r.action}`),
  );
  return { id: first.id, name: first.name, permissions: [...permSet] };
}
```

## 트랜잭션 패턴

```ts
async createWithRelations(data: CreateData): Promise<{ id: string }> {
  return this.database.db.transaction(async (tx) => {
    const [item] = await tx.insert(table).values(data).returning({ id: table.id });
    if (!item) throw new InternalServerErrorException('생성 실패');
    await tx.insert(relatedTable).values({ itemId: item.id });
    return item;
  });
}
```

## 핵심 규칙

- `DatabaseService` import: `import { DatabaseService } from '@terab/db'`
- 스키마·타입 import: `import { tableName, TableName$Insert, TableName$Select } from '@terab/db'`
- Drizzle 연산자 import: `import { and, eq, gt, isNull } from 'drizzle-orm'`
- 반환 타입 명시 필수: `Promise<T>` 또는 `Promise<T | null>`
````

- [ ] **Step 2: 패턴 키워드 확인**

```bash
grep -n "\[row = null\]\|transaction\|aggregate" services/api/.claude/rules/layer-repository.md
```

Expected: 3개 패턴 모두 포함된 줄 번호 출력

- [ ] **Step 3: 커밋**

```bash
git add services/api/.claude/rules/layer-repository.md
git commit -m "docs: api rules - layer-repository.md 추가"
```

---

### Task 6: layer-schema.md 생성

**Files:**
- Create: `services/api/.claude/rules/layer-schema.md`

- [ ] **Step 1: 파일 생성**

`services/api/.claude/rules/layer-schema.md`를 아래 내용으로 생성한다.

````markdown
---
description: Drizzle Schema 작성 패턴
globs:
  - "src/database/schema/**/*.ts"
alwaysApply: false
---

# Schema 작성 패턴

## 파일 구조

```ts
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';

export const exampleTable = table(
  'example_table',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    name: t.varchar('name', { length: 100 }).notNull(),
    active: t.boolean('active').notNull().default(true),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    t.uniqueIndex().on(table.name),
    t.index().on(table.createdAt),
  ],
);

export type ExampleTable$Insert = typeof exampleTable.$inferInsert;
export type ExampleTable$Select = typeof exampleTable.$inferSelect;
```

## 표준 컬럼 패턴

| 컬럼 용도 | 타입 | 패턴 |
|---|---|---|
| PK | uuid | `t.uuid('id').primaryKey().defaultRandom()` |
| 문자열 | varchar | `t.varchar('col', { length: N }).notNull()` |
| 생성/수정 시각 | timestamp | `t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow()` |
| 외래 키 | uuid | `t.uuid('user_id').notNull().references(() => users.id)` |
| nullable 시각 (used_at 등) | timestamp | `t.timestamp('used_at', { withTimezone: true })` (`.notNull()` 없음) |

## 타입 네이밍

- `$Insert`: INSERT 시 사용 — `typeof table.$inferInsert`
- `$Select`: SELECT 결과 — `typeof table.$inferSelect`
- 파일 하단에 선언

## 등록

새 스키마 파일 작성 후 `src/database/schema/index.ts`에 반드시 re-export 추가:

```ts
export * from './example-table.schema';
```
````

- [ ] **Step 2: 타입 네이밍 패턴 확인**

```bash
grep -n "\$Insert\|\$Select\|pgTable as table" services/api/.claude/rules/layer-schema.md
```

Expected: 각 패턴이 포함된 줄 번호 출력

- [ ] **Step 3: 커밋**

```bash
git add services/api/.claude/rules/layer-schema.md
git commit -m "docs: api rules - layer-schema.md 추가"
```

---

### Task 7: error-handling.md 생성

**Files:**
- Create: `services/api/.claude/rules/error-handling.md`

- [ ] **Step 1: 파일 생성**

`services/api/.claude/rules/error-handling.md`를 아래 내용으로 생성한다.

````markdown
---
description: ApiException과 ErrorCode 추가·사용 패턴
alwaysApply: true
---

# 오류 처리 패턴

## ErrorCode 추가

`src/common/exceptions/error-code.enum.ts`의 `ErrorCode` 객체에 추가한다.

```ts
export const ErrorCode = {
  // 기존 항목들...

  NEW_ERROR_KEY: {
    message: '사용자에게 노출되는 한글 오류 메시지',
    status: HttpStatus.NOT_FOUND,  // 적절한 HTTP 상태 코드
  },
} as const satisfies Record<string, ErrorCodeDefinition>;
```

- `message`: 클라이언트에 노출되는 한글 메시지
- `status`: `HttpStatus` enum 값
- `as const satisfies Record<string, ErrorCodeDefinition>` 패턴 유지 필수

## ApiException 사용

```ts
import { ApiException } from '@terab/common';

// ✅ ErrorCode에 등록된 키만 사용 (타입 안전)
throw new ApiException('NEW_ERROR_KEY');

// ❌ 일반 NestJS 예외 (메시지가 제네릭으로 마스킹됨 — 상세 내용은 로그에만 기록)
throw new NotFoundException('상세 메시지');
```

## 응답 형식

`ApiExceptionFilter`가 모든 예외를 아래 형식으로 직렬화한다.

```json
// ApiException — code + message 그대로 노출
{ "code": "NEW_ERROR_KEY", "message": "사용자에게 노출되는 한글 오류 메시지" }

// 일반 HttpException — status 기반 제네릭 메시지
{ "code": "HTTP_ERROR", "message": "Not Found" }
```

## 추가 순서

1. `ErrorCode` 객체에 항목 등록
2. `ErrorCodeKey` 타입이 자동으로 새 키를 포함 (별도 수정 불필요)
3. 서비스 코드에서 `throw new ApiException('NEW_ERROR_KEY')` 사용
````

- [ ] **Step 2: alwaysApply 확인**

```bash
grep -n "alwaysApply" services/api/.claude/rules/error-handling.md
```

Expected:
```
3:alwaysApply: true
```

- [ ] **Step 3: 커밋**

```bash
git add services/api/.claude/rules/error-handling.md
git commit -m "docs: api rules - error-handling.md 추가 (alwaysApply)"
```

---

### Task 8: testing.md 생성

**Files:**
- Create: `services/api/.claude/rules/testing.md`

- [ ] **Step 1: 파일 생성**

`services/api/.claude/rules/testing.md`를 아래 내용으로 생성한다.

````markdown
---
description: Jest 단위 테스트 작성 패턴
globs:
  - "src/**/*.spec.ts"
alwaysApply: false
---

# 테스트 작성 패턴

## 기본 구조

```ts
import { Test } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService, setupMockDbSelectChain } from '@terab/test';
import { TargetRepository } from './target.repository';

describe('TargetRepository', () => {
  let repo: TargetRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TargetRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    repo = module.get(TargetRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain(); // clearAllMocks() 후 반드시 호출 — select 체인 재구성
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });
});
```

## Mock 패턴

```ts
import { mockDbLimit, setupMockDbSelectChain } from '@terab/test';

it('유효한 id로 조회하면 행을 반환한다', async () => {
  const expected = { id: 'uuid-1', name: 'test' };
  mockDbLimit.mockResolvedValue([expected]);  // 단건 조회 결과 모킹

  const result = await repo.findById('uuid-1');

  expect(result).toEqual(expected);
});

it('일치하는 행이 없으면 null을 반환한다', async () => {
  mockDbLimit.mockResolvedValue([]);

  const result = await repo.findById('non-existent');

  expect(result).toBeNull();
});
```

## 핵심 규칙

- 테스트 설명(`describe`/`it`)은 한글로 작성
- `setupMockDbSelectChain()`은 `jest.clearAllMocks()` 호출 직후 실행 (순서 바꾸면 mock 체인 깨짐)
- Mock 유틸 import: `@terab/test` 패키지 (`mockDatabaseService`, `setupMockDbSelectChain`, `mockDbLimit` 등)
- 첫 번째 테스트는 항상 `it('인스턴스가 생성된다', () => { expect(target).toBeDefined(); })`
- DB 레이어 테스트는 `mockDatabaseService`로 주입 — 실제 DB 연결 없음
````

- [ ] **Step 2: 핵심 패턴 확인**

```bash
grep -n "setupMockDbSelectChain\|인스턴스가 생성\|mockDbLimit" services/api/.claude/rules/testing.md
```

Expected: 3개 패턴 모두 포함된 줄 번호 출력

- [ ] **Step 3: 최종 커밋**

```bash
git add services/api/.claude/rules/testing.md
git commit -m "docs: api rules - testing.md 추가"
```

---

## 완료 후 검증

모든 파일이 생성됐는지 확인한다.

```bash
find services/api/.claude/rules -name "*.md" | sort
```

Expected:
```
services/api/.claude/rules/error-handling.md
services/api/.claude/rules/layer-controller.md
services/api/.claude/rules/layer-repository.md
services/api/.claude/rules/layer-schema.md
services/api/.claude/rules/layer-service.md
services/api/.claude/rules/testing.md
```

```bash
ls services/api/CLAUDE.md CLAUDE.md
```

Expected: 두 파일 모두 출력

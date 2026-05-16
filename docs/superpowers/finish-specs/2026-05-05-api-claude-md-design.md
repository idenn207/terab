# services/api CLAUDE.md + Rules 설계

**날짜:** 2026-05-05
**범위:** `services/api/CLAUDE.md` 신규 작성, `services/api/.claude/rules/` 신규 작성, 루트 `CLAUDE.md` 환경변수 참조 추가

---

## 배경 및 목표

루트 `CLAUDE.md`는 모노레포 공통 원칙을 다루지만 `services/api/`에는 전용 컨텍스트 파일이 없다. Claude가 API 코드 작업 시 구조·인프라·빌드를 파악하는 데 시간이 걸리고, 코드 패턴(ts-rest 핸들러, Drizzle 쿼리, ErrorCode 추가 절차 등)을 매번 기존 코드에서 추론해야 한다.

**목표:**
- 서비스 수준 컨텍스트(`CLAUDE.md`) — 구조·인프라·빌드·행동 지침
- 코드 패턴 규칙(`.claude/rules/`) — 레이어별 코딩 패턴, 파일 타입에 따라 자동 로드

---

## 파일 구성

```
# 수정
CLAUDE.md                                        # 환경변수 참조 추가

# 신규 생성
services/api/CLAUDE.md                           # 구조·인프라·빌드·행동 지침
services/api/.claude/rules/
  layer-controller.md   # glob: src/**/*.controller.ts
  layer-service.md      # glob: src/**/*.service.ts
  layer-repository.md   # glob: src/**/*.repository.ts
  layer-schema.md       # glob: src/database/schema/**/*.ts
  error-handling.md     # alwaysApply: true
  testing.md            # glob: src/**/*.spec.ts
```

---

## 1. 루트 CLAUDE.md 변경

### 1.1 환경변수 참조 추가

`## 프로젝트 개요` → `### 주요 명령어` 바로 아래에 환경 설정 섹션을 추가한다.

```markdown
### 환경 설정

각 서비스의 필요 환경변수는 루트의 `*.env.example` 파일을 참조한다.

| 파일 | 대상 서비스 |
| --- | --- |
| `api.env.example` | services/api |
| `mq.env.example` | services/mq |
| `web.env.example` | services/web |
| `infra.env.example` | DB / Redis / MinIO |
```

---

## 2. services/api/CLAUDE.md

### 목차

```
# services/api/CLAUDE.md

> 루트 CLAUDE.md의 세부 컨벤션입니다.

## 아키텍처 개요
  - 모듈 구조 표
  - 내부 패키지(@terab/*) 표
  - 주요 명령어
  - 테스트 파일 위치

## 모듈 의존 구조
  - @Global 모듈 목록
  - 도메인 간 순환 의존 금지 원칙

## 인프라 & 빌드
  - Docker 3-stage 구조
  - @terab/contract file: 의존성 심링크 처리
  - DB 마이그레이션 절차

## Claude 행동 지침
  - 신규 모듈 생성 체크리스트
  - 오류 추가 절차
```

### 2.1 아키텍처 개요

#### 모듈 구조 표

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

#### 내부 패키지(@terab/*) 표

| 패키지 | 실제 경로 | 역할 |
|---|---|---|
| `@terab/contract` | `packages/contracts/` | ts-rest 계약 + Zod 스키마 |
| `@terab/db` | `src/database/` (path alias) | DatabaseService, Schema 타입 |
| `@terab/common` | `src/common/` (path alias) | Guards, Decorators, Exceptions |
| `@terab/core` | `src/core/` (path alias) | TokenService |
| `@terab/test` | `src/test/` (path alias) | Mock 유틸 |

#### 주요 명령어

```bash
npm run start:dev     # 개발 서버 (watch 모드)
npm run build         # 프로덕션 빌드
npm test              # 단위 테스트
npm run test:e2e      # e2e 테스트
npm run db:generate   # 마이그레이션 파일 생성 (스키마 변경 후)
npm run db:push       # 마이그레이션 적용 (개발 환경)
```

> 루트에서 `make api`로도 실행 가능 (`cd services/api && npm run start:dev`).

#### 테스트 파일 위치

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

### 2.2 모듈 의존 구조

- `DatabaseModule` — `@Global()` 선언. 각 도메인 모듈이 직접 import하지 않아도 `DatabaseService`를 주입받을 수 있다.
- `CoreModule` — `TokenService`를 export. 필요한 모듈이 직접 import한다.
- 도메인 모듈 간 순환 의존 금지. 공통 로직은 `CoreModule` 또는 `DatabaseModule`로 위임한다.
- `AppModule`은 모든 도메인 모듈을 import한다. 신규 모듈 추가 시 반드시 등록한다.
- 각 모듈은 필요한 외부 모듈(`BullModule`, `PassportModule` 등)을 직접 import한다.

### 2.3 인프라 & 빌드

#### Docker 3-stage 빌드

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

#### DB 마이그레이션

Drizzle Kit을 사용한다. 마이그레이션 파일은 `drizzle/` 디렉토리에 저장된다.

```bash
npm run db:generate   # 스키마 변경 후 마이그레이션 파일 생성
npm run db:push       # 마이그레이션 적용 (개발 환경)
```

운영 환경 마이그레이션은 `docker-entrypoint.sh`에서 컨테이너 시작 시 자동 적용된다. 운영 배포 전 `drizzle/` 마이그레이션 파일이 커밋되어 있어야 한다.

### 2.4 Claude 행동 지침

공통 지침은 루트 CLAUDE.md 참조. 아래는 api 서비스 전용 추가 지침이다.

#### 신규 모듈 생성 시 체크리스트

1. `src/{domain}/` 디렉토리 생성
2. `{domain}.module.ts`, `{domain}.controller.ts`, `{domain}.service.ts`, `{domain}.repository.ts` 생성
3. `AppModule`의 `imports` 배열에 등록
4. 필요한 외부 모듈(`BullModule`, `PassportModule` 등) 해당 모듈에서 직접 import
5. DB Schema가 필요하면 `src/database/schema/`에 `{domain}.schema.ts` 추가 후 `index.ts`에 re-export

#### 오류 추가 절차

1. `src/common/exceptions/error-code.enum.ts`의 `ErrorCode` 객체에 항목 추가
2. 서비스 코드에서 `throw new ApiException('NEW_ERROR_KEY')`로 사용

---

## 3. Rules 파일 상세

### 3.1 layer-controller.md

**frontmatter**
```yaml
description: NestJS Controller 작성 패턴 (ts-rest 기반)
globs: ["src/**/*.controller.ts"]
alwaysApply: false
```

**핵심 내용**
- `@TsRestHandler(contract.domain.action)` + `tsRestHandler(contract.domain.action, async ({body, params, query}) => ...)` 패턴
- 반환 형식: `{ status: HttpStatus.XXX, body: { ... } }` — ts-rest 계약과 일치해야 함
- 인증 우회: `@Public()` 데코레이터 — 로그인·회원가입·refresh 등 공개 엔드포인트에 사용
- 권한 검사: `@RequirePermission('resource:action')` 데코레이터
- 현재 사용자: `@CurrentUser() user: AuthUser` 파라미터 데코레이터
- 속도 제한 재정의: `@Throttle({ default: { ttl, limit } })`
- 쿠키 읽기: `@Cookies('cookieName')` 파라미터 데코레이터
- 쿠키 쓰기: `@Res({ passthrough: true }) res: Response` + `res.cookie()`
- **컨트롤러에 비즈니스 로직 없음** — 서비스로 위임, 컨트롤러는 HTTP 레이어만 담당
- `@Controller()` 빈 인자 — ts-rest가 경로를 관리하므로 컨트롤러 레벨 prefix 없음

### 3.2 layer-service.md

**frontmatter**
```yaml
description: NestJS Service 작성 패턴 (비즈니스 로직)
globs: ["src/**/*.service.ts"]
alwaysApply: false
```

**핵심 내용**
- `@Injectable()` + constructor injection (readonly 선언)
- 예외: `throw new ApiException('ERROR_CODE_KEY')` — `ErrorCode`에 등록된 키만 사용
- DB 직접 접근 금지 — 항상 Repository 경유
- 트랜잭션이 필요한 경우 Repository에 전용 메서드 위임 (서비스에서 `database.db.transaction` 호출 금지)
- 상수는 클래스 최상단 `private readonly XXX_MS = ...` 패턴으로 추출

### 3.3 layer-repository.md

**frontmatter**
```yaml
description: NestJS Repository 작성 패턴 (Drizzle ORM)
globs: ["src/**/*.repository.ts"]
alwaysApply: false
```

**핵심 내용**
- `@Injectable()` + `constructor(private readonly database: DatabaseService)`
- 단건 조회: `const [row = null] = await this.database.db.select(...).limit(1)` — `null` 기본값 포함
- 컬럼 선택 명시: `.select({ id: table.id, ... })` — `select()` 빈 호출(전체 컬럼) 지양
- leftJoin 후 집계: `rows[0]`으로 첫 번째 행 추출 후 private `aggregate*()` 메서드로 그루핑
- 트랜잭션: `this.database.db.transaction(async (tx) => { ... })` — tx를 쿼리 빌더로 사용
- 반환 타입 명시: Promise<T> 또는 Promise<T | null>
- `@terab/db` 패키지에서 스키마 테이블·타입 import

### 3.4 layer-schema.md

**frontmatter**
```yaml
description: Drizzle Schema 작성 패턴
globs: ["src/database/schema/**/*.ts"]
alwaysApply: false
```

**핵심 내용**
- `import * as t from 'drizzle-orm/pg-core'` + `import { pgTable as table } from 'drizzle-orm/pg-core'`
- 테이블 정의: `export const tableName = table('table_name', { ... }, (table) => [ indexes ])`
- PK: `t.uuid('id').primaryKey().defaultRandom()`
- 타임스탬프: `t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
- 타입 export (파일 하단):
  ```ts
  export type TableName$Insert = typeof tableName.$inferInsert;
  export type TableName$Select = typeof tableName.$inferSelect;
  ```
- 인덱스는 세 번째 인자 배열: `[t.uniqueIndex().on(col), t.index().on(col)]`
- 새 스키마 파일 작성 후 `src/database/schema/index.ts`에 re-export 추가

### 3.5 error-handling.md

**frontmatter**
```yaml
description: ApiException과 ErrorCode 추가·사용 패턴
alwaysApply: true
```

**핵심 내용**
- `ErrorCode` 객체 구조:
  ```ts
  ERROR_CODE_KEY: {
    message: '사용자에게 노출되는 한글 메시지',
    status: HttpStatus.XXX,
  }
  ```
- 파일 하단 `as const satisfies Record<string, ErrorCodeDefinition>` 패턴 유지
- `ApiException` 사용: `throw new ApiException('ERROR_CODE_KEY')`
- `ErrorCodeKey = keyof typeof ErrorCode` — 새 키 추가 시 자동 반영
- **응답 형식**: `ApiExceptionFilter`가 `{ code: string, message: string }` 으로 직렬화
- 일반 `HttpException`(NestJS 내장)을 throw하면 `ApiExceptionFilter`가 status code 기반 제네릭 메시지로 마스킹함 — 상세 오류는 로그에만 기록됨
- 새 오류 추가 순서: `ErrorCode` 등록 → `ApiException` throw

### 3.6 testing.md

**frontmatter**
```yaml
description: Jest 단위 테스트 작성 패턴
globs: ["src/**/*.spec.ts"]
alwaysApply: false
```

**핵심 내용**
- 테스트 모듈: `Test.createTestingModule({ providers: [...] }).compile()`
- Mock 주입: `{ provide: DatabaseService, useValue: mockDatabaseService }`
- `beforeEach` 패턴:
  ```ts
  beforeEach(async () => {
    const module = await Test.createTestingModule({ ... }).compile();
    repo = module.get(TargetClass);
    jest.clearAllMocks();
    setupMockDbSelectChain(); // select 체인 재구성 (clearAllMocks 후 필수)
  });
  ```
- `mockDbLimit.mockResolvedValue([...])` — 단건 조회 결과 모킹
- 테스트 설명(describe/it)은 한글
- 첫 번째 테스트: `it('인스턴스가 생성된다', () => { expect(target).toBeDefined(); })`
- Mock 유틸 import: `@terab/test` 패키지 (`mockDatabaseService`, `setupMockDbSelectChain` 등)

---

## 검토 포인트

- `services/api/.claude/rules/` 경로가 Claude Code에서 서비스 하위 디렉토리로 올바르게 로드되는지 확인 필요
- `layer-service.md`의 "트랜잭션은 repository에 위임" 규칙이 현재 `auth.repository.ts`의 `registerUser` 메서드와 일치 (검증됨)
- `error-handling.md`의 `alwaysApply: true` — API 작업 중 어떤 파일을 열어도 ErrorCode 패턴을 항상 참조할 수 있도록 설정

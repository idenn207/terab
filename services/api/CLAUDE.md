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
| `src/security/` | TokenService (JWT·암호화 유틸) |
| `src/database/` | DatabaseService, Schema, Seed, Migration |
| `src/health/` | 헬스체크 엔드포인트 |

### `src/common/` 분류 기준

"공통이냐"가 아니라 **"독자 `@Module()`이 없는 NestJS 1차 빌딩 블록이냐"**가 기준이다. 자체 `*.module.ts`를 가지는 인프라성 코드는 `src/common/`이 아니라 `src/{name}/` 최상위에 둔다.

**`src/common/`에 들어가는 것 (Module 없음):**

| 분류 | 디렉토리 | 예시 |
|---|---|---|
| Guard | `src/common/guards/` | `JwtAuthGuard`, `PermissionGuard` |
| Filter | `src/common/filters/` | `ApiExceptionFilter` |
| Decorator | `src/common/decorators/` | `@Public()`, `@CurrentUser()`, `@RequirePermission()` |
| Exception | `src/common/exceptions/` | `ApiException`, `ErrorCode` |
| Pipe / Interceptor | `src/common/pipes/`, `src/common/interceptors/` | (필요 시 추가) |

- 등록: `AppModule`의 `APP_GUARD` / `APP_FILTER` / `APP_PIPE` provider 또는 핸들러 데코레이터로 직접 사용
- export: `src/common/index.ts`에 re-export — 외부에서는 `@terab/common`으로 import
- **금지**: `src/common/` 안에 `*.module.ts` 두지 않는다. Module이 필요하면 `src/{name}/` 최상위로 승격한다

**`src/common/`에 들어가지 않는 것 (자체 Module을 가짐):**

| 디렉토리 | Module | 이유 |
|---|---|---|
| `src/database/` | `DatabaseModule` (`@Global`) | DI 진입점, Schema/Seed/Migration까지 묶인 인프라 |
| `src/security/` | `SecurityModule` (`@Global`) | `TokenService` provider |
| `src/logger/` | `LoggerModule` (`@Global`) | `nestjs-pino` 설정 wrapper |
| `src/minio/` | `MinioModule` | MinIO client provider |

- 위 4개는 `@Global()`로 어디서든 inject 가능하므로 "공통처럼 동작"하지만, 폴더는 `common/`이 아니다
- path alias(`@terab/db`, `@terab/security` 등)로 import한다 — 미래에 독립 패키지로 분리할 여지를 남긴 설계

**새 코드 배치 결정 흐름:**

1. `@Module()` 데코레이터가 붙은 클래스를 만드는가? → `src/{name}/` 최상위 (필요 시 path alias 추가)
2. NestJS 데코레이터/Guard/Filter/Exception 등 Module 없는 재사용 단위인가? → `src/common/{category}/`
3. 특정 도메인에서만 쓰이는 유틸인가? → 해당 도메인 디렉토리 내부 (`src/{domain}/utils/` 등)

### 내부 패키지 (@terab/*)

| 패키지 | 실제 경로 | 역할 |
|---|---|---|
| `@terab/db` | `src/database/` (path alias) | DatabaseService, Schema 타입 |
| `@terab/common` | `src/common/` (path alias) | Guards, Decorators, Exceptions |
| `@terab/security` | `src/security/` (path alias) | TokenService |
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
- `SecurityModule` — `TokenService`를 export. `@Global()` 선언으로 전역 제공.
- 도메인 모듈 간 순환 의존 금지. 공통 로직은 `SecurityModule` 또는 `DatabaseModule`로 위임한다.
- `AppModule`은 모든 도메인 모듈을 import한다. 신규 모듈 추가 시 반드시 등록한다.
- 각 모듈은 필요한 외부 모듈(`BullModule`, `PassportModule` 등)을 직접 import한다.

### 도메인 간 의존 관계

```
FileModule → FolderModule
```

- `FileModule`이 `FolderModule`을 import한다. `UploadSessionService`·`FileService`가 `FolderService`(폴더 소유권 검증 등)를 주입받기 위해 필요하다.
- `FolderModule`은 `FolderService`를 export한다.

## 인프라 & 빌드

### Docker 빌드

`services/api/Dockerfile`을 각 서비스 디렉토리 컨텍스트에서 빌드한다 (`docker build ./services/api`).

| Stage | 역할 |
|---|---|
| `builder` | API 소스 빌드 (`nest build`) |
| `runner` | 런타임 이미지 (non-root `appuser`, prod deps만 설치) |

```bash
# 로컬 Docker 이미지 빌드 (루트에서 실행)
make image
```

### DB 마이그레이션

Drizzle Kit을 사용한다. 마이그레이션 파일은 `drizzle/` 디렉토리에 저장된다.

```bash
npm run db:generate   # 스키마 변경 후 마이그레이션 파일 생성
npm run db:push       # 마이그레이션 적용 (개발 환경)
```

운영 환경 마이그레이션은 `docker-entrypoint.sh`에서 컨테이너 시작 시 자동 적용된다. 운영 배포 전 `drizzle/` 마이그레이션 파일이 커밋되어 있어야 한다.

## Swagger / DTO 컨벤션

> 본 컨벤션은 ts-rest 제거 마이그레이션(2026-05-16) 완료 시점에 박제됨. 원본은 `docs/superpowers/finish-specs/2026-05-16-ts-rest-removal-swagger-migration-design.md` §6.A.

### Controller 데코레이터

- 경로 prefix: `@Controller('domain')` — kebab/단수형 (`'auth'`, `'file'`, `'trusted-device'`)
- 그룹 태그: `@ApiTags('Domain')` — PascalCase 단수형
- 인증 기본값: 글로벌 security로 처리. `@Public()` 라우트는 자동 비움 (데코레이터가 `ApiSecurity({})` 합성)

### 메서드 데코레이터 순서 (고정)

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

### HttpCode 명시

| 메서드 | 기본 | 명시 필수 |
|---|---|---|
| GET | 200 | 거의 없음 |
| POST | 201 | **200 응답 시 `@HttpCode(HttpStatus.OK)` 필수** |
| DELETE | 200 | **204 응답 시 `@HttpCode(HttpStatus.NO_CONTENT)` 필수** |

### 응답 표현 패턴

```ts
// 단일
@ApiResponse({ status: HttpStatus.OK, type: UserDto })
// 배열
@ApiResponse({ status: HttpStatus.OK, type: UserDto, isArray: true })
// 빈 응답
@ApiResponse({ status: HttpStatus.NO_CONTENT })
// Discriminated union — @ApiExtraModels + oneOf + discriminator.mapping 3종 세트 필수
```

union 응답은 3종 세트 누락 시 web codegen narrowing이 깨진다.

### DTO 작성

- 위치: `src/{domain}/dto/`, 공유는 `src/common/dto/`
- 파일명 kebab-case + `.dto.ts`, 클래스명 PascalCase + `Dto`
- 필드 `!: type` (non-null assertion)
- 단순 필드는 swagger plugin(`nest-cli.json`의 `"plugins": ["@nestjs/swagger"]`)이 자동 처리. 명시 메타만 `@ApiProperty(...)` 수동
- Response DTO에는 class-validator 데코레이터 불필요. 민감 필드 `@Exclude()`

### Request DTO 검증 원칙 (필수)

> REST API 입력 검증의 게이트. 모든 request body / query / path는 ValidationPipe(글로벌) + class-validator + class-transformer로 검증된다. validator가 누락된 필드는 **검증 게이트가 무력화**된다 — 보안·계약 양쪽에서 중대 결함.

- 모든 request DTO 필드에 의미에 맞는 class-validator 데코레이터 부착:
  | 타입 | 필수 validator |
  |---|---|
  | UUID 식별자 | `@IsUUID()` (옵션: `'4'`) |
  | string literal union (`'a' \| 'b'`) | `@IsEnum([...])` 또는 `@IsIn([...])` |
  | enum 값 | `@IsEnum(MyEnum)` |
  | 자연어 텍스트 | `@IsString()` + `@MinLength`/`@MaxLength` |
  | 정수 | `@IsInt()` + `@Min`/`@Max` |
  | boolean | `@IsBoolean()` |
  | 이메일 | `@IsEmail()` |
  | URL | `@IsUrl()` |
  | optional | 위 데코레이터들 위에 `@IsOptional()` 추가 |
  | 중첩 객체 | `@ValidateNested()` + `@Type(() => SubDto)` |
  | 배열 | 항목 validator + `each: true` |
- **swagger plugin의 자동 합성**: `classValidatorShim: true` (기본값)이므로 validator의 메타데이터가 OpenAPI에 자동 반영된다. 따라서:
  - validator로 표현되는 항목(`enum`, `format: 'uuid'`, `minLength`/`maxLength`, `minimum`/`maximum`)은 `@ApiProperty(...)` 옵션에서 **중복 작성 금지**
  - `@ApiProperty()`는 다음 경우에만 명시: description, example, deprecated, `additionalProperties`, 복잡 타입(`Record`, `oneOf`), 타입 추론이 불충분한 경우(예: `type: 'integer'`)
- transform이 필요한 필드(`@Type(() => Number)` 등)는 class-transformer 데코레이터 명시. 글로벌 ValidationPipe는 `transform: true` 전제

### Response DTO의 UUID / ENUM 표현 (composed decorator 미도입)

> response DTO는 validator를 부착하지 않으므로 plugin이 추출할 메타데이터가 없다. UUID/ENUM 표현을 위해 composed decorator(`@ApiUuidProperty` 등)를 도입하지 않고 **`@ApiProperty` 명시 패턴을 그대로 유지한다** — 추상화 한 겹보다 명시 한 줄이 코드 grep·OpenAPI 추적·신규 기여자 이해도에 유리하다는 판단.

- UUID 필드: `@ApiProperty({ format: 'uuid' })`
- nullable UUID (`string | null`): `@ApiProperty({ type: String, format: 'uuid', nullable: true })`
  - `type: String` 명시 필수 — 명시 없이 `format`만 주면 plugin의 union 타입 추론이 `Object`로 fallback되어 OpenAPI에 `type: "object"` 회귀가 발생함
- string literal union: `@ApiProperty({ enum: ['VALUE_A', 'VALUE_B'] })`
- nullable enum: `@ApiProperty({ enum: [...], nullable: true })`
- `Date` 필드: 명시 불필요. plugin이 자동으로 `string / date-time`으로 직렬화

### Path/Query 검증

```ts
@Param('id', ParseUUIDPipe) id: string
@Query() query: XxxQueryDto
```

- path UUID 파라미터는 `ParseUUIDPipe` 또는 query DTO 내 `@IsUUID()` 중 하나로 반드시 검증
- query DTO도 request DTO와 동일한 검증 원칙 적용 (`@IsOptional` + `@Type(() => Number)` 패턴 활용)

### `@ApiError` 헬퍼

- `@ApiError('KEY1', 'KEY2')`만 사용 — ErrorCode 키 기반
- 직접 `@ApiResponse({ status: 4xx, type: ErrorResponseDto })` 작성 **금지** (보일러플레이트 + ErrorCode와 drift)

### `@Public()` 사용

- 가드 우회 + OpenAPI security 비움이 자동 합성
- 부착 시 web `PUBLIC_PATHS` 자동 갱신됨

### OpenAPI 노출

- dev 환경에서만: `SwaggerModule.setup('swagger', app, doc, { jsonDocumentUrl: '/json' })`
- prod 환경은 `NODE_ENV === 'dev'` 분기 안에서만 활성화

### 금지 패턴

| 금지 | 대체 |
|---|---|
| `@ApiProperty()` 단순 필드 명시적 부착 | swagger plugin에 위임 |
| `@Post()` 후 `@HttpCode` 생략 (200 의도) | `@HttpCode(HttpStatus.OK)` 명시 |
| `@ApiResponse({ status: 4xx, type: ErrorResponseDto })` 직접 | `@ApiError('KEY')` |
| `oneOf` 없이 union 응답 type 명시 | `@ApiExtraModels + oneOf + discriminator.mapping` 3종 세트 |
| `class-validator` 없는 DTO body 검증 | ValidationPipe + class-validator |
| request DTO에 `@IsUUID`/`@IsEnum` 누락 | 모든 식별자/literal union에 validator 필수 — 검증 게이트 무력화 방지 |
| validator로 표현 가능한 메타를 `@ApiProperty`에 중복 작성 (`enum`, `format: 'uuid'`, `min`/`max`, `minLength`/`maxLength`) | validator만 부착, plugin이 자동 합성 |
| response DTO에 `string \| null` UUID인데 `type: String` 누락 | `@ApiProperty({ type: String, format: 'uuid', nullable: true })` — 미명시 시 OpenAPI `type: "object"` 회귀 |
| response DTO에 UUID 표현용 composed decorator (`@ApiUuidProperty` 등) 도입 | `@ApiProperty({ format: 'uuid' })` 명시 패턴 유지 — 추상화 1겹보다 명시가 grep·OpenAPI 추적·이해도에 유리 |

## Claude 행동 지침

> 공통 지침은 루트 CLAUDE.md를 참조. 아래는 api 서비스 전용 추가 지침이다.

### 신규 모듈 생성 시 체크리스트

1. `src/{domain}/` 디렉토리 생성
2. `{domain}.module.ts`, `{domain}.controller.ts`, `{domain}.service.ts`, `{domain}.repository.ts` 생성 (각 파일 옆에 `*.spec.ts` 함께 생성)
3. `AppModule`의 `imports` 배열에 등록
4. 필요한 외부 모듈(`BullModule`, `PassportModule` 등) 해당 모듈에서 직접 import
5. DB Schema가 필요하면 `src/database/schema/`에 `{domain}.schema.ts` 추가 후 `index.ts`에 re-export

### 오류 추가 절차

1. `src/common/exceptions/error-code.enum.ts`의 `ErrorCode` 객체에 항목 추가 (`{ message: '한글 오류 메시지', status: HttpStatus.XXX }` 구조 필수)
2. 서비스 코드에서 `throw new ApiException('NEW_ERROR_KEY')`로 사용

### 로거 사용

- `ServiceCore` 자손 service의 public 메서드는 자동 trace된다. 별도 로그 호출 불필요
- 비즈니스 이벤트는 `@InjectPinoLogger(ClassName.name)` 주입 후 `this.logger.info`로 명시 기록
- `LoggerModule`은 `@Global()` 선언이므로 도메인 모듈에서 별도 import 없이 주입 가능
- 호출 형식·레벨 기준, 자동 trace 정책은 `.claude/rules/logging.md` 참조

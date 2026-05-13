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
| `@terab/contract` | `packages/contracts/` | ts-rest 계약 + Zod 스키마 |
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
2. `{domain}.module.ts`, `{domain}.controller.ts`, `{domain}.service.ts`, `{domain}.repository.ts` 생성 (각 파일 옆에 `*.spec.ts` 함께 생성)
3. `AppModule`의 `imports` 배열에 등록
4. 필요한 외부 모듈(`BullModule`, `PassportModule` 등) 해당 모듈에서 직접 import
5. DB Schema가 필요하면 `src/database/schema/`에 `{domain}.schema.ts` 추가 후 `index.ts`에 re-export

### 오류 추가 절차

1. `src/common/exceptions/error-code.enum.ts`의 `ErrorCode` 객체에 항목 추가 (`{ message: '한글 오류 메시지', status: HttpStatus.XXX }` 구조 필수)
2. 서비스 코드에서 `throw new ApiException('NEW_ERROR_KEY')`로 사용

### 로거 사용

- 로거가 필요한 클래스는 `@InjectPinoLogger(ClassName.name)`으로 주입한다
- `LoggerModule`은 `@Global()` 선언이므로 도메인 모듈에서 별도 import 없이 주입 가능
- 호출 형식·레벨 기준은 `.claude/rules/logging.md` 참조

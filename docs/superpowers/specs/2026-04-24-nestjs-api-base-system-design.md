# NestJS API 기본 시스템 구성 설계

**날짜**: 2026-04-24
**브랜치**: `BREAKING/java-to-nestjs`
**범위**: 인프라 + 인증(auth) 도메인 — 기존 Java Spring Boot API의 로직·API path 마이그레이션, 서버 환경 완전 재구성

---

## 1. 기술 스택 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 런타임 | Node 24.x / NestJS 11 | 기존 결정 유지 |
| ORM | **Drizzle ORM** | Docker Windows→Linux 배포 시 Prisma 바이너리 타겟 이슈 없음; SQL-first로 파일 트리 계층 쿼리에 유리; 마이그레이션 SQL 파일 생성 방식이 Flyway와 유사 |
| 아키텍처 패턴 | **NestJS 표준 패턴** | `Controller → Service → Repository` 3계층. UseCase 레이어 제거; Drizzle 쿼리는 Repository에 격리 |
| 인증 | **Passport.js + @nestjs/jwt** | `passport-jwt` Strategy: 401 인증 담당; 커스텀 `PermissionGuard`: 403 인가 담당 — 책임 분리 |
| Guard 등록 | **APP_GUARD 전역 등록** | deny-all 기본값; 도메인 모듈이 Guard import 불필요; NestJS 공식 권장 패턴 |
| 환경변수 | **env_file + 심볼릭링크** | Docker Config/Secret 제거; `api.env`를 `docker-compose.yml`에서 `env_file`로 주입; 로컬은 심볼릭링크 |

---

## 2. 디렉토리 구조

```
services/api/src/
├── auth/                              # Auth 도메인
│   ├── strategies/
│   │   └── jwt.strategy.ts            # Passport JWT Strategy (auth 전용)
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── backup-login.dto.ts
│   │   ├── login-response.dto.ts
│   │   └── user-response.dto.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.repository.ts             # Drizzle 쿼리 전담 (DB 접근 격리)
│   └── auth.module.ts
│
├── common/                            # 전역 재사용 코드 (NestJS 컨벤션)
│   ├── guards/
│   │   ├── jwt-auth.guard.ts          # APP_GUARD 전역 등록 (401)
│   │   └── permission.guard.ts        # APP_GUARD 전역 등록 (403)
│   ├── decorators/
│   │   ├── public.decorator.ts        # @Public() — 인증 우회
│   │   ├── current-user.decorator.ts  # @CurrentUser()
│   │   └── require-permission.decorator.ts  # @RequirePermission('file:read')
│   └── filters/
│       └── api-exception.filter.ts    # GlobalExceptionHandler 대응
│
├── database/                          # DB 인프라
│   ├── schema/
│   │   ├── users.schema.ts
│   │   ├── refresh-tokens.schema.ts
│   │   ├── roles.schema.ts
│   │   └── index.ts                   # 전체 schema export
│   ├── database.module.ts             # @Global() — Drizzle 클라이언트 제공
│   └── database.service.ts
│
├── app.module.ts
└── main.ts

services/api/
├── drizzle/
│   ├── migrations/
│   │   └── 0000_init.sql              # V1~V4 Flyway SQL 통합본 (기존 스키마 기록)
│   └── meta/
│       └── _journal.json
└── drizzle.config.ts
```

### Java → NestJS 대응표

| Java | NestJS | 위치 |
|------|--------|------|
| `SecurityConfig` | `app.module.ts` APP_GUARD 등록 | `app.module.ts` |
| `JwtAuthenticationFilter` | `jwt-auth.guard.ts` + `jwt.strategy.ts` | `common/guards/`, `auth/strategies/` |
| `GlobalExceptionHandler` | `api-exception.filter.ts` | `common/filters/` |
| `application.yml` configtree | `api.env` + `env_file` | 프로젝트 루트 |
| `@PreAuthorize` | `@RequirePermission()` | `common/decorators/` |
| `@AuthenticationPrincipal` | `@CurrentUser()` | `common/decorators/` |
| `Repository` (Spring Data JPA) | `auth.repository.ts` (Drizzle 쿼리 격리) | `auth/` |

---

## 3. 모듈 연결 구조

```
AppModule
├── ConfigModule (isGlobal: true)   ← 모든 모듈에서 ConfigService 사용 가능
├── DatabaseModule (isGlobal: true) ← 모든 모듈에서 DatabaseService 사용 가능
├── AuthModule
│   └── imports: [JwtModule]        ← @nestjs/jwt, JwtService 제공
└── providers (APP_GUARD)
    ├── JwtAuthGuard                ← 전역 인증 (401), 실행 순서 1
    └── PermissionGuard             ← 전역 인가 (403), 실행 순서 2
```

**설계 원칙:**
- `ConfigModule`, `DatabaseModule`은 `@Global()` — 도메인 모듈에서 재선언 불필요
- `JwtModule`은 `AuthModule` 내부에만 등록 — `JwtService`는 인증 도메인만 사용
- APP_GUARD 등록 순서가 실행 순서를 결정: 401 → 403 보장

---

## 4. 환경변수 관리

### 파일 구조

```
프로젝트 루트/
├── api.env          # API 서비스 환경변수 (gitignore)
├── web.env          # Web 서비스 환경변수 (gitignore)
├── infra.env        # DB/MinIO/RabbitMQ/Portainer (gitignore)
│
├── api.env.example  # 필수 키 목록 (커밋 대상)
├── web.env.example
└── infra.env.example
```

### 심볼릭링크 (로컬 개발)

```bash
# make setup-local → scripts/setup-local.sh
ln -sf "$(pwd)/api.env" services/api/.env
ln -sf "$(pwd)/web.env" services/web/.env
```

### docker-compose.yml 설정

```yaml
services:
  api:
    env_file:
      - api.env          # Docker가 전체 키를 process.env로 주입
  web:
    env_file:
      - web.env
  db:
    env_file:
      - infra.env
```

### NestJS ConfigModule

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  // 로컬: services/api/.env 심볼릭링크 자동 읽기
  // 운영: docker-compose env_file 주입 → .env 없어도 동작
})
```

커스텀 로더, docker-entrypoint.sh 내 파일 처리 로직 **불필요**.

### docker-entrypoint.sh 역할

환경변수 처리를 하지 않으므로 Java 버전과 동일하게 DB 준비 대기만 담당:

```sh
#!/bin/sh
set -e
exec wait-for-it.sh db:5432 --timeout=60 -- node dist/main.js
```

### api.env 키 목록 (예시)

```
DATABASE_URL=postgresql://user:pass@db:5432/terab
JWT_SECRET=
JWT_ACCESS_EXPIRY_MS=900000
JWT_REFRESH_EXPIRY_MS=604800000
CORS_ALLOWED_ORIGINS=https://drive.skypark207.com
PASSWORD_PEPPER=
OWNER_USERNAME=owner
OWNER_NICKNAME=Owner
OWNER_PASSWORD=
RABBITMQ_URL=amqp://terab:pass@rabbitmq:5672
MINIO_ENDPOINT=
MINIO_ROOT_USER=
MINIO_PASSWORD=
MINIO_BUCKET=
```

---

## 5. 보안 레이어

### 요청 처리 흐름

```
요청
 ↓
JwtAuthGuard (APP_GUARD #1)
  ├── @Public() 여부 확인 (Reflector)
  │   └── true → 통과
  └── false → AuthGuard('jwt') 위임 → passport-jwt Strategy
        ├── Authorization 헤더에서 Bearer 토큰 추출
        ├── JwtService.verify() 검증
        ├── 성공 → req.user 주입 (userId, username, permissions[])
        └── 실패 → 401 UnauthorizedException
 ↓
PermissionGuard (APP_GUARD #2)
  ├── @RequirePermission() 데코레이터 없음 → 통과
  └── 있음 → req.user.permissions 대조
        └── 불충분 → 403 ForbiddenException
 ↓
Controller
```

### Refresh Token 전용 경로

`POST /api/auth/refresh`는 `@Public()`으로 JWT 검증 우회.
서비스 레이어에서 쿠키의 RT를 직접 검증 (Java의 `@CookieValue` 방식과 동일).

### RT 보안 정책 (Java에서 그대로 이전)

- RT: HttpOnly Secure 쿠키 (`refreshToken`), `path=/api/auth`, 만료 7일
- DB에 해시값만 저장 (bcrypt, `TokenHasher` 역할을 `HashUtil`로 대응)
- Refresh 시 RT Rotation (기존 폐기 → 신규 발급)
- RT 재사용 감지 시 해당 사용자의 모든 활성 RT 즉시 무효화 (family invalidation)

### main.ts 보안 설정

```
- cookie-parser 미들웨어 (RT 쿠키 파싱)
- helmet (보안 헤더)
- CORS: ConfigService에서 CORS_ALLOWED_ORIGINS 읽기, 와일드카드 금지
- ValidationPipe (class-validator, global, whitelist: true)
- ApiExceptionFilter (global exception filter)
- 포트: 3000 (내부), Nginx 외부 노출
```

---

## 6. Auth 도메인

### API 엔드포인트 (기존 Java path 동일)

| Method | Path | 설명 | Guard |
|--------|------|------|-------|
| POST | `/api/auth/login` | 로그인 → AT 응답 + RT 쿠키 | `@Public()` |
| POST | `/api/auth/login/backup` | 백업코드 로그인 → AT + RT 쿠키 | `@Public()` |
| POST | `/api/auth/refresh` | AT 갱신 (RT 쿠키 사용) | `@Public()` |
| POST | `/api/auth/logout` | 로그아웃 + RT 쿠키 삭제 | JWT 필요 |
| GET | `/api/auth/me` | 현재 사용자 조회 | JWT 필요 |

### AuthService 책임

- 비밀번호 검증 (pepper + bcrypt)
- AT 발급 (`JwtService.sign`) — payload에 `userId`, `username`, `permissions[]` 포함
- RT 생성 → 해시 후 AuthRepository에 저장 위임
- RT Rotation 및 재사용 감지
- Owner 계정 초기화 (`OnModuleInit`)
- **쿠키 설정은 Controller 담당, DB 쿼리는 AuthRepository 담당** — Service는 순수 비즈니스 로직만

### AuthRepository 책임

Drizzle 쿼리를 도메인 의미의 메서드로 캡슐화. Service는 SQL 문법을 직접 다루지 않는다.

| 메서드 | 역할 |
|--------|------|
| `findUserWithPermissionsByUsername(username)` | 유저+권한 조인 쿼리 → `UserWithPermissions \| null` |
| `findUserWithPermissionsById(id)` | 동일 조인, id 기준 |
| `findActiveRefreshTokens(now)` | 만료·폐기되지 않은 RT 목록 |
| `insertRefreshToken(userId, tokenHash, expiresAt)` | RT DB 저장 |
| `revokeRefreshTokenById(id, revokedAt)` | RT 폐기 (revokedAt 설정) |
| `findUnusedBackupCodes(userId)` | 미사용 백업코드 목록 |
| `markBackupCodeUsed(id, usedAt)` | 백업코드 사용 처리 |
| `findUserByUsername(username)` | Owner 초기화용 단순 존재 확인 |
| `findRoleByName(name)` | OWNER 역할 ID 조회 |
| `insertUser(data)` | 유저 생성 → `{ id }` 반환 |
| `insertUserRole(userId, roleId)` | 유저-역할 연결 |

`UserWithPermissions` 인터페이스는 Repository에서 export — Service는 이 타입만 사용하며 Drizzle 스키마 타입에 의존하지 않는다.

### RT 쿠키 설정 (Controller)

```typescript
// AuthController
res.cookie('refreshToken', rawToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: refreshExpMs,
  path: '/api/auth',
});
```

### 데이터베이스 레이어 (Drizzle)

**스키마**: 기존 Flyway V2~V4 SQL을 TypeScript로 미러링

```typescript
// database/schema/users.schema.ts
export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  username:  varchar('username', { length: 50 }).notNull().unique(),
  nickname:  varchar('nickname', { length: 100 }).notNull(),
  password:  varchar('password', { length: 255 }).notNull(),
  active:    boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**마이그레이션 전략:**
- `drizzle/migrations/0000_init.sql`: V1~V4 Flyway SQL 통합 (기존 DB 상태 기록)
- 이후 스키마 변경은 `drizzle-kit generate`로 증분 마이그레이션 파일 생성
- `drizzle-kit migrate`로 적용 (`drizzle-kit push` 운영 사용 금지)

---

## 7. 예외 처리

Java `ApiException(ErrorCode)` 패턴을 NestJS로 이전:

```
ApiException (커스텀 HttpException)
  ├── errorCode: string  (예: 'INVALID_CREDENTIALS')
  ├── message: string
  └── httpStatus: HttpStatus

ApiExceptionFilter (@Catch(ApiException, HttpException))
  └── 응답 구조: { errorCode, message }
```

- 비즈니스 예외: `throw new ApiException(ErrorCode.INVALID_CREDENTIALS)`
- 입력 유효성: `ValidationPipe` + `class-validator` (`@IsString()`, `@IsNotEmpty()` 등)
- 서버 내부 오류: Filter에서 일괄 처리 (500)

---

## 8. 초기 계정 초기화

Java `OwnerAccountInitializer` (`ApplicationRunner`) 대응:

```typescript
// app.module.ts 또는 별도 initializer
// NestJS OnApplicationBootstrap 또는 @nestjs/schedule 없이
// AppModule의 onApplicationBootstrap() 훅 사용
// OWNER_USERNAME 계정이 없으면 생성 (멱등성 보장)
```

---

## 9. 미포함 범위 (이후 단계)

이번 설계 범위에 포함되지 않는 도메인:

- `backupcode` — 백업코드 관리
- `device` — Push Token 등록
- `trusteddevice` — 신뢰 기기 (30일 2FA 스킵)
- `twofa` — 2FA 챌린지
- `file`, `folder`, `drive` — 파일 관리 (미구현)
- RabbitMQ 이벤트 발행 (`@nestjs/microservices` + `amqplib`)
- MinIO 연동

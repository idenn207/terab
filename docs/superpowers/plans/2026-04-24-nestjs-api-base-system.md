# NestJS API 기본 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Java Spring Boot API의 인프라·인증 도메인을 NestJS 11 + Drizzle ORM으로 재구성한다.

**Architecture:** NestJS 표준 `Controller → Service → Repository` 3계층. Drizzle 쿼리는 Repository에 격리하여 Service는 순수 비즈니스 로직만 담당. APP_GUARD 전역 등록(deny-all)으로 JwtAuthGuard(401) → PermissionGuard(403) 순서 보장. `api.env` 심볼릭링크로 로컬/운영 환경변수 통일.

**Tech Stack:** NestJS 11, Drizzle ORM + drizzle-kit, node-postgres(pg), @nestjs/jwt, @nestjs/passport, passport-jwt, bcryptjs, class-validator, cookie-parser, helmet

---

## 파일 구조 전체 맵

```
services/api/
├── src/
│   ├── auth/
│   │   ├── strategies/jwt.strategy.ts        # Passport JWT Strategy
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── backup-login.dto.ts
│   │   │   ├── login-response.dto.ts
│   │   │   └── user-response.dto.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.controller.spec.ts
│   │   ├── auth.service.ts
│   │   ├── auth.service.spec.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.repository.spec.ts
│   │   └── auth.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── require-permission.decorator.ts
│   │   ├── exceptions/
│   │   │   ├── error-code.enum.ts
│   │   │   └── api.exception.ts
│   │   └── filters/
│   │       ├── api-exception.filter.ts
│   │       └── api-exception.filter.spec.ts
│   ├── common/guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── jwt-auth.guard.spec.ts
│   │   ├── permission.guard.ts
│   │   └── permission.guard.spec.ts
│   ├── database/
│   │   ├── schema/
│   │   │   ├── users.schema.ts
│   │   │   ├── refresh-tokens.schema.ts
│   │   │   ├── backup-codes.schema.ts
│   │   │   └── index.ts
│   │   ├── database.service.ts
│   │   ├── database.service.spec.ts
│   │   └── database.module.ts
│   ├── app.initializer.ts
│   ├── app.module.ts
│   └── main.ts
├── drizzle/
│   ├── migrations/0000_init.sql
│   └── meta/_journal.json
├── drizzle.config.ts
├── Dockerfile
├── docker-entrypoint.sh
└── wait-for-it.sh
```

**Java 코드 대응 참조 파일 (origin/master):**
- `services/api/src/main/java/com/terab/api/auth/service/AuthService.java`
- `services/api/src/main/java/com/terab/api/security/JwtProvider.java`
- `services/api/src/main/java/com/terab/api/security/TokenHasher.java`
- `services/api/src/main/java/com/terab/api/common/exception/ErrorCode.java`
- `services/api/src/main/java/com/terab/api/config/OwnerAccountInitializer.java`

---

## Task 0: 프로젝트 정리 및 의존성 설치

**Files:**
- Delete: `src/app.controller.ts`, `src/app.service.ts`, `src/app.controller.spec.ts`
- Modify: `package.json`
- Modify: `services/web/.gitignore` (이미 `.env` 있음 — api 것은 `services/api/.gitignore`에도 있음, 확인만)

- [ ] **Step 1: 불필요한 보일러플레이트 파일 삭제**

```bash
cd services/api
rm src/app.controller.ts src/app.service.ts src/app.controller.spec.ts
```

- [ ] **Step 2: 필요한 패키지 설치**

```bash
cd services/api
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt \
  drizzle-orm pg bcryptjs class-validator class-transformer cookie-parser helmet

npm install -D @types/passport-jwt @types/pg @types/bcryptjs @types/cookie-parser \
  drizzle-kit
```

- [ ] **Step 3: Jest가 nodenext tsconfig에서 동작하도록 package.json jest 설정 수정**

`services/api/package.json`의 `"jest"` 블록을 아래로 교체:

```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": ["ts-jest", {
      "tsconfig": {
        "module": "commonjs"
      }
    }]
  },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

- [ ] **Step 4: 루트 .gitignore에 새 env 파일 추가**

`c:/_project/my/terab/.gitignore`의 기존 `configs.env`, `secrets.env` 항목 아래에 추가:

```
api.env
web.env
infra.env
```

- [ ] **Step 5: 빌드 오류 없이 앱이 시작되는지 확인 (app.module.ts 임시 정리)**

`src/app.module.ts`를 아래 최소 상태로 교체 (이후 Task 13에서 완성):

```typescript
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```

`src/main.ts`를 아래로 교체 (이후 Task 13에서 완성):

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 6: 실행 확인**

```bash
cd services/api
npm run start:dev
```

Expected: 서버 시작 메시지 출력, 오류 없음

- [ ] **Step 7: 커밋**

```bash
cd services/api
git add package.json package-lock.json src/app.module.ts src/main.ts
git add -u src/app.controller.ts src/app.service.ts src/app.controller.spec.ts
cd ../..
git add .gitignore
git commit -m "chore: NestJS 의존성 설치 및 보일러플레이트 정리"
```

---

## Task 1: 환경변수 설정 및 로컬 셋업

**Files:**
- Create: `api.env.example` (프로젝트 루트)
- Modify: `scripts/setup-local.sh`
- Create: `services/api/drizzle.config.ts`

- [ ] **Step 1: api.env.example 생성 (프로젝트 루트)**

```bash
cat > api.env.example << 'EOF'
# Database
DATABASE_URL=postgresql://terab:changeme@localhost:5432/terab

# JWT
JWT_SECRET=change-this-to-a-long-random-string
JWT_ACCESS_EXPIRY_MS=900000
JWT_REFRESH_EXPIRY_MS=604800000

# Security
PASSWORD_PEPPER=change-this-to-a-long-random-string
CORS_ALLOWED_ORIGINS=https://drive.skypark207.com

# Owner Account (초기 구동 시 생성)
OWNER_USERNAME=owner
OWNER_NICKNAME=Owner
OWNER_PASSWORD=changeme

# RabbitMQ (현재 미사용, 향후 도메인 확장 시 사용)
RABBITMQ_URL=amqp://terab:changeme@localhost:5672

# MinIO (현재 미사용)
MINIO_ENDPOINT=
MINIO_ROOT_USER=
MINIO_PASSWORD=
MINIO_BUCKET=
EOF
```

- [ ] **Step 2: scripts/setup-local.sh를 심볼릭링크 방식으로 교체**

`scripts/setup-local.sh` 전체를 아래로 교체:

```bash
#!/bin/bash
set -e

# ─── api.env 존재 확인 ───────────────────────────────────────────
if [ ! -f api.env ]; then
  echo "ERROR: api.env 없음. 아래 명령으로 생성하세요:"
  echo "  cp api.env.example api.env"
  exit 1
fi

# ─── 누락 키 검증 ──────────────────────────────────────────────
echo "=== 환경변수 검증 ==="
MISSING=()
while IFS='=' read -r key _; do
  [[ "$key" =~ ^# || -z "$key" ]] && continue
  grep -q "^${key}=" api.env 2>/dev/null || MISSING+=("$key")
done < api.env.example

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "  ⚠ api.env 누락 키: ${MISSING[*]}"
  exit 1
fi
echo "  ✓ 모든 필수 키 확인 완료"

# ─── 심볼릭링크 생성 ────────────────────────────────────────────
echo ""
echo "=== 심볼릭링크 생성 ==="

ln -sf "$(pwd)/api.env" services/api/.env
echo "  ✓ services/api/.env → $(pwd)/api.env"

echo ""
echo "setup-local 완료. 'make api'로 서버를 기동하세요."
```

- [ ] **Step 3: drizzle.config.ts 생성**

`services/api/drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: 커밋**

```bash
git add api.env.example scripts/setup-local.sh services/api/drizzle.config.ts
git commit -m "chore: 환경변수 관리 방식 api.env 심볼릭링크로 전환"
```

---

## Task 2: Drizzle 스키마 정의

**Files:**
- Create: `src/database/schema/users.schema.ts`
- Create: `src/database/schema/refresh-tokens.schema.ts`
- Create: `src/database/schema/backup-codes.schema.ts`
- Create: `src/database/schema/index.ts`

- [ ] **Step 1: users.schema.ts 작성**

`services/api/src/database/schema/users.schema.ts`:

```typescript
import { boolean, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  nickname: varchar('nickname', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique(),
  password: varchar('password', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  resource: varchar('resource', { length: 50 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);
```

- [ ] **Step 2: refresh-tokens.schema.ts 작성**

`services/api/src/database/schema/refresh-tokens.schema.ts`:

```typescript
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  deviceId: uuid('device_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
```

- [ ] **Step 3: backup-codes.schema.ts 작성**

`services/api/src/database/schema/backup-codes.schema.ts`:

```typescript
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';

export const backupCodes = pgTable('backup_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeHash: varchar('code_hash', { length: 60 }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: schema/index.ts 작성**

`services/api/src/database/schema/index.ts`:

```typescript
export * from './users.schema.js';
export * from './refresh-tokens.schema.js';
export * from './backup-codes.schema.js';
```

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add src/database/schema/
git commit -m "feat: Drizzle 스키마 정의 (users, refresh-tokens, backup-codes)"
```

---

## Task 3: 초기 마이그레이션 파일 생성

**Files:**
- Create: `drizzle/migrations/0000_init.sql`
- Create: `drizzle/meta/_journal.json`

> 기존 Flyway V1~V4가 적용된 DB의 최종 스키마를 Drizzle 베이스라인으로 기록한다.
> V1 테이블(bigserial)은 V2에서 DROP됐으므로 포함하지 않는다.
> `CREATE TABLE IF NOT EXISTS`로 기존 DB에서 멱등성 보장.

- [ ] **Step 1: drizzle/ 디렉토리 및 meta 생성**

```bash
cd services/api
mkdir -p drizzle/migrations drizzle/meta
```

- [ ] **Step 2: 0000_init.sql 작성**

`services/api/drizzle/migrations/0000_init.sql`:

```sql
-- Drizzle 베이스라인: Flyway V2~V4 적용 후 최종 스키마
-- 기존 DB에서도 안전하게 실행되도록 IF NOT EXISTS 사용

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  nickname VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200),
  push_token VARCHAR(500),
  platform VARCHAR(10) NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_push_token ON devices(push_token);

CREATE TABLE IF NOT EXISTS two_fa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  options VARCHAR(20) NOT NULL,
  correct_num VARCHAR(2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_two_fa_challenges_user_id ON two_fa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_two_fa_challenges_status ON two_fa_challenges(status);

CREATE TABLE IF NOT EXISTS backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(60) NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON backup_codes(user_id);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(500),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_token_hash ON trusted_devices(token_hash);

-- RBAC 시드 데이터 (멱등성: INSERT ... WHERE NOT EXISTS)
INSERT INTO permissions (resource, action)
SELECT * FROM (VALUES
  ('file', 'read'), ('file', 'write'), ('file', 'delete'),
  ('share', 'create'), ('share', 'manage'),
  ('user', 'read'), ('user', 'invite'), ('user', 'manage'), ('user', 'role'),
  ('storage', 'read'), ('storage', 'manage'),
  ('system', 'monitor'), ('system', 'config'),
  ('audit', 'read')
) AS v(resource, action)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = v.resource AND action = v.action);

INSERT INTO roles (name, is_system)
SELECT * FROM (VALUES ('OWNER', true), ('ADMIN', true), ('USER', true)) AS v(name, is_system)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'USER'
  AND (p.resource || ':' || p.action) IN (
    'file:read','file:write','file:delete','share:create','storage:read'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ADMIN'
  AND (p.resource || ':' || p.action) IN (
    'file:read','file:write','file:delete','share:create','storage:read',
    'share:manage','user:read','user:invite','user:manage','storage:manage',
    'system:monitor','audit:read'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'OWNER'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: _journal.json 작성**

`services/api/drizzle/meta/_journal.json`:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1745452800000,
      "tag": "0000_init",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 4: 커밋**

```bash
cd services/api
git add drizzle/ drizzle.config.ts
git commit -m "chore: Drizzle 초기 마이그레이션 베이스라인 설정 (Flyway V1~V4 통합)"
```

---

## Task 4: DatabaseModule

**Files:**
- Create: `src/database/database.service.ts`
- Create: `src/database/database.service.spec.ts`
- Create: `src/database/database.module.ts`

- [ ] **Step 1: 테스트 작성**

`services/api/src/database/database.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('postgresql://test:test@localhost:5432/test'),
          },
        },
      ],
    }).compile();

    service = module.get(DatabaseService);
  });

  it('db 인스턴스를 노출한다', () => {
    expect(service.db).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd services/api
npm test -- --testPathPattern=database.service
```

Expected: FAIL — `database.service.ts` 없음

- [ ] **Step 3: DatabaseService 구현**

`services/api/src/database/database.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly db: NodePgDatabase<typeof schema>;
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.getOrThrow<string>('DATABASE_URL'),
      max: 5,
      idleTimeoutMillis: 60000,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit(): Promise<void> {
    await migrate(this.db, { migrationsFolder: './drizzle/migrations' });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
```

- [ ] **Step 4: DatabaseModule 구현**

`services/api/src/database/database.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
```

- [ ] **Step 5: 테스트 재실행 — 통과 확인**

```bash
cd services/api
npm test -- --testPathPattern=database.service
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd services/api
git add src/database/
git commit -m "feat: DatabaseModule 구현 (Drizzle + 마이그레이션 자동 실행)"
```

---

## Task 5: 공통 예외 처리 레이어

**Files:**
- Create: `src/common/exceptions/error-code.enum.ts`
- Create: `src/common/exceptions/api.exception.ts`
- Create: `src/common/filters/api-exception.filter.ts`
- Create: `src/common/filters/api-exception.filter.spec.ts`

- [ ] **Step 1: 테스트 작성**

`services/api/src/common/filters/api-exception.filter.spec.ts`:

```typescript
import { HttpStatus } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { ApiException } from '../exceptions/api.exception.js';
import { ErrorCode } from '../exceptions/error-code.enum.js';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
const mockGetRequest = jest.fn().mockReturnValue({ url: '/api/test' });
const mockSwitchToHttp = jest.fn().mockReturnValue({
  getResponse: mockGetResponse,
  getRequest: mockGetRequest,
});
const mockContext: any = { switchToHttp: mockSwitchToHttp };

describe('ApiExceptionFilter', () => {
  let filter: ApiExceptionFilter;

  beforeEach(() => {
    filter = new ApiExceptionFilter();
    jest.clearAllMocks();
  });

  it('ApiException을 errorCode와 message가 포함된 응답으로 처리한다', () => {
    const exception = new ApiException(ErrorCode.INVALID_CREDENTIALS);

    filter.catch(exception, mockContext);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith({
      errorCode: 'INVALID_CREDENTIALS',
      message: '아이디 또는 비밀번호가 올바르지 않습니다.',
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd services/api
npm test -- --testPathPattern=api-exception.filter
```

Expected: FAIL — 파일 없음

- [ ] **Step 3: error-code.enum.ts 구현**

`services/api/src/common/exceptions/error-code.enum.ts`:

```typescript
import { HttpStatus } from '@nestjs/common';

export interface ErrorCodeDefinition {
  message: string;
  status: HttpStatus;
}

export const ErrorCode = {
  INVALID_CREDENTIALS: {
    message: '아이디 또는 비밀번호가 올바르지 않습니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  TOKEN_EXPIRED: {
    message: '토큰이 만료되었습니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  TOKEN_INVALID: {
    message: '유효하지 않은 토큰입니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  REFRESH_TOKEN_INVALID: {
    message: 'Refresh Token이 유효하지 않습니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  FORBIDDEN: {
    message: '접근 권한이 없습니다.',
    status: HttpStatus.FORBIDDEN,
  },
  USERNAME_TAKEN: {
    message: '이미 사용 중인 아이디입니다.',
    status: HttpStatus.CONFLICT,
  },
  ACCOUNT_DISABLED: {
    message: '비활성화된 계정입니다.',
    status: HttpStatus.LOCKED,
  },
  BACKUP_CODE_INVALID: {
    message: '유효하지 않은 백업 코드입니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCodeKey = keyof typeof ErrorCode;
```

- [ ] **Step 4: api.exception.ts 구현**

`services/api/src/common/exceptions/api.exception.ts`:

```typescript
import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorCodeKey } from './error-code.enum.js';

export class ApiException extends HttpException {
  readonly errorCode: ErrorCodeKey;

  constructor(code: ErrorCodeKey) {
    const { message, status } = ErrorCode[code];
    super(message, status);
    this.errorCode = code;
  }
}
```

- [ ] **Step 5: api-exception.filter.ts 구현**

`services/api/src/common/filters/api-exception.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiException } from '../exceptions/api.exception.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json({
        errorCode: exception.errorCode,
        message: exception.message,
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({
        errorCode: 'HTTP_ERROR',
        message: exception.message,
      });
      return;
    }

    this.logger.error('예상치 못한 오류', exception instanceof Error ? exception.stack : String(exception), { url: request.url });
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: '서버 내부 오류가 발생했습니다.',
    });
  }
}
```

- [ ] **Step 6: 테스트 재실행 — 통과 확인**

```bash
cd services/api
npm test -- --testPathPattern=api-exception.filter
```

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
cd services/api
git add src/common/exceptions/ src/common/filters/
git commit -m "feat: ApiException, ErrorCode, ApiExceptionFilter 구현"
```

---

## Task 6: 공통 데코레이터

**Files:**
- Create: `src/common/decorators/public.decorator.ts`
- Create: `src/common/decorators/current-user.decorator.ts`
- Create: `src/common/decorators/require-permission.decorator.ts`

> 데코레이터는 메타데이터 정의만 하므로 별도 테스트 없이 Guard 테스트에서 통합 검증한다.

- [ ] **Step 1: public.decorator.ts**

`services/api/src/common/decorators/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: current-user.decorator.ts**

`services/api/src/common/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../auth/types/auth-user.type.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
```

- [ ] **Step 3: require-permission.decorator.ts**

`services/api/src/common/decorators/require-permission.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

- [ ] **Step 4: AuthUser 타입 정의 (데코레이터가 참조하는 타입)**

`services/api/src/auth/types/auth-user.type.ts`:

```typescript
export interface AuthUser {
  userId: string;
  username: string;
  permissions: string[];
}
```

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add src/common/decorators/ src/auth/types/
git commit -m "feat: 공통 데코레이터 구현 (@Public, @CurrentUser, @RequirePermission)"
```

---

## Task 7: JWT Strategy & JwtAuthGuard

**Files:**
- Create: `src/auth/strategies/jwt.strategy.ts`
- Create: `src/common/guards/jwt-auth.guard.ts`
- Create: `src/common/guards/jwt-auth.guard.spec.ts`

- [ ] **Step 1: 테스트 작성**

`services/api/src/common/guards/jwt-auth.guard.spec.ts`:

```typescript
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const mockGetHandler = jest.fn();
const mockGetClass = jest.fn();
const mockContext: Partial<ExecutionContext> = {
  getHandler: mockGetHandler,
  getClass: mockGetClass,
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('@Public() 라우트는 인증 없이 통과한다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const result = guard.canActivate(mockContext as ExecutionContext);
    expect(result).toBe(true);
  });

  it('@Public()이 없는 라우트는 Passport 검증을 위임한다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const superCanActivate = jest.spyOn(
      Object.getPrototypeOf(Object.getPrototypeOf(guard)),
      'canActivate',
    ).mockReturnValue(true);

    guard.canActivate(mockContext as ExecutionContext);
    expect(superCanActivate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd services/api
npm test -- --testPathPattern=jwt-auth.guard
```

Expected: FAIL

- [ ] **Step 3: JWT Strategy 구현**

`services/api/src/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../types/auth-user.type.js';

interface JwtPayload {
  sub: string;
  username: string;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      userId: payload.sub,
      username: payload.username,
      permissions: payload.permissions ?? [],
    };
  }
}
```

- [ ] **Step 4: JwtAuthGuard 구현**

`services/api/src/common/guards/jwt-auth.guard.ts`:

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 5: 테스트 재실행 — 통과 확인**

```bash
cd services/api
npm test -- --testPathPattern=jwt-auth.guard
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd services/api
git add src/auth/strategies/ src/common/guards/jwt-auth.guard.ts src/common/guards/jwt-auth.guard.spec.ts
git commit -m "feat: JwtStrategy, JwtAuthGuard 구현"
```

---

## Task 8: PermissionGuard

**Files:**
- Create: `src/common/guards/permission.guard.ts`
- Create: `src/common/guards/permission.guard.spec.ts`

- [ ] **Step 1: 테스트 작성**

`services/api/src/common/guards/permission.guard.spec.ts`:

```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard.js';
import { AuthUser } from '../../auth/types/auth-user.type.js';

function mockContext(user: AuthUser | undefined, handler: object = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionGuard(reflector);
  });

  it('@RequirePermission()이 없으면 통과한다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = mockContext({ userId: '1', username: 'u', permissions: [] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('사용자가 필요한 권한을 보유하면 통과한다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['file:read']);
    const ctx = mockContext({ userId: '1', username: 'u', permissions: ['file:read', 'file:write'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('사용자가 권한이 없으면 ForbiddenException을 던진다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system:config']);
    const ctx = mockContext({ userId: '1', username: 'u', permissions: ['file:read'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd services/api
npm test -- --testPathPattern=permission.guard
```

Expected: FAIL

- [ ] **Step 3: PermissionGuard 구현**

`services/api/src/common/guards/permission.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../../auth/types/auth-user.type.js';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user }: { user: AuthUser } = context.switchToHttp().getRequest();
    const hasAll = required.every((p) => user?.permissions?.includes(p));
    if (!hasAll) throw new ForbiddenException(ErrorCode'FORBIDDEN의 message');
    return true;
  }
}
```

> 주의: 위 코드에서 `ForbiddenException` 메시지를 `ErrorCode.FORBIDDEN.message`('접근 권한이 없습니다.')로 설정한다:

```typescript
    if (!hasAll) throw new ForbiddenException('접근 권한이 없습니다.');
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
cd services/api
npm test -- --testPathPattern=permission.guard
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add src/common/guards/permission.guard.ts src/common/guards/permission.guard.spec.ts
git commit -m "feat: PermissionGuard 구현 (RBAC 인가, 403)"
```

---

## Task 9: Auth DTOs

**Files:**
- Create: `src/auth/dto/login.dto.ts`
- Create: `src/auth/dto/backup-login.dto.ts`
- Create: `src/auth/dto/login-response.dto.ts`
- Create: `src/auth/dto/user-response.dto.ts`

- [ ] **Step 1: login.dto.ts**

`services/api/src/auth/dto/login.dto.ts`:

```typescript
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password: string;
}
```

- [ ] **Step 2: backup-login.dto.ts**

`services/api/src/auth/dto/backup-login.dto.ts`:

```typescript
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BackupLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  backupCode: string;
}
```

- [ ] **Step 3: user-response.dto.ts**

`services/api/src/auth/dto/user-response.dto.ts`:

```typescript
export class UserResponseDto {
  id: string;
  username: string;
  nickname: string;

  constructor(id: string, username: string, nickname: string) {
    this.id = id;
    this.username = username;
    this.nickname = nickname;
  }
}
```

- [ ] **Step 4: login-response.dto.ts**

`services/api/src/auth/dto/login-response.dto.ts`:

```typescript
import { UserResponseDto } from './user-response.dto.js';

export class LoginResponseDto {
  status: 'AUTHENTICATED' | '2FA_REQUIRED';
  accessToken?: string;
  user?: UserResponseDto;

  static authenticated(accessToken: string, user: UserResponseDto): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.status = 'AUTHENTICATED';
    dto.accessToken = accessToken;
    dto.user = user;
    return dto;
  }
}
```

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add src/auth/dto/
git commit -m "feat: Auth DTO 정의 (LoginDto, BackupLoginDto, LoginResponseDto, UserResponseDto)"
```

---

## Task 10: AuthRepository

**Files:**
- Create: `src/auth/auth.repository.ts`
- Create: `src/auth/auth.repository.spec.ts`

> Drizzle 쿼리를 도메인 의미의 메서드로 캡슐화한다. Service는 이 Repository만 호출하며 Drizzle 문법에 직접 의존하지 않는다.

- [ ] **Step 1: 테스트 작성**

`services/api/src/auth/auth.repository.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AuthRepository } from './auth.repository.js';
import { DatabaseService } from '../database/database.service.js';

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

const mockDatabaseService = {
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
};

describe('AuthRepository', () => {
  let repo: AuthRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    repo = module.get(AuthRepository);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd services/api
npm test -- --testPathPattern=auth.repository
```

Expected: FAIL — `auth.repository.ts` 없음

- [ ] **Step 3: AuthRepository 구현**

`services/api/src/auth/auth.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import {
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  refreshTokens,
  backupCodes,
} from '../database/schema/index.js';

export interface UserWithPermissions {
  id: string;
  username: string;
  nickname: string;
  password: string;
  active: boolean;
  permissions: string[];
}

export interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface BackupCodeRow {
  id: string;
  codeHash: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  async findUserWithPermissionsByUsername(username: string): Promise<UserWithPermissions | null> {
    const rows = await this.database.db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        password: users.password,
        active: users.active,
        resource: permissions.resource,
        action: permissions.action,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(users.username, username));

    if (!rows.length) return null;
    return this.aggregateUser(rows);
  }

  async findUserWithPermissionsById(id: string): Promise<UserWithPermissions | null> {
    const rows = await this.database.db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        password: users.password,
        active: users.active,
        resource: permissions.resource,
        action: permissions.action,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(users.id, id));

    if (!rows.length) return null;
    return this.aggregateUser(rows);
  }

  async findActiveRefreshTokens(now: Date): Promise<RefreshTokenRow[]> {
    return this.database.db
      .select()
      .from(refreshTokens)
      .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)));
  }

  async insertRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.database.db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  }

  async revokeRefreshTokenById(id: string, revokedAt: Date): Promise<void> {
    await this.database.db
      .update(refreshTokens)
      .set({ revokedAt })
      .where(eq(refreshTokens.id, id));
  }

  async findUnusedBackupCodes(userId: string): Promise<BackupCodeRow[]> {
    return this.database.db
      .select({ id: backupCodes.id, codeHash: backupCodes.codeHash })
      .from(backupCodes)
      .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
  }

  async markBackupCodeUsed(id: string, usedAt: Date): Promise<void> {
    await this.database.db
      .update(backupCodes)
      .set({ usedAt })
      .where(eq(backupCodes.id, id));
  }

  async findUserByUsername(username: string): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return rows[0] ?? null;
  }

  async findRoleByName(name: string): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);
    return rows[0] ?? null;
  }

  async insertUser(data: { username: string; nickname: string; password: string }): Promise<{ id: string }> {
    const [row] = await this.database.db
      .insert(users)
      .values(data)
      .returning({ id: users.id });
    return row;
  }

  async insertUserRole(userId: string, roleId: string): Promise<void> {
    await this.database.db.insert(userRoles).values({ userId, roleId });
  }

  private aggregateUser(
    rows: Array<{
      id: string;
      username: string;
      nickname: string;
      password: string;
      active: boolean;
      resource: string | null;
      action: string | null;
    }>,
  ): UserWithPermissions {
    const first = rows[0];
    const permSet = new Set(
      rows.filter((r) => r.resource && r.action).map((r) => `${r.resource}:${r.action}`),
    );
    return {
      id: first.id,
      username: first.username,
      nickname: first.nickname,
      password: first.password,
      active: first.active,
      permissions: [...permSet],
    };
  }
}
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
cd services/api
npm test -- --testPathPattern=auth.repository
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add src/auth/auth.repository.ts src/auth/auth.repository.spec.ts
git commit -m "feat: AuthRepository 구현 (Drizzle 쿼리 격리)"
```

---

## Task 11: AuthService

**Files:**
- Create: `src/auth/auth.service.ts`
- Create: `src/auth/auth.service.spec.ts`

> Java의 `AuthService` + `LoginUseCase` + `RefreshTokenUseCase` + `LogoutUseCase` + `GetCurrentUserUseCase` + `BackupCodeService(verifyAndConsume)`를 통합한다. DB 쿼리는 AuthRepository에 완전히 위임한다.

- [ ] **Step 1: 테스트 작성**

`services/api/src/auth/auth.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { ApiException } from '../common/exceptions/api.exception.js';

const mockAuthRepository = {
  findUserWithPermissionsByUsername: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
  findActiveRefreshTokens: jest.fn(),
  insertRefreshToken: jest.fn(),
  revokeRefreshTokenById: jest.fn(),
  findUnusedBackupCodes: jest.fn(),
  markBackupCodeUsed: jest.fn(),
  findUserByUsername: jest.fn(),
  findRoleByName: jest.fn(),
  insertUser: jest.fn(),
  insertUserRole: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.access.token'),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_ACCESS_EXPIRY_MS: '900000',
      JWT_REFRESH_EXPIRY_MS: '604800000',
      PASSWORD_PEPPER: 'test-pepper',
    };
    return config[key];
  }),
  get: jest.fn().mockReturnValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('validateCredentials', () => {
    it('비밀번호 불일치 시 ApiException(INVALID_CREDENTIALS)을 던진다', async () => {
      await expect(
        service.validateCredentials(
          { password: '$2a$10$wronghash', active: true } as any,
          'wrong-password',
        ),
      ).rejects.toThrow(ApiException);
    });

    it('비활성 계정은 ApiException(ACCOUNT_DISABLED)을 던진다', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      await expect(
        service.validateCredentials(
          { password: 'hash', active: false } as any,
          'any-password',
        ),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('generateAccessToken', () => {
    it('JwtService.sign을 호출하고 AT를 반환한다', () => {
      const user = { id: 'uuid-1', username: 'user1', permissions: ['file:read'] };
      const token = service.generateAccessToken(user as any);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'uuid-1', username: 'user1', permissions: ['file:read'] },
        expect.objectContaining({ expiresIn: expect.any(Number) }),
      );
      expect(token).toBe('mock.access.token');
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd services/api
npm test -- --testPathPattern=auth.service
```

Expected: FAIL

- [ ] **Step 3: AuthService 구현**

`services/api/src/auth/auth.service.ts`:

```typescript
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthRepository, UserWithPermissions } from './auth.repository.js';
import { ApiException } from '../common/exceptions/api.exception.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { BackupLoginDto } from './dto/backup-login.dto.js';

interface AuthTokens {
  accessToken: string;
  rawRefreshToken: string;
  refreshTokenExpMs: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly accessExpMs: number;
  private readonly refreshExpMs: number;
  private readonly pepper: string;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessExpMs = Number(this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRY_MS'));
    this.refreshExpMs = Number(this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY_MS'));
    this.pepper = this.configService.getOrThrow<string>('PASSWORD_PEPPER');
  }

  async onModuleInit(): Promise<void> {
    await this.initOwnerAccount();
  }

  // ─── Login ───────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<{ response: LoginResponseDto; rawRefreshToken: string; refreshTokenExpMs: number }> {
    const user = await this.authRepository.findUserWithPermissionsByUsername(dto.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, dto.password);

    // TODO: Push 기기 존재 시 2FA 챌린지 발급 (device, twofa 도메인 구현 후 추가)
    const tokens = await this.issueTokenPair(user);
    const response = LoginResponseDto.authenticated(
      tokens.accessToken,
      new UserResponseDto(user.id, user.username, user.nickname),
    );
    return { response, rawRefreshToken: tokens.rawRefreshToken, refreshTokenExpMs: tokens.refreshTokenExpMs };
  }

  async loginWithBackupCode(dto: BackupLoginDto): Promise<{ response: LoginResponseDto; rawRefreshToken: string; refreshTokenExpMs: number }> {
    const user = await this.authRepository.findUserWithPermissionsByUsername(dto.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, dto.password);
    await this.verifyAndConsumeBackupCode(user.id, dto.backupCode);

    const tokens = await this.issueTokenPair(user);
    const response = LoginResponseDto.authenticated(
      tokens.accessToken,
      new UserResponseDto(user.id, user.username, user.nickname),
    );
    return { response, rawRefreshToken: tokens.rawRefreshToken, refreshTokenExpMs: tokens.refreshTokenExpMs };
  }

  // ─── Refresh ─────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string | undefined): Promise<{ response: LoginResponseDto; rawRefreshToken: string; refreshTokenExpMs: number }> {
    if (!rawRefreshToken) throw new ApiException('REFRESH_TOKEN_INVALID');

    const now = new Date();
    const activeTokens = await this.authRepository.findActiveRefreshTokens(now);
    const matched = activeTokens.find((rt) => this.compareTokenHash(rawRefreshToken, rt.tokenHash));

    if (!matched) {
      // UUID 기반 토큰은 userId 클레임이 없으므로 family invalidation 불가
      // TODO: RT를 JWT로 변경하면 subject에서 userId 추출 후 전체 폐기 가능
      throw new ApiException('REFRESH_TOKEN_INVALID');
    }

    await this.authRepository.revokeRefreshTokenById(matched.id, now);

    const user = await this.authRepository.findUserWithPermissionsById(matched.userId);
    if (!user) throw new ApiException('REFRESH_TOKEN_INVALID');

    const tokens = await this.issueTokenPair(user);
    const response = LoginResponseDto.authenticated(
      tokens.accessToken,
      new UserResponseDto(user.id, user.username, user.nickname),
    );
    return { response, rawRefreshToken: tokens.rawRefreshToken, refreshTokenExpMs: tokens.refreshTokenExpMs };
  }

  // ─── Logout ──────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const now = new Date();
    const activeTokens = await this.authRepository.findActiveRefreshTokens(now);
    const matched = activeTokens.find((rt) => this.compareTokenHash(rawRefreshToken, rt.tokenHash));
    if (matched) {
      await this.authRepository.revokeRefreshTokenById(matched.id, now);
    }
  }

  // ─── Me ──────────────────────────────────────────────────────────────

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.authRepository.findUserWithPermissionsById(userId);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    return new UserResponseDto(user.id, user.username, user.nickname);
  }

  // ─── 내부 인증 로직 ──────────────────────────────────────────────────

  async validateCredentials(user: UserWithPermissions, rawPassword: string): Promise<void> {
    const pepperedPassword = this.pepperPassword(rawPassword);
    const valid = await bcrypt.compare(pepperedPassword, user.password);
    if (!valid) throw new ApiException('INVALID_CREDENTIALS');
    if (!user.active) throw new ApiException('ACCOUNT_DISABLED');
  }

  generateAccessToken(user: Pick<UserWithPermissions, 'id' | 'username' | 'permissions'>): string {
    return this.jwtService.sign(
      { sub: user.id, username: user.username, permissions: user.permissions },
      { expiresIn: Math.floor(this.accessExpMs / 1000) },
    );
  }

  // ─── 내부 비즈니스 로직 ──────────────────────────────────────────────

  private async issueTokenPair(user: UserWithPermissions): Promise<AuthTokens> {
    const accessToken = this.generateAccessToken(user);
    const rawRefreshToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpMs);
    await this.authRepository.insertRefreshToken(user.id, tokenHash, expiresAt);
    return { accessToken, rawRefreshToken, refreshTokenExpMs: this.refreshExpMs };
  }

  private async verifyAndConsumeBackupCode(userId: string, inputCode: string): Promise<void> {
    const codes = await this.authRepository.findUnusedBackupCodes(userId);
    for (const code of codes) {
      const match = await bcrypt.compare(inputCode, code.codeHash);
      if (match) {
        await this.authRepository.markBackupCodeUsed(code.id, new Date());
        return;
      }
    }
    throw new ApiException('BACKUP_CODE_INVALID');
  }

  // ─── Owner 계정 초기화 ───────────────────────────────────────────────

  private async initOwnerAccount(): Promise<void> {
    const ownerPassword = this.configService.get<string>('OWNER_PASSWORD');
    if (!ownerPassword) return;

    const ownerUsername = this.configService.get<string>('OWNER_USERNAME') ?? 'owner';
    const ownerNickname = this.configService.get<string>('OWNER_NICKNAME') ?? 'Owner';

    const existing = await this.authRepository.findUserByUsername(ownerUsername);
    if (existing) return;

    const ownerRole = await this.authRepository.findRoleByName('OWNER');
    if (!ownerRole) throw new Error('OWNER role 없음 — 마이그레이션 실행 여부를 확인하세요');

    const hashedPassword = await bcrypt.hash(this.pepperPassword(ownerPassword), 10);
    const newUser = await this.authRepository.insertUser({
      username: ownerUsername,
      nickname: ownerNickname,
      password: hashedPassword,
    });
    await this.authRepository.insertUserRole(newUser.id, ownerRole.id);
  }

  // ─── 암호화 유틸 ─────────────────────────────────────────────────────

  private pepperPassword(rawPassword: string): string {
    return crypto.createHmac('sha256', this.pepper).update(rawPassword).digest('hex');
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private compareTokenHash(rawToken: string, storedHash: string): boolean {
    const a = Buffer.from(this.hashToken(rawToken));
    const b = Buffer.from(storedHash);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
cd services/api
npm test -- --testPathPattern=auth.service
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add src/auth/auth.service.ts src/auth/auth.service.spec.ts
git commit -m "feat: AuthService 구현 (login, backup login, refresh, logout, me, owner 초기화)"
```

---

## Task 12: AuthController

**Files:**
- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.controller.spec.ts`

- [ ] **Step 1: 테스트 작성**

`services/api/src/auth/auth.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

const mockResponse = () => {
  const res: any = {};
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

const loginResult = {
  response: LoginResponseDto.authenticated('at.token', new UserResponseDto('uid', 'user1', 'User')),
  rawRefreshToken: 'raw.rt',
  refreshTokenExpMs: 604800000,
};

const mockAuthService = {
  login: jest.fn().mockResolvedValue(loginResult),
  loginWithBackupCode: jest.fn().mockResolvedValue(loginResult),
  refresh: jest.fn().mockResolvedValue(loginResult),
  logout: jest.fn().mockResolvedValue(undefined),
  getCurrentUser: jest.fn().mockResolvedValue(new UserResponseDto('uid', 'user1', 'User')),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  it('POST /login — RT 쿠키를 설정하고 LoginResponseDto를 반환한다', async () => {
    const res = mockResponse();
    const result = await controller.login({ username: 'u', password: 'p' } as any, res);
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'raw.rt', expect.objectContaining({ httpOnly: true }));
    expect(result.status).toBe('AUTHENTICATED');
  });

  it('POST /logout — RT 쿠키를 삭제한다', async () => {
    const res = mockResponse();
    await controller.logout('raw.rt', res);
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ path: '/api/auth' }));
  });

  it('GET /me — UserResponseDto를 반환한다', async () => {
    const result = await controller.me({ userId: 'uid', username: 'user1', permissions: [] });
    expect(result.id).toBe('uid');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd services/api
npm test -- --testPathPattern=auth.controller
```

Expected: FAIL

- [ ] **Step 3: AuthController 구현**

`services/api/src/auth/auth.controller.ts`:

```typescript
import {
  Controller, Post, Get, Body, Res, HttpCode, HttpStatus, CookieParam,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { BackupLoginDto } from './dto/backup-login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthUser } from './types/auth-user.type.js';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_PATH = '/api/auth';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return response;
  }

  @Public()
  @Post('login/backup')
  async loginWithBackup(@Body() dto: BackupLoginDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.loginWithBackupCode(dto);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return response;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @CookieParam(REFRESH_TOKEN_COOKIE) rawRefreshToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const { response, rawRefreshToken: newRt, refreshTokenExpMs } = await this.authService.refresh(rawRefreshToken);
    this.setRefreshTokenCookie(res, newRt, refreshTokenExpMs);
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CookieParam(REFRESH_TOKEN_COOKIE) rawRefreshToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(rawRefreshToken);
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: COOKIE_PATH });
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.authService.getCurrentUser(user.userId);
  }

  private setRefreshTokenCookie(res: Response, rawToken: string, maxAgeMs: number): void {
    res.cookie(REFRESH_TOKEN_COOKIE, rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: maxAgeMs,
      path: COOKIE_PATH,
    });
  }
}
```

> **주의:** NestJS에서 `@CookieParam`은 `@nestjs/common`에 없다. 대신 `@Req()` + `req.cookies`를 사용하거나 `cookie-parser` 미들웨어 + 커스텀 파라미터 데코레이터를 사용한다. 아래로 교체:

```typescript
import { Request } from 'express';
// ...
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    // ...
  }

  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    // ...
  }
```

최종 `auth.controller.ts`에서는 `@CookieParam` 대신 `@Req() req: Request`와 `req.cookies[REFRESH_TOKEN_COOKIE]`를 사용한다.

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
cd services/api
npm test -- --testPathPattern=auth.controller
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add src/auth/auth.controller.ts src/auth/auth.controller.spec.ts
git commit -m "feat: AuthController 구현 (login, backup, refresh, logout, me)"
```

---

## Task 13: AuthModule

**Files:**
- Create: `src/auth/auth.module.ts`

- [ ] **Step 1: AuthModule 구현**

`services/api/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        // signOptions는 AuthService.generateAccessToken에서 개별 설정
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 2: 커밋**

```bash
cd services/api
git add src/auth/auth.module.ts
git commit -m "feat: AuthModule 조립 완료"
```

---

## Task 14: 앱 부트스트랩 완성

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: app.module.ts 완성**

`services/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionGuard } from './common/guards/permission.guard.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
  ],
  providers: [
    // 전역 Guard: JwtAuthGuard(401) → PermissionGuard(403) 순서 보장
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // 전역 Exception Filter
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    // 전역 Validation Pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 2: main.ts 완성**

`services/api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());
  app.use(helmet());

  const allowedOrigins = configService
    .getOrThrow<string>('CORS_ALLOWED_ORIGINS')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 3: 전체 테스트 실행 — 통과 확인**

```bash
cd services/api
npm test
```

Expected: 모든 테스트 PASS

- [ ] **Step 4: 개발 서버 실행 확인**

`services/api/.env`가 존재한다는 가정 하에 (make setup-local 실행 후):

```bash
cd services/api
npm run start:dev
```

Expected:
- `NestFactory`가 AppModule을 로드
- DatabaseService.onModuleInit에서 마이그레이션 실행 (DB 연결 가능한 경우)
- 포트 3000에서 리스닝

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add src/app.module.ts src/main.ts
git commit -m "feat: 앱 부트스트랩 완성 (CORS, cookie-parser, helmet, 전역 Guard/Filter/Pipe)"
```

---

## Task 15: Docker 설정

**Files:**
- Create: `services/api/Dockerfile`
- Create: `services/api/docker-entrypoint.sh`
- Create: `services/api/wait-for-it.sh` (Java 버전에서 복사)

- [ ] **Step 1: wait-for-it.sh 복사**

Java 브랜치의 `wait-for-it.sh`를 현재 브랜치로 복사한다 (내용 동일):

```bash
git show origin/master:services/api/wait-for-it.sh > services/api/wait-for-it.sh
chmod +x services/api/wait-for-it.sh
```

- [ ] **Step 2: docker-entrypoint.sh 작성 (LF 저장 필수)**

`services/api/docker-entrypoint.sh`:

```sh
#!/bin/sh
# 환경변수는 docker-compose env_file로 주입됨 — 별도 secret 파일 처리 불필요
set -e

exec wait-for-it.sh db:5432 --timeout=60 -- node dist/main.js
```

파일 저장 시 LF(Unix) 줄바꿈 사용 — Docker 빌드에 포함되는 파일이므로 LF 필수.

- [ ] **Step 3: Dockerfile 작성 (LF 저장 필수)**

`services/api/Dockerfile`:

```dockerfile
# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache bash

# wait-for-it.sh 설치
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN sed -i 's/\r$//' /usr/local/bin/wait-for-it.sh && chmod +x /usr/local/bin/wait-for-it.sh

# entrypoint 설치
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

# 보안: non-root 사용자
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 빌드 결과물 및 마이그레이션 파일 복사
COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
```

- [ ] **Step 4: Docker 빌드 확인**

```bash
cd services/api
docker build -t terab-api:local .
```

Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
cd services/api
git add Dockerfile docker-entrypoint.sh wait-for-it.sh
git commit -m "chore: NestJS API Docker 설정 (Node 24 alpine, 멀티스테이지 빌드)"
```

---

## Self-Review

**Spec 커버리지 체크:**

| 설계 섹션 | 구현 Task |
|-----------|-----------|
| 디렉토리 구조 | Task 0~15 (전체 파일 생성) ✓ |
| 모듈 연결 구조 (APP_GUARD) | Task 13~14 ✓ |
| Drizzle 스키마 | Task 2 ✓ |
| 마이그레이션 전략 | Task 3~4 ✓ |
| 환경변수 (api.env 심볼릭링크) | Task 1 ✓ |
| docker-entrypoint.sh | Task 15 ✓ |
| JwtStrategy + JwtAuthGuard (401) | Task 7 ✓ |
| PermissionGuard (403) | Task 8 ✓ |
| Repository 패턴 (Drizzle 쿼리 격리) | Task 10 (AuthRepository) ✓ |
| RT HttpOnly 쿠키 (path=/api/auth) | Task 12 ✓ |
| RT Rotation | Task 11 (refresh → revokeRefreshTokenById) ✓ |
| RT family invalidation | Task 11 (TODO 주석, UUID 기반 토큰은 userId 추출 불가) ⚠ |
| 비밀번호 pepper + bcrypt | Task 11 (pepperPassword) ✓ |
| Owner 계정 초기화 | Task 11 (initOwnerAccount → AuthRepository 위임) ✓ |
| CORS wildcard 금지 | Task 14 (main.ts) ✓ |
| ValidationPipe (whitelist) | Task 14 (app.module.ts) ✓ |
| `/api/auth/login` @Public | Task 12 ✓ |
| `/api/auth/me` JWT 필요 | Task 12 (Guard 전역 적용으로 자동) ✓ |

**⚠ RT Family Invalidation 제한:**
현재 RT는 UUID 기반 랜덤 토큰으로 userId 정보를 포함하지 않는다. 재사용 감지 시 해당 사용자의 모든 RT를 폐기하려면 `refreshTokens` 테이블 조회에서 userId를 알아야 한다. `rotateRefreshToken`에서 matched RT가 없을 때 `rawRefreshToken`으로부터 userId를 알 수 없으므로 family invalidation을 구현할 수 없다. **Java 코드는 JWT 형식의 RT를 사용해 subject에서 userId를 추출**했다. 이를 맞추려면 RT도 JWT로 발급해야 하나, 현재 RT는 단순 UUID 연결 형태로 단순화했다. 추후 RT를 JWT로 변경하거나 `refresh_tokens` 테이블에 인덱스 조회를 통한 대안 구현이 필요하다.

# MQ 서비스 구축 + Device / 2FA / TrustedDevice NestJS 이식 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push 2FA 전체 플로우를 NestJS 스택으로 완성한다 — MQ 서비스(NestJS+BullMQ) 신규 구축, Device·2FA·TrustedDevice 도메인 이식, login() 2FA 분기 완성.

**Architecture:** API 서비스에 Device·2FA·TrustedDevice 모듈을 추가하고 BullMQ로 Redis에 push-challenge job을 발행한다. MQ 서비스는 독립 NestJS 앱으로 해당 job을 소비해 FCM으로 Push를 발송한다. 2FA 상태 폴링 엔드포인트는 APPROVED 시 직접 accessToken을 발급한다.

**Tech Stack:** NestJS 11, Drizzle ORM, @nestjs/bullmq (BullMQ 5), firebase-admin 12, PostgreSQL 16, Redis 7

---

## 파일 맵

### API 서비스 — 신규 생성

```
services/api/src/database/schema/
  devices.schema.ts
  two-fa-challenges.schema.ts
  trusted-devices.schema.ts

services/api/src/device/
  device.repository.ts
  device.service.ts
  device.service.spec.ts
  device.controller.ts
  device.module.ts
  dto/register-device.dto.ts
  dto/device-response.dto.ts

services/api/src/twofa/
  twofa.repository.ts
  twofa.service.ts
  twofa.service.spec.ts
  twofa.controller.ts
  twofa.module.ts
  dto/challenge-status-response.dto.ts
  dto/respond-challenge.dto.ts
  push-challenge.publisher.ts
  types/push-challenge-job.interface.ts

services/api/src/trusted-device/
  trusted-device.repository.ts
  trusted-device.service.ts
  trusted-device.service.spec.ts
  trusted-device.controller.ts
  trusted-device.module.ts
  dto/trusted-device-response.dto.ts
```

### API 서비스 — 수정

```
services/api/src/database/schema/index.ts        ← 3개 스키마 추가
services/api/src/common/exceptions/error-code.enum.ts  ← 3개 코드 추가
services/api/src/auth/dto/login-response.dto.ts  ← twoFactorRequired factory
services/api/src/auth/auth.service.ts            ← login() 2FA 분기
services/api/src/auth/auth.service.spec.ts       ← 2FA 분기 테스트
services/api/src/auth/auth.controller.ts         ← trustToken 쿠키 처리
services/api/src/auth/auth.module.ts             ← 신규 모듈 + BullMQ 등록
services/api/src/app.module.ts                   ← BullModule.forRoot + 신규 모듈
services/api/package.json                        ← @nestjs/bullmq 추가
```

### MQ 서비스 — 신규 생성

```
services/mq/
  package.json
  tsconfig.json
  nest-cli.json
  .swcrc
  Dockerfile
  src/
    main.ts
    app.module.ts
    push/
      push.worker.ts
      push.worker.spec.ts
      push.module.ts
      fcm/
        fcm.service.ts
        fcm.module.ts
    health/
      health.controller.ts
      health.module.ts
```

### 인프라 — 수정

```
docker-stack.yml           ← Redis 추가, RabbitMQ 제거, mq 서비스 추가
docker-stack.local.yml     ← 동일
.github/workflows/deploy.yml  ← mq 빌드/배포 추가
Makefile                   ← notification → mq
CLAUDE.md                  ← notification → mq 명칭 수정
```

---

## Task 1: DB 스키마 추가 + Drizzle 마이그레이션

**Files:**

- Create: `services/api/src/database/schema/devices.schema.ts`
- Create: `services/api/src/database/schema/two-fa-challenges.schema.ts`
- Create: `services/api/src/database/schema/trusted-devices.schema.ts`
- Modify: `services/api/src/database/schema/index.ts`

- [ ] **Step 1: devices 스키마 작성**

```typescript
// services/api/src/database/schema/devices.schema.ts
import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  pushToken: text('push_token').notNull().unique(),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: two-fa-challenges 스키마 작성**

```typescript
// services/api/src/database/schema/two-fa-challenges.schema.ts
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const twoFaChallenges = pgTable('two_fa_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  options: varchar('options', { length: 20 }).notNull(),
  correctNum: varchar('correct_num', { length: 2 }).notNull(),
  status: varchar('status', { length: 10 }).notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
});
```

- [ ] **Step 3: trusted-devices 스키마 작성**

```typescript
// services/api/src/database/schema/trusted-devices.schema.ts
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const trustedDevices = pgTable('trusted_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  userAgent: varchar('user_agent', { length: 500 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: schema/index.ts에 re-export 추가**

```typescript
// services/api/src/database/schema/index.ts
export * from './backup-codes.schema';
export * from './devices.schema';
export * from './refresh-tokens.schema';
export * from './trusted-devices.schema';
export * from './two-fa-challenges.schema';
export * from './users.schema';
```

- [ ] **Step 5: Drizzle 마이그레이션 생성**

```bash
cd services/api
npm run db:generate
```

Expected: `drizzle/` 폴더에 새 마이그레이션 SQL 파일 생성.
생성된 파일에 `two_fa_challenges`, `trusted_devices` CREATE TABLE이 있다면 해당 구문을 `CREATE TABLE IF NOT EXISTS`로 변경한다 (Java Flyway 마이그레이션이 이미 테이블을 생성했으므로).

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/database/schema/ services/api/drizzle/
git commit -m "chore: Device, TwoFaChallenge, TrustedDevice Drizzle 스키마 추가"
```

---

## Task 2: ErrorCode 추가 + LoginResponseDto 확장

**Files:**

- Modify: `services/api/src/common/exceptions/error-code.enum.ts`
- Modify: `services/api/src/auth/dto/login-response.dto.ts`

- [ ] **Step 1: ErrorCode에 3개 추가**

`services/api/src/common/exceptions/error-code.enum.ts`의 `BACKUP_CODE_INVALID` 항목 뒤에 추가:

```typescript
  TWO_FA_CHALLENGE_NOT_FOUND: {
    message: '2FA 챌린지를 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  DEVICE_NOT_FOUND: {
    message: '등록되지 않은 디바이스입니다.',
    status: HttpStatus.NOT_FOUND,
  },
  TRUSTED_DEVICE_NOT_FOUND: {
    message: '등록되지 않은 신뢰기기입니다.',
    status: HttpStatus.NOT_FOUND,
  },
```

- [ ] **Step 2: LoginResponseDto에 twoFactorRequired factory 추가**

`services/api/src/auth/dto/login-response.dto.ts` 전체 교체:

```typescript
import { UserResponseDto } from './user-response.dto';

export class LoginResponseDto {
  status!: 'AUTHENTICATED' | '2FA_REQUIRED';
  accessToken?: string;
  user?: UserResponseDto;
  challengeId?: string;
  options?: string[];
  expiresAt?: Date;

  static authenticated(accessToken: string, user: UserResponseDto): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.status = 'AUTHENTICATED';
    dto.accessToken = accessToken;
    dto.user = user;
    return dto;
  }

  static twoFactorRequired(challengeId: string, options: string[], expiresAt: Date): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.status = '2FA_REQUIRED';
    dto.challengeId = challengeId;
    dto.options = options;
    dto.expiresAt = expiresAt;
    return dto;
  }
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd services/api && npm run build
```

Expected: BUILD SUCCESSFUL (타입 오류 없음)

- [ ] **Step 4: 커밋**

```bash
git add services/api/src/common/exceptions/error-code.enum.ts \
        services/api/src/auth/dto/login-response.dto.ts
git commit -m "feat: ErrorCode 3개 추가, LoginResponseDto 2FA 분기 지원"
```

---

## Task 3: Device 도메인

**Files:**

- Create: `services/api/src/device/device.repository.ts`
- Create: `services/api/src/device/device.service.ts`
- Create: `services/api/src/device/device.service.spec.ts`
- Create: `services/api/src/device/device.controller.ts`
- Create: `services/api/src/device/device.module.ts`
- Create: `services/api/src/device/dto/register-device.dto.ts`
- Create: `services/api/src/device/dto/device-response.dto.ts`

- [ ] **Step 1: DTOs 작성**

```typescript
// services/api/src/device/dto/register-device.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  pushToken!: string;
}
```

```typescript
// services/api/src/device/dto/device-response.dto.ts
export class DeviceResponseDto {
  id!: string;
  pushToken!: string;
  userAgent?: string;
  createdAt!: Date;
}
```

- [ ] **Step 2: DeviceRepository 작성**

```typescript
// services/api/src/device/device.repository.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, devices } from '@terab/db';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DeviceRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsert(userId: string, pushToken: string, userAgent?: string): Promise<void> {
    await this.database.db.insert(devices).values({ userId, pushToken, userAgent }).onConflictDoUpdate({
      target: devices.pushToken,
      set: { userId, userAgent },
    });
  }

  async findByUserId(userId: string) {
    return this.database.db.select().from(devices).where(eq(devices.userId, userId));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const rows = await this.database.db
      .select()
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.userId, userId)));
    return rows[0] ?? null;
  }

  async deleteById(id: string): Promise<void> {
    await this.database.db.delete(devices).where(eq(devices.id, id));
  }
}
```

- [ ] **Step 3: DeviceService 단위 테스트 작성**

```typescript
// services/api/src/device/device.service.spec.ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DeviceRepository } from './device.repository';
import { DeviceService } from './device.service';

const mockDeviceRepository = {
  upsert: jest.fn(),
  findByUserId: jest.fn(),
  findByIdAndUserId: jest.fn(),
  deleteById: jest.fn(),
};

describe('DeviceService', () => {
  let service: DeviceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DeviceService, { provide: DeviceRepository, useValue: mockDeviceRepository }],
    }).compile();
    service = module.get(DeviceService);
    jest.clearAllMocks();
  });

  describe('remove', () => {
    it('디바이스가 없으면 ApiException(DEVICE_NOT_FOUND)을 던진다', async () => {
      mockDeviceRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.remove('device-id', 'user-id')).rejects.toThrow(ApiException);
    });

    it('디바이스가 있으면 deleteById를 호출한다', async () => {
      mockDeviceRepository.findByIdAndUserId.mockResolvedValue({ id: 'device-id' });

      await service.remove('device-id', 'user-id');

      expect(mockDeviceRepository.deleteById).toHaveBeenCalledWith('device-id');
    });
  });
});
```

- [ ] **Step 4: 테스트 실행 — FAIL 확인**

```bash
cd services/api && npm test -- --testPathPattern="device.service.spec"
```

Expected: FAIL (DeviceService 없음)

- [ ] **Step 5: DeviceService 구현**

```typescript
// services/api/src/device/device.service.ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import type { Request } from 'express';
import { DeviceRepository } from './device.repository';
import { DeviceResponseDto } from './dto/device-response.dto';

@Injectable()
export class DeviceService {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async register(userId: string, pushToken: string, userAgent?: string): Promise<void> {
    await this.deviceRepository.upsert(userId, pushToken, userAgent);
  }

  async findAll(userId: string): Promise<DeviceResponseDto[]> {
    const rows = await this.deviceRepository.findByUserId(userId);
    return rows.map((r) => ({
      id: r.id,
      pushToken: r.pushToken,
      userAgent: r.userAgent ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async remove(id: string, userId: string): Promise<void> {
    const device = await this.deviceRepository.findByIdAndUserId(id, userId);
    if (!device) throw new ApiException('DEVICE_NOT_FOUND');
    await this.deviceRepository.deleteById(id);
  }

  async findPushTokensByUserId(userId: string): Promise<string[]> {
    const rows = await this.deviceRepository.findByUserId(userId);
    return rows.map((r) => r.pushToken);
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npm test -- --testPathPattern="device.service.spec"
```

Expected: PASS

- [ ] **Step 7: DeviceController 작성**

```typescript
// services/api/src/device/device.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { Request } from 'express';
import { DeviceService } from './device.service';
import { DeviceResponseDto } from './dto/device-response.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('api/devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@Body() dto: RegisterDeviceDto, @CurrentUser() user: AuthUser, @Req() req: Request): Promise<void> {
    await this.deviceService.register(user.userId, dto.pushToken, req.headers['user-agent']);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<DeviceResponseDto[]> {
    return this.deviceService.findAll(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.deviceService.remove(id, user.userId);
  }
}
```

- [ ] **Step 8: DeviceModule 작성**

```typescript
// services/api/src/device/device.module.ts
import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceRepository } from './device.repository';
import { DeviceService } from './device.service';

@Module({
  controllers: [DeviceController],
  providers: [DeviceService, DeviceRepository],
  exports: [DeviceService],
})
export class DeviceModule {}
```

- [ ] **Step 9: AppModule에 DeviceModule 등록**

`services/api/src/app.module.ts`의 imports 배열에 `DeviceModule` 추가:

```typescript
import { DeviceModule } from './device/device.module';
// ... imports 배열에 DeviceModule 추가
```

- [ ] **Step 10: 빌드 확인**

```bash
cd services/api && npm run build
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 11: 커밋**

```bash
git add services/api/src/device/ services/api/src/app.module.ts
git commit -m "feat: Device 도메인 추가 (DEV-018)"
```

---

## Task 4: TrustedDevice 도메인

**Files:**

- Create: `services/api/src/trusted-device/trusted-device.repository.ts`
- Create: `services/api/src/trusted-device/trusted-device.service.ts`
- Create: `services/api/src/trusted-device/trusted-device.service.spec.ts`
- Create: `services/api/src/trusted-device/trusted-device.controller.ts`
- Create: `services/api/src/trusted-device/trusted-device.module.ts`
- Create: `services/api/src/trusted-device/dto/trusted-device-response.dto.ts`

- [ ] **Step 1: DTO 작성**

```typescript
// services/api/src/trusted-device/dto/trusted-device-response.dto.ts
export class TrustedDeviceResponseDto {
  id!: string;
  userAgent?: string;
  expiresAt!: Date;
  createdAt!: Date;
}
```

- [ ] **Step 2: TrustedDeviceRepository 작성**

```typescript
// services/api/src/trusted-device/trusted-device.repository.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, trustedDevices } from '@terab/db';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class TrustedDeviceRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(userId: string, tokenHash: string, userAgent: string | undefined, expiresAt: Date): Promise<void> {
    await this.database.db.insert(trustedDevices).values({ userId, tokenHash, userAgent, expiresAt });
  }

  async findByTokenHash(tokenHash: string) {
    const rows = await this.database.db.select().from(trustedDevices).where(eq(trustedDevices.tokenHash, tokenHash));
    return rows[0] ?? null;
  }

  async findByUserId(userId: string) {
    return this.database.db.select().from(trustedDevices).where(eq(trustedDevices.userId, userId));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const rows = await this.database.db
      .select()
      .from(trustedDevices)
      .where(and(eq(trustedDevices.id, id), eq(trustedDevices.userId, userId)));
    return rows[0] ?? null;
  }

  async deleteById(id: string): Promise<void> {
    await this.database.db.delete(trustedDevices).where(eq(trustedDevices.id, id));
  }
}
```

- [ ] **Step 3: TrustedDeviceService 단위 테스트 작성**

```typescript
// services/api/src/trusted-device/trusted-device.service.spec.ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TrustedDeviceRepository } from './trusted-device.repository';
import { TrustedDeviceService } from './trusted-device.service';

const mockRepo = {
  insert: jest.fn(),
  findByTokenHash: jest.fn(),
  findByUserId: jest.fn(),
  findByIdAndUserId: jest.fn(),
  deleteById: jest.fn(),
};

describe('TrustedDeviceService', () => {
  let service: TrustedDeviceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TrustedDeviceService, { provide: TrustedDeviceRepository, useValue: mockRepo }],
    }).compile();
    service = module.get(TrustedDeviceService);
    jest.clearAllMocks();
  });

  describe('verify', () => {
    it('토큰이 없으면 false를 반환한다', async () => {
      const result = await service.verify(undefined, 'user-id');
      expect(result).toBe(false);
    });

    it('DB에 토큰이 없으면 false를 반환한다', async () => {
      mockRepo.findByTokenHash.mockResolvedValue(null);
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(false);
    });

    it('만료된 토큰이면 false를 반환한다', async () => {
      mockRepo.findByTokenHash.mockResolvedValue({
        userId: 'user-id',
        expiresAt: new Date(Date.now() - 1000),
      });
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(false);
    });

    it('유효한 토큰이고 userId가 일치하면 true를 반환한다', async () => {
      mockRepo.findByTokenHash.mockResolvedValue({
        userId: 'user-id',
        expiresAt: new Date(Date.now() + 100_000),
      });
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(true);
    });
  });

  describe('revoke', () => {
    it('디바이스가 없으면 ApiException(TRUSTED_DEVICE_NOT_FOUND)을 던진다', async () => {
      mockRepo.findByIdAndUserId.mockResolvedValue(null);
      await expect(service.revoke('device-id', 'user-id')).rejects.toThrow(ApiException);
    });
  });
});
```

- [ ] **Step 4: 테스트 실행 — FAIL 확인**

```bash
cd services/api && npm test -- --testPathPattern="trusted-device.service.spec"
```

Expected: FAIL (TrustedDeviceService 없음)

- [ ] **Step 5: TrustedDeviceService 구현**

```typescript
// services/api/src/trusted-device/trusted-device.service.ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { createHash, randomUUID } from 'node:crypto';
import { TrustedDeviceRepository } from './trusted-device.repository';
import { TrustedDeviceResponseDto } from './dto/trusted-device-response.dto';

const TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TrustedDeviceService {
  constructor(private readonly trustedDeviceRepository: TrustedDeviceRepository) {}

  async register(userId: string, userAgent: string | undefined): Promise<string> {
    const rawToken = `${randomUUID()}-${randomUUID()}`;
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TRUST_DURATION_MS);
    await this.trustedDeviceRepository.insert(userId, tokenHash, userAgent, expiresAt);
    return rawToken;
  }

  async verify(rawToken: string | undefined, userId: string): Promise<boolean> {
    if (!rawToken) return false;
    const tokenHash = this.hashToken(rawToken);
    const device = await this.trustedDeviceRepository.findByTokenHash(tokenHash);
    if (!device) return false;
    if (device.userId !== userId) return false;
    if (device.expiresAt <= new Date()) return false;
    return true;
  }

  async findAll(userId: string): Promise<TrustedDeviceResponseDto[]> {
    const rows = await this.trustedDeviceRepository.findByUserId(userId);
    return rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent ?? undefined,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }

  async revoke(id: string, userId: string): Promise<void> {
    const device = await this.trustedDeviceRepository.findByIdAndUserId(id, userId);
    if (!device) throw new ApiException('TRUSTED_DEVICE_NOT_FOUND');
    await this.trustedDeviceRepository.deleteById(id);
  }

  get trustDurationMs(): number {
    return TRUST_DURATION_MS;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npm test -- --testPathPattern="trusted-device.service.spec"
```

Expected: PASS

- [ ] **Step 7: TrustedDeviceController 작성**

```typescript
// services/api/src/trusted-device/trusted-device.controller.ts
import { Controller, Delete, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TrustedDeviceService } from './trusted-device.service';
import { TrustedDeviceResponseDto } from './dto/trusted-device-response.dto';

@Controller('api/trusted-devices')
export class TrustedDeviceController {
  constructor(private readonly trustedDeviceService: TrustedDeviceService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<TrustedDeviceResponseDto[]> {
    return this.trustedDeviceService.findAll(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.trustedDeviceService.revoke(id, user.userId);
  }
}
```

- [ ] **Step 8: TrustedDeviceModule 작성**

```typescript
// services/api/src/trusted-device/trusted-device.module.ts
import { Module } from '@nestjs/common';
import { TrustedDeviceController } from './trusted-device.controller';
import { TrustedDeviceRepository } from './trusted-device.repository';
import { TrustedDeviceService } from './trusted-device.service';

@Module({
  controllers: [TrustedDeviceController],
  providers: [TrustedDeviceService, TrustedDeviceRepository],
  exports: [TrustedDeviceService],
})
export class TrustedDeviceModule {}
```

- [ ] **Step 9: AppModule에 TrustedDeviceModule 등록**

`services/api/src/app.module.ts`의 imports에 `TrustedDeviceModule` 추가.

- [ ] **Step 10: 빌드 확인**

```bash
cd services/api && npm run build
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 11: 커밋**

```bash
git add services/api/src/trusted-device/ services/api/src/app.module.ts
git commit -m "feat: TrustedDevice 도메인 추가 (DEV-015)"
```

---

## Task 5: 2FA 도메인

**Files:**

- Create: `services/api/src/twofa/types/push-challenge-job.interface.ts`
- Create: `services/api/src/twofa/push-challenge.publisher.ts`
- Create: `services/api/src/twofa/twofa.repository.ts`
- Create: `services/api/src/twofa/twofa.service.ts`
- Create: `services/api/src/twofa/twofa.service.spec.ts`
- Create: `services/api/src/twofa/dto/challenge-status-response.dto.ts`
- Create: `services/api/src/twofa/dto/respond-challenge.dto.ts`
- Create: `services/api/src/twofa/twofa.controller.ts`
- Create: `services/api/src/twofa/twofa.module.ts`
- Modify: `services/api/package.json`

- [ ] **Step 1: @nestjs/bullmq 의존성 추가**

```bash
cd services/api && npm install @nestjs/bullmq bullmq
```

- [ ] **Step 2: PushChallengeJob 인터페이스 작성**

```typescript
// services/api/src/twofa/types/push-challenge-job.interface.ts
export interface PushChallengeJob {
  userId: string;
  pushToken: string;
  challengeId: string;
  options: string; // "47,82,13"
  expiresAt: string; // ISO 8601
}
```

- [ ] **Step 3: PushChallengePublisher 작성**

```typescript
// services/api/src/twofa/push-challenge.publisher.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { PushChallengeJob } from './types/push-challenge-job.interface';

export const PUSH_CHALLENGE_QUEUE = 'push-challenge';

@Injectable()
export class PushChallengePublisher {
  constructor(@InjectQueue(PUSH_CHALLENGE_QUEUE) private readonly queue: Queue<PushChallengeJob>) {}

  async publish(job: PushChallengeJob): Promise<void> {
    await this.queue.add('send', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}
```

- [ ] **Step 4: DTOs 작성**

```typescript
// services/api/src/twofa/dto/challenge-status-response.dto.ts
import { UserResponseDto } from '../../auth/dto/user-response.dto';

export class ChallengeStatusResponseDto {
  status!: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  options?: string[];
  remainingSeconds?: number;
  accessToken?: string;
  user?: UserResponseDto;

  static pending(options: string[], remainingSeconds: number): ChallengeStatusResponseDto {
    const dto = new ChallengeStatusResponseDto();
    dto.status = 'PENDING';
    dto.options = options;
    dto.remainingSeconds = remainingSeconds;
    return dto;
  }

  static approved(accessToken: string, user: UserResponseDto): ChallengeStatusResponseDto {
    const dto = new ChallengeStatusResponseDto();
    dto.status = 'APPROVED';
    dto.accessToken = accessToken;
    dto.user = user;
    return dto;
  }

  static denied(): ChallengeStatusResponseDto {
    const dto = new ChallengeStatusResponseDto();
    dto.status = 'DENIED';
    return dto;
  }
}
```

```typescript
// services/api/src/twofa/dto/respond-challenge.dto.ts
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class RespondChallengeDto {
  @IsString()
  @Matches(/^\d{2}$/)
  selectedNumber!: string;

  @IsBoolean()
  @IsOptional()
  trustDevice?: boolean;
}
```

- [ ] **Step 5: TwoFaRepository 작성**

```typescript
// services/api/src/twofa/twofa.repository.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, twoFaChallenges, users, permissions, userRoles, roles, rolePermissions } from '@terab/db';
import { eq } from 'drizzle-orm';

export interface TwoFaChallengeRow {
  id: string;
  userId: string;
  options: string;
  correctNum: string;
  status: string;
  expiresAt: Date;
  respondedAt: Date | null;
}

@Injectable()
export class TwoFaRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(data: { userId: string; options: string; correctNum: string; expiresAt: Date }): Promise<TwoFaChallengeRow> {
    const rows = await this.database.db.insert(twoFaChallenges).values(data).returning();
    return rows[0] as TwoFaChallengeRow;
  }

  async findById(id: string): Promise<TwoFaChallengeRow | null> {
    const rows = await this.database.db.select().from(twoFaChallenges).where(eq(twoFaChallenges.id, id));
    return (rows[0] as TwoFaChallengeRow) ?? null;
  }

  async updateStatus(id: string, status: string, respondedAt?: Date): Promise<void> {
    await this.database.db
      .update(twoFaChallenges)
      .set({ status, respondedAt: respondedAt ?? null })
      .where(eq(twoFaChallenges.id, id));
  }

  async findUserWithPermissionsById(userId: string) {
    const rows = await this.database.db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        resource: permissions.resource,
        action: permissions.action,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(users.id, userId));
    if (!rows.length) return null;
    const first = rows[0];
    return {
      id: first.id,
      username: first.username,
      nickname: first.nickname,
      permissions: rows.filter((r) => r.resource && r.action).map((r) => `${r.resource}:${r.action}`),
    };
  }
}
```

- [ ] **Step 6: TwoFaService 단위 테스트 작성**

```typescript
// services/api/src/twofa/twofa.service.spec.ts
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

const mockTwoFaRepository = {
  insert: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.access.token'),
};

describe('TwoFaService', () => {
  let service: TwoFaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TwoFaService, { provide: TwoFaRepository, useValue: mockTwoFaRepository }, { provide: JwtService, useValue: mockJwtService }],
    }).compile();
    service = module.get(TwoFaService);
    jest.clearAllMocks();
  });

  describe('createChallenge', () => {
    it('3개의 2자리 숫자 options를 생성한다', async () => {
      mockTwoFaRepository.insert.mockImplementation(async (data) => ({ id: 'challenge-id', ...data }));

      const result = await service.createChallenge('user-id');

      const parts = result.options.split(',');
      expect(parts).toHaveLength(3);
      parts.forEach((p) => {
        const n = parseInt(p, 10);
        expect(n).toBeGreaterThanOrEqual(10);
        expect(n).toBeLessThanOrEqual(99);
      });
    });

    it('correctNum은 options 중 하나다', async () => {
      mockTwoFaRepository.insert.mockImplementation(async (data) => ({ id: 'challenge-id', ...data }));

      const result = await service.createChallenge('user-id');

      expect(result.options.split(',')).toContain(result.correctNum);
    });
  });

  describe('respond', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.respond('id', 'userId', '47', false)).rejects.toThrow(ApiException);
    });

    it('소유자가 다르면 ApiException(FORBIDDEN)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'other-user',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await expect(service.respond('id', 'user-id', '47', false)).rejects.toThrow(ApiException);
    });

    it('이미 처리된 챌린지는 아무것도 하지 않는다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await service.respond('id', 'user-id', '47', false);

      expect(mockTwoFaRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('정답이면 APPROVED로 변경한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await service.respond('id', 'user-id', '47', false);

      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'APPROVED', expect.any(Date));
    });

    it('오답이면 DENIED로 변경한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await service.respond('id', 'user-id', '82', false);

      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'DENIED', expect.any(Date));
    });
  });
});
```

- [ ] **Step 7: 테스트 실행 — FAIL 확인**

```bash
cd services/api && npm test -- --testPathPattern="twofa.service.spec"
```

Expected: FAIL (TwoFaService 없음)

- [ ] **Step 8: TwoFaService 구현**

```typescript
// services/api/src/twofa/twofa.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiException } from '@terab/common';
import { randomInt } from 'node:crypto';
import { UserResponseDto } from '../auth/dto/user-response.dto';
import { ChallengeStatusResponseDto } from './dto/challenge-status-response.dto';
import { TwoFaRepository } from './twofa.repository';

const CHALLENGE_EXPIRY_MS = 60_000;

@Injectable()
export class TwoFaService {
  constructor(
    private readonly twoFaRepository: TwoFaRepository,
    private readonly jwtService: JwtService,
  ) {}

  async createChallenge(userId: string) {
    const optionNums = this.generateOptions();
    const options = optionNums.join(',');
    const correctNum = optionNums[randomInt(3)].toString();
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MS);
    return this.twoFaRepository.insert({ userId, options, correctNum, expiresAt });
  }

  async getStatus(challengeId: string): Promise<ChallengeStatusResponseDto> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');

    if (challenge.status === 'PENDING' && challenge.expiresAt <= new Date()) {
      await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
      return ChallengeStatusResponseDto.denied();
    }

    if (challenge.status === 'PENDING') {
      const remainingSeconds = Math.max(0, Math.floor((challenge.expiresAt.getTime() - Date.now()) / 1000));
      return ChallengeStatusResponseDto.pending(challenge.options.split(','), remainingSeconds);
    }

    if (challenge.status === 'APPROVED') {
      const user = await this.twoFaRepository.findUserWithPermissionsById(challenge.userId);
      if (!user) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
      const accessToken = this.jwtService.sign({ sub: user.id, username: user.username, permissions: user.permissions }, { expiresIn: 900 });
      return ChallengeStatusResponseDto.approved(accessToken, new UserResponseDto(user.id, user.username, user.nickname));
    }

    return ChallengeStatusResponseDto.denied();
  }

  async respond(challengeId: string, userId: string, selectedNumber: string, _trustDevice: boolean): Promise<void> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    if (challenge.userId !== userId) throw new ApiException('FORBIDDEN');

    // 이미 처리된 챌린지 — 브루트포스 방지: 맞음/틀림 미노출
    if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) return;

    if (challenge.correctNum === selectedNumber) {
      await this.twoFaRepository.updateStatus(challengeId, 'APPROVED', new Date());
    } else {
      await this.twoFaRepository.updateStatus(challengeId, 'DENIED', new Date());
    }
  }

  async resend(oldChallengeId: string): Promise<{ id: string; options: string[]; expiresAt: Date }> {
    const old = await this.twoFaRepository.findById(oldChallengeId);
    if (!old) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    if (old.status === 'PENDING') {
      await this.twoFaRepository.updateStatus(oldChallengeId, 'EXPIRED');
    }
    const challenge = await this.createChallenge(old.userId);
    return { id: challenge.id, options: challenge.options.split(','), expiresAt: challenge.expiresAt };
  }

  private generateOptions(): number[] {
    const nums = new Set<number>();
    while (nums.size < 3) {
      nums.add(10 + randomInt(90));
    }
    return Array.from(nums);
  }
}
```

- [ ] **Step 9: 테스트 통과 확인**

```bash
npm test -- --testPathPattern="twofa.service.spec"
```

Expected: PASS (6 tests)

- [ ] **Step 10: TwoFaController 작성**

```typescript
// services/api/src/twofa/twofa.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { ChallengeStatusResponseDto } from './dto/challenge-status-response.dto';
import { RespondChallengeDto } from './dto/respond-challenge.dto';
import { TwoFaService } from './twofa.service';

const TRUST_TOKEN_COOKIE = 'trustToken';

@Controller('api/auth/2fa')
export class TwoFaController {
  constructor(
    private readonly twoFaService: TwoFaService,
    private readonly trustedDeviceService: TrustedDeviceService,
  ) {}

  @Public()
  @Get('challenge/:id/status')
  async getStatus(@Param('id') id: string): Promise<ChallengeStatusResponseDto> {
    return this.twoFaService.getStatus(id);
  }

  @Post('challenge/:id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondChallengeDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.twoFaService.respond(id, user.userId, dto.selectedNumber, dto.trustDevice ?? false);

    if (dto.trustDevice) {
      const rawToken = await this.trustedDeviceService.register(user.userId, req.headers['user-agent']);
      res.cookie(TRUST_TOKEN_COOKIE, rawToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: this.trustedDeviceService.trustDurationMs,
      });
    }
  }

  @Public()
  @Post('challenge/:id/resend')
  async resend(@Param('id') id: string): Promise<{ challengeId: string; options: string[]; expiresAt: Date }> {
    const result = await this.twoFaService.resend(id);
    return { challengeId: result.id, options: result.options, expiresAt: result.expiresAt };
  }
}
```

- [ ] **Step 11: TwoFaModule 작성**

```typescript
// services/api/src/twofa/twofa.module.ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TrustedDeviceModule } from '../trusted-device/trusted-device.module';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { TwoFaController } from './twofa.controller';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    TrustedDeviceModule,
  ],
  controllers: [TwoFaController],
  providers: [TwoFaService, TwoFaRepository, PushChallengePublisher],
  exports: [TwoFaService, PushChallengePublisher],
})
export class TwoFaModule {}
```

- [ ] **Step 12: AppModule에 BullModule.forRoot + TwoFaModule 등록**

`services/api/src/app.module.ts` 전체 교체:

```typescript
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ApiExceptionFilter, JwtAuthGuard, PermissionGuard } from '@terab/common';
import { DatabaseModule } from '@terab/db';
import { AuthModule } from './auth/auth.module';
import { DeviceModule } from './device/device.module';
import { HealthModule } from './health/health.module';
import { TrustedDeviceModule } from './trusted-device/trusted-device.module';
import { TwoFaModule } from './twofa/twofa.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: Number(config.getOrThrow<string>('REDIS_PORT')),
        },
      }),
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    DeviceModule,
    TwoFaModule,
    TrustedDeviceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
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

- [ ] **Step 13: 빌드 확인**

```bash
cd services/api && npm run build
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 14: 커밋**

```bash
git add services/api/src/twofa/ \
        services/api/src/app.module.ts \
        services/api/package.json \
        services/api/package-lock.json
git commit -m "feat: TwoFa 도메인 추가 (DEV-012)"
```

---

## Task 6: login() 2FA 분기 완성

**Files:**

- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`
- Modify: `services/api/src/auth/auth.controller.ts`
- Modify: `services/api/src/auth/auth.module.ts`

- [ ] **Step 1: AuthService login() 2FA 분기 테스트 추가**

`services/api/src/auth/auth.service.spec.ts`에 다음 테스트를 `describe('login')` 블록 내 기존 테스트 뒤에 추가:

```typescript
// auth.service.spec.ts — describe('login') 내부에 추가

it('디바이스가 없으면 즉시 AUTHENTICATED를 반환한다', async () => {
  mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  mockTrustedDeviceService.verify.mockResolvedValue(false);
  mockDeviceService.findPushTokensByUserId.mockResolvedValue([]);

  const result = await service.login({ username: 'user1', password: 'pw' }, undefined, undefined);

  expect(result.response.status).toBe('AUTHENTICATED');
});

it('신뢰기기 토큰이 유효하면 2FA 없이 AUTHENTICATED를 반환한다', async () => {
  mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  mockTrustedDeviceService.verify.mockResolvedValue(true);

  const result = await service.login({ username: 'user1', password: 'pw' }, 'valid-trust-token', undefined);

  expect(result.response.status).toBe('AUTHENTICATED');
  expect(mockDeviceService.findPushTokensByUserId).not.toHaveBeenCalled();
});

it('디바이스가 있으면 2FA_REQUIRED를 반환한다', async () => {
  mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  mockTrustedDeviceService.verify.mockResolvedValue(false);
  mockDeviceService.findPushTokensByUserId.mockResolvedValue(['push-token-abc']);
  mockTwoFaService.createChallenge.mockResolvedValue({
    id: 'challenge-id',
    options: '47,82,13',
    expiresAt: new Date(Date.now() + 60_000),
  });

  const result = await service.login({ username: 'user1', password: 'pw' }, undefined, undefined);

  expect(result.response.status).toBe('2FA_REQUIRED');
  expect(mockPushChallengePublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ pushToken: 'push-token-abc' }));
});
```

`auth.service.spec.ts` 상단 mock 섹션에도 다음을 추가:

```typescript
const mockDeviceService = {
  findPushTokensByUserId: jest.fn(),
};

const mockTwoFaService = {
  createChallenge: jest.fn(),
};

const mockTrustedDeviceService = {
  verify: jest.fn(),
};

const mockPushChallengePublisher = {
  publish: jest.fn(),
};
```

그리고 `Test.createTestingModule` providers에 추가:

```typescript
{ provide: DeviceService, useValue: mockDeviceService },
{ provide: TwoFaService, useValue: mockTwoFaService },
{ provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
{ provide: PushChallengePublisher, useValue: mockPushChallengePublisher },
```

imports도 추가:

```typescript
import { DeviceService } from '../device/device.service';
import { TwoFaService } from '../twofa/twofa.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher';
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd services/api && npm test -- --testPathPattern="auth.service.spec"
```

Expected: FAIL (login() 2FA 분기 미구현)

- [ ] **Step 3: AuthService login() 2FA 분기 구현**

`services/api/src/auth/auth.service.ts`의 `login()` 메서드 내 TODO 주석 제거 후 전체 메서드 교체:

```typescript
  async login(
    dto: LoginDto,
    trustToken: string | undefined,
    userAgent: string | undefined,
  ): Promise<{
    response: LoginResponseDto;
    rawRefreshToken?: string;
    refreshTokenExpMs?: number;
  }> {
    const user = await this.authRepository.findUserWithPermissionsByUsername(dto.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, dto.password);

    // 신뢰기기 쿠키 유효 시 2FA 스킵
    if (trustToken && await this.trustedDeviceService.verify(trustToken, user.id)) {
      const tokens = await this.issueTokenPair(user);
      return {
        response: LoginResponseDto.authenticated(
          tokens.accessToken,
          new UserResponseDto(user.id, user.username, user.nickname),
        ),
        rawRefreshToken: tokens.rawRefreshToken,
        refreshTokenExpMs: tokens.refreshTokenExpMs,
      };
    }

    // pushToken 없으면 2FA 스킵
    const pushTokens = await this.deviceService.findPushTokensByUserId(user.id);
    if (pushTokens.length === 0) {
      const tokens = await this.issueTokenPair(user);
      return {
        response: LoginResponseDto.authenticated(
          tokens.accessToken,
          new UserResponseDto(user.id, user.username, user.nickname),
        ),
        rawRefreshToken: tokens.rawRefreshToken,
        refreshTokenExpMs: tokens.refreshTokenExpMs,
      };
    }

    // 2FA 챌린지 생성 + BullMQ 발행
    const challenge = await this.twoFaService.createChallenge(user.id);
    await Promise.all(
      pushTokens.map((pushToken) =>
        this.pushChallengePublisher.publish({
          userId: user.id,
          pushToken,
          challengeId: challenge.id,
          options: challenge.options,
          expiresAt: challenge.expiresAt.toISOString(),
        }),
      ),
    );

    return {
      response: LoginResponseDto.twoFactorRequired(
        challenge.id,
        challenge.options.split(','),
        challenge.expiresAt,
      ),
    };
  }
```

`AuthService` constructor에 의존성 추가:

```typescript
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly deviceService: DeviceService,
    private readonly twoFaService: TwoFaService,
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly pushChallengePublisher: PushChallengePublisher,
  ) { ... }
```

상단 imports 추가:

```typescript
import { DeviceService } from '../device/device.service';
import { TwoFaService } from '../twofa/twofa.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher';
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- --testPathPattern="auth.service.spec"
```

Expected: PASS

- [ ] **Step 5: AuthController — trustToken 쿠키 전달 + 조건부 RT 쿠키 설정**

`services/api/src/auth/auth.controller.ts`의 `login()` 메서드 교체:

```typescript
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const trustToken = req.cookies?.['trustToken'] as string | undefined;
    const userAgent = req.headers['user-agent'];
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.login(
      dto,
      trustToken,
      userAgent,
    );
    if (rawRefreshToken && refreshTokenExpMs) {
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    }
    return response;
  }
```

- [ ] **Step 6: AuthModule에 신규 모듈 + BullMQ 큐 추가**

`services/api/src/auth/auth.module.ts` 전체 교체:

```typescript
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DeviceModule } from '../device/device.module';
import { TrustedDeviceModule } from '../trusted-device/trusted-device.module';
import { TwoFaModule } from '../twofa/twofa.module';
import { PUSH_CHALLENGE_QUEUE } from '../twofa/push-challenge.publisher';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        signOptions: { algorithm: 'HS256' },
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    DeviceModule,
    TwoFaModule,
    TrustedDeviceModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 7: 전체 테스트 + 빌드 확인**

```bash
cd services/api && npm test && npm run build
```

Expected: 모든 테스트 PASS, BUILD SUCCESSFUL

- [ ] **Step 8: 커밋**

```bash
git add services/api/src/auth/
git commit -m "feat: login() 2FA 분기 완성 (DEV-012)"
```

---

## Task 7: MQ 서비스 구축

**Files:**

- Create: `services/mq/package.json`
- Create: `services/mq/tsconfig.json`
- Create: `services/mq/nest-cli.json`
- Create: `services/mq/.swcrc`
- Create: `services/mq/src/main.ts`
- Create: `services/mq/src/app.module.ts`
- Create: `services/mq/src/push/push.worker.ts`
- Create: `services/mq/src/push/push.worker.spec.ts`
- Create: `services/mq/src/push/push.module.ts`
- Create: `services/mq/src/push/fcm/fcm.service.ts`
- Create: `services/mq/src/push/fcm/fcm.module.ts`
- Create: `services/mq/src/health/health.controller.ts`
- Create: `services/mq/src/health/health.module.ts`
- Create: `services/mq/Dockerfile`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "mq",
  "version": "0.0.1",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "test": "jest"
  },
  "dependencies": {
    "@nestjs/bullmq": "^10.2.3",
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.4",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "bullmq": "^5.56.0",
    "firebase-admin": "^13.4.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@swc/cli": "^0.8.1",
    "@swc/core": "^1.15.30",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.0.0",
    "jest": "^30.0.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "strict": true
  }
}
```

- [ ] **Step 3: nest-cli.json 작성**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "builder": {
      "type": "swc",
      "options": { "swcrcPath": ".swcrc" }
    },
    "typeCheck": true,
    "deleteOutDir": true
  }
}
```

- [ ] **Step 4: .swcrc 작성**

`services/api/.swcrc`를 복사해 `services/mq/.swcrc`로 생성한다.

```bash
cp services/api/.swcrc services/mq/.swcrc
```

- [ ] **Step 5: PushChallengeJob 인터페이스 작성**

```typescript
// services/mq/src/push/push-challenge-job.interface.ts
export interface PushChallengeJob {
  userId: string;
  pushToken: string;
  challengeId: string;
  options: string; // "47,82,13"
  expiresAt: string; // ISO 8601
}
```

- [ ] **Step 6: FcmService 작성**

```typescript
// services/mq/src/push/fcm/fcm.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message, type Messaging } from 'firebase-admin/messaging';
import { readFileSync } from 'node:fs';
import type { PushChallengeJob } from '../push-challenge-job.interface';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging!: Messaging;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const credentialPath = this.configService.getOrThrow<string>('FIREBASE_CREDENTIAL_PATH');
    const credential = JSON.parse(readFileSync(credentialPath, 'utf-8')) as object;
    const app = initializeApp({ credential: cert(credential as Parameters<typeof cert>[0]) });
    this.messaging = getMessaging(app);
  }

  async send(job: PushChallengeJob): Promise<void> {
    const message: Message = {
      token: job.pushToken,
      data: {
        type: '2FA_CHALLENGE',
        challengeId: job.challengeId,
        options: job.options,
        expiresAt: job.expiresAt,
        deeplink: `/auth/2fa/${job.challengeId}`,
      },
      notification: {
        title: '로그인 승인 요청',
        body: '모바일 앱에서 숫자를 선택해 로그인을 승인해 주세요.',
      },
    };
    try {
      await this.messaging.send(message);
    } catch (e) {
      throw new Error(`FCM 전송 실패: ${(e as Error).message}`);
    }
  }
}
```

- [ ] **Step 7: FcmModule 작성**

```typescript
// services/mq/src/push/fcm/fcm.module.ts
import { Module } from '@nestjs/common';
import { FcmService } from './fcm.service';

@Module({
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
```

- [ ] **Step 8: PushWorker 단위 테스트 작성**

```typescript
// services/mq/src/push/push.worker.spec.ts
import { Test } from '@nestjs/testing';
import { FcmService } from './fcm/fcm.service';
import { PushWorker } from './push.worker';

const mockFcmService = {
  send: jest.fn(),
};

describe('PushWorker', () => {
  let worker: PushWorker;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PushWorker, { provide: FcmService, useValue: mockFcmService }],
    }).compile();
    worker = module.get(PushWorker);
    jest.clearAllMocks();
  });

  it('job.data를 FcmService.send에 전달한다', async () => {
    const jobData = {
      userId: 'user-id',
      pushToken: 'token',
      challengeId: 'challenge-id',
      options: '47,82,13',
      expiresAt: new Date().toISOString(),
    };

    await worker.process({ data: jobData } as any);

    expect(mockFcmService.send).toHaveBeenCalledWith(jobData);
  });

  it('FcmService.send가 실패하면 에러를 전파한다', async () => {
    mockFcmService.send.mockRejectedValue(new Error('FCM 전송 실패'));

    await expect(worker.process({ data: {} } as any)).rejects.toThrow('FCM 전송 실패');
  });
});
```

- [ ] **Step 9: 테스트 실행 — FAIL 확인**

```bash
cd services/mq && npm install && npm test
```

Expected: FAIL (PushWorker 없음)

- [ ] **Step 10: PushWorker 구현**

```typescript
// services/mq/src/push/push.worker.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { FcmService } from './fcm/fcm.service';
import type { PushChallengeJob } from './push-challenge-job.interface';

@Processor('push-challenge')
export class PushWorker extends WorkerHost {
  private readonly logger = new Logger(PushWorker.name);

  constructor(private readonly fcmService: FcmService) {
    super();
  }

  async process(job: Job<PushChallengeJob>): Promise<void> {
    await this.fcmService.send(job.data);
  }
}
```

- [ ] **Step 11: 테스트 통과 확인**

```bash
npm test
```

Expected: PASS (2 tests)

- [ ] **Step 12: PushModule 작성**

```typescript
// services/mq/src/push/push.module.ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FcmModule } from './fcm/fcm.module';
import { PushWorker } from './push.worker';

@Module({
  imports: [BullModule.registerQueue({ name: 'push-challenge' }), FcmModule],
  providers: [PushWorker],
})
export class PushModule {}
```

- [ ] **Step 13: HealthModule + Controller 작성**

```typescript
// services/mq/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
```

```typescript
// services/mq/src/health/health.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

- [ ] **Step 14: AppModule + main.ts 작성**

```typescript
// services/mq/src/app.module.ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PushModule } from './push/push.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: Number(config.getOrThrow<string>('REDIS_PORT')),
        },
      }),
    }),
    PushModule,
    HealthModule,
  ],
})
export class AppModule {}
```

```typescript
// services/mq/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 15: Dockerfile 작성**

```dockerfile
# services/mq/Dockerfile
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json .swcrc ./
COPY src ./src
RUN npm run build

FROM node:24-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

CMD ["node", "dist/main"]
```

- [ ] **Step 16: 빌드 확인**

```bash
cd services/mq && npm run build
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 17: 커밋**

```bash
git add services/mq/
git commit -m "feat: MQ 서비스 구축 (NestJS + BullMQ + FCM)"
```

---

## Task 8: 인프라 변경

**Files:**

- Modify: `docker-stack.yml`
- Modify: `docker-stack.local.yml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `Makefile`
- Modify: `CLAUDE.md`

- [ ] **Step 1: docker-stack.yml — RabbitMQ 제거 + Redis + MQ 서비스 추가**

`docker-stack.yml`에서 `rabbitmq` 서비스 블록 전체를 다음으로 교체:

```yaml
# ─── Redis (BullMQ 브로커) ────────────────────────────────────
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes
  volumes:
    - /volume2/docker/terab/volumes/redis:/data
  networks:
    - terab-net
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 5s
    retries: 5
  deploy:
    replicas: 1
    placement:
      constraints:
        - node.role == manager
    restart_policy:
      condition: any
      delay: 5s
      window: 60s
```

주석 처리된 `notification` 서비스 블록 전체를 다음으로 교체:

```yaml
# ─── MQ 서비스 (BullMQ Worker) ───────────────────────────────
mq:
  image: ghcr.io/idenn207/terab-mq:latest
  env_file:
    - mq.env
  networks:
    - terab-net
  healthcheck:
    test: ['CMD-SHELL', 'wget -qO /dev/null http://0.0.0.0:3001/health || exit 1']
    interval: 15s
    timeout: 10s
    retries: 3
    start_period: 30s
  deploy:
    replicas: 1
    restart_policy:
      condition: any
      delay: 10s
      window: 120s
```

- [ ] **Step 2: mq.env.example 파일 생성**

```bash
# mq.env.example
REDIS_HOST=redis
REDIS_PORT=6379
FIREBASE_CREDENTIAL_PATH=/run/secrets/firebase_credential
```

- [ ] **Step 3: docker-stack.local.yml — RabbitMQ 제거 + Redis + MQ 추가**

기존 `rabbitmq` 오버라이드 블록을 제거하고 다음을 추가:

```yaml
redis:
  volumes:
    - ./volumes/redis:/data
  ports:
    - '6379:6379'
  deploy:
    placement:
      constraints: []

mq:
  image: terab-mq:local
  deploy:
    replicas: 1
```

- [ ] **Step 4: api.env.example에 Redis 환경변수 추가**

기존 `api.env.example`에 추가:

```bash
REDIS_HOST=redis
REDIS_PORT=6379
```

- [ ] **Step 5: CI/CD (.github/workflows/deploy.yml)에 mq 빌드 추가**

주석 처리된 `test-notification` job을 다음 job으로 교체:

```yaml
test-mq:
  name: Test (mq)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Set up Node 24
      uses: actions/setup-node@v6
      with:
        node-version: 24
        cache: npm
        cache-dependency-path: services/mq/package-lock.json
    - name: MQ build & type check
      working-directory: services/mq
      run: |
        npm ci
        npm run build
    - name: MQ tests
      working-directory: services/mq
      run: npm test
```

`build-push` 단계에서 api, web 이미지를 빌드하는 부분 뒤에 mq 이미지 빌드 추가:

```yaml
- name: Build and push mq
  uses: docker/build-push-action@v6
  with:
    context: services/mq
    push: ${{ github.event_name == 'push' }}
    tags: ghcr.io/idenn207/terab-mq:latest
```

- [ ] **Step 6: Makefile — notification → mq**

Makefile에서 `notification` 관련 타겟을 `mq`로 변경한다.

기존:

```makefile
notification:
  cd services/notification && ...
```

변경:

```makefile
mq:
  cd services/mq && npm run start:dev
```

- [ ] **Step 7: CLAUDE.md 명칭 수정**

`CLAUDE.md`에서:

- `make notification` → `make mq`
- `notification/ # Notification MS (RabbitMQ + FCM) — 별도 Spring Boot 서비스` →
  `mq/           # MQ 서비스 (BullMQ Worker + FCM) — 별도 NestJS 서비스`

- [ ] **Step 8: 커밋**

```bash
git add docker-stack.yml docker-stack.local.yml \
        .github/workflows/deploy.yml \
        Makefile CLAUDE.md \
        mq.env.example
git commit -m "chore: MQ 서비스 인프라 전환 (RabbitMQ → Redis+BullMQ)"
```

---

## Self-Review

**스펙 커버리지 체크:**

| 스펙 항목                                                 | Task                       |
| --------------------------------------------------------- | -------------------------- |
| MQ 서비스 (NestJS + BullMQ worker + FCM)                  | Task 7                     |
| Redis 인프라 전환 (RabbitMQ 제거)                         | Task 8                     |
| Device 도메인 (register, list, remove)                    | Task 3                     |
| TrustedDevice 도메인 (register, verify, list, revoke)     | Task 4                     |
| 2FA 도메인 (createChallenge, getStatus, respond, resend)  | Task 5                     |
| login() 2FA 분기 (TrustedDevice 체크 → Device 체크 → 2FA) | Task 6                     |
| loginResponseDto.twoFactorRequired                        | Task 2                     |
| trustToken 쿠키 설정 (respond 시)                         | Task 5 Step 10             |
| options 타입 변환 (DB: string → API: string[])            | Task 5 Step 8 (split(',')) |
| BullMQ job 재시도 (attempts: 3, exponential backoff)      | Task 5 Step 3              |
| APPROVED 시 accessToken 발급 (TwoFaService.getStatus)     | Task 5 Step 8              |

**플레이스홀더 스캔:** 없음.

**타입 일관성:**

- `PushChallengeJob` 인터페이스: API(`services/api/src/twofa/types/`) 와 MQ(`services/mq/src/push/`) 양쪽에 동일 구조로 선언됨.
- `challenge.options`: DB 저장/BullMQ payload는 `"47,82,13"` (string), API 응답은 `string[]` — `split(',')` 변환은 TwoFaService 내에서 일관되게 처리.
- `TwoFaService.resend()`가 반환하는 `id` 필드를 TwoFaController에서 `challengeId`로 rename해 응답 — 일관성 확인됨.

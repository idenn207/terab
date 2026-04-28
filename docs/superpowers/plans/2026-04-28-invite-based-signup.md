# 초대 기반 가입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 API로 초대 링크를 생성하고, 초대받은 사용자가 웹/앱에서 회원가입을 완료하는 전체 플로우를 구현한다.

**Architecture:** API 서비스에 `InvitationModule`을 신규 추가하고, `AuthService.register()`로 초대 토큰 검증→사용자 생성→백업 코드 발급→토큰 발급을 처리한다. 웹은 FSD `features/register-by-invitation` 슬라이스를 추가하고, `/register/:token` 라우트에 연결한다. 모바일은 AndroidManifest에 App Links 경로만 추가하면 기존 `useDeepLink` 훅이 자동 처리한다.

**Tech Stack:** NestJS 11, Drizzle ORM, bcryptjs, React 19, React Router v6, react-hook-form, Zustand, MSW (테스트), Vitest

---

## 파일 맵

### API — 신규 생성

```
services/api/src/database/schema/invitations.schema.ts
services/api/src/invitation/
  invitation.repository.ts
  invitation.repository.spec.ts
  invitation.service.ts
  invitation.service.spec.ts
  invitation.controller.ts
  invitation.module.ts
  dto/create-invitation.dto.ts
  dto/invitation-response.dto.ts
services/api/src/auth/dto/register.dto.ts
services/api/src/auth/dto/register-response.dto.ts
```

### API — 수정

```
services/api/src/database/schema/index.ts            ← invitations re-export
services/api/src/common/exceptions/error-code.enum.ts ← 3개 추가
services/api/src/auth/auth.repository.ts             ← insertBackupCodes 추가
services/api/src/auth/auth.service.ts                ← register() 추가 + InvitationService 주입
services/api/src/auth/auth.service.spec.ts           ← register 테스트 + InvitationService mock
services/api/src/auth/auth.controller.ts             ← POST /api/auth/register 추가
services/api/src/auth/auth.module.ts                 ← InvitationModule import
services/api/src/app.module.ts                       ← InvitationModule 등록
services/api/drizzle/                                ← 신규 마이그레이션 SQL
```

### Web — 신규 생성

```
services/web/src/features/register-by-invitation/
  api/invitationApi.ts
  api/registerApi.ts
  model/useInvitationValidation.ts
  model/useRegister.ts
  __tests__/useRegister.test.tsx
  ui/RegisterForm.tsx
  index.ts
```

### Web — 수정

```
services/web/src/features/index.ts                         ← register-by-invitation re-export
services/web/src/pages/register/ui/RegisterPage.tsx        ← 구현
services/web/src/pages/register/ui/BackupCodeIssuePage.tsx ← 구현
services/web/src/app/providers/router/config.tsx           ← /register/:token 라우트 추가
```

### Mobile — 수정

```
services/web/android/app/src/main/AndroidManifest.xml ← /register/ App Links 경로 추가
```

---

## Task 1: invitations DB 스키마 + Drizzle 마이그레이션

**Files:**

- Create: `services/api/src/database/schema/invitations.schema.ts`
- Modify: `services/api/src/database/schema/index.ts`
- Create: `services/api/drizzle/<timestamp>_invitations.sql`

- [ ] **Step 1: invitations 스키마 작성**

```typescript
// services/api/src/database/schema/invitations.schema.ts
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const invitations = table('invitations', {
  id:            t.uuid('id').primaryKey().defaultRandom(),
  token:         t.uuid('token').notNull().unique().defaultRandom(),
  createdBy:     t.uuid('created_by').notNull().references(() => users.id),
  usedBy:        t.uuid('used_by').references(() => users.id),
  usedAt:        t.timestamp('used_at', { withTimezone: true }),
  expiresAt:     t.timestamp('expires_at', { withTimezone: true }).notNull(),
  deactivatedAt: t.timestamp('deactivated_at', { withTimezone: true }),
  createdAt:     t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Invitations$Insert = typeof invitations.$inferInsert;
export type Invitations$Select = typeof invitations.$inferSelect;
```

- [ ] **Step 2: schema/index.ts에 re-export 추가**

기존 내용을 유지하며 `invitations` 줄을 알파벳 순서에 추가:

```typescript
export * from './backup-codes.schema';
export * from './devices.schema';
export * from './invitations.schema';   // ← 추가
export * from './permissions.schema';
export * from './refresh-tokens.schema';
export * from './role-permissions.schema';
export * from './roles.schema';
export * from './trusted-devices.schema';
export * from './two-fa-challenges.schema';
export * from './user-roles.schema';
export * from './users.schema';
```

- [ ] **Step 3: Drizzle 마이그레이션 생성**

```bash
cd services/api
npm run db:generate
```

Expected: `drizzle/` 폴더에 `invitations` CREATE TABLE 구문이 포함된 SQL 파일 생성.

- [ ] **Step 4: 커밋**

```bash
git add services/api/src/database/schema/invitations.schema.ts \
        services/api/src/database/schema/index.ts \
        services/api/drizzle/
git commit -m "chore: invitations Drizzle 스키마 추가"
```

---

## Task 2: ErrorCode 3개 추가

**Files:**

- Modify: `services/api/src/common/exceptions/error-code.enum.ts`

- [ ] **Step 1: ErrorCode에 3개 추가**

`TRUSTED_DEVICE_NOT_FOUND` 항목 뒤에 추가:

```typescript
  INVITATION_NOT_FOUND: {
    message: '유효하지 않은 초대 링크입니다.',
    status: HttpStatus.NOT_FOUND,
  },
  INVITATION_EXPIRED: {
    message: '만료된 초대 링크입니다.',
    status: HttpStatus.GONE,
  },
  INVITATION_ALREADY_USED: {
    message: '이미 사용된 초대 링크입니다.',
    status: HttpStatus.CONFLICT,
  },
```

- [ ] **Step 2: 빌드 확인**

```bash
cd services/api && npm run build
```

Expected: BUILD SUCCESSFUL (타입 오류 없음)

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/common/exceptions/error-code.enum.ts
git commit -m "chore: ErrorCode 3개 추가 (INVITATION_NOT_FOUND, INVITATION_EXPIRED, INVITATION_ALREADY_USED)"
```

---

## Task 3: InvitationRepository (TDD)

**Files:**

- Create: `services/api/src/invitation/invitation.repository.ts`
- Create: `services/api/src/invitation/invitation.repository.spec.ts`

- [ ] **Step 1: InvitationRepository 단위 테스트 작성**

```typescript
// services/api/src/invitation/invitation.repository.spec.ts
import { Test } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService } from '@terab/test';
import { InvitationRepository } from './invitation.repository';

describe('InvitationRepository', () => {
  let repo: InvitationRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvitationRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();
    repo = module.get(InvitationRepository);
  });

  it('정의되어 있다', () => {
    expect(repo).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd services/api && npm test -- --testPathPattern="invitation.repository.spec"
```

Expected: FAIL (InvitationRepository 없음)

- [ ] **Step 3: InvitationRepository 구현**

```typescript
// services/api/src/invitation/invitation.repository.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, invitations } from '@terab/db';
import { eq } from 'drizzle-orm';

export interface InvitationRow {
  id: string;
  token: string;
  createdBy: string;
  usedBy: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  deactivatedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(data: { createdBy: string; expiresAt: Date }): Promise<InvitationRow> {
    const [row] = await this.database.db
      .insert(invitations)
      .values(data)
      .returning();
    return row as InvitationRow;
  }

  async findByToken(token: string): Promise<InvitationRow | null> {
    const rows = await this.database.db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);
    return (rows[0] as InvitationRow) ?? null;
  }

  async deactivate(token: string): Promise<void> {
    await this.database.db
      .update(invitations)
      .set({ deactivatedAt: new Date() })
      .where(eq(invitations.token, token));
  }

  async markUsed(token: string, usedBy: string): Promise<void> {
    await this.database.db
      .update(invitations)
      .set({ usedAt: new Date(), usedBy })
      .where(eq(invitations.token, token));
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- --testPathPattern="invitation.repository.spec"
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/invitation/invitation.repository.ts \
        services/api/src/invitation/invitation.repository.spec.ts
git commit -m "feat: InvitationRepository 추가"
```

---

## Task 4: InvitationService (TDD)

**Files:**

- Create: `services/api/src/invitation/invitation.service.spec.ts`
- Create: `services/api/src/invitation/invitation.service.ts`
- Create: `services/api/src/invitation/dto/create-invitation.dto.ts`
- Create: `services/api/src/invitation/dto/invitation-response.dto.ts`

- [ ] **Step 1: DTOs 작성**

```typescript
// services/api/src/invitation/dto/create-invitation.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateInvitationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  expiresInDays?: number;
}
```

```typescript
// services/api/src/invitation/dto/invitation-response.dto.ts
export class InvitationResponseDto {
  token!: string;
  url!: string;
  expiresAt!: Date;
}
```

- [ ] **Step 2: InvitationService 단위 테스트 작성**

```typescript
// services/api/src/invitation/invitation.service.spec.ts
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { InvitationRepository } from './invitation.repository';
import { InvitationService } from './invitation.service';

const mockRepo = {
  insert: jest.fn(),
  findByToken: jest.fn(),
  deactivate: jest.fn(),
  markUsed: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('https://drive.skypark207.com'),
};

describe('InvitationService', () => {
  let service: InvitationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: InvitationRepository, useValue: mockRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get(InvitationService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('초대 URL을 반환한다', async () => {
      mockRepo.insert.mockResolvedValue({
        token: 'test-token-uuid',
        expiresAt: new Date('2026-05-05'),
      });

      const result = await service.create('creator-id');

      expect(result.url).toBe('https://drive.skypark207.com/register/test-token-uuid');
      expect(result.token).toBe('test-token-uuid');
    });
  });

  describe('validate', () => {
    it('토큰이 없으면 false를 반환한다', async () => {
      mockRepo.findByToken.mockResolvedValue(null);
      expect(await service.validate('no-token')).toBe(false);
    });

    it('비활성화된 초대는 false를 반환한다', async () => {
      mockRepo.findByToken.mockResolvedValue({
        deactivatedAt: new Date(),
        usedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      expect(await service.validate('token')).toBe(false);
    });

    it('사용된 초대는 false를 반환한다', async () => {
      mockRepo.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
      });
      expect(await service.validate('token')).toBe(false);
    });

    it('만료된 초대는 false를 반환한다', async () => {
      mockRepo.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await service.validate('token')).toBe(false);
    });

    it('유효한 초대는 true를 반환한다', async () => {
      mockRepo.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      expect(await service.validate('token')).toBe(true);
    });
  });

  describe('validateOrThrow', () => {
    it('토큰이 없으면 INVITATION_NOT_FOUND를 던진다', async () => {
      mockRepo.findByToken.mockResolvedValue(null);
      await expect(service.validateOrThrow('no-token')).rejects.toThrow(ApiException);
    });

    it('비활성화된 초대는 INVITATION_NOT_FOUND를 던진다', async () => {
      mockRepo.findByToken.mockResolvedValue({
        deactivatedAt: new Date(),
        usedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      await expect(service.validateOrThrow('token')).rejects.toThrow(ApiException);
    });

    it('사용된 초대는 INVITATION_ALREADY_USED를 던진다', async () => {
      mockRepo.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
      });

      let code: string | undefined;
      try {
        await service.validateOrThrow('token');
      } catch (e) {
        code = (e as ApiException).errorCode;
      }
      expect(code).toBe('INVITATION_ALREADY_USED');
    });

    it('만료된 초대는 INVITATION_EXPIRED를 던진다', async () => {
      mockRepo.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      let code: string | undefined;
      try {
        await service.validateOrThrow('token');
      } catch (e) {
        code = (e as ApiException).errorCode;
      }
      expect(code).toBe('INVITATION_EXPIRED');
    });
  });
});
```

- [ ] **Step 3: 테스트 실행 — FAIL 확인**

```bash
cd services/api && npm test -- --testPathPattern="invitation.service.spec"
```

Expected: FAIL (InvitationService 없음)

- [ ] **Step 4: ApiException의 errorCode 접근 방식 확인**

```bash
cat services/api/src/common/exceptions/api.exception.ts
```

`ApiException`이 `errorCode` 프로퍼티를 노출하는지 확인한다. 없으면 Step 2의 `validateOrThrow` 테스트에서 `rejects.toThrow(ApiException)` 대신 아래 방식으로 교체한다:

```typescript
// errorCode 프로퍼티가 없는 경우 대체 검증
await expect(service.validateOrThrow('token')).rejects.toMatchObject({ message: expect.stringContaining('사용된') });
```

- [ ] **Step 5: InvitationService 구현**

```typescript
// services/api/src/invitation/invitation.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import type { InvitationRow } from './invitation.repository';
import { InvitationRepository } from './invitation.repository';
import { InvitationResponseDto } from './dto/invitation-response.dto';

const DEFAULT_EXPIRES_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationService {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly configService: ConfigService,
  ) {}

  async create(createdBy: string, expiresInDays: number = DEFAULT_EXPIRES_DAYS): Promise<InvitationResponseDto> {
    const expiresAt = new Date(Date.now() + expiresInDays * MS_PER_DAY);
    const row = await this.invitationRepository.insert({ createdBy, expiresAt });
    const baseUrl = this.configService.getOrThrow<string>('APP_BASE_URL');
    return { token: row.token, url: `${baseUrl}/register/${row.token}`, expiresAt: row.expiresAt };
  }

  async validate(token: string): Promise<boolean> {
    const row = await this.invitationRepository.findByToken(token);
    return this.isValid(row);
  }

  async validateOrThrow(token: string): Promise<InvitationRow> {
    const row = await this.invitationRepository.findByToken(token);
    if (!row || row.deactivatedAt !== null) throw new ApiException('INVITATION_NOT_FOUND');
    if (row.usedAt !== null) throw new ApiException('INVITATION_ALREADY_USED');
    if (row.expiresAt <= new Date()) throw new ApiException('INVITATION_EXPIRED');
    return row;
  }

  async deactivate(token: string): Promise<void> {
    await this.invitationRepository.deactivate(token);
  }

  async markUsed(token: string, usedBy: string): Promise<void> {
    await this.invitationRepository.markUsed(token, usedBy);
  }

  private isValid(row: InvitationRow | null): boolean {
    if (!row) return false;
    if (row.deactivatedAt !== null) return false;
    if (row.usedAt !== null) return false;
    if (row.expiresAt <= new Date()) return false;
    return true;
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npm test -- --testPathPattern="invitation.service.spec"
```

Expected: PASS (9 tests)

- [ ] **Step 7: 커밋**

```bash
git add services/api/src/invitation/
git commit -m "feat: InvitationService 추가 (생성/검증/비활성화)"
```

---

## Task 5: InvitationController + InvitationModule + AppModule 등록

**Files:**

- Create: `services/api/src/invitation/invitation.controller.ts`
- Create: `services/api/src/invitation/invitation.module.ts`
- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: InvitationController 작성**

```typescript
// services/api/src/invitation/invitation.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import { InvitationService } from './invitation.service';

@Controller('api/invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @RequirePermission('user:invite')
  async create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<InvitationResponseDto> {
    return this.invitationService.create(user.userId, dto.expiresInDays);
  }

  @Get(':token')
  @Public()
  async validate(@Param('token') token: string): Promise<{ valid: boolean }> {
    const valid = await this.invitationService.validate(token);
    return { valid };
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user:manage')
  async deactivate(@Param('token') token: string): Promise<void> {
    await this.invitationService.deactivate(token);
  }
}
```

- [ ] **Step 2: InvitationModule 작성**

```typescript
// services/api/src/invitation/invitation.module.ts
import { Module } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationRepository } from './invitation.repository';
import { InvitationService } from './invitation.service';

@Module({
  controllers: [InvitationController],
  providers: [InvitationService, InvitationRepository],
  exports: [InvitationService],
})
export class InvitationModule {}
```

- [ ] **Step 3: AppModule에 InvitationModule 등록**

`services/api/src/app.module.ts`의 imports에 추가:

```typescript
import { InvitationModule } from './invitation/invitation.module';

// imports 배열에 추가:
InvitationModule,
```

- [ ] **Step 4: 빌드 확인**

```bash
cd services/api && npm run build
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/invitation/invitation.controller.ts \
        services/api/src/invitation/invitation.module.ts \
        services/api/src/app.module.ts
git commit -m "feat: InvitationController + Module 추가, AppModule 등록"
```

---

## Task 6: AuthRepository 확장 (insertBackupCodes)

**Files:**

- Modify: `services/api/src/auth/auth.repository.ts`

- [ ] **Step 1: insertBackupCodes 메서드 추가**

`services/api/src/auth/auth.repository.ts`에서 import에 `backupCodes` 추가 확인 (이미 있으면 스킵), 그리고 메서드 추가:

```typescript
// auth.repository.ts — insertUserRole 메서드 뒤에 추가
async insertBackupCodes(userId: string, codeHashes: string[]): Promise<void> {
  await this.database.db
    .insert(backupCodes)
    .values(codeHashes.map((codeHash) => ({ userId, codeHash })));
}
```

- [ ] **Step 2: auth.service.spec.ts의 mockAuthRepository에 추가**

`services/api/src/auth/auth.service.spec.ts`에서 `mockAuthRepository` 객체에 추가:

```typescript
insertBackupCodes: jest.fn(),
```

- [ ] **Step 3: 빌드 확인**

```bash
cd services/api && npm run build
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add services/api/src/auth/auth.repository.ts \
        services/api/src/auth/auth.service.spec.ts
git commit -m "feat: AuthRepository.insertBackupCodes 추가"
```

---

## Task 7: AuthService.register() (TDD)

**Files:**

- Modify: `services/api/src/auth/auth.service.spec.ts`
- Modify: `services/api/src/auth/auth.service.ts`
- Create: `services/api/src/auth/dto/register.dto.ts`
- Create: `services/api/src/auth/dto/register-response.dto.ts`

- [ ] **Step 1: DTOs 작성**

```typescript
// services/api/src/auth/dto/register.dto.ts
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsUUID()
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nickname!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
```

```typescript
// services/api/src/auth/dto/register-response.dto.ts
import type { UserResponseDto } from './user-response.dto';

export class RegisterResponseDto {
  accessToken!: string;
  user!: UserResponseDto;
  backupCodes!: string[];
}
```

- [ ] **Step 2: auth.service.spec.ts에 InvitationService mock + register 테스트 추가**

`services/api/src/auth/auth.service.spec.ts`에 추가:

파일 상단 import 섹션에:

```typescript
import { InvitationService } from '../invitation/invitation.service';
```

`mockPushChallengePublisher` 선언 뒤에:

```typescript
const mockInvitationService = {
  validateOrThrow: jest.fn(),
  markUsed: jest.fn(),
};
```

`Test.createTestingModule` providers 배열에 추가:

```typescript
{ provide: InvitationService, useValue: mockInvitationService },
```

`describe('AuthService')` 내부 `jest.clearAllMocks()` 호출 뒤에:

```typescript
mockInvitationService.validateOrThrow.mockResolvedValue({ token: 'valid-token' });
```

그리고 기존 `describe` 블록 뒤에 새 `describe` 블록 추가:

```typescript
describe('register', () => {
  const registerDto = {
    token: '550e8400-e29b-41d4-a716-446655440000',
    username: 'newuser',
    nickname: '새유저',
    password: 'password123',
  };

  it('초대 토큰이 유효하지 않으면 ApiException을 던진다', async () => {
    mockInvitationService.validateOrThrow.mockRejectedValue(new ApiException('INVITATION_NOT_FOUND'));

    await expect(service.register(registerDto)).rejects.toThrow(ApiException);
    expect(mockAuthRepository.insertUser).not.toHaveBeenCalled();
  });

  it('중복 username이면 ApiException(USERNAME_TAKEN)을 던진다', async () => {
    mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
    mockAuthRepository.insertUser.mockRejectedValue({ code: '23505' });
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

    await expect(service.register(registerDto)).rejects.toThrow(ApiException);
  });

  it('성공 시 accessToken + user + backupCodes 8개를 반환한다', async () => {
    mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
    mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-id' });
    mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
    mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
    mockInvitationService.markUsed.mockResolvedValue(undefined);
    mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
    mockTokenService.issueRefreshToken.mockReturnValue({
      rawRefreshToken: 'raw-rt',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 86400000),
    });
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

    const result = await service.register(registerDto);

    expect(result.accessToken).toBe('mock.access.token');
    expect(result.backupCodes).toHaveLength(8);
    expect(result.user.username).toBe('newuser');
    expect(mockAuthRepository.insertBackupCodes).toHaveBeenCalledWith('new-user-id', expect.arrayContaining([expect.any(String)]));
    expect(mockInvitationService.markUsed).toHaveBeenCalledWith(registerDto.token, 'new-user-id');
  });
});
```

- [ ] **Step 3: 테스트 실행 — FAIL 확인**

```bash
cd services/api && npm test -- --testPathPattern="auth.service.spec"
```

Expected: FAIL (register 메서드 없음)

- [ ] **Step 4: AuthService.register() 구현**

`services/api/src/auth/auth.service.ts`에 추가:

파일 상단 import 섹션에:

```typescript
import { randomBytes } from 'node:crypto';
import { InvitationService } from '../invitation/invitation.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { RegisterResponseDto } from './dto/register-response.dto.js';
```

`AuthService` constructor의 파라미터 끝에 추가:

```typescript
private readonly invitationService: InvitationService,
```

완성된 constructor (기존 파라미터 순서 유지):

```typescript
constructor(
  private readonly pushChallengePublisher: PushChallengePublisher,
  private readonly configService: ConfigService,
  private readonly tokenService: TokenService,
  private readonly deviceService: DeviceService,
  private readonly twoFaService: TwoFaService,
  private readonly trustedDeviceService: TrustedDeviceService,
  private readonly authRepository: AuthRepository,
  private readonly invitationService: InvitationService,
) {}
```

`getCurrentUser` 메서드 뒤에 추가:

```typescript
// ─── Register ────────────────────────────────────────────────────────

async register(dto: RegisterDto): Promise<RegisterResponseDto & { rawRefreshToken: string; refreshTokenExpMs: number }> {
  await this.invitationService.validateOrThrow(dto.token);

  const userRole = await this.authRepository.findRoleByName('USER');
  if (!userRole) throw new Error('USER 역할 없음 — 마이그레이션 실행 여부를 확인하세요');

  const pepperedPassword = this.tokenService.pepperPassword(dto.password);
  const hashedPassword = await bcrypt.hash(pepperedPassword, BCRYPT_ROUNDS);

  const rawCodes = this.generateBackupCodes();
  const codeHashes = await Promise.all(rawCodes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)));

  let newUser: { id: string };
  try {
    newUser = await this.authRepository.insertUser({
      username: dto.username,
      nickname: dto.nickname,
      password: hashedPassword,
    });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new ApiException('USERNAME_TAKEN');
    throw err;
  }

  await this.authRepository.insertUserRole(newUser.id, userRole.id);
  await this.authRepository.insertBackupCodes(newUser.id, codeHashes);
  await this.invitationService.markUsed(dto.token, newUser.id);

  const userWithPermissions = await this.authRepository.findUserWithPermissionsById(newUser.id);
  if (!userWithPermissions) throw new Error('가입 직후 사용자 조회 실패');

  const tokens = await this.issueTokenPair(userWithPermissions);

  return {
    accessToken: tokens.accessToken,
    user: new UserResponseDto(newUser.id, dto.username, dto.nickname),
    backupCodes: rawCodes,
    rawRefreshToken: tokens.rawRefreshToken,
    refreshTokenExpMs: tokens.refreshTokenExpMs,
  };
}

private generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const buf = randomBytes(4);
    const hex = buf.toString('hex').toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test -- --testPathPattern="auth.service.spec"
```

Expected: PASS (기존 테스트 포함 전체 통과)

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/auth/auth.service.ts \
        services/api/src/auth/auth.service.spec.ts \
        services/api/src/auth/dto/register.dto.ts \
        services/api/src/auth/dto/register-response.dto.ts
git commit -m "feat: AuthService.register() 추가 (DEV-017)"
```

---

## Task 8: AuthController + AuthModule 업데이트

**Files:**

- Modify: `services/api/src/auth/auth.controller.ts`
- Modify: `services/api/src/auth/auth.module.ts`

- [ ] **Step 1: AuthController에 POST /api/auth/register 추가**

`services/api/src/auth/auth.controller.ts`에 추가:

파일 상단 import 섹션에:

```typescript
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
```

`login` 메서드 위에 추가 (또는 메서드 순서는 기존 패턴 유지):

```typescript
@Public()
@Throttle({ default: { ttl: 60000, limit: 5 } })
@Post('register')
@HttpCode(HttpStatus.CREATED)
async register(
  @Body() dto: RegisterDto,
  @Res({ passthrough: true }) res: Response,
): Promise<RegisterResponseDto> {
  const { accessToken, user, backupCodes, rawRefreshToken, refreshTokenExpMs } =
    await this.authService.register(dto);
  this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
  return { accessToken, user, backupCodes };
}
```

- [ ] **Step 2: AuthModule에 InvitationModule 추가**

`services/api/src/auth/auth.module.ts`의 imports에 추가:

```typescript
import { InvitationModule } from '../invitation/invitation.module';

// @Module imports 배열에 추가:
InvitationModule,
```

- [ ] **Step 3: 전체 테스트 + 빌드 확인**

```bash
cd services/api && npm test && npm run build
```

Expected: 모든 테스트 PASS, BUILD SUCCESSFUL

- [ ] **Step 4: api.env.example에 APP_BASE_URL 추가**

기존 `api.env.example` 파일에 추가:

```bash
APP_BASE_URL=https://drive.skypark207.com
```

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/auth/auth.controller.ts \
        services/api/src/auth/auth.module.ts \
        api.env.example
git commit -m "feat: POST /api/auth/register 엔드포인트 추가 (DEV-017)"
```

---

## Task 9: Web — register-by-invitation feature 슬라이스

**Files:**

- Create: `services/web/src/features/register-by-invitation/api/invitationApi.ts`
- Create: `services/web/src/features/register-by-invitation/api/registerApi.ts`
- Create: `services/web/src/features/register-by-invitation/model/useRegister.ts`
- Create: `services/web/src/features/register-by-invitation/__tests__/useRegister.test.tsx`
- Create: `services/web/src/features/register-by-invitation/ui/RegisterForm.tsx`
- Create: `services/web/src/features/register-by-invitation/index.ts`
- Modify: `services/web/src/features/index.ts`

- [ ] **Step 1: API 함수 작성**

```typescript
// services/web/src/features/register-by-invitation/api/invitationApi.ts
import axios from 'axios';

export interface ValidateInvitationResponse {
  valid: boolean;
}

export async function validateInvitation(token: string): Promise<ValidateInvitationResponse> {
  const { data } = await axios.get<ValidateInvitationResponse>(`/api/invitations/${token}`);
  return data;
}
```

```typescript
// services/web/src/features/register-by-invitation/api/registerApi.ts
import axios from 'axios';

export interface RegisterRequest {
  token: string;
  username: string;
  nickname: string;
  password: string;
}

export interface RegisterResponse {
  accessToken: string;
  user: { id: string; username: string; nickname: string };
  backupCodes: string[];
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const { data: response } = await axios.post<RegisterResponse>('/api/auth/register', data, {
    withCredentials: true,
  });
  return response;
}
```

- [ ] **Step 2: useRegister 단위 테스트 작성**

```typescript
// services/web/src/features/register-by-invitation/__tests__/useRegister.test.tsx
import { useUserStore } from '@/entities';
import { act, renderHook } from '@testing-library/react';
import { server } from '@tests/mocks';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useRegister } from '../model/useRegister';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/register/test-token']}>
    <Routes>
      <Route path="/register/:token" element={<>{children}</>} />
    </Routes>
  </MemoryRouter>
);

describe('useRegister', () => {
  afterEach(() => {
    useUserStore.getState().clearAuth();
  });

  it('가입 성공 시 accessToken과 user를 스토어에 저장한다', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          {
            accessToken: 'mock-access-token',
            user: { id: 'uuid-1', username: 'newuser', nickname: '새유저' },
            backupCodes: Array.from({ length: 8 }, (_, i) => `ABCD-${i}00${i}`),
          },
          { status: 201 },
        ),
      ),
    );

    const { result } = renderHook(() => useRegister(), { wrapper });
    await act(() =>
      result.current.submit({
        username: 'newuser',
        nickname: '새유저',
        password: 'password123',
        passwordConfirm: 'password123',
      }),
    );

    expect(useUserStore.getState().accessToken).toBe('mock-access-token');
    expect(useUserStore.getState().user?.username).toBe('newuser');
  });

  it('USERNAME_TAKEN 응답 시 error.code를 설정한다', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { code: 'USERNAME_TAKEN', message: '이미 사용 중인 아이디입니다.' },
          { status: 409 },
        ),
      ),
    );

    const { result } = renderHook(() => useRegister(), { wrapper });
    await act(() =>
      result.current.submit({
        username: 'taken',
        nickname: '테스트',
        password: 'password123',
        passwordConfirm: 'password123',
      }),
    );

    expect(result.current.error?.code).toBe('USERNAME_TAKEN');
    expect(useUserStore.getState().accessToken).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트 실행 — FAIL 확인**

```bash
cd services/web && npm test -- useRegister.test
```

Expected: FAIL (useRegister 없음)

- [ ] **Step 4: useRegister 구현**

```typescript
// services/web/src/features/register-by-invitation/model/useRegister.ts
import { useUserStore } from '@/entities';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { register } from '../api/registerApi';

export interface RegisterFormValues {
  username: string;
  nickname: string;
  password: string;
  passwordConfirm: string;
}

export function useRegister() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const submit = async (values: RegisterFormValues) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await register({
        token,
        username: values.username,
        nickname: values.nickname,
        password: values.password,
      });
      setAuth(result.accessToken, result.user);
      navigate(`/register/${token}/backup`, {
        state: { backupCodes: result.backupCodes },
        replace: true,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: string; message?: string } } };
      setError({
        code: e.response?.data?.code ?? 'UNKNOWN',
        message: e.response?.data?.message ?? '가입에 실패했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test -- useRegister.test
```

Expected: PASS (2 tests)

- [ ] **Step 6: RegisterForm UI 컴포넌트 작성**

```typescript
// services/web/src/features/register-by-invitation/ui/RegisterForm.tsx
import { Button, Field, Input, Label } from '@/shared/ui';
import { useForm } from 'react-hook-form';
import type { RegisterFormValues } from '../model/useRegister';
import { useRegister } from '../model/useRegister';

export function RegisterForm() {
  const { submit, isLoading, error } = useRegister();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>();

  return (
    <form onSubmit={handleSubmit(submit)} className="grid w-full max-w-sm grid-cols-1 gap-6">
      <Field>
        <Label htmlFor="username">아이디</Label>
        <Input
          id="username"
          type="text"
          autoComplete="username"
          {...register('username', { required: '아이디를 입력해 주세요.' })}
        />
        {errors.username && (
          <p role="alert" className="text-sm text-red-500">
            {errors.username.message}
          </p>
        )}
      </Field>
      <Field>
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          type="text"
          {...register('nickname', { required: '닉네임을 입력해 주세요.' })}
        />
        {errors.nickname && (
          <p role="alert" className="text-sm text-red-500">
            {errors.nickname.message}
          </p>
        )}
      </Field>
      <Field>
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password', {
            required: '비밀번호를 입력해 주세요.',
            minLength: { value: 8, message: '비밀번호는 8자 이상이어야 합니다.' },
          })}
        />
        {errors.password && (
          <p role="alert" className="text-sm text-red-500">
            {errors.password.message}
          </p>
        )}
      </Field>
      <Field>
        <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
        <Input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          {...register('passwordConfirm', {
            required: '비밀번호 확인을 입력해 주세요.',
            validate: (v) => v === watch('password') || '비밀번호가 일치하지 않습니다.',
          })}
        />
        {errors.passwordConfirm && (
          <p role="alert" className="text-sm text-red-500">
            {errors.passwordConfirm.message}
          </p>
        )}
      </Field>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error.message}
        </p>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? '가입 중...' : '가입하기'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 7: useInvitationValidation 훅 작성**

FSD 규칙: `index.ts`에서 `api/` 함수를 직접 export하면 안 됨. `validateInvitation` API 호출은 모델 훅으로 캡슐화한다.

```typescript
// services/web/src/features/register-by-invitation/model/useInvitationValidation.ts
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { validateInvitation } from '../api/invitationApi';

export function useInvitationValidation() {
  const { token } = useParams<{ token: string }>();
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setValid(false);
      return;
    }
    validateInvitation(token)
      .then(({ valid }) => setValid(valid))
      .catch(() => setValid(false));
  }, [token]);

  return { valid };
}
```

- [ ] **Step 8: feature 슬라이스 index.ts 작성 + features/index.ts 업데이트**

```typescript
// services/web/src/features/register-by-invitation/index.ts
export * from './model/useInvitationValidation';
export * from './model/useRegister';
export * from './ui/RegisterForm';
```

`services/web/src/features/index.ts`에 한 줄 추가 (알파벳 순서, 기존 내용 보존):

```typescript
// 기존 내용 예시 (덮어쓰지 말 것 — 줄 추가만)
// export * from './backup-code';
// ...
export * from './push-notification';
export * from './register-by-invitation';   // ← 이 줄만 추가
export * from './trusted-device';
```

- [ ] **Step 9: 커밋**

```bash
git add services/web/src/features/register-by-invitation/ \
        services/web/src/features/index.ts
git commit -m "feat: register-by-invitation feature 슬라이스 추가 (API, 훅, 컴포넌트)"
```

---

## Task 10: Web — RegisterPage + BackupCodeIssuePage + 라우터 업데이트

**Files:**

- Modify: `services/web/src/pages/register/ui/RegisterPage.tsx`
- Modify: `services/web/src/pages/register/ui/BackupCodeIssuePage.tsx`
- Modify: `services/web/src/app/providers/router/config.tsx`

- [ ] **Step 1: RegisterPage 구현**

```typescript
// services/web/src/pages/register/ui/RegisterPage.tsx
import { RegisterForm, useInvitationValidation } from '@/features';
import { LogoLabel } from '@/shared/assets';
import { Heading } from '@/shared/ui';

export function RegisterPage() {
  const { valid } = useInvitationValidation();

  if (valid === null) {
    return (
      <div className="grid w-full max-w-sm grid-cols-1 gap-8">
        <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
        <p className="text-sm text-zinc-500">초대 링크를 확인하는 중...</p>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="grid w-full max-w-sm grid-cols-1 gap-8">
        <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
        <p role="alert" className="text-sm text-red-500">
          유효하지 않은 초대 링크입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-sm grid-cols-1 gap-8">
      <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
      <Heading>회원가입</Heading>
      <RegisterForm />
    </div>
  );
}
```

- [ ] **Step 2: BackupCodeIssuePage 구현**

```typescript
// services/web/src/pages/register/ui/BackupCodeIssuePage.tsx
import { LogoLabel } from '@/shared/assets';
import { Button, Heading } from '@/shared/ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LocationState {
  backupCodes?: string[];
}

export function BackupCodeIssuePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const backupCodes = state?.backupCodes ?? [];
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (backupCodes.length === 0) {
    navigate('/drive', { replace: true });
    return null;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
  };

  return (
    <div className="grid w-full max-w-sm grid-cols-1 gap-6">
      <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
      <Heading>백업 코드</Heading>
      <p className="text-sm text-zinc-500">
        아래 코드는 지금만 확인할 수 있습니다. 분실 시 재발급이 불가하니 안전한 곳에 보관하세요.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-md bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-800">
        {backupCodes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <Button type="button" onClick={handleCopy}>
        {copied ? '복사됨 ✓' : '클립보드에 복사'}
      </Button>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        백업 코드를 안전한 곳에 저장했습니다.
      </label>
      <Button
        type="button"
        disabled={!confirmed}
        onClick={() => navigate('/drive', { replace: true })}
      >
        완료
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: 라우터에 /register 라우트 추가**

`services/web/src/app/providers/router/config.tsx`에서:

import 섹션에 추가:

```typescript
import { BackupCodeIssuePage, RegisterPage } from '@/pages';
```

`authRoutes` 배열 뒤에 `registerRoutes` 추가:

```typescript
const registerRoutes: RouteObject[] = [
  {
    path: '/register',
    element: <AuthLayout />,
    children: [
      { path: ':token', element: <RegisterPage /> },
      { path: ':token/backup', element: <BackupCodeIssuePage /> },
    ],
  },
];
```

`routes` 배열 export에 `registerRoutes` 추가:

```typescript
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...rootRoutes, ...authRoutes, ...registerRoutes, ...appRoutes, ...previewRoutes],
  },
];
```

- [ ] **Step 4: 전체 웹 테스트 + 빌드 확인**

```bash
cd services/web && npm test && npm run build
```

Expected: 모든 테스트 PASS, BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
git add services/web/src/pages/register/ \
        services/web/src/app/providers/router/config.tsx
git commit -m "feat: RegisterPage + BackupCodeIssuePage + 라우터 연결 (DEV-017)"
```

---

## Task 11: Mobile — AndroidManifest App Links 업데이트

**Files:**

- Modify: `services/web/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: /register/ App Links 경로 추가**

`services/web/android/app/src/main/AndroidManifest.xml`에서 `/auth/2fa/` intent-filter 블록 뒤에 추가:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https"
        android:host="drive.skypark207.com"
        android:pathPrefix="/register/" />
</intent-filter>
```

- [ ] **Step 2: Capacitor 동기화**

```bash
cd services/web && npm run cap:sync
```

Expected: 빌드 성공 및 Android 프로젝트에 반영

- [ ] **Step 3: 커밋**

```bash
git add services/web/android/app/src/main/AndroidManifest.xml
git commit -m "feat: Android App Links /register/ 경로 추가 (DEV-017)"
```

---

## Self-Review

### 스펙 커버리지 체크

| 스펙 항목 | Task |
| --- | --- |
| `POST /api/invitations` (ADMIN) — 초대 링크 생성 | Task 5 |
| `GET /api/invitations/:token` (Public) — 토큰 검증 | Task 5 |
| `DELETE /api/invitations/:token` (ADMIN) — 비활성화 | Task 5 |
| `POST /api/auth/register` (Public) — 회원가입 | Task 7, 8 |
| invitations DB 스키마 (3가지 유효성 조건) | Task 1 |
| ErrorCode 3개 추가 | Task 2 |
| 백업 코드 8개 생성 (bcrypt 해싱) | Task 7 |
| refreshToken 쿠키 설정 | Task 8 |
| APP_BASE_URL 환경변수 | Task 8 |
| Web RegisterPage (/register/:token) | Task 10 |
| Web BackupCodeIssuePage (/register/:token/backup) | Task 10 |
| 라우터 /register 연결 | Task 10 |
| 모바일 App Links /register/ 경로 | Task 11 |
| `user:invite` / `user:manage` 기존 RBAC 권한 재사용 | Task 5 |

**RBAC 시딩 변경 불필요 확인:** `rbac.seed.ts`에 이미 ADMIN 역할에 `user:invite`, `user:manage`가 정의되어 있음. Task 없이 그대로 사용.

### 타입 일관성 체크

- `InvitationRow`: Task 3에서 정의 → Task 4 `validateOrThrow` 반환 타입에서 사용 ✓
- `InvitationResponseDto`: Task 4에서 정의 → Task 5 Controller 반환 타입에서 사용 ✓
- `RegisterDto`: Task 7에서 정의 → Task 8 Controller에서 사용 ✓
- `RegisterResponseDto`: Task 7에서 정의 → Task 8 Controller에서 사용 ✓
- `backupCodes` 배열: `string[]` — AuthService.register() → Controller → Web registerApi.ts RegisterResponse.backupCodes 모두 `string[]` ✓
- `useRegister.submit()` 파라미터 `RegisterFormValues` → `RegisterForm`의 `useForm<RegisterFormValues>()` ✓

---

## 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-04-28 | 초안 작성 |
| 2026-04-28 | 플랜 검토 수정: (1) `index.ts`에 `validateInvitation` export 추가, (2) `RegisterPage`에서 axios 직접 호출 → `validateInvitation` 사용으로 교체, (3) `features/index.ts` 부분 스니펫에 "기존 내용 보존" 주의사항 명시 |
| 2026-04-29 | FSD 위반 수정: Task 9에서 `api/invitationApi` 직접 export 제거 → `useInvitationValidation` 훅으로 캡슐화 (Step 7 추가), Task 10 `RegisterPage`에서 `validateInvitation` 직접 호출 → `useInvitationValidation()` 훅 사용으로 교체 |

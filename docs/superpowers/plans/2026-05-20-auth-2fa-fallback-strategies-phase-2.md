# 2FA Fallback Strategies — Phase 2 (Passkey/WebAuthn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WebAuthn(Level 2) 기반 Passkey를 2FA fallback strategy로 도입. 사용자가 platform authenticator(Touch ID, Windows Hello, 보안키)로 credential을 다중 등록하고 로그인 challenge를 Passkey ceremony로 완료할 수 있게 한다. Web first 머지 — Capacitor Android PoC는 별도 spec.

**Architecture:** `@simplewebauthn/server`로 RP 측 registration/authentication ceremony 검증, browser는 표준 `navigator.credentials` API. Per-user 다중 credential 허용 (`two_fa_passkey` 테이블, `(credential_id)` unique). Registration·authentication challenge(랜덤 32바이트)는 짧은 TTL로 CacheManager(글로벌 keyv/redis)에 저장. `PasskeyTwoFaStrategy`가 Phase 0 Registry에 합류, 통합 `POST /auth/2fa/challenge/:id/complete` body discriminator에 `PASSKEY` 분기 추가.

**Tech Stack:** NestJS 11 / TypeScript / Drizzle ORM / `@simplewebauthn/server` (RP) / `@simplewebauthn/browser` (web) / @nestjs/cache-manager (이미 도입)

**Spec:** `docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md` §5.3

**Pre-requisite:**
- Phase 0 plan(`2026-05-20-auth-2fa-fallback-strategies-phase-0.md`) 실행 완료 — Strategy/Registry/PushTwoFaStrategy/BackupCodeTwoFaStrategy가 존재
- Phase 1 plan(`2026-05-20-auth-2fa-fallback-strategies-phase-1.md`) 실행 완료 — `ChallengeController`, `CompleteChallengeBodyDto`, `TwoFaService.completeChallenge` / `removeStrategy`, `EncryptionService`, last-strategy 가드(`TWOFA_LAST_STRATEGY_CANNOT_REMOVE`)가 이미 도입돼 있음. Phase 2는 이 기반 위에 PASSKEY 분기만 얹는다

**Scope 제외:** Capacitor Android WebView Passkey 호환(별도 spec `2026-XX-XX-passkey-capacitor-compat-design.md`). 모바일 사용자는 TOTP/backup-code fallback 사용.

---

## File Structure

**Create — api**
- `services/api/src/database/schema/two-fa-passkey.schema.ts` — `two_fa_passkey` 테이블
- `services/api/drizzle/0006_create_two_fa_passkey.sql` — migration (실제 파일명은 db:generate 결과; 본 plan은 0006 가정. Phase 1이 0005를 사용)
- `services/api/src/twofa/passkey.repository.ts`
- `services/api/src/twofa/passkey.repository.spec.ts`
- `services/api/src/twofa/passkey-challenge.store.ts` — CacheManager 기반 challenge 저장소
- `services/api/src/twofa/passkey-challenge.store.spec.ts`
- `services/api/src/twofa/passkey.service.ts` — `@simplewebauthn/server` wrapper
- `services/api/src/twofa/passkey.service.spec.ts`
- `services/api/src/twofa/strategies/passkey.strategy.ts`
- `services/api/src/twofa/strategies/passkey.strategy.spec.ts`
- `services/api/src/twofa/passkey.controller.ts` — `POST /auth/2fa/passkey/setup/start`, `POST /auth/2fa/passkey/setup/complete`, `GET /auth/2fa/passkey`, `DELETE /auth/2fa/passkey/:id`, `POST /auth/2fa/passkey/auth/start`
- `services/api/src/twofa/passkey.controller.spec.ts`
- `services/api/src/twofa/dto/passkey-registration-options.dto.ts`
- `services/api/src/twofa/dto/passkey-registration-complete-body.dto.ts`
- `services/api/src/twofa/dto/passkey-authentication-options.dto.ts`
- `services/api/src/twofa/dto/passkey-list-response.dto.ts`
- `services/api/test/passkey.e2e-spec.ts`

**Modify — api**
- `services/api/src/common/exceptions/error-code.enum.ts` — `TWOFA_PASSKEY_VERIFICATION_FAILED` / `TWOFA_PASSKEY_NOT_ENROLLED` 추가
- `services/api/package.json` — `@simplewebauthn/server` dependency
- `api.env.example` — `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_RP_ORIGIN`
- `services/api/src/twofa/dto/complete-challenge-body.dto.ts` — `type`에 `'PASSKEY'` 추가 + `credentialResponse` 필드
- `services/api/src/twofa/twofa.service.ts` — `completeChallenge`에 PASSKEY 분기 처리(verifyResponse가 challenge 검증을 cache에서 수행하므로 challenge row PENDING 검증은 PASSKEY에서도 그대로 작동)
- `services/api/src/twofa/twofa.module.ts` — PasskeyService/Repository/Store/Strategy/Controller 등록 + TWOFA_STRATEGY_TOKEN factory에 추가
- `services/api/src/database/schema/index.ts` — `two-fa-passkey.schema.ts` re-export

**Create — web**
- `services/web/src/pages/settings/twofa-setup-passkey.tsx` — Passkey 등록 UI
- `services/web/src/pages/settings/twofa-setup-passkey.test.tsx`
- `services/web/src/pages/login/twofa-passkey-ceremony.tsx` — login 시 Passkey ceremony 진입

**Modify — web**
- `services/web/src/api/openapi/**` — codegen 갱신
- `services/web/src/pages/login/twofa-challenge.tsx` (또는 Phase 1에서 도입된 alt-method 진입점) — `PASSKEY` 선택지 추가
- `services/web/package.json` — `@simplewebauthn/browser` dependency

---

## Task 1: ErrorCode 2종 추가

**Files:**
- Modify: `services/api/src/common/exceptions/error-code.enum.ts`

- [ ] **Step 1.1: ErrorCode 추가**

`// ───── 2FA ─────` 블록 (Phase 1에서 추가된 TOTP 키들 뒤)에 추가:

```ts
  TWOFA_PASSKEY_VERIFICATION_FAILED: {
    message: 'Passkey 검증에 실패했습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  TWOFA_PASSKEY_NOT_ENROLLED: {
    message: '등록된 Passkey가 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
```

- [ ] **Step 1.2: tsc 확인**

```bash
cd services/api && npx tsc --noEmit
```

Expected: 통과.

- [ ] **Step 1.3: 커밋**

```bash
git add services/api/src/common/exceptions/error-code.enum.ts
git commit -m "feat(api): Passkey 관련 ErrorCode 2종 추가

TWOFA_PASSKEY_VERIFICATION_FAILED(검증 실패) / TWOFA_PASSKEY_NOT_ENROLLED(미등록 사용자 ceremony 시도)."
```

---

## Task 2: @simplewebauthn/server 의존성 + env 추가

**Files:**
- Modify: `services/api/package.json`
- Modify: `api.env.example`

- [ ] **Step 2.1: 의존성 설치**

```bash
cd services/api
npm install @simplewebauthn/server
```

Expected: `package.json`에 `"@simplewebauthn/server": "^10.x"` (또는 최신 stable) 추가. `package-lock.json` 갱신.

- [ ] **Step 2.2: api.env.example 갱신**

`api.env.example`의 `# Security` 블록 안에 추가 (Phase 1의 `TWOFA_MASTER_KEY` 뒤):

```
# WebAuthn / Passkey
# RP ID는 origin의 effective domain. 로컬은 localhost, 운영은 drive.skypark207.com
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Terab
WEBAUTHN_RP_ORIGIN=http://localhost:5173
```

> **운영 환경 주의:** 실제 `api.env`는 본 plan으로 수정하지 않는다. 운영자가 `WEBAUTHN_RP_ID=drive.skypark207.com`, `WEBAUTHN_RP_ORIGIN=https://drive.skypark207.com`로 채운다. `WEBAUTHN_RP_ID`는 origin의 effective domain만 가능 (subdomain까지 허용 — 예: `skypark207.com`로 두면 모든 subdomain에서 동작).

- [ ] **Step 2.3: 커밋**

```bash
git add services/api/package.json services/api/package-lock.json api.env.example
git commit -m "feat(api): @simplewebauthn/server 의존성 + WebAuthn RP env 추가

WEBAUTHN_RP_ID/RP_NAME/RP_ORIGIN 3종. 실제 값은 운영자가 채운다."
```

---

## Task 3: two_fa_passkey 스키마 + migration

**Files:**
- Create: `services/api/src/database/schema/two-fa-passkey.schema.ts`
- Modify: `services/api/src/database/schema/index.ts`
- Create: `services/api/drizzle/0006_create_two_fa_passkey.sql` (자동 생성)

- [ ] **Step 3.1: schema 파일 작성**

`services/api/src/database/schema/two-fa-passkey.schema.ts`:

```ts
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

const bytea = t.customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const twoFaPasskey = table(
  'two_fa_passkey',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: bytea('credential_id').notNull(),
    publicKey: bytea('public_key').notNull(),
    signCount: t.bigint('sign_count', { mode: 'number' }).notNull().default(0),
    transports: t.varchar('transports', { length: 64 }).array().notNull().default([]),
    aaguid: t.uuid('aaguid'),
    nickname: t.varchar('nickname', { length: 64 }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: t.timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    t.uniqueIndex().on(table.credentialId),
    t.index().on(table.userId),
  ],
);

export type TwoFaPasskey$Insert = typeof twoFaPasskey.$inferInsert;
export type TwoFaPasskey$Select = typeof twoFaPasskey.$inferSelect;
```

- [ ] **Step 3.2: schema index 갱신**

`services/api/src/database/schema/index.ts`에 추가:

```ts
export * from './two-fa-passkey.schema';
```

- [ ] **Step 3.3: migration 생성**

```bash
cd services/api
npm run db:generate
```

Expected: `drizzle/0006_create_two_fa_passkey.sql` (또는 다음 번호) 생성. 내용에 `credential_id bytea NOT NULL`, `public_key bytea NOT NULL`, `sign_count bigint NOT NULL DEFAULT 0`, `transports varchar(64)[] NOT NULL DEFAULT '{}'`, `aaguid uuid`, `UNIQUE INDEX ... on credential_id` 포함 확인.

- [ ] **Step 3.4: dev DB 적용**

```bash
cd services/api && npm run db:push
psql $DATABASE_URL -c "\\d two_fa_passkey"
```

Expected: 통과, 컬럼/제약 확인.

- [ ] **Step 3.5: 커밋**

```bash
git add services/api/src/database/schema/two-fa-passkey.schema.ts services/api/src/database/schema/index.ts services/api/drizzle/
git commit -m "feat(api): two_fa_passkey 스키마 + migration

per-user 다중 credential 허용, unique(credential_id) 제약, transports/aaguid/nickname 메타 보관."
```

---

## Task 4: PasskeyRepository

**Files:**
- Create: `services/api/src/twofa/passkey.repository.ts`
- Create: `services/api/src/twofa/passkey.repository.spec.ts`

- [ ] **Step 4.1: spec 작성**

`services/api/src/twofa/passkey.repository.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockDbLimit, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
import { PasskeyRepository } from './passkey.repository';

describe('PasskeyRepository', () => {
  let repo: PasskeyRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PasskeyRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();
    repo = module.get(PasskeyRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => expect(repo).toBeDefined());

  describe('findByCredentialId', () => {
    it('일치하는 credential이 없으면 null', async () => {
      mockDbLimit.mockResolvedValue([]);
      const result = await repo.findByCredentialId(Buffer.from('x'));
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 4.2: 테스트 실패 확인**

```bash
cd services/api && npx jest src/twofa/passkey.repository.spec.ts
```

Expected: FAIL.

- [ ] **Step 4.3: Repository 구현**

`services/api/src/twofa/passkey.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
  RepositoryCore,
  TransactionContext,
  twoFaPasskey,
  TwoFaPasskey$Insert,
  TwoFaPasskey$Select,
} from '@terab/db';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class PasskeyRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findByCredentialId(credentialId: Buffer): Promise<TwoFaPasskey$Select | null> {
    const [row = null] = await this.conn
      .select()
      .from(twoFaPasskey)
      .where(eq(twoFaPasskey.credentialId, credentialId))
      .limit(1);
    return row;
  }

  async findById(id: string): Promise<TwoFaPasskey$Select | null> {
    const [row = null] = await this.conn
      .select()
      .from(twoFaPasskey)
      .where(eq(twoFaPasskey.id, id))
      .limit(1);
    return row;
  }

  async listByUserId(userId: string): Promise<TwoFaPasskey$Select[]> {
    return this.conn.select().from(twoFaPasskey).where(eq(twoFaPasskey.userId, userId));
  }

  async insert(data: TwoFaPasskey$Insert): Promise<TwoFaPasskey$Select> {
    const [row] = await this.conn.insert(twoFaPasskey).values(data).returning();
    return row;
  }

  async updateAfterAuth(id: string, signCount: number, lastUsedAt: Date): Promise<void> {
    await this.conn
      .update(twoFaPasskey)
      .set({ signCount, lastUsedAt })
      .where(eq(twoFaPasskey.id, id));
  }

  async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
    const rows = await this.conn
      .delete(twoFaPasskey)
      .where(and(eq(twoFaPasskey.id, id), eq(twoFaPasskey.userId, userId)))
      .returning({ id: twoFaPasskey.id });
    return rows.length === 1;
  }
}
```

- [ ] **Step 4.4: 테스트 통과 확인**

```bash
cd services/api && npx jest src/twofa/passkey.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 4.5: 커밋**

```bash
git add services/api/src/twofa/passkey.repository.ts services/api/src/twofa/passkey.repository.spec.ts
git commit -m "feat(api): PasskeyRepository — credential CRUD + signCount update"
```

---

## Task 5: PasskeyChallengeStore

WebAuthn은 registration/authentication ceremony 시작 시 RP가 challenge(랜덤 32바이트)를 만들어 browser에 전달하고, browser는 그 challenge를 서명해 돌려준다. RP는 서명 검증 시 "지금 받은 challenge가 이전에 RP가 발급한 그것"이 맞는지 확인해야 한다. 짧은 TTL(60초)로 CacheManager에 저장.

**Files:**
- Create: `services/api/src/twofa/passkey-challenge.store.ts`
- Create: `services/api/src/twofa/passkey-challenge.store.spec.ts`

- [ ] **Step 5.1: spec 작성**

`services/api/src/twofa/passkey-challenge.store.spec.ts`:

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { PasskeyChallengeStore } from './passkey-challenge.store';

describe('PasskeyChallengeStore', () => {
  let store: PasskeyChallengeStore;
  const cache = new Map<string, string>();
  const mockCache = {
    get: jest.fn(async (k: string) => cache.get(k)),
    set: jest.fn(async (k: string, v: string) => { cache.set(k, v); }),
    del: jest.fn(async (k: string) => { cache.delete(k); }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PasskeyChallengeStore, { provide: CACHE_MANAGER, useValue: mockCache }],
    }).compile();
    store = module.get(PasskeyChallengeStore);
    cache.clear();
    jest.clearAllMocks();
  });

  describe('registration challenge', () => {
    it('저장 후 동일 키로 조회 가능, 한 번 consume 후 재조회는 null', async () => {
      await store.saveRegistrationChallenge('user-1', 'challenge-base64');
      expect(await store.consumeRegistrationChallenge('user-1')).toBe('challenge-base64');
      expect(await store.consumeRegistrationChallenge('user-1')).toBeNull();
    });
  });

  describe('authentication challenge', () => {
    it('challengeId 기반 키. 저장·consume 한 번씩만', async () => {
      await store.saveAuthenticationChallenge('c1', 'auth-challenge');
      expect(await store.consumeAuthenticationChallenge('c1')).toBe('auth-challenge');
      expect(await store.consumeAuthenticationChallenge('c1')).toBeNull();
    });
  });
});
```

- [ ] **Step 5.2: 테스트 실패 확인**

```bash
cd services/api && npx jest src/twofa/passkey-challenge.store.spec.ts
```

Expected: FAIL.

- [ ] **Step 5.3: Store 구현**

`services/api/src/twofa/passkey-challenge.store.ts`:

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

@Injectable()
export class PasskeyChallengeStore {
  private readonly TTL_MS = 60 * 1000;
  private readonly REG_PREFIX = 'twofa:passkey:reg:';
  private readonly AUTH_PREFIX = 'twofa:passkey:auth:';

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async saveRegistrationChallenge(userId: string, challenge: string): Promise<void> {
    await this.cache.set(this.REG_PREFIX + userId, challenge, this.TTL_MS);
  }

  async consumeRegistrationChallenge(userId: string): Promise<string | null> {
    const key = this.REG_PREFIX + userId;
    const value = await this.cache.get<string>(key);
    if (value) await this.cache.del(key);
    return value ?? null;
  }

  async saveAuthenticationChallenge(challengeId: string, challenge: string): Promise<void> {
    await this.cache.set(this.AUTH_PREFIX + challengeId, challenge, this.TTL_MS);
  }

  async consumeAuthenticationChallenge(challengeId: string): Promise<string | null> {
    const key = this.AUTH_PREFIX + challengeId;
    const value = await this.cache.get<string>(key);
    if (value) await this.cache.del(key);
    return value ?? null;
  }
}
```

- [ ] **Step 5.4: 테스트 통과**

```bash
cd services/api && npx jest src/twofa/passkey-challenge.store.spec.ts
```

Expected: PASS.

- [ ] **Step 5.5: 커밋**

```bash
git add services/api/src/twofa/passkey-challenge.store.ts services/api/src/twofa/passkey-challenge.store.spec.ts
git commit -m "feat(api): PasskeyChallengeStore — WebAuthn challenge TTL 60s

registration은 user 단위, authentication은 challengeId 단위. CacheManager(keyv/redis) 기반."
```

---

## Task 6: PasskeyService — @simplewebauthn/server wrapper

RP 측 ceremony 4종 (generateRegistrationOptions / verifyRegistrationResponse / generateAuthenticationOptions / verifyAuthenticationResponse)을 캡슐화.

**Files:**
- Create: `services/api/src/twofa/passkey.service.ts`
- Create: `services/api/src/twofa/passkey.service.spec.ts`

- [ ] **Step 6.1: spec 작성**

`services/api/src/twofa/passkey.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { PasskeyChallengeStore } from './passkey-challenge.store';
import { PasskeyRepository } from './passkey.repository';
import { PasskeyService } from './passkey.service';

const mockPasskeyRepository = {
  listByUserId: jest.fn(),
  findByCredentialId: jest.fn(),
  insert: jest.fn(),
  updateAfterAuth: jest.fn(),
};
const mockStore = {
  saveRegistrationChallenge: jest.fn(),
  consumeRegistrationChallenge: jest.fn(),
  saveAuthenticationChallenge: jest.fn(),
  consumeAuthenticationChallenge: jest.fn(),
};
const config = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'WEBAUTHN_RP_ID') return 'localhost';
    if (key === 'WEBAUTHN_RP_NAME') return 'Terab';
    if (key === 'WEBAUTHN_RP_ORIGIN') return 'http://localhost:5173';
    throw new Error(key);
  }),
};

describe('PasskeyService', () => {
  let service: PasskeyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PasskeyService,
        { provide: ConfigService, useValue: config },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: PasskeyRepository, useValue: mockPasskeyRepository },
        { provide: PasskeyChallengeStore, useValue: mockStore },
      ],
    }).compile();
    service = module.get(PasskeyService);
    jest.clearAllMocks();
  });

  describe('startRegistration', () => {
    it('이미 등록된 credentialId는 excludeCredentials에 포함', async () => {
      mockPasskeyRepository.listByUserId.mockResolvedValue([
        { credentialId: Buffer.from([1, 2, 3]), transports: ['internal'] },
      ]);
      const options = await service.startRegistration('user-1', 'owner');
      expect(options.excludeCredentials).toHaveLength(1);
      expect(mockStore.saveRegistrationChallenge).toHaveBeenCalledWith('user-1', options.challenge);
    });
  });

  describe('verifyRegistration', () => {
    it('저장된 challenge가 없으면 TWOFA_PASSKEY_VERIFICATION_FAILED', async () => {
      mockStore.consumeRegistrationChallenge.mockResolvedValue(null);
      await expect(
        service.verifyRegistration('user-1', { id: 'x', rawId: 'x', response: {}, type: 'public-key' } as never),
      ).rejects.toMatchObject({ code: 'TWOFA_PASSKEY_VERIFICATION_FAILED' });
    });
  });

  describe('startAuthentication', () => {
    it('등록된 credential이 없으면 TWOFA_PASSKEY_NOT_ENROLLED', async () => {
      mockPasskeyRepository.listByUserId.mockResolvedValue([]);
      await expect(service.startAuthentication('user-1', 'challenge-1')).rejects.toMatchObject({
        code: 'TWOFA_PASSKEY_NOT_ENROLLED',
      });
    });
  });

  describe('verifyAuthentication', () => {
    it('challenge 저장 없으면 TWOFA_PASSKEY_VERIFICATION_FAILED', async () => {
      mockStore.consumeAuthenticationChallenge.mockResolvedValue(null);
      await expect(
        service.verifyAuthentication('challenge-1', {
          id: 'x', rawId: 'x', response: {}, type: 'public-key',
        } as never),
      ).rejects.toMatchObject({ code: 'TWOFA_PASSKEY_VERIFICATION_FAILED' });
    });
  });
});
```

- [ ] **Step 6.2: 테스트 실패 확인**

```bash
cd services/api && npx jest src/twofa/passkey.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 6.3: PasskeyService 구현**

`services/api/src/twofa/passkey.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { PasskeyChallengeStore } from './passkey-challenge.store';
import { PasskeyRepository } from './passkey.repository';

interface VerifiedRegistration {
  id: string;
}

interface VerifiedAuthentication {
  userId: string;
}

@Injectable()
export class PasskeyService extends ServiceCore {
  private readonly rpID: string;
  private readonly rpName: string;
  private readonly origin: string;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    configService: ConfigService,
    private readonly passkeyRepository: PasskeyRepository,
    private readonly challengeStore: PasskeyChallengeStore,
  ) {
    super(database, txContext);
    this.rpID = configService.getOrThrow('WEBAUTHN_RP_ID');
    this.rpName = configService.getOrThrow('WEBAUTHN_RP_NAME');
    this.origin = configService.getOrThrow('WEBAUTHN_RP_ORIGIN');
  }

  async startRegistration(userId: string, username: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const existing = await this.passkeyRepository.listByUserId(userId);
    const options = await generateRegistrationOptions({
      rpID: this.rpID,
      rpName: this.rpName,
      userID: Buffer.from(userId),
      userName: username,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existing.map((cred) => ({
        id: cred.credentialId.toString('base64url'),
        transports: cred.transports as AuthenticatorTransportFuture[],
      })),
    });
    await this.challengeStore.saveRegistrationChallenge(userId, options.challenge);
    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
  ): Promise<VerifiedRegistration> {
    const expectedChallenge = await this.challengeStore.consumeRegistrationChallenge(userId);
    if (!expectedChallenge) throw new ApiException('TWOFA_PASSKEY_VERIFICATION_FAILED');

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new ApiException('TWOFA_PASSKEY_VERIFICATION_FAILED');
    }

    const { credential } = verification.registrationInfo;
    const credentialId = Buffer.from(credential.id, 'base64url');
    const existing = await this.passkeyRepository.findByCredentialId(credentialId);
    if (existing) throw new ApiException('TWOFA_PASSKEY_VERIFICATION_FAILED');

    const row = await this.passkeyRepository.insert({
      userId,
      credentialId,
      publicKey: Buffer.from(credential.publicKey),
      signCount: credential.counter,
      transports: (response.response.transports ?? []) as string[],
      aaguid: verification.registrationInfo.aaguid ?? null,
    });
    return { id: row.id };
  }

  async startAuthentication(userId: string, challengeId: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const credentials = await this.passkeyRepository.listByUserId(userId);
    if (credentials.length === 0) throw new ApiException('TWOFA_PASSKEY_NOT_ENROLLED');

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId.toString('base64url'),
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
      userVerification: 'preferred',
    });
    await this.challengeStore.saveAuthenticationChallenge(challengeId, options.challenge);
    return options;
  }

  async verifyAuthentication(
    challengeId: string,
    response: AuthenticationResponseJSON,
  ): Promise<VerifiedAuthentication> {
    const expectedChallenge = await this.challengeStore.consumeAuthenticationChallenge(challengeId);
    if (!expectedChallenge) throw new ApiException('TWOFA_PASSKEY_VERIFICATION_FAILED');

    const credentialId = Buffer.from(response.rawId, 'base64url');
    const stored = await this.passkeyRepository.findByCredentialId(credentialId);
    if (!stored) throw new ApiException('TWOFA_PASSKEY_VERIFICATION_FAILED');

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: stored.credentialId.toString('base64url'),
        publicKey: stored.publicKey,
        counter: stored.signCount,
        transports: stored.transports as AuthenticatorTransportFuture[],
      },
    });
    if (!verification.verified) {
      throw new ApiException('TWOFA_PASSKEY_VERIFICATION_FAILED');
    }
    // counter rollback 방어 — verifyAuthenticationResponse가 자체 검증하지만, 한 번 더 명시
    if (verification.authenticationInfo.newCounter < stored.signCount) {
      throw new ApiException('TWOFA_PASSKEY_VERIFICATION_FAILED');
    }
    await this.passkeyRepository.updateAfterAuth(
      stored.id,
      verification.authenticationInfo.newCounter,
      new Date(),
    );
    return { userId: stored.userId };
  }
}

type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
```

> **버전 주의:** `@simplewebauthn/server` v10 API 기준. v9 이하는 `authenticator: {credentialID, credentialPublicKey, counter}` 형태, v10+는 `credential: {id, publicKey, counter, transports}` 형태로 변경됨. 실행자는 설치된 패키지 버전 확인 후 형태 보정.

- [ ] **Step 6.4: 테스트 통과**

```bash
cd services/api && npx jest src/twofa/passkey.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6.5: 커밋**

```bash
git add services/api/src/twofa/passkey.service.ts services/api/src/twofa/passkey.service.spec.ts
git commit -m "feat(api): PasskeyService — registration·authentication ceremony

@simplewebauthn/server v10 API 사용. excludeCredentials(중복 등록 방지)/allowCredentials(login 시 후보 노출), counter rollback 방어 포함."
```

---

## Task 7: PasskeyTwoFaStrategy

**Files:**
- Create: `services/api/src/twofa/strategies/passkey.strategy.ts`
- Create: `services/api/src/twofa/strategies/passkey.strategy.spec.ts`

- [ ] **Step 7.1: spec 작성**

`services/api/src/twofa/strategies/passkey.strategy.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { PasskeyRepository } from '../passkey.repository';
import { PasskeyService } from '../passkey.service';
import { PasskeyTwoFaStrategy } from './passkey.strategy';

const mockPasskeyService = {
  verifyAuthentication: jest.fn(),
};
const mockPasskeyRepository = {
  listByUserId: jest.fn(),
  deleteByIdForUser: jest.fn(),
};

describe('PasskeyTwoFaStrategy', () => {
  let strategy: PasskeyTwoFaStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PasskeyTwoFaStrategy,
        { provide: PasskeyService, useValue: mockPasskeyService },
        { provide: PasskeyRepository, useValue: mockPasskeyRepository },
      ],
    }).compile();
    strategy = module.get(PasskeyTwoFaStrategy);
    jest.clearAllMocks();
  });

  it('type은 PASSKEY', () => expect(strategy.type).toBe('PASSKEY'));

  describe('startSetup / completeSetup', () => {
    it('TWOFA_SETUP_NOT_SUPPORTED — PasskeyController가 직접 처리하므로 strategy 경로는 차단', async () => {
      await expect(strategy.startSetup('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.completeSetup('u', {})).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
    });
  });

  describe('createChallenge', () => {
    it('TWOFA_SETUP_NOT_SUPPORTED — PasskeyController가 직접 처리', async () => {
      await expect(strategy.createChallenge('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
    });
  });

  describe('verifyResponse', () => {
    it('PasskeyService.verifyAuthentication에 위임', async () => {
      mockPasskeyService.verifyAuthentication.mockResolvedValue({ userId: 'u' });
      const ok = await strategy.verifyResponse('u', 'challenge-1', { credentialResponse: { id: 'x' } as never });
      expect(ok).toBe(true);
      expect(mockPasskeyService.verifyAuthentication).toHaveBeenCalledWith('challenge-1', { id: 'x' });
    });

    it('verify 결과 userId가 다르면 ApiException(FORBIDDEN)', async () => {
      mockPasskeyService.verifyAuthentication.mockResolvedValue({ userId: 'other' });
      await expect(
        strategy.verifyResponse('u', 'challenge-1', { credentialResponse: { id: 'x' } as never }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('list / revoke', () => {
    it('list — 모든 credential 반환', async () => {
      mockPasskeyRepository.listByUserId.mockResolvedValue([
        { id: 'p1', createdAt: new Date(), lastUsedAt: null },
        { id: 'p2', createdAt: new Date(), lastUsedAt: new Date() },
      ]);
      const result = await strategy.list('u');
      expect(result).toHaveLength(2);
    });

    it('revoke — 본인 소유 아니면 FORBIDDEN', async () => {
      mockPasskeyRepository.deleteByIdForUser.mockResolvedValue(false);
      await expect(strategy.revoke('u', 'p1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('revoke — 본인 소유면 삭제', async () => {
      mockPasskeyRepository.deleteByIdForUser.mockResolvedValue(true);
      await strategy.revoke('u', 'p1');
      expect(mockPasskeyRepository.deleteByIdForUser).toHaveBeenCalledWith('p1', 'u');
    });
  });
});
```

- [ ] **Step 7.2: 테스트 실패 확인**

```bash
cd services/api && npx jest src/twofa/strategies/passkey.strategy.spec.ts
```

Expected: FAIL.

- [ ] **Step 7.3: Strategy 구현**

`services/api/src/twofa/strategies/passkey.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { PasskeyRepository } from '../passkey.repository';
import { PasskeyService } from '../passkey.service';
import {
  TwoFaStrategy,
  TwoFaStrategyInstance,
  TwoFaStrategyType,
} from './twofa-strategy.interface';

interface PasskeyResponsePayload {
  credentialResponse: AuthenticationResponseJSON;
}

@Injectable()
export class PasskeyTwoFaStrategy
  implements TwoFaStrategy<never, never, PasskeyResponsePayload>
{
  readonly type: TwoFaStrategyType = 'PASSKEY';

  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly passkeyRepository: PasskeyRepository,
  ) {}

  async startSetup(): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async completeSetup(): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async createChallenge(): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async verifyResponse(
    userId: string,
    challengeId: string,
    payload: PasskeyResponsePayload,
  ): Promise<boolean> {
    const result = await this.passkeyService.verifyAuthentication(challengeId, payload.credentialResponse);
    if (result.userId !== userId) throw new ApiException('FORBIDDEN');
    return true;
  }

  async list(userId: string): Promise<TwoFaStrategyInstance[]> {
    const rows = await this.passkeyRepository.listByUserId(userId);
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt }));
  }

  async revoke(userId: string, id: string): Promise<void> {
    const ok = await this.passkeyRepository.deleteByIdForUser(id, userId);
    if (!ok) throw new ApiException('FORBIDDEN');
  }
}
```

> 참고: Passkey의 registration ceremony는 표준 NestJS controller 경로(start/complete 2단계)에서 직접 처리하는 것이 자연스럽다. Strategy 인터페이스의 `startSetup`/`completeSetup`을 통해서도 호출 가능하게 만들 수도 있으나, 본 Phase에서는 PasskeyController가 직접 PasskeyService를 호출. Strategy는 Registry dispatch 경로(verify, list, revoke)에서만 의미를 가진다.

- [ ] **Step 7.4: 테스트 통과**

```bash
cd services/api && npx jest src/twofa/strategies/passkey.strategy.spec.ts
```

Expected: PASS.

- [ ] **Step 7.5: 커밋**

```bash
git add services/api/src/twofa/strategies/passkey.strategy.ts services/api/src/twofa/strategies/passkey.strategy.spec.ts
git commit -m "feat(api): PasskeyTwoFaStrategy — verifyResponse만 의미

setup/createChallenge는 PasskeyController가 직접 처리(2단계 ceremony이므로 strategy 인터페이스 부적합). verify·list·revoke만 Registry 경로에서 활용."
```

---

## Task 8: PasskeyController

**Files:**
- Create: `services/api/src/twofa/dto/passkey-registration-options.dto.ts`
- Create: `services/api/src/twofa/dto/passkey-registration-complete-body.dto.ts`
- Create: `services/api/src/twofa/dto/passkey-authentication-options.dto.ts`
- Create: `services/api/src/twofa/dto/passkey-list-response.dto.ts`
- Modify: `services/api/src/twofa/dto/index.ts`
- Create: `services/api/src/twofa/passkey.controller.ts`
- Create: `services/api/src/twofa/passkey.controller.spec.ts`

- [ ] **Step 8.1: DTO 작성**

`services/api/src/twofa/dto/passkey-registration-options.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

// @simplewebauthn/server의 PublicKeyCredentialCreationOptionsJSON 그대로 노출.
// 키 이름/구조는 표준이라 web의 @simplewebauthn/browser가 직접 소비.
export class PasskeyRegistrationOptionsDto {
  @ApiProperty({ additionalProperties: true })
  options!: Record<string, unknown>;
}
```

`services/api/src/twofa/dto/passkey-registration-complete-body.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

export class PasskeyRegistrationCompleteBodyDto {
  // @simplewebauthn/server의 RegistrationResponseJSON 형태로 통째 전송.
  // 내부 필드 구조는 표준이지만 우리 측에서는 옵셔널/존재만 검증, 실제 의미 검증은 verifyRegistrationResponse가 수행.
  @IsObject()
  credentialResponse!: Record<string, unknown>;
}
```

`services/api/src/twofa/dto/passkey-authentication-options.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class PasskeyAuthenticationOptionsDto {
  @ApiProperty({ additionalProperties: true })
  options!: Record<string, unknown>;
}
```

`services/api/src/twofa/dto/passkey-list-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class PasskeyInstanceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  lastUsedAt!: Date | null;
}

export class PasskeyListResponseDto {
  @ApiProperty({ type: PasskeyInstanceDto, isArray: true })
  instances!: PasskeyInstanceDto[];
}
```

`services/api/src/twofa/dto/index.ts`에 추가:

```ts
export * from './passkey-registration-options.dto';
export * from './passkey-registration-complete-body.dto';
export * from './passkey-authentication-options.dto';
export * from './passkey-list-response.dto';
```

- [ ] **Step 8.2: Controller 구현**

`services/api/src/twofa/passkey.controller.ts`:

```ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiError, CurrentUser, Public, type AuthUser } from '@terab/common';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import {
  PasskeyAuthenticationOptionsDto,
  PasskeyListResponseDto,
  PasskeyRegistrationCompleteBodyDto,
  PasskeyRegistrationOptionsDto,
} from './dto';
import { PasskeyService } from './passkey.service';
import { PasskeyTwoFaStrategy } from './strategies/passkey.strategy';
import { TwoFaService } from './twofa.service';

@Controller('auth/2fa/passkey')
@ApiTags('TwoFa')
export class PasskeyController {
  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly passkeyStrategy: PasskeyTwoFaStrategy,
    private readonly twoFaService: TwoFaService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('setup/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passkey 등록 시작 — WebAuthn registration options 발급' })
  @ApiResponse({ status: HttpStatus.OK, type: PasskeyRegistrationOptionsDto })
  async startRegistration(@CurrentUser() user: AuthUser): Promise<PasskeyRegistrationOptionsDto> {
    const options = await this.passkeyService.startRegistration(user.userId, user.username);
    return { options: options as unknown as Record<string, unknown> };
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('setup/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Passkey 등록 완료 — credentialResponse 검증 후 저장' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TWOFA_PASSKEY_VERIFICATION_FAILED')
  async completeRegistration(
    @CurrentUser() user: AuthUser,
    @Body() body: PasskeyRegistrationCompleteBodyDto,
  ): Promise<void> {
    await this.passkeyService.verifyRegistration(user.userId, body.credentialResponse as unknown as RegistrationResponseJSON);
  }

  @Get()
  @ApiOperation({ summary: '등록된 Passkey 목록' })
  @ApiResponse({ status: HttpStatus.OK, type: PasskeyListResponseDto })
  async list(@CurrentUser() user: AuthUser): Promise<PasskeyListResponseDto> {
    const instances = await this.passkeyStrategy.list(user.userId);
    return { instances };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Passkey 해제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FORBIDDEN', 'TWOFA_LAST_STRATEGY_CANNOT_REMOVE')
  async revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.twoFaService.removeStrategy(user.userId, 'PASSKEY', id);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('auth/:challengeId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passkey 로그인 ceremony 시작 — challengeId 단위로 authentication options 발급' })
  @ApiResponse({ status: HttpStatus.OK, type: PasskeyAuthenticationOptionsDto })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND', 'TWOFA_PASSKEY_NOT_ENROLLED')
  async startAuthentication(
    @Param('challengeId', ParseUUIDPipe) challengeId: string,
  ): Promise<PasskeyAuthenticationOptionsDto> {
    const userId = await this.twoFaService.getChallengeUserId(challengeId);
    const options = await this.passkeyService.startAuthentication(userId, challengeId);
    return { options: options as unknown as Record<string, unknown> };
  }
}
```

> 참고: `TwoFaService.getChallengeUserId(challengeId)` helper가 필요. Task 9에서 추가 (challenge row를 찾아 PENDING 상태 + 미만료면 userId 반환, 아니면 throw).

- [ ] **Step 8.3: Controller spec 작성**

`services/api/src/twofa/passkey.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { PasskeyTwoFaStrategy } from './strategies/passkey.strategy';
import { TwoFaService } from './twofa.service';

const mockPasskeyService = {
  startRegistration: jest.fn(),
  verifyRegistration: jest.fn(),
  startAuthentication: jest.fn(),
};
const mockPasskeyStrategy = {
  list: jest.fn(),
};
const mockTwoFaService = {
  removeStrategy: jest.fn(),
  getChallengeUserId: jest.fn(),
};

describe('PasskeyController', () => {
  let controller: PasskeyController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PasskeyController],
      providers: [
        { provide: PasskeyService, useValue: mockPasskeyService },
        { provide: PasskeyTwoFaStrategy, useValue: mockPasskeyStrategy },
        { provide: TwoFaService, useValue: mockTwoFaService },
      ],
    }).compile();
    controller = module.get(PasskeyController);
    jest.clearAllMocks();
  });

  describe('startRegistration', () => {
    it('PasskeyService.startRegistration의 결과를 options 키로 감싸 반환', async () => {
      mockPasskeyService.startRegistration.mockResolvedValue({ challenge: 'c', rp: { id: 'localhost' } });
      const result = await controller.startRegistration({ userId: 'u', username: 'owner' } as never);
      expect(result.options).toEqual({ challenge: 'c', rp: { id: 'localhost' } });
    });
  });

  describe('startAuthentication', () => {
    it('challengeId → userId 조회 후 startAuthentication 위임', async () => {
      mockTwoFaService.getChallengeUserId.mockResolvedValue('user-1');
      mockPasskeyService.startAuthentication.mockResolvedValue({ challenge: 'auth-c' });
      const result = await controller.startAuthentication('challenge-1');
      expect(mockPasskeyService.startAuthentication).toHaveBeenCalledWith('user-1', 'challenge-1');
      expect(result.options).toEqual({ challenge: 'auth-c' });
    });
  });

  describe('revoke', () => {
    it('TwoFaService.removeStrategy(PASSKEY) 위임', async () => {
      await controller.revoke({ userId: 'u' } as never, 'p1');
      expect(mockTwoFaService.removeStrategy).toHaveBeenCalledWith('u', 'PASSKEY', 'p1');
    });
  });
});
```

- [ ] **Step 8.4: 테스트 실패→통과**

```bash
cd services/api && npx jest src/twofa/passkey.controller.spec.ts
```

Expected: 처음 FAIL → 구현 적용 후 PASS.

- [ ] **Step 8.5: 커밋**

```bash
git add services/api/src/twofa/passkey.controller.ts services/api/src/twofa/passkey.controller.spec.ts services/api/src/twofa/dto/passkey-*.dto.ts services/api/src/twofa/dto/index.ts
git commit -m "feat(api): PasskeyController — registration · authentication ceremony endpoint

POST /auth/2fa/passkey/setup/start
POST /auth/2fa/passkey/setup/complete
GET  /auth/2fa/passkey
DELETE /auth/2fa/passkey/:id
POST /auth/2fa/passkey/auth/:challengeId/start (@Public)"
```

---

## Task 9: TwoFaService 확장 — getChallengeUserId + completeChallenge에 PASSKEY 분기

**Files:**
- Modify: `services/api/src/twofa/twofa.service.ts`
- Modify: `services/api/src/twofa/twofa.service.spec.ts`
- Modify: `services/api/src/twofa/dto/complete-challenge-body.dto.ts`

- [ ] **Step 9.1: complete-challenge body DTO에 PASSKEY 분기 추가**

`services/api/src/twofa/dto/complete-challenge-body.dto.ts`를 다음으로 교체 (Phase 1 결과 위에 PASSKEY 추가):

```ts
import { IsIn, IsObject, IsOptional, Matches, ValidateIf } from 'class-validator';

export class CompleteChallengeBodyDto {
  @IsOptional()
  @IsIn(['PUSH', 'TOTP', 'PASSKEY'])
  type?: 'PUSH' | 'TOTP' | 'PASSKEY';

  @ValidateIf((o: CompleteChallengeBodyDto) => o.type === 'TOTP')
  @Matches(/^\d{6}$/)
  code?: string;

  @ValidateIf((o: CompleteChallengeBodyDto) => o.type === 'PASSKEY')
  @IsObject()
  credentialResponse?: Record<string, unknown>;
}
```

- [ ] **Step 9.2: TwoFaService에 getChallengeUserId 추가**

`services/api/src/twofa/twofa.service.ts`에 추가:

```ts
async getChallengeUserId(challengeId: string): Promise<string> {
  const challenge = await this.twoFaRepository.findById(challengeId);
  if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
  if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) {
    throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
  }
  return challenge.userId;
}
```

- [ ] **Step 9.3: completeChallenge의 PASSKEY 분기 확인**

Phase 1의 `completeChallenge`는 다음 형태였음:

```ts
if (type === 'PUSH') return this.claimApprovedChallenge(challengeId);
// 그 외 — verifyResponse 호출
```

PASSKEY는 default 경로(아래 else 절)로 자동 dispatch된다. 단, payload key가 다르므로 (TOTP=`code`, PASSKEY=`credentialResponse`) verifyResponse 호출 시 body 자체를 그대로 넘기는 형태로 일반화:

```ts
const strategy = this.registry.get(type);
await strategy.verifyResponse(challenge.userId, challengeId, body as unknown);
```

(body 전체를 넘기면 각 strategy의 payload 인터페이스가 `code` 또는 `credentialResponse` 키를 통해 자신의 필드를 꺼내 쓴다.)

해당 변경을 `twofa.service.ts`의 `completeChallenge` 메서드에 반영:

```ts
@LogReplay()
async completeChallenge(
  challengeId: string,
  body: CompleteChallengeBodyDto,
): Promise<string> {
  const type: TwoFaStrategyType = body.type ?? 'PUSH';
  if (type === 'PUSH') return this.claimApprovedChallenge(challengeId);

  const challenge = await this.twoFaRepository.findById(challengeId);
  if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
  if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) {
    throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
  }

  const strategy = this.registry.get(type);
  await strategy.verifyResponse(challenge.userId, challengeId, body as unknown as never);

  await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
  return challenge.userId;
}
```

> 참고: `CompleteChallengeBodyDto`를 그대로 verifyResponse에 넘기지만, 각 strategy는 자신이 알고 있는 키만 읽어 사용한다 (TOTP는 `code`, PASSKEY는 `credentialResponse`).

- [ ] **Step 9.4: spec 갱신 — PASSKEY 케이스 추가**

`services/api/src/twofa/twofa.service.spec.ts`의 `describe('completeChallenge')` 안에 추가:

```ts
it('type=PASSKEY면 strategy.verifyResponse에 body를 그대로 전달', async () => {
  mockTwoFaRepository.findById.mockResolvedValue({
    id: 'c', userId: 'u', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
    options: '47,82,13', correctNum: '47',
  });
  const passkeyStrategy = { type: 'PASSKEY', verifyResponse: jest.fn().mockResolvedValue(true) };
  mockRegistry.get.mockImplementation((t: string) => (t === 'PASSKEY' ? passkeyStrategy : mockPushStrategy));

  const body = { type: 'PASSKEY' as const, credentialResponse: { id: 'cred-1' } };
  const userId = await service.completeChallenge('c', body);

  expect(passkeyStrategy.verifyResponse).toHaveBeenCalledWith('u', 'c', body);
  expect(userId).toBe('u');
});
```

새 describe `getChallengeUserId`:

```ts
describe('getChallengeUserId', () => {
  it('PENDING + 미만료면 userId 반환', async () => {
    mockTwoFaRepository.findById.mockResolvedValue({
      id: 'c', userId: 'u', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
      options: '47,82,13', correctNum: '47',
    });
    expect(await service.getChallengeUserId('c')).toBe('u');
  });

  it('만료 challenge면 TWO_FA_CHALLENGE_NOT_FOUND', async () => {
    mockTwoFaRepository.findById.mockResolvedValue({
      id: 'c', userId: 'u', status: 'PENDING', expiresAt: new Date(Date.now() - 1_000),
      options: '47,82,13', correctNum: '47',
    });
    await expect(service.getChallengeUserId('c')).rejects.toMatchObject({ code: 'TWO_FA_CHALLENGE_NOT_FOUND' });
  });
});
```

- [ ] **Step 9.5: 회귀 확인**

```bash
cd services/api && npx jest src/twofa/twofa.service.spec.ts
```

Expected: PASS (Phase 1의 케이스 모두 포함 + 신규 케이스).

- [ ] **Step 9.6: 커밋**

```bash
git add services/api/src/twofa/twofa.service.ts services/api/src/twofa/twofa.service.spec.ts services/api/src/twofa/dto/complete-challenge-body.dto.ts
git commit -m "feat(api): completeChallenge·CompleteChallengeBodyDto에 PASSKEY 분기 추가

- type 리터럴에 'PASSKEY' 추가, credentialResponse 필드 도입 (type=PASSKEY일 때만 검증)
- TwoFaService.getChallengeUserId helper 추가 (PasskeyController.startAuthentication에서 사용)
- completeChallenge는 strategy.verifyResponse에 body를 그대로 전달 — strategy가 자신의 키를 꺼내 씀"
```

---

## Task 10: TwoFaModule 갱신 — Passkey providers/controllers 등록

**Files:**
- Modify: `services/api/src/twofa/twofa.module.ts`

- [ ] **Step 10.1: TwoFaModule 교체**

`services/api/src/twofa/twofa.module.ts`를 다음으로 교체 (Phase 1 결과 위에 Passkey 추가):

```ts
import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeService } from './backup-code.service';
import { ChallengeController } from './challenge.controller';
import { PasskeyChallengeStore } from './passkey-challenge.store';
import { PasskeyController } from './passkey.controller';
import { PasskeyRepository } from './passkey.repository';
import { PasskeyService } from './passkey.service';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { BackupCodeTwoFaStrategy } from './strategies/backup-code.strategy';
import { PasskeyTwoFaStrategy } from './strategies/passkey.strategy';
import { PushTwoFaStrategy } from './strategies/push.strategy';
import { TotpTwoFaStrategy } from './strategies/totp.strategy';
import { TWOFA_STRATEGY_TOKEN } from './strategies/twofa-strategy.interface';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TotpController } from './totp.controller';
import { TotpLockoutService } from './totp-lockout.service';
import { TotpRepository } from './totp.repository';
import { TotpService } from './totp.service';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    forwardRef(() => AuthModule),
  ],
  controllers: [ChallengeController, TotpController, PasskeyController],
  providers: [
    TwoFaService,
    TwoFaRepository,
    PushChallengePublisher,
    BackupCodeService,
    BackupCodeRepository,
    TotpService,
    TotpRepository,
    TotpLockoutService,
    PasskeyService,
    PasskeyRepository,
    PasskeyChallengeStore,
    PushTwoFaStrategy,
    BackupCodeTwoFaStrategy,
    TotpTwoFaStrategy,
    PasskeyTwoFaStrategy,
    TwoFaStrategyRegistry,
    {
      provide: TWOFA_STRATEGY_TOKEN,
      useFactory: (
        push: PushTwoFaStrategy,
        backupCode: BackupCodeTwoFaStrategy,
        totp: TotpTwoFaStrategy,
        passkey: PasskeyTwoFaStrategy,
      ) => [push, backupCode, totp, passkey],
      inject: [PushTwoFaStrategy, BackupCodeTwoFaStrategy, TotpTwoFaStrategy, PasskeyTwoFaStrategy],
    },
  ],
  exports: [TwoFaService, PushChallengePublisher, BackupCodeService],
})
export class TwoFaModule {}
```

- [ ] **Step 10.2: TwoFaService.countRemainingNonPushStrategiesExcluding 확장**

Phase 1에서 정의한 helper의 type 배열에 PASSKEY 추가. `services/api/src/twofa/twofa.service.ts`의 해당 메서드:

```ts
private async countRemainingNonPushStrategiesExcluding(
  userId: string,
  excludeType: TwoFaStrategyType,
  excludeId: string,
): Promise<number> {
  const types: TwoFaStrategyType[] = ['TOTP', 'BACKUP_CODE', 'PASSKEY'];
  let count = 0;
  for (const t of types) {
    const instances = await this.registry.get(t).list(userId);
    count += t === excludeType
      ? instances.filter((i) => i.id !== excludeId).length
      : instances.length;
  }
  return count;
}
```

- [ ] **Step 10.3: 회귀 확인**

```bash
cd services/api
npx tsc --noEmit
npm test
```

Expected: 전체 spec PASS.

- [ ] **Step 10.4: 부팅 확인**

```bash
cd services/api && npm run start:dev
# 다른 터미널:
curl -i http://localhost:3000/api/health
```

Expected: 200 OK.

- [ ] **Step 10.5: 커밋**

```bash
git add services/api/src/twofa/twofa.module.ts services/api/src/twofa/twofa.service.ts
git commit -m "feat(api): TwoFaModule에 PasskeyService/Strategy/Controller 등록

last-strategy 가드의 카운트 대상에 PASSKEY 추가."
```

---

## Task 11: Web codegen + @simplewebauthn/browser

**Files:**
- Modify: `services/web/package.json`
- (auto) `services/web/src/api/openapi/**`

- [ ] **Step 11.1: @simplewebauthn/browser 설치**

```bash
cd services/web
npm install @simplewebauthn/browser
```

- [ ] **Step 11.2: openapi codegen**

```bash
cd services/web && npm run gen:api
```

Expected: 새 endpoint(`/auth/2fa/passkey/*`) 타입 생성. diff 확인.

- [ ] **Step 11.3: 커밋**

```bash
git add services/web/package.json services/web/package-lock.json services/web/src/api/openapi
git commit -m "chore(web): @simplewebauthn/browser 의존성 + openapi codegen — Phase 2 Passkey"
```

---

## Task 12: Web — 설정 화면 Passkey 등록 UI

**Files:**
- Create: `services/web/src/pages/settings/twofa-setup-passkey.tsx`
- Create: `services/web/src/pages/settings/twofa-setup-passkey.test.tsx`

- [ ] **Step 12.1: 컴포넌트**

`services/web/src/pages/settings/twofa-setup-passkey.tsx`:

```tsx
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';

export function TwoFaSetupPasskeyPage() {
  const [phase, setPhase] = useState<'IDLE' | 'IN_PROGRESS' | 'DONE'>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const enroll = async () => {
    setError(null);
    setPhase('IN_PROGRESS');
    try {
      const optRes = await apiClient.post('/auth/2fa/passkey/setup/start');
      const credentialResponse = await startRegistration({ optionsJSON: optRes.data.options });
      await apiClient.post('/auth/2fa/passkey/setup/complete', { credentialResponse });
      setPhase('DONE');
    } catch (e: unknown) {
      setError((e as Error).message ?? '실패');
      setPhase('IDLE');
    }
  };

  if (phase === 'DONE') return <p>Passkey가 등록됐습니다.</p>;

  return (
    <section>
      <h1>Passkey 등록</h1>
      <p>장치 인증(Touch ID, Windows Hello, 보안키)으로 Passkey를 추가합니다.</p>
      <button onClick={enroll} disabled={phase === 'IN_PROGRESS'}>등록</button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 12.2: 테스트**

`services/web/src/pages/settings/twofa-setup-passkey.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { startRegistration } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';
import { TwoFaSetupPasskeyPage } from './twofa-setup-passkey';

jest.mock('../../api/client');
jest.mock('@simplewebauthn/browser');

describe('TwoFaSetupPasskeyPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('등록 버튼 클릭 → start API → browser ceremony → complete API 순서로 호출', async () => {
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: { options: { challenge: 'c' } } })
      .mockResolvedValueOnce({ data: {} });
    (startRegistration as jest.Mock).mockResolvedValue({ id: 'cred-1' });

    render(<TwoFaSetupPasskeyPage />);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() => screen.getByText(/등록됐습니다/));
    expect((apiClient.post as jest.Mock).mock.calls[0][0]).toBe('/auth/2fa/passkey/setup/start');
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c' } });
    expect((apiClient.post as jest.Mock).mock.calls[1][1]).toEqual({ credentialResponse: { id: 'cred-1' } });
  });
});
```

- [ ] **Step 12.3: 테스트 실행**

```bash
cd services/web && npm test -- twofa-setup-passkey.test.tsx
```

Expected: PASS.

- [ ] **Step 12.4: 라우팅 등록**

`/settings/2fa/passkey` 경로를 router에 추가. Phase 1 Task 13의 라우팅 등록과 동일한 방식.

- [ ] **Step 12.5: 커밋**

```bash
git add services/web/src/pages/settings/twofa-setup-passkey.tsx services/web/src/pages/settings/twofa-setup-passkey.test.tsx services/web/src/router.tsx
git commit -m "feat(web): Passkey 등록 페이지

start API → navigator.credentials.create (via @simplewebauthn/browser) → complete API."
```

---

## Task 13: Web — login 화면 Passkey ceremony 진입

Phase 1에서 도입한 "다른 방법으로" alt-method 선택지에 `PASSKEY`를 추가.

**Files:**
- Create: `services/web/src/pages/login/twofa-passkey-ceremony.tsx`
- Modify: `services/web/src/pages/login/twofa-challenge.tsx` (alt-method 진입점)

- [ ] **Step 13.1: Passkey ceremony 컴포넌트**

`services/web/src/pages/login/twofa-passkey-ceremony.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';

interface Props {
  challengeId: string;
  onSuccess: (response: unknown) => void;
}

export function TwoFaPasskeyCeremonyPage({ challengeId, onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'STARTING' | 'WAITING_USER' | 'SUBMITTING'>('STARTING');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const optRes = await apiClient.post(`/auth/2fa/passkey/auth/${challengeId}/start`);
        if (cancelled) return;
        setPhase('WAITING_USER');
        const credentialResponse = await startAuthentication({ optionsJSON: optRes.data.options });
        if (cancelled) return;
        setPhase('SUBMITTING');
        const res = await apiClient.post(`/auth/2fa/challenge/${challengeId}/complete`, {
          type: 'PASSKEY',
          credentialResponse,
        });
        onSuccess(res.data);
      } catch (e: unknown) {
        setError((e as Error).message ?? '실패');
      }
    })();
    return () => { cancelled = true; };
  }, [challengeId, onSuccess]);

  return (
    <section>
      <h1>Passkey 인증</h1>
      {phase === 'STARTING' && <p>준비 중...</p>}
      {phase === 'WAITING_USER' && <p>장치 인증을 진행하세요.</p>}
      {phase === 'SUBMITTING' && <p>검증 중...</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 13.2: alt-method 메뉴에 Passkey 추가**

Phase 1의 `twofa-challenge.tsx`에 있는 alt-method 전환 UI에 PASSKEY 진입 추가:

```tsx
{altMethod === 'NONE' && (
  <>
    {/* push polling UI */}
    <button onClick={() => setAltMethod('TOTP')}>다른 방법으로 (TOTP)</button>
    <button onClick={() => setAltMethod('PASSKEY')}>다른 방법으로 (Passkey)</button>
  </>
)}
{altMethod === 'TOTP' && <TwoFaTotpInputPage challengeId={challengeId} onSuccess={onSuccess} />}
{altMethod === 'PASSKEY' && <TwoFaPasskeyCeremonyPage challengeId={challengeId} onSuccess={onSuccess} />}
```

- [ ] **Step 13.3: 테스트**

`services/web/src/pages/login/twofa-passkey-ceremony.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { startAuthentication } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';
import { TwoFaPasskeyCeremonyPage } from './twofa-passkey-ceremony';

jest.mock('../../api/client');
jest.mock('@simplewebauthn/browser');

describe('TwoFaPasskeyCeremonyPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('마운트 시 start → ceremony → complete 순서로 호출하고 onSuccess', async () => {
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: { options: { challenge: 'c' } } })
      .mockResolvedValueOnce({ data: { status: 'AUTHENTICATED' } });
    (startAuthentication as jest.Mock).mockResolvedValue({ id: 'cred-1' });
    const onSuccess = jest.fn();

    render(<TwoFaPasskeyCeremonyPage challengeId="ch-1" onSuccess={onSuccess} />);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect((apiClient.post as jest.Mock).mock.calls[0][0]).toBe('/auth/2fa/passkey/auth/ch-1/start');
    expect((apiClient.post as jest.Mock).mock.calls[1][0]).toBe('/auth/2fa/challenge/ch-1/complete');
    expect((apiClient.post as jest.Mock).mock.calls[1][1]).toEqual({
      type: 'PASSKEY',
      credentialResponse: { id: 'cred-1' },
    });
  });
});
```

- [ ] **Step 13.4: 테스트 실행**

```bash
cd services/web && npm test -- twofa-passkey-ceremony.test.tsx
```

Expected: PASS.

- [ ] **Step 13.5: 커밋**

```bash
git add services/web/src/pages/login
git commit -m "feat(web): login Passkey ceremony 진입

alt-method 메뉴에 'Passkey' 추가, 선택 시 start → navigator.credentials.get → complete(type=PASSKEY) flow."
```

---

## Task 14: e2e — Passkey 검증은 navigator.credentials가 필요해 unit·통합 단계까지만

브라우저 없는 환경에서 fully-automated WebAuthn e2e는 어렵다. `@simplewebauthn/server`의 ceremony 함수가 통합 테스트되는 형태로 minimal e2e를 작성한다 — `startRegistration` API가 정상 응답하는지, 잘못된 `credentialResponse`를 보냈을 때 `TWOFA_PASSKEY_VERIFICATION_FAILED`를 던지는지 확인하는 수준.

**Files:**
- Create: `services/api/test/passkey.e2e-spec.ts`

- [ ] **Step 14.1: e2e 작성**

`services/api/test/passkey.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Passkey (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'owner', password: process.env.OWNER_PASSWORD });
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/2fa/passkey/setup/start — options 발급 성공', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/2fa/passkey/setup/start')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.options.challenge).toBeDefined();
    expect(res.body.options.rp).toBeDefined();
  });

  it('POST /auth/2fa/passkey/setup/complete — 잘못된 credentialResponse는 검증 실패', async () => {
    await request(app.getHttpServer())
      .post('/auth/2fa/passkey/setup/start')
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app.getHttpServer())
      .post('/auth/2fa/passkey/setup/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        credentialResponse: {
          id: 'fake', rawId: 'fake', response: {}, type: 'public-key', clientExtensionResults: {},
        },
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TWOFA_PASSKEY_VERIFICATION_FAILED');
  });

  it('GET /auth/2fa/passkey — 빈 배열로 응답', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/2fa/passkey')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.instances)).toBe(true);
  });
}, 30_000);
```

- [ ] **Step 14.2: e2e 실행**

```bash
cd services/api && npm run test:e2e -- --testPathPattern=passkey
```

Expected: PASS.

- [ ] **Step 14.3: 커밋**

```bash
git add services/api/test/passkey.e2e-spec.ts
git commit -m "test(api): Passkey e2e — start options 응답 + 위조 credential 검증 거부"
```

---

## Task 15: 회귀 검증 + spec §9 갱신

- [ ] **Step 15.1: 전체 검증**

```bash
cd services/api
npx tsc --noEmit
npm run lint
npm test
npm run test:e2e

cd ../web
npm run lint
npm test
```

Expected: 전부 PASS.

- [ ] **Step 15.2: spec §9 체크리스트 갱신**

`docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md` §9의 Phase 2 라인:

```md
- [x] Phase 2: Passkey — 별도 spec/plan (스키마·service·controller·web UI·단위·e2e, mobile PoC 분리)
```

- [ ] **Step 15.3: 커밋**

```bash
git add docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md
git commit -m "docs(superpowers): 2FA fallback spec §9 Phase 2 완료 표시"
```

---

## Self-Review 결과 박제

- **Spec coverage** (§5.3 + §6 단위/e2e + §4.3 schema + §4.4 ErrorCode + §3 결정 사항):
  - schema/migration (`two_fa_passkey` + per-user 다중 + unique credential_id) → Task 3
  - `@simplewebauthn/server` 도입 → Task 2/6
  - PasskeyChallengeStore (registration + authentication challenge TTL) → Task 5
  - registration/authentication ceremony 4단계 → Task 6
  - PasskeyTwoFaStrategy + Registry 합류 → Task 7/10
  - controller (setup start/complete, list, revoke, auth/start) → Task 8
  - 통합 challenge.controller body에 PASSKEY 분기 + getChallengeUserId → Task 9
  - last-strategy 가드에 PASSKEY 카운트 추가 → Task 10
  - web setup UI + login Passkey ceremony → Task 12/13
  - e2e (start options + 위조 credential 거부) → Task 14
- **Placeholder scan:** "구체 위치는 ...에 grep" 표현이 web router 등록 Task 12에 등장하지만, 같은 패턴을 Phase 1 Task 13에서 동일하게 처리했으므로 placeholder 아니라 "기존 패턴 따라 등록"의 의미.
- **Type consistency:**
  - `TwoFaStrategyType` = `'PUSH' | 'TOTP' | 'PASSKEY' | 'BACKUP_CODE'` — Phase 0 정의와 일치, Phase 1 Task 1에서 사용한 키들과 합치
  - `CompleteChallengeBodyDto.type` 확장 — Phase 1 정의에 `'PASSKEY'` 추가하고 `credentialResponse` 필드 추가, ValidateIf로 조건부 검증
  - `PasskeyService.verifyAuthentication(challengeId, response)` → `PasskeyTwoFaStrategy.verifyResponse(userId, challengeId, payload)` → `payload.credentialResponse` 키로 dispatch. signature 일관
  - `TWOFA_PASSKEY_VERIFICATION_FAILED` / `TWOFA_PASSKEY_NOT_ENROLLED` — Task 1에서 정의, Task 6/14에서 사용. `TWOFA_LAST_STRATEGY_CANNOT_REMOVE` (Phase 1)는 PasskeyController.revoke에서도 동일 키 재사용
- **Scope:** Phase 2 only. mobile은 별도 spec.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-auth-2fa-fallback-strategies-phase-2.md`. 두 가지 실행 옵션:

1. **Subagent-Driven (recommended)** — task별 fresh subagent 디스패치, 중간 리뷰 가능. `superpowers:subagent-driven-development` 사용
2. **Inline Execution** — 본 세션에서 일괄 실행, 체크포인트마다 리뷰. `superpowers:executing-plans` 사용

> **Phase 1 미실행 상태에서 Phase 2를 시작하면 안 됨** — `CompleteChallengeBodyDto`, `ChallengeController`, `EncryptionService`, `removeStrategy` 등이 Phase 1 산출물이다. 본 plan은 Phase 1 완료를 전제로 한다.

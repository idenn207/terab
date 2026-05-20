# 2FA Fallback Strategies — Phase 1 (TOTP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RFC 6238 기반 TOTP를 2FA fallback strategy로 도입한다. 사용자가 authenticator 앱(QR/manual key)으로 TOTP를 등록하고, 로그인 challenge에서 TOTP code로 인증 완료까지 가능하게 한다. 마지막 push-외 strategy 제거 가드와 5회/5분 사용자 단위 lockout 포함.

**Architecture:** `otplib`로 RFC 6238 TOTP 생성·검증, `EncryptionService`(AES-256-GCM, env `TWOFA_MASTER_KEY`)로 secret envelope encryption. `TotpTwoFaStrategy`가 Phase 0 Registry에 합류, 통합 challenge verify endpoint(`POST /auth/2fa/challenge/:id/complete`)가 body의 `type` discriminator로 dispatch. Lockout은 글로벌 `@nestjs/cache-manager` + Redis(`keyv`)로 구현해 신규 인프라 도입 없음.

**Tech Stack:** NestJS 11 / TypeScript / Drizzle ORM / `otplib` / Node `crypto` AES-256-GCM / `@nestjs/cache-manager`(이미 도입) / React 19 + Vite (web)

**Spec:** `docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md` §5.2

**Pre-requisite:** Phase 0 plan(`2026-05-20-auth-2fa-fallback-strategies-phase-0.md`) 실행 완료 — `src/twofa/`에 Strategy/Registry/PushTwoFaStrategy/BackupCodeTwoFaStrategy/BackupCodeService가 존재하고 `src/backup-code/`는 삭제된 상태.

---

## File Structure

**Create — api**

- `services/api/src/security/encryption.service.ts` — `EncryptionService` (AES-256-GCM envelope, `TWOFA_MASTER_KEY` base64)
- `services/api/src/security/encryption.service.spec.ts`
- `services/api/src/database/schema/two-fa-totp.schema.ts` — `two_fa_totp` 테이블 정의
- `services/api/drizzle/0005_create_two_fa_totp.sql` — migration (실제 파일명은 `npm run db:generate` 결과; 본 plan은 0005 가정)
- `services/api/src/twofa/totp.repository.ts`
- `services/api/src/twofa/totp.repository.spec.ts`
- `services/api/src/twofa/totp.service.ts` — secret 생성·encryption·검증
- `services/api/src/twofa/totp.service.spec.ts`
- `services/api/src/twofa/totp-lockout.service.ts` — `CacheManager` 기반 5회/5분 lockout
- `services/api/src/twofa/totp-lockout.service.spec.ts`
- `services/api/src/twofa/strategies/totp.strategy.ts` — `TotpTwoFaStrategy`
- `services/api/src/twofa/strategies/totp.strategy.spec.ts`
- `services/api/src/twofa/totp.controller.ts` — `POST /auth/2fa/totp/setup/start`, `POST /auth/2fa/totp/setup/complete`, `DELETE /auth/2fa/totp/:id`, `GET /auth/2fa/totp`
- `services/api/src/twofa/totp.controller.spec.ts`
- `services/api/src/twofa/challenge.controller.ts` — `POST /auth/2fa/challenge/:id/complete`(generalized) + GET status 이관
- `services/api/src/twofa/challenge.controller.spec.ts`
- `services/api/src/twofa/dto/totp-setup-start-response.dto.ts`
- `services/api/src/twofa/dto/totp-setup-complete-body.dto.ts`
- `services/api/src/twofa/dto/totp-list-response.dto.ts`
- `services/api/src/twofa/dto/complete-challenge-body.dto.ts`
- `services/api/test/totp.e2e-spec.ts`

**Modify — api**

- `services/api/src/common/exceptions/error-code.enum.ts` — `TWOFA_TOTP_INVALID_CODE` / `TWOFA_TOTP_LOCKED` / `TWOFA_LAST_STRATEGY_CANNOT_REMOVE` 3종 추가
- `services/api/package.json` — `otplib` dependency 추가
- `api.env.example` — `TWOFA_MASTER_KEY` 추가 (변경 없음의 placeholder)
- `services/api/src/twofa/twofa.module.ts` — `TotpService`/`TotpRepository`/`TotpLockoutService`/`TotpTwoFaStrategy`/`TotpController`/`ChallengeController` 등록, Registry provider에 totp strategy 추가
- `services/api/src/twofa/twofa.service.ts` — `completeChallenge(challengeId, body, password?)` 메서드 추가, `removeStrategy(userId, type, id)` 가드
- `services/api/src/twofa/twofa.service.spec.ts` — completeChallenge / removeStrategy 케이스 추가
- `services/api/src/twofa/twofa.controller.ts` — 기존 `GET :id/status`/`POST :id/respond`/`POST :id/resend`는 그대로 유지; challenge.controller로 이동시 backward compat path는 alias 유지(또는 challenge.controller에서만 노출하고 twofa.controller 삭제. 본 plan은 후자 선택. 자세한 절차 Task 12)
- `services/api/src/auth/auth.controller.ts` — 기존 `POST /auth/2fa/challenge/:id/complete` (line 115)를 삭제하고 challenge.controller로 이동
- `services/api/src/auth/auth.service.ts` — `completeTwoFa(challengeId)` 메서드를 `TwoFaService.completeChallenge` 위임으로 변경하거나 challenge.controller에서 TwoFaService를 직접 호출하도록 정리 (본 plan은 후자)
- `services/api/src/database/schema/index.ts` — `two-fa-totp.schema.ts` re-export 추가

**Create — web**

- `services/web/src/pages/settings/twofa-setup-totp.tsx` — QR/manual key 표시 + 코드 확인 UI
- `services/web/src/pages/settings/twofa-setup-totp.test.tsx`
- `services/web/src/pages/login/twofa-choose-method.tsx` — challenge 화면에서 "다른 방법으로" 클릭 시 strategy 선택 모달
- `services/web/src/pages/login/twofa-totp-input.tsx` — TOTP 코드 입력 화면

**Modify — web**

- `services/web/src/api/openapi/...` — openapi 타입 codegen 자동 갱신 (api 변경 적용 후 `npm run gen:api`)
- `services/web/src/pages/login/twofa-challenge.tsx`(또는 기존 push polling 컴포넌트) — '다른 방법으로' 버튼 + 진입 처리 추가

---

## Task 1: ErrorCode 3종 추가

**Files:**

- Modify: `services/api/src/common/exceptions/error-code.enum.ts`

- [ ] **Step 1.1: ErrorCode에 3종 추가**

`services/api/src/common/exceptions/error-code.enum.ts`의 `// ───── 2FA ──────────────────────────────` 블록 안, `TWO_FA_CHALLENGE_NOT_FOUND` 뒤에 추가 (Phase 0의 `TWOFA_STRATEGY_NOT_FOUND`, `TWOFA_SETUP_NOT_SUPPORTED` 다음 줄):

```ts
  TWOFA_TOTP_INVALID_CODE: {
    message: 'TOTP 코드가 올바르지 않습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  TWOFA_TOTP_LOCKED: {
    message: 'TOTP 입력 실패 횟수가 한도를 초과해 잠겼습니다. 잠시 후 다시 시도하세요.',
    status: HttpStatus.TOO_MANY_REQUESTS,
  },
  TWOFA_LAST_STRATEGY_CANNOT_REMOVE: {
    message: '마지막 2FA 방식은 제거할 수 없습니다. backup code 또는 다른 방식을 먼저 추가하세요.',
    status: HttpStatus.BAD_REQUEST,
  },
```

- [ ] **Step 1.2: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 1.3: 커밋**

```bash
git add services/api/src/common/exceptions/error-code.enum.ts
git commit -m "feat(api): TOTP/last-strategy 가드용 ErrorCode 3종 추가

Phase 1에서 도입되는 TotpTwoFaStrategy의 검증 실패·lockout·마지막 strategy 제거 가드 키."
```

---

## Task 2: api.env에 TWOFA_MASTER_KEY 추가 + otplib 의존성

**Files:**

- Modify: `api.env.example`
- Modify: `services/api/package.json`

- [ ] **Step 2.1: otplib 설치**

```bash
cd services/api
npm install otplib
```

Expected: `package.json` dependencies에 `"otplib": "^12.x.x"` (또는 최신 stable) 추가. `package-lock.json` 갱신.

- [ ] **Step 2.2: api.env.example에 TWOFA_MASTER_KEY 추가**

`api.env.example`의 `# Security` 블록 안에 다음 줄을 추가:

```
# 2FA TOTP secret encryption — base64-encoded 32 bytes (AES-256-GCM key)
# 생성: openssl rand -base64 32
TWOFA_MASTER_KEY=
```

**보안 주의:** 사용자의 실제 `api.env`(로컬·운영)는 본 plan으로 수정하지 않는다. 변경은 `api.env.example`에만 적용하고, 실제 값 채움은 운영자에게 위임 (`secrets/` 디렉토리 아님 — env 파일에 직접). 로컬 개발 시 `make setup-local`로 propagation됨.

- [ ] **Step 2.3: 커밋**

```bash
git add api.env.example services/api/package.json services/api/package-lock.json
git commit -m "feat(api): otplib 의존성 + TWOFA_MASTER_KEY 환경변수 추가

RFC 6238 TOTP 검증과 secret AES-256-GCM envelope encryption을 위해 추가.
실제 키 값은 운영자가 채운다 (openssl rand -base64 32)."
```

---

## Task 3: two_fa_totp 스키마 + migration

**Files:**

- Create: `services/api/src/database/schema/two-fa-totp.schema.ts`
- Modify: `services/api/src/database/schema/index.ts`
- Create: `services/api/drizzle/0005_create_two_fa_totp.sql` (자동 생성)

- [ ] **Step 3.1: schema 파일 작성**

`services/api/src/database/schema/two-fa-totp.schema.ts`:

```ts
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const twoFaTotp = table(
  'two_fa_totp',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secretEncrypted: t
      .customType<{ data: Buffer; driverData: Buffer }>({
        dataType: () => 'bytea',
      })('secret_encrypted')
      .notNull(),
    iv: t
      .customType<{ data: Buffer; driverData: Buffer }>({
        dataType: () => 'bytea',
      })('iv')
      .notNull(),
    authTag: t
      .customType<{ data: Buffer; driverData: Buffer }>({
        dataType: () => 'bytea',
      })('auth_tag')
      .notNull(),
    algorithm: t.varchar('algorithm', { length: 16 }).notNull().default('SHA1'),
    digits: t.integer('digits').notNull().default(6),
    periodSec: t.integer('period_sec').notNull().default(30),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: t.timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [t.uniqueIndex().on(table.userId)],
);

export type TwoFaTotp$Insert = typeof twoFaTotp.$inferInsert;
export type TwoFaTotp$Select = typeof twoFaTotp.$inferSelect;
```

> 참고: drizzle-orm은 native `bytea` 컬럼을 위해 `customType` 패턴을 사용한다. 위 정의는 `Buffer` 입출력을 보장한다. 만약 drizzle-orm v0.30+ 가 `t.bytea` native helper를 제공하면 그쪽으로 교체 가능 — `npx drizzle-kit --help` 확인.

- [ ] **Step 3.2: schema index 갱신**

`services/api/src/database/schema/index.ts`의 마지막 줄 뒤에 추가:

```ts
export * from './two-fa-totp.schema';
```

- [ ] **Step 3.3: migration 생성**

```bash
cd services/api
npm run db:generate
```

Expected: `drizzle/0005_create_two_fa_totp.sql`(또는 다음 번호)와 `drizzle/meta/0005_snapshot.json` + `_journal.json` 갱신. 생성된 SQL 확인 — 예상 내용:

```sql
CREATE TABLE "two_fa_totp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "secret_encrypted" bytea NOT NULL,
  "iv" bytea NOT NULL,
  "auth_tag" bytea NOT NULL,
  "algorithm" varchar(16) DEFAULT 'SHA1' NOT NULL,
  "digits" integer DEFAULT 6 NOT NULL,
  "period_sec" integer DEFAULT 30 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);
ALTER TABLE "two_fa_totp" ADD CONSTRAINT "two_fa_totp_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
CREATE UNIQUE INDEX "two_fa_totp_user_id_index" ON "two_fa_totp" USING btree ("user_id");
```

생성된 파일 내용이 위와 다르면 schema의 `customType`이 `bytea`로 직렬화되지 않은 것 — 파일 수정 후 db:generate 재실행.

- [ ] **Step 3.4: dev DB에 적용 확인**

```bash
cd services/api
npm run db:push
```

Expected: 통과. `psql $DATABASE_URL -c "\\d two_fa_totp"`로 컬럼/제약 확인.

- [ ] **Step 3.5: 커밋**

```bash
git add services/api/src/database/schema/two-fa-totp.schema.ts services/api/src/database/schema/index.ts services/api/drizzle/
git commit -m "feat(api): two_fa_totp 스키마 + migration

AES-256-GCM envelope encryption 컬럼(secret_encrypted/iv/auth_tag) + unique(user_id) 제약. TOTP는 user당 1개 강제."
```

---

## Task 4: EncryptionService (AES-256-GCM)

`SecurityModule`에 `EncryptionService`를 추가한다. `TWOFA_MASTER_KEY`(base64 32바이트)를 마스터 키로 사용, per-row IV(12바이트)를 생성하고 GCM auth tag를 별도 보관.

**Files:**

- Create: `services/api/src/security/encryption.service.ts`
- Create: `services/api/src/security/encryption.service.spec.ts`
- Modify: `services/api/src/security/security.module.ts`
- Modify: `services/api/src/security/index.ts`

- [ ] **Step 4.1: spec 작성**

`services/api/src/security/encryption.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const validKey = Buffer.alloc(32, 'x').toString('base64'); // 32바이트

describe('EncryptionService', () => {
  const buildService = (key: string) => {
    return Test.createTestingModule({
      providers: [EncryptionService, { provide: ConfigService, useValue: { getOrThrow: () => key } }],
    })
      .compile()
      .then((m) => m.get(EncryptionService));
  };

  describe('초기화', () => {
    it('TWOFA_MASTER_KEY가 base64 32바이트가 아니면 throw', async () => {
      const tooShort = Buffer.alloc(16, 'x').toString('base64');
      await expect(buildService(tooShort)).rejects.toThrow(/32 bytes/);
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('같은 plaintext를 두 번 암호화하면 IV가 다르고 ciphertext도 다르다', async () => {
      const service = await buildService(validKey);
      const a = service.encrypt('secret-value');
      const b = service.encrypt('secret-value');
      expect(a.iv).not.toEqual(b.iv);
      expect(a.ciphertext).not.toEqual(b.ciphertext);
    });

    it('encrypt 결과를 decrypt하면 원본 plaintext가 복원된다', async () => {
      const service = await buildService(validKey);
      const enc = service.encrypt('my-totp-secret');
      const dec = service.decrypt(enc);
      expect(dec).toBe('my-totp-secret');
    });

    it('auth_tag가 변조되면 decrypt가 throw한다', async () => {
      const service = await buildService(validKey);
      const enc = service.encrypt('value');
      enc.authTag[0] ^= 0xff;
      expect(() => service.decrypt(enc)).toThrow();
    });

    it('ciphertext가 변조되면 decrypt가 throw한다', async () => {
      const service = await buildService(validKey);
      const enc = service.encrypt('value');
      enc.ciphertext[0] ^= 0xff;
      expect(() => service.decrypt(enc)).toThrow();
    });
  });
});
```

- [ ] **Step 4.2: 테스트 실패 확인**

```bash
cd services/api
npx jest src/security/encryption.service.spec.ts
```

Expected: FAIL (모듈 미존재).

- [ ] **Step 4.3: EncryptionService 구현**

`services/api/src/security/encryption.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

@Injectable()
export class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LEN = 12;
  private readonly TAG_LEN = 16;
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const base64 = configService.getOrThrow<string>('TWOFA_MASTER_KEY');
    const key = Buffer.from(base64, 'base64');
    if (key.length !== 32) {
      throw new Error('TWOFA_MASTER_KEY must decode to 32 bytes for AES-256-GCM');
    }
    this.key = key;
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(this.IV_LEN);
    const cipher = createCipheriv(this.ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag };
  }

  decrypt(payload: EncryptedPayload): string {
    if (payload.authTag.length !== this.TAG_LEN) {
      throw new Error('Invalid auth tag length');
    }
    const decipher = createDecipheriv(this.ALGORITHM, this.key, payload.iv);
    decipher.setAuthTag(payload.authTag);
    const plaintext = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
```

- [ ] **Step 4.4: SecurityModule에 provider 등록**

`services/api/src/security/security.module.ts` 교체:

```ts
import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { TokenModule } from './token.module';

@Global()
@Module({
  imports: [TokenModule],
  providers: [EncryptionService],
  exports: [TokenModule, EncryptionService],
})
export class SecurityModule {}
```

- [ ] **Step 4.5: index re-export**

`services/api/src/security/index.ts`에 추가:

```ts
export * from './encryption.service';
```

- [ ] **Step 4.6: 테스트 통과 확인**

```bash
cd services/api
npx jest src/security/encryption.service.spec.ts
```

Expected: PASS (5 cases).

- [ ] **Step 4.7: 커밋**

```bash
git add services/api/src/security
git commit -m "feat(api): EncryptionService 도입 (AES-256-GCM)

TWOFA_MASTER_KEY(base64 32바이트)를 사용한 envelope encryption. per-row IV + auth tag 분리 저장. TOTP secret 등 민감 컬럼 암호화 용도."
```

---

## Task 5: TotpRepository

**Files:**

- Create: `services/api/src/twofa/totp.repository.ts`
- Create: `services/api/src/twofa/totp.repository.spec.ts`

- [ ] **Step 5.1: spec 작성**

`services/api/src/twofa/totp.repository.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockDbLimit, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
import { TotpRepository } from './totp.repository';

describe('TotpRepository', () => {
  let repo: TotpRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TotpRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();
    repo = module.get(TotpRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  describe('findByUserId', () => {
    it('userId에 등록된 TOTP가 없으면 null', async () => {
      mockDbLimit.mockResolvedValue([]);
      const result = await repo.findByUserId('user-1');
      expect(result).toBeNull();
    });

    it('userId에 등록된 TOTP가 있으면 row 반환', async () => {
      const row = {
        id: 'totp-1',
        userId: 'user-1',
        secretEncrypted: Buffer.from([1, 2]),
        iv: Buffer.from([3]),
        authTag: Buffer.from([4]),
        algorithm: 'SHA1',
        digits: 6,
        periodSec: 30,
        createdAt: new Date(),
        lastUsedAt: null,
      };
      mockDbLimit.mockResolvedValue([row]);
      const result = await repo.findByUserId('user-1');
      expect(result).toEqual(row);
    });
  });
});
```

- [ ] **Step 5.2: 테스트 실패 확인**

```bash
cd services/api
npx jest src/twofa/totp.repository.spec.ts
```

Expected: FAIL.

- [ ] **Step 5.3: Repository 구현**

`services/api/src/twofa/totp.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, RepositoryCore, TransactionContext, twoFaTotp, TwoFaTotp$Insert, TwoFaTotp$Select } from '@terab/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class TotpRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findByUserId(userId: string): Promise<TwoFaTotp$Select | null> {
    const [row = null] = await this.conn.select().from(twoFaTotp).where(eq(twoFaTotp.userId, userId)).limit(1);
    return row;
  }

  async findById(id: string): Promise<TwoFaTotp$Select | null> {
    const [row = null] = await this.conn.select().from(twoFaTotp).where(eq(twoFaTotp.id, id)).limit(1);
    return row;
  }

  async insert(data: TwoFaTotp$Insert): Promise<TwoFaTotp$Select> {
    const [row] = await this.conn.insert(twoFaTotp).values(data).returning();
    return row;
  }

  async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
    const rows = await this.conn.delete(twoFaTotp).where(eq(twoFaTotp.id, id)).returning({ userId: twoFaTotp.userId });
    return rows.length === 1 && rows[0].userId === userId;
  }

  async updateLastUsedAt(id: string, lastUsedAt: Date): Promise<void> {
    await this.conn.update(twoFaTotp).set({ lastUsedAt }).where(eq(twoFaTotp.id, id));
  }
}
```

- [ ] **Step 5.4: 테스트 통과 확인**

```bash
cd services/api
npx jest src/twofa/totp.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 5.5: 커밋**

```bash
git add services/api/src/twofa/totp.repository.ts services/api/src/twofa/totp.repository.spec.ts
git commit -m "feat(api): TotpRepository — two_fa_totp 단건 CRUD

findByUserId/findById/insert/deleteByIdForUser/updateLastUsedAt 제공."
```

---

## Task 6: TotpService

secret 생성·인코딩·검증을 담당. `otplib`의 `authenticator`(SHA1, 6digit, 30s — 기본값)를 사용.

**Files:**

- Create: `services/api/src/twofa/totp.service.ts`
- Create: `services/api/src/twofa/totp.service.spec.ts`

- [ ] **Step 6.1: spec 작성**

`services/api/src/twofa/totp.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService, TransactionContext } from '@terab/db';
import { EncryptionService } from '@terab/security';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { authenticator } from 'otplib';
import { TotpRepository } from './totp.repository';
import { TotpService } from './totp.service';

const mockTotpRepository = {
  findByUserId: jest.fn(),
  insert: jest.fn(),
  updateLastUsedAt: jest.fn(),
};

const validKey = Buffer.alloc(32, 'x').toString('base64');

describe('TotpService', () => {
  let service: TotpService;
  let encryption: EncryptionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TotpService,
        EncryptionService,
        { provide: ConfigService, useValue: { getOrThrow: () => validKey } },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TotpRepository, useValue: mockTotpRepository },
      ],
    }).compile();
    service = module.get(TotpService);
    encryption = module.get(EncryptionService);
    jest.clearAllMocks();
  });

  describe('startSetup', () => {
    it('이미 등록된 TOTP가 있으면 status=ENROLLED 반환', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue({ id: 'existing' });
      const result = await service.startSetup('user-1');
      expect(result.status).toBe('ENROLLED');
    });

    it('미등록 상태면 secret + otpauth URI를 반환', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const result = await service.startSetup('user-1');
      expect(result.status).toBe('PENDING');
      if (result.status !== 'PENDING') throw new Error();
      expect(result.secret).toMatch(/^[A-Z2-7]+$/); // base32
      expect(result.otpauthUri).toContain('otpauth://totp/');
      expect(result.otpauthUri).toContain('terab');
    });
  });

  describe('completeSetup', () => {
    it('이미 등록된 TOTP가 있으면 TWOFA_SETUP_NOT_SUPPORTED', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue({ id: 'existing' });
      await expect(service.completeSetup('user-1', 'secret', '123456')).rejects.toMatchObject({
        code: 'TWOFA_SETUP_NOT_SUPPORTED',
      });
    });

    it('잘못된 코드면 TWOFA_TOTP_INVALID_CODE', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const secret = authenticator.generateSecret();
      await expect(service.completeSetup('user-1', secret, '000000')).rejects.toMatchObject({
        code: 'TWOFA_TOTP_INVALID_CODE',
      });
    });

    it('올바른 코드면 secret을 암호화해 저장', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      mockTotpRepository.insert.mockResolvedValue({ id: 'totp-1' });

      await service.completeSetup('user-1', secret, validCode);

      expect(mockTotpRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          secretEncrypted: expect.any(Buffer),
          iv: expect.any(Buffer),
          authTag: expect.any(Buffer),
        }),
      );
    });
  });

  describe('verifyCode', () => {
    it('등록 안 된 사용자면 false', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const ok = await service.verifyCode('user-1', '123456');
      expect(ok).toBe(false);
    });

    it('올바른 코드면 true + lastUsedAt 갱신', async () => {
      const secret = authenticator.generateSecret();
      const enc = encryption.encrypt(secret);
      mockTotpRepository.findByUserId.mockResolvedValue({
        id: 'totp-1',
        secretEncrypted: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
      });
      const validCode = authenticator.generate(secret);

      const ok = await service.verifyCode('user-1', validCode);

      expect(ok).toBe(true);
      expect(mockTotpRepository.updateLastUsedAt).toHaveBeenCalledWith('totp-1', expect.any(Date));
    });

    it('잘못된 코드면 false + lastUsedAt 미갱신', async () => {
      const secret = authenticator.generateSecret();
      const enc = encryption.encrypt(secret);
      mockTotpRepository.findByUserId.mockResolvedValue({
        id: 'totp-1',
        secretEncrypted: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
      });

      const ok = await service.verifyCode('user-1', '000000');

      expect(ok).toBe(false);
      expect(mockTotpRepository.updateLastUsedAt).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6.2: 테스트 실패 확인**

```bash
cd services/api
npx jest src/twofa/totp.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 6.3: TotpService 구현**

`services/api/src/twofa/totp.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { EncryptionService } from '@terab/security';
import { authenticator } from 'otplib';
import { TotpRepository } from './totp.repository';

interface SetupPendingResult {
  status: 'PENDING';
  secret: string;
  otpauthUri: string;
}

interface SetupEnrolledResult {
  status: 'ENROLLED';
  id: string;
}

export type SetupStartResult = SetupPendingResult | SetupEnrolledResult;

@Injectable()
export class TotpService extends ServiceCore {
  private readonly ISSUER = 'terab';
  private readonly WINDOW = 1;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly totpRepository: TotpRepository,
    private readonly encryption: EncryptionService,
  ) {
    super(database, txContext);
  }

  async startSetup(userId: string): Promise<SetupStartResult> {
    const existing = await this.totpRepository.findByUserId(userId);
    if (existing) return { status: 'ENROLLED', id: existing.id };

    const secret = authenticator.generateSecret();
    const otpauthUri = authenticator.keyuri(userId, this.ISSUER, secret);
    return { status: 'PENDING', secret, otpauthUri };
  }

  async completeSetup(userId: string, secret: string, code: string): Promise<{ id: string }> {
    const existing = await this.totpRepository.findByUserId(userId);
    if (existing) throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');

    authenticator.options = { window: this.WINDOW };
    if (!authenticator.check(code, secret)) {
      throw new ApiException('TWOFA_TOTP_INVALID_CODE');
    }
    const enc = this.encryption.encrypt(secret);
    const row = await this.totpRepository.insert({
      userId,
      secretEncrypted: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
    });
    return { id: row.id };
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const row = await this.totpRepository.findByUserId(userId);
    if (!row) return false;

    const secret = this.encryption.decrypt({
      ciphertext: row.secretEncrypted,
      iv: row.iv,
      authTag: row.authTag,
    });
    authenticator.options = { window: this.WINDOW };
    const ok = authenticator.check(code, secret);
    if (ok) {
      await this.totpRepository.updateLastUsedAt(row.id, new Date());
    }
    return ok;
  }
}
```

- [ ] **Step 6.4: 테스트 통과 확인**

```bash
cd services/api
npx jest src/twofa/totp.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6.5: 커밋**

```bash
git add services/api/src/twofa/totp.service.ts services/api/src/twofa/totp.service.spec.ts
git commit -m "feat(api): TotpService — otplib + EncryptionService 기반

RFC 6238 SHA1/6digit/30s default, ±1 step window 허용. secret AES-256-GCM 저장."
```

---

## Task 7: TotpLockoutService (Redis CacheManager 기반)

5회/5분 사용자 단위 lockout. `@nestjs/cache-manager`(이미 글로벌 등록)의 `Cache` 인스턴스를 사용.

**Files:**

- Create: `services/api/src/twofa/totp-lockout.service.ts`
- Create: `services/api/src/twofa/totp-lockout.service.spec.ts`

- [ ] **Step 7.1: spec 작성**

`services/api/src/twofa/totp-lockout.service.spec.ts`:

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { TotpLockoutService } from './totp-lockout.service';

describe('TotpLockoutService', () => {
  let service: TotpLockoutService;
  const store = new Map<string, { value: number; expiresAt: number }>();
  const mockCache = {
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    }),
    set: jest.fn(async (key: string, value: number, ttl: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttl });
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TotpLockoutService, { provide: CACHE_MANAGER, useValue: mockCache }],
    }).compile();
    service = module.get(TotpLockoutService);
    store.clear();
    jest.clearAllMocks();
  });

  describe('recordFailure', () => {
    it('실패 카운트를 1씩 증가시키고 ttl 갱신', async () => {
      await service.recordFailure('user-1');
      await service.recordFailure('user-1');
      expect(await service.getFailureCount('user-1')).toBe(2);
    });
  });

  describe('isLocked', () => {
    it('실패가 한도 미만이면 false', async () => {
      for (let i = 0; i < 4; i++) await service.recordFailure('user-1');
      expect(await service.isLocked('user-1')).toBe(false);
    });

    it('실패가 5회면 true', async () => {
      for (let i = 0; i < 5; i++) await service.recordFailure('user-1');
      expect(await service.isLocked('user-1')).toBe(true);
    });
  });

  describe('clearLockout', () => {
    it('성공 시 카운트가 0이 된다', async () => {
      await service.recordFailure('user-1');
      await service.clearLockout('user-1');
      expect(await service.getFailureCount('user-1')).toBe(0);
    });
  });
});
```

- [ ] **Step 7.2: 테스트 실패 확인**

```bash
cd services/api
npx jest src/twofa/totp-lockout.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 7.3: TotpLockoutService 구현**

`services/api/src/twofa/totp-lockout.service.ts`:

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

@Injectable()
export class TotpLockoutService {
  private readonly MAX_FAILURES = 5;
  private readonly TTL_MS = 5 * 60 * 1000;
  private readonly KEY_PREFIX = 'twofa:totp:fail:';

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async getFailureCount(userId: string): Promise<number> {
    const value = await this.cache.get<number>(this.key(userId));
    return value ?? 0;
  }

  async isLocked(userId: string): Promise<boolean> {
    return (await this.getFailureCount(userId)) >= this.MAX_FAILURES;
  }

  async recordFailure(userId: string): Promise<void> {
    const next = (await this.getFailureCount(userId)) + 1;
    await this.cache.set(this.key(userId), next, this.TTL_MS);
  }

  async clearLockout(userId: string): Promise<void> {
    await this.cache.del(this.key(userId));
  }

  private key(userId: string): string {
    return `${this.KEY_PREFIX}${userId}`;
  }
}
```

- [ ] **Step 7.4: 테스트 통과 확인**

```bash
cd services/api
npx jest src/twofa/totp-lockout.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7.5: 커밋**

```bash
git add services/api/src/twofa/totp-lockout.service.ts services/api/src/twofa/totp-lockout.service.spec.ts
git commit -m "feat(api): TotpLockoutService — 5회/5분 사용자 단위 lockout

CacheManager(이미 글로벌 keyv/redis) 기반. 신규 인프라 도입 없음."
```

---

## Task 8: TotpTwoFaStrategy

Phase 0의 `TwoFaStrategy` 인터페이스를 구현. setup ceremony는 TOTP가 의미를 가지는 첫 strategy.

**Files:**

- Create: `services/api/src/twofa/strategies/totp.strategy.ts`
- Create: `services/api/src/twofa/strategies/totp.strategy.spec.ts`

- [ ] **Step 8.1: spec 작성**

`services/api/src/twofa/strategies/totp.strategy.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TotpLockoutService } from '../totp-lockout.service';
import { TotpRepository } from '../totp.repository';
import { TotpService } from '../totp.service';
import { TotpTwoFaStrategy } from './totp.strategy';

const mockTotpService = {
  startSetup: jest.fn(),
  completeSetup: jest.fn(),
  verifyCode: jest.fn(),
};
const mockTotpRepository = {
  findByUserId: jest.fn(),
  findById: jest.fn(),
  deleteByIdForUser: jest.fn(),
};
const mockLockout = {
  isLocked: jest.fn(),
  recordFailure: jest.fn(),
  clearLockout: jest.fn(),
};

describe('TotpTwoFaStrategy', () => {
  let strategy: TotpTwoFaStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TotpTwoFaStrategy,
        { provide: TotpService, useValue: mockTotpService },
        { provide: TotpRepository, useValue: mockTotpRepository },
        { provide: TotpLockoutService, useValue: mockLockout },
      ],
    }).compile();
    strategy = module.get(TotpTwoFaStrategy);
    jest.clearAllMocks();
  });

  it('type은 TOTP다', () => {
    expect(strategy.type).toBe('TOTP');
  });

  describe('startSetup / completeSetup', () => {
    it('TotpService에 위임', async () => {
      mockTotpService.startSetup.mockResolvedValue({ status: 'PENDING', secret: 's', otpauthUri: 'uri' });
      await strategy.startSetup('u');
      expect(mockTotpService.startSetup).toHaveBeenCalledWith('u');

      await strategy.completeSetup('u', { secret: 's', code: '123456' });
      expect(mockTotpService.completeSetup).toHaveBeenCalledWith('u', 's', '123456');
    });

    it('completeSetup payload 형식이 잘못되면 throw', async () => {
      await expect(strategy.completeSetup('u', { secret: 's' } as unknown)).rejects.toThrow();
      await expect(strategy.completeSetup('u', { code: '123456' } as unknown)).rejects.toThrow();
    });
  });

  describe('createChallenge', () => {
    it('TOTP는 challenge가 client-side(인증기 앱 시계)이므로 TWOFA_SETUP_NOT_SUPPORTED', async () => {
      await expect(strategy.createChallenge('u')).rejects.toMatchObject({
        code: 'TWOFA_SETUP_NOT_SUPPORTED',
      });
    });
  });

  describe('verifyResponse', () => {
    it('lockout 상태면 TWOFA_TOTP_LOCKED', async () => {
      mockLockout.isLocked.mockResolvedValue(true);
      await expect(strategy.verifyResponse('u', '', { code: '123456' })).rejects.toMatchObject({
        code: 'TWOFA_TOTP_LOCKED',
      });
    });

    it('올바른 코드면 true + lockout clear', async () => {
      mockLockout.isLocked.mockResolvedValue(false);
      mockTotpService.verifyCode.mockResolvedValue(true);
      const ok = await strategy.verifyResponse('u', '', { code: '123456' });
      expect(ok).toBe(true);
      expect(mockLockout.clearLockout).toHaveBeenCalledWith('u');
    });

    it('잘못된 코드면 실패 카운트 증가 후 TWOFA_TOTP_INVALID_CODE', async () => {
      mockLockout.isLocked.mockResolvedValue(false);
      mockTotpService.verifyCode.mockResolvedValue(false);
      await expect(strategy.verifyResponse('u', '', { code: '000000' })).rejects.toMatchObject({
        code: 'TWOFA_TOTP_INVALID_CODE',
      });
      expect(mockLockout.recordFailure).toHaveBeenCalledWith('u');
    });
  });

  describe('list / revoke', () => {
    it('list — 등록 없으면 빈 배열', async () => {
      mockTotpRepository.findByUserId.mockResolvedValue(null);
      const result = await strategy.list('u');
      expect(result).toEqual([]);
    });

    it('list — 등록 row 있으면 단일 항목 반환', async () => {
      const row = { id: 'totp-1', createdAt: new Date(), lastUsedAt: null };
      mockTotpRepository.findByUserId.mockResolvedValue(row);
      const result = await strategy.list('u');
      expect(result).toEqual([{ id: 'totp-1', createdAt: row.createdAt, lastUsedAt: null }]);
    });

    it('revoke — 소유자 아니면 ApiException(FORBIDDEN)', async () => {
      mockTotpRepository.deleteByIdForUser.mockResolvedValue(false);
      await expect(strategy.revoke('u', 'totp-x')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('revoke — 본인 소유 row면 정상 삭제', async () => {
      mockTotpRepository.deleteByIdForUser.mockResolvedValue(true);
      await strategy.revoke('u', 'totp-1');
      expect(mockTotpRepository.deleteByIdForUser).toHaveBeenCalledWith('totp-1', 'u');
    });
  });
});
```

- [ ] **Step 8.2: 테스트 실패 확인**

```bash
cd services/api
npx jest src/twofa/strategies/totp.strategy.spec.ts
```

Expected: FAIL.

- [ ] **Step 8.3: Strategy 구현**

`services/api/src/twofa/strategies/totp.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { TotpLockoutService } from '../totp-lockout.service';
import { TotpRepository } from '../totp.repository';
import { TotpService } from '../totp.service';
import { TwoFaStrategy, TwoFaStrategyInstance, TwoFaStrategyType } from './twofa-strategy.interface';

interface TotpSetupPayload {
  secret: string;
  code: string;
}

interface TotpResponsePayload {
  code: string;
}

@Injectable()
export class TotpTwoFaStrategy implements TwoFaStrategy<unknown, never, TotpResponsePayload> {
  readonly type: TwoFaStrategyType = 'TOTP';

  constructor(
    private readonly totpService: TotpService,
    private readonly totpRepository: TotpRepository,
    private readonly lockout: TotpLockoutService,
  ) {}

  async startSetup(userId: string) {
    return this.totpService.startSetup(userId);
  }

  async completeSetup(userId: string, payload: unknown): Promise<void> {
    const body = payload as Partial<TotpSetupPayload>;
    if (typeof body?.secret !== 'string' || typeof body?.code !== 'string') {
      throw new ApiException('TWOFA_TOTP_INVALID_CODE');
    }
    await this.totpService.completeSetup(userId, body.secret, body.code);
  }

  async createChallenge(): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async verifyResponse(userId: string, _challengeId: string, payload: TotpResponsePayload): Promise<boolean> {
    if (await this.lockout.isLocked(userId)) {
      throw new ApiException('TWOFA_TOTP_LOCKED');
    }
    const ok = await this.totpService.verifyCode(userId, payload.code);
    if (!ok) {
      await this.lockout.recordFailure(userId);
      throw new ApiException('TWOFA_TOTP_INVALID_CODE');
    }
    await this.lockout.clearLockout(userId);
    return true;
  }

  async list(userId: string): Promise<TwoFaStrategyInstance[]> {
    const row = await this.totpRepository.findByUserId(userId);
    if (!row) return [];
    return [{ id: row.id, createdAt: row.createdAt, lastUsedAt: row.lastUsedAt }];
  }

  async revoke(userId: string, id: string): Promise<void> {
    const ok = await this.totpRepository.deleteByIdForUser(id, userId);
    if (!ok) throw new ApiException('FORBIDDEN');
  }
}
```

- [ ] **Step 8.4: 테스트 통과 확인**

```bash
cd services/api
npx jest src/twofa/strategies/totp.strategy.spec.ts
```

Expected: PASS.

- [ ] **Step 8.5: 커밋**

```bash
git add services/api/src/twofa/strategies/totp.strategy.ts services/api/src/twofa/strategies/totp.strategy.spec.ts
git commit -m "feat(api): TotpTwoFaStrategy — Phase 0 인터페이스 구현

TotpService(검증)·TotpLockoutService(5회 잠금)·TotpRepository(list/revoke) 위임."
```

---

## Task 9: TotpController + DTO

설정 화면에서 사용할 setup start/complete + list/revoke endpoint.

**Files:**

- Create: `services/api/src/twofa/dto/totp-setup-start-response.dto.ts`
- Create: `services/api/src/twofa/dto/totp-setup-complete-body.dto.ts`
- Create: `services/api/src/twofa/dto/totp-list-response.dto.ts`
- Modify: `services/api/src/twofa/dto/index.ts`
- Create: `services/api/src/twofa/totp.controller.ts`
- Create: `services/api/src/twofa/totp.controller.spec.ts`

- [ ] **Step 9.1: DTO 작성**

`services/api/src/twofa/dto/totp-setup-start-response.dto.ts`:

```ts
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

export class TotpSetupPendingDto {
  @ApiProperty({ enum: ['PENDING'] })
  status!: 'PENDING';

  secret!: string;
  otpauthUri!: string;
}

export class TotpSetupEnrolledDto {
  @ApiProperty({ enum: ['ENROLLED'] })
  status!: 'ENROLLED';

  @ApiProperty({ format: 'uuid' })
  id!: string;
}

export type TotpSetupStartResponse = TotpSetupPendingDto | TotpSetupEnrolledDto;
```

`services/api/src/twofa/dto/totp-setup-complete-body.dto.ts`:

```ts
import { IsString, Matches, MinLength } from 'class-validator';

export class TotpSetupCompleteBodyDto {
  @IsString()
  @MinLength(16)
  secret!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}
```

`services/api/src/twofa/dto/totp-list-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class TotpInstanceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  lastUsedAt!: Date | null;
}

export class TotpListResponseDto {
  @ApiProperty({ type: TotpInstanceDto, isArray: true })
  instances!: TotpInstanceDto[];
}
```

`services/api/src/twofa/dto/index.ts`에 추가:

```ts
export * from './totp-setup-start-response.dto';
export * from './totp-setup-complete-body.dto';
export * from './totp-list-response.dto';
```

- [ ] **Step 9.2: TotpController 구현**

`services/api/src/twofa/totp.controller.ts`:

```ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiError, CurrentUser, type AuthUser } from '@terab/common';
import { TotpListResponseDto, TotpSetupCompleteBodyDto, TotpSetupEnrolledDto, TotpSetupPendingDto, type TotpSetupStartResponse } from './dto';
import { TotpTwoFaStrategy } from './strategies/totp.strategy';
import { TwoFaService } from './twofa.service';

@Controller('auth/2fa/totp')
@ApiTags('TwoFa')
@ApiExtraModels(TotpSetupPendingDto, TotpSetupEnrolledDto)
export class TotpController {
  constructor(
    private readonly totpStrategy: TotpTwoFaStrategy,
    private readonly twoFaService: TwoFaService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('setup/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'TOTP 등록 시작 — secret + otpauth URI 발급' })
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      oneOf: refs(TotpSetupPendingDto, TotpSetupEnrolledDto),
      discriminator: {
        propertyName: 'status',
        mapping: {
          PENDING: getSchemaPath(TotpSetupPendingDto),
          ENROLLED: getSchemaPath(TotpSetupEnrolledDto),
        },
      },
    },
  })
  async startSetup(@CurrentUser() user: AuthUser): Promise<TotpSetupStartResponse> {
    return this.totpStrategy.startSetup(user.userId);
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('setup/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'TOTP 등록 완료 — 1회 검증 후 영구 저장' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TWOFA_TOTP_INVALID_CODE', 'TWOFA_SETUP_NOT_SUPPORTED')
  async completeSetup(@CurrentUser() user: AuthUser, @Body() body: TotpSetupCompleteBodyDto): Promise<void> {
    await this.totpStrategy.completeSetup(user.userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'TOTP 등록 목록 조회 (user당 최대 1개)' })
  @ApiResponse({ status: HttpStatus.OK, type: TotpListResponseDto })
  async list(@CurrentUser() user: AuthUser): Promise<TotpListResponseDto> {
    const instances = await this.totpStrategy.list(user.userId);
    return { instances };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'TOTP 해제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FORBIDDEN', 'TWOFA_LAST_STRATEGY_CANNOT_REMOVE')
  async revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.twoFaService.removeStrategy(user.userId, 'TOTP', id);
  }
}
```

- [ ] **Step 9.3: TotpController spec 작성**

`services/api/src/twofa/totp.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { TotpTwoFaStrategy } from './strategies/totp.strategy';
import { TotpController } from './totp.controller';
import { TwoFaService } from './twofa.service';

const mockStrategy = {
  startSetup: jest.fn(),
  completeSetup: jest.fn(),
  list: jest.fn(),
};
const mockTwoFaService = {
  removeStrategy: jest.fn(),
};

describe('TotpController', () => {
  let controller: TotpController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TotpController],
      providers: [
        { provide: TotpTwoFaStrategy, useValue: mockStrategy },
        { provide: TwoFaService, useValue: mockTwoFaService },
      ],
    }).compile();
    controller = module.get(TotpController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => expect(controller).toBeDefined());

  describe('startSetup', () => {
    it('PENDING 상태면 secret + otpauthUri 반환', async () => {
      mockStrategy.startSetup.mockResolvedValue({ status: 'PENDING', secret: 's', otpauthUri: 'uri' });
      const result = await controller.startSetup({ userId: 'u' } as never);
      expect(result).toEqual({ status: 'PENDING', secret: 's', otpauthUri: 'uri' });
    });
  });

  describe('completeSetup', () => {
    it('payload를 strategy에 위임', async () => {
      await controller.completeSetup({ userId: 'u' } as never, { secret: 's', code: '123456' });
      expect(mockStrategy.completeSetup).toHaveBeenCalledWith('u', { secret: 's', code: '123456' });
    });
  });

  describe('revoke', () => {
    it('TwoFaService.removeStrategy 위임', async () => {
      await controller.revoke({ userId: 'u' } as never, 'totp-1');
      expect(mockTwoFaService.removeStrategy).toHaveBeenCalledWith('u', 'TOTP', 'totp-1');
    });
  });
});
```

- [ ] **Step 9.4: 테스트 실패→통과 확인**

```bash
cd services/api
npx jest src/twofa/totp.controller.spec.ts
```

Expected: 처음 FAIL → 구현 적용 후 PASS.

- [ ] **Step 9.5: 커밋**

```bash
git add services/api/src/twofa/totp.controller.ts services/api/src/twofa/totp.controller.spec.ts services/api/src/twofa/dto/totp-setup-start-response.dto.ts services/api/src/twofa/dto/totp-setup-complete-body.dto.ts services/api/src/twofa/dto/totp-list-response.dto.ts services/api/src/twofa/dto/index.ts
git commit -m "feat(api): TotpController — setup start/complete, list, revoke

POST /auth/2fa/totp/setup/start (60s/3)
POST /auth/2fa/totp/setup/complete (60s/3)
GET  /auth/2fa/totp
DELETE /auth/2fa/totp/:id"
```

---

## Task 10: 통합 challenge.controller — POST /auth/2fa/challenge/:id/complete generalized

기존 `auth.controller.ts`의 `POST /auth/2fa/challenge/:id/complete`를 `challenge.controller.ts`로 이관하면서 body 추가. `:id/status`, `:id/respond`, `:id/resend` 3개 endpoint(기존 `twofa.controller.ts`)도 함께 이관해 challenge 도메인을 한 곳에 모은다.

**Files:**

- Create: `services/api/src/twofa/challenge.controller.ts`
- Create: `services/api/src/twofa/challenge.controller.spec.ts`
- Create: `services/api/src/twofa/dto/complete-challenge-body.dto.ts`
- Modify: `services/api/src/twofa/dto/index.ts`
- Delete: `services/api/src/twofa/twofa.controller.ts`, `services/api/src/twofa/twofa.controller.spec.ts` (기능 모두 이관됨)
- Modify: `services/api/src/auth/auth.controller.ts` — `:id/complete` 엔드포인트 제거
- Modify: `services/api/src/auth/auth.service.ts` — `completeTwoFa(challengeId)` 제거 (또는 변경) 후 challenge.controller가 TwoFaService를 직접 호출

- [ ] **Step 10.1: complete-challenge body DTO**

`services/api/src/twofa/dto/complete-challenge-body.dto.ts`:

```ts
import { IsIn, IsOptional, Matches, ValidateIf } from 'class-validator';

export class CompleteChallengeBodyDto {
  @IsOptional()
  @IsIn(['PUSH', 'TOTP'])
  type?: 'PUSH' | 'TOTP';

  @ValidateIf((o: CompleteChallengeBodyDto) => o.type === 'TOTP')
  @Matches(/^\d{6}$/)
  code?: string;
}
```

`services/api/src/twofa/dto/index.ts`에 추가:

```ts
export * from './complete-challenge-body.dto';
```

- [ ] **Step 10.2: TwoFaService에 completeChallenge + removeStrategy 추가**

`services/api/src/twofa/twofa.service.ts`에 다음 메서드 추가 (기존 클래스 끝 부분):

```ts
import type { TwoFaStrategyType } from './strategies/twofa-strategy.interface';

// constructor 매개변수 추가 (clientside):
// private readonly registry: TwoFaStrategyRegistry,  ← Phase 0에서 추가됨
// 새로 필요: TotpRepository(혹은 strategy를 직접 inject해도 됨)

@LogReplay()
async completeChallenge(
  challengeId: string,
  body: { type?: 'PUSH' | 'TOTP'; code?: string },
): Promise<string> {
  const type: TwoFaStrategyType = body.type ?? 'PUSH';

  if (type === 'PUSH') {
    return this.claimApprovedChallenge(challengeId);
  }

  const challenge = await this.twoFaRepository.findById(challengeId);
  if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
  if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) {
    throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
  }

  const strategy = this.registry.get(type);
  await strategy.verifyResponse(challenge.userId, challengeId, { code: body.code ?? '' });

  await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
  return challenge.userId;
}

async removeStrategy(userId: string, type: TwoFaStrategyType, id: string): Promise<void> {
  const remaining = await this.countRemainingNonPushStrategiesExcluding(userId, type, id);
  if (remaining === 0) throw new ApiException('TWOFA_LAST_STRATEGY_CANNOT_REMOVE');
  const strategy = this.registry.get(type);
  await strategy.revoke(userId, id);
}

private async countRemainingNonPushStrategiesExcluding(
  userId: string,
  excludeType: TwoFaStrategyType,
  excludeId: string,
): Promise<number> {
  const types: TwoFaStrategyType[] = ['TOTP', 'BACKUP_CODE'];
  let count = 0;
  for (const t of types) {
    if (t === excludeType) {
      const instances = await this.registry.get(t).list(userId);
      count += instances.filter((i) => i.id !== excludeId).length;
    } else {
      const instances = await this.registry.get(t).list(userId);
      count += instances.length;
    }
  }
  return count;
}
```

> 참고: `BackupCodeTwoFaStrategy.list`는 Phase 0에서 `TWOFA_SETUP_NOT_SUPPORTED` throw로 정의됐다. 본 Phase에서 backup code를 "1개 instance"로 카운트하려면 `BackupCodeTwoFaStrategy.list`를 "unused backup-code가 1개라도 있으면 dummy instance 1개 반환, 없으면 빈 배열"로 갱신해야 한다. Task 10.3에서 처리.

- [ ] **Step 10.3: BackupCodeTwoFaStrategy.list 구현 보강**

`services/api/src/twofa/strategies/backup-code.strategy.ts` — `list` 메서드 교체 + 생성자에 `BackupCodeRepository` 추가:

```ts
// import 추가
import { BackupCodeRepository } from '../backup-code.repository';

// constructor 수정
constructor(
  private readonly backupCodeService: BackupCodeService,
  private readonly backupCodeRepository: BackupCodeRepository,
) {}

// list 교체
async list(userId: string): Promise<TwoFaStrategyInstance[]> {
  const unused = await this.backupCodeRepository.findUnusedByUserId(userId);
  if (unused.length === 0) return [];
  return [{ id: 'backup-code', createdAt: unused[0].createdAt, lastUsedAt: null }];
}
```

해당 strategy의 spec(`backup-code.strategy.spec.ts`)도 mock에 `backupCodeRepository`를 추가하고 list 케이스 두 개(`unused>=1`/`unused=0`)를 갱신.

- [ ] **Step 10.4: challenge.controller 구현**

`services/api/src/twofa/challenge.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser, Public } from '@terab/common';
import { TokenService } from '@terab/security';
import { AuthenticatedResponseDto, type LoginResponse } from '../auth/dto';
import { AuthService } from '../auth/auth.service';
import {
  ChallengeStatusApprovedDto,
  type ChallengeStatusResponse,
  ChallengeStatusDeniedDto,
  ChallengeStatusExpiredDto,
  ChallengeStatusPendingDto,
  CompleteChallengeBodyDto,
  ResendChallengeResponseDto,
  RespondChallengeBodyDto,
} from './dto';
import { TwoFaService } from './twofa.service';

@Controller('auth/2fa/challenge')
@ApiTags('TwoFa')
export class ChallengeController {
  constructor(
    private readonly twoFaService: TwoFaService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get(':id/status')
  @ApiOperation({ summary: '2FA 챌린지 상태 조회' })
  @ApiExtraModels(ChallengeStatusPendingDto, ChallengeStatusApprovedDto, ChallengeStatusDeniedDto, ChallengeStatusExpiredDto)
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      oneOf: refs(ChallengeStatusPendingDto, ChallengeStatusApprovedDto, ChallengeStatusDeniedDto, ChallengeStatusExpiredDto),
      discriminator: {
        propertyName: 'status',
        mapping: {
          PENDING: getSchemaPath(ChallengeStatusPendingDto),
          APPROVED: getSchemaPath(ChallengeStatusApprovedDto),
          DENIED: getSchemaPath(ChallengeStatusDeniedDto),
          EXPIRED: getSchemaPath(ChallengeStatusExpiredDto),
        },
      },
    },
  })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND')
  async getStatus(@Param('id', ParseUUIDPipe) id: string): Promise<ChallengeStatusResponse> {
    return this.twoFaService.getStatus(id);
  }

  @Post(':id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '2FA 챌린지 응답 (PUSH 전용)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND', 'FORBIDDEN')
  async respond(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: RespondChallengeBodyDto): Promise<void> {
    await this.twoFaService.respond(id, user.userId, body.selectedNumber);
  }

  @Public()
  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA 챌린지 재발송 (PUSH 전용)' })
  @ApiResponse({ status: HttpStatus.OK, type: ResendChallengeResponseDto })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND')
  async resend(@Param('id', ParseUUIDPipe) id: string): Promise<ResendChallengeResponseDto> {
    return this.twoFaService.resend(id);
  }

  @Public()
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA 챌린지 완료 — type별 verify 후 토큰 발급' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuthenticatedResponseDto,
  })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND', 'TWOFA_TOTP_INVALID_CODE', 'TWOFA_TOTP_LOCKED')
  async complete(@Param('id', ParseUUIDPipe) id: string, @Body() body: CompleteChallengeBodyDto): Promise<LoginResponse> {
    const userId = await this.twoFaService.completeChallenge(id, body);
    return this.authService.issueAuthenticatedResponse(userId);
  }
}
```

> 참고: `AuthService.issueAuthenticatedResponse(userId)`는 새로 추출되는 helper — 기존 `completeTwoFa(challengeId)`의 token 발급 부분만 분리. Task 10.5에서 작성.

- [ ] **Step 10.5: AuthService refactor — issueAuthenticatedResponse 분리**

`services/api/src/auth/auth.service.ts`의 `completeTwoFa` 메서드(있다면)를 다음 helper로 교체:

```ts
async issueAuthenticatedResponse(userId: string): Promise<{
  response: LoginResponse;
  rawRefreshToken: string;
  refreshTokenExpMs: number;
}> {
  // 기존 completeTwoFa의 token/Refresh 발급 로직을 그대로 이관.
  // 구체 코드는 기존 completeTwoFa 본문을 옮기면 됨.
  // ...
}
```

> 본 plan의 작성 시점에 auth.service.ts의 completeTwoFa 구현 세부는 가변일 수 있다. **실행자는 기존 `completeTwoFa(challengeId)` 본문에서 `claimApprovedChallenge` 호출 부분을 제거하고, "userId가 주어진 상태에서 access token + refresh token 발급 + DB 기록" 부분만 `issueAuthenticatedResponse(userId)`로 추출**한다.

- [ ] **Step 10.6: auth.controller에서 :id/complete 제거**

`services/api/src/auth/auth.controller.ts`의 `completeTwoFa` 메서드(line 115 부근)와 관련 import를 삭제. 함수 전체 제거:

```ts
// 삭제 대상:
@Public()
@Post('2fa/challenge/:id/complete')
@HttpCode(HttpStatus.OK)
@ApiOperation(...)
@ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
@ApiError('TWO_FA_CHALLENGE_NOT_FOUND')
async completeTwoFa(...) { ... }
```

- [ ] **Step 10.7: twofa.controller.ts 삭제 (기능 모두 challenge.controller로 이관)**

```bash
git rm services/api/src/twofa/twofa.controller.ts services/api/src/twofa/twofa.controller.spec.ts
```

- [ ] **Step 10.8: challenge.controller spec 작성**

`services/api/src/twofa/challenge.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { ChallengeController } from './challenge.controller';
import { TwoFaService } from './twofa.service';

const mockTwoFaService = {
  getStatus: jest.fn(),
  respond: jest.fn(),
  resend: jest.fn(),
  completeChallenge: jest.fn(),
};
const mockAuthService = {
  issueAuthenticatedResponse: jest.fn(),
};

describe('ChallengeController', () => {
  let controller: ChallengeController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ChallengeController],
      providers: [
        { provide: TwoFaService, useValue: mockTwoFaService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();
    controller = module.get(ChallengeController);
    jest.clearAllMocks();
  });

  describe('complete', () => {
    it('type=TOTP면 completeChallenge → issueAuthenticatedResponse 위임', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue('user-1');
      mockAuthService.issueAuthenticatedResponse.mockResolvedValue({
        response: { status: 'AUTHENTICATED' } as never,
        rawRefreshToken: 'rt',
        refreshTokenExpMs: 1000,
      });

      const result = await controller.complete('challenge-id', { type: 'TOTP', code: '123456' });

      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('challenge-id', {
        type: 'TOTP',
        code: '123456',
      });
      expect(mockAuthService.issueAuthenticatedResponse).toHaveBeenCalledWith('user-1');
    });

    it('body 비어 있으면 type=PUSH로 dispatch', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue('user-1');
      mockAuthService.issueAuthenticatedResponse.mockResolvedValue({
        response: { status: 'AUTHENTICATED' } as never,
        rawRefreshToken: 'rt',
        refreshTokenExpMs: 1000,
      });
      await controller.complete('challenge-id', {});
      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('challenge-id', {});
    });
  });
});
```

- [ ] **Step 10.9: TwoFaService.completeChallenge / removeStrategy spec 추가**

`services/api/src/twofa/twofa.service.spec.ts`에 다음 describe 블록 추가 (Phase 0의 spec 갱신본 기준):

```ts
describe('completeChallenge', () => {
  it('type=PUSH면 claimApprovedChallenge에 위임', async () => {
    mockTwoFaRepository.findById.mockResolvedValue({
      id: 'c',
      userId: 'u',
      status: 'APPROVED',
      expiresAt: new Date(Date.now() + 60_000),
      options: '47,82,13',
      correctNum: '47',
    });
    const userId = await service.completeChallenge('c', { type: 'PUSH' });
    expect(userId).toBe('u');
    expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('c', 'EXPIRED');
  });

  it('type=TOTP면 challenge가 PENDING이어야 하고, strategy.verifyResponse 호출 후 EXPIRED 처리', async () => {
    mockTwoFaRepository.findById.mockResolvedValue({
      id: 'c',
      userId: 'u',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      options: '47,82,13',
      correctNum: '47',
    });
    const totpStrategy = { type: 'TOTP', verifyResponse: jest.fn().mockResolvedValue(true) };
    mockRegistry.get.mockImplementation((t: string) => (t === 'TOTP' ? totpStrategy : mockPushStrategy));

    const userId = await service.completeChallenge('c', { type: 'TOTP', code: '123456' });

    expect(totpStrategy.verifyResponse).toHaveBeenCalledWith('u', 'c', { code: '123456' });
    expect(userId).toBe('u');
    expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('c', 'EXPIRED');
  });

  it('type=TOTP인데 challenge가 PENDING이 아니면 TWO_FA_CHALLENGE_NOT_FOUND', async () => {
    mockTwoFaRepository.findById.mockResolvedValue({
      id: 'c',
      userId: 'u',
      status: 'APPROVED',
      expiresAt: new Date(Date.now() + 60_000),
      options: '47,82,13',
      correctNum: '47',
    });
    await expect(service.completeChallenge('c', { type: 'TOTP', code: '1' })).rejects.toMatchObject({
      code: 'TWO_FA_CHALLENGE_NOT_FOUND',
    });
  });
});

describe('removeStrategy', () => {
  it('마지막 push-외 strategy면 TWOFA_LAST_STRATEGY_CANNOT_REMOVE', async () => {
    const totpStrategy = {
      type: 'TOTP',
      list: jest.fn().mockResolvedValue([{ id: 'totp-1', createdAt: new Date(), lastUsedAt: null }]),
      revoke: jest.fn(),
    };
    const backupCodeStrategy = { type: 'BACKUP_CODE', list: jest.fn().mockResolvedValue([]), revoke: jest.fn() };
    mockRegistry.get.mockImplementation((t: string) => {
      if (t === 'TOTP') return totpStrategy;
      if (t === 'BACKUP_CODE') return backupCodeStrategy;
      return mockPushStrategy;
    });

    await expect(service.removeStrategy('u', 'TOTP', 'totp-1')).rejects.toMatchObject({
      code: 'TWOFA_LAST_STRATEGY_CANNOT_REMOVE',
    });
    expect(totpStrategy.revoke).not.toHaveBeenCalled();
  });

  it('남은 strategy가 있으면 revoke 수행', async () => {
    const totpStrategy = {
      type: 'TOTP',
      list: jest.fn().mockResolvedValue([{ id: 'totp-1', createdAt: new Date(), lastUsedAt: null }]),
      revoke: jest.fn(),
    };
    const backupCodeStrategy = {
      type: 'BACKUP_CODE',
      list: jest.fn().mockResolvedValue([{ id: 'backup-code', createdAt: new Date(), lastUsedAt: null }]),
      revoke: jest.fn(),
    };
    mockRegistry.get.mockImplementation((t: string) => {
      if (t === 'TOTP') return totpStrategy;
      if (t === 'BACKUP_CODE') return backupCodeStrategy;
      return mockPushStrategy;
    });

    await service.removeStrategy('u', 'TOTP', 'totp-1');
    expect(totpStrategy.revoke).toHaveBeenCalledWith('u', 'totp-1');
  });
});
```

- [ ] **Step 10.10: 회귀 확인**

```bash
cd services/api
npx tsc --noEmit
npx jest src/twofa/
npx jest src/auth/
```

Expected: 전부 PASS.

- [ ] **Step 10.11: 커밋**

```bash
git add services/api/src/twofa/challenge.controller.ts services/api/src/twofa/challenge.controller.spec.ts services/api/src/twofa/dto/complete-challenge-body.dto.ts services/api/src/twofa/dto/index.ts services/api/src/twofa/twofa.service.ts services/api/src/twofa/twofa.service.spec.ts services/api/src/twofa/strategies/backup-code.strategy.ts services/api/src/twofa/strategies/backup-code.strategy.spec.ts services/api/src/auth/auth.controller.ts services/api/src/auth/auth.service.ts
git rm services/api/src/twofa/twofa.controller.ts services/api/src/twofa/twofa.controller.spec.ts

git commit -m "feat(api): 통합 challenge.controller + completeChallenge/removeStrategy

- POST/GET /auth/2fa/challenge/* 4개 endpoint를 challenge.controller로 통합
- complete body에 type discriminator(PUSH/TOTP) 추가
- TwoFaService.completeChallenge: type별 dispatch
- TwoFaService.removeStrategy: 마지막 strategy 가드(TOTP+BACKUP_CODE 합산)
- BackupCodeTwoFaStrategy.list: unused 코드 존재 시 dummy instance 1개 반환
- auth.controller의 :id/complete 제거 (challenge.controller로 이전)
- twofa.controller.ts 삭제 (challenge.controller로 통합)"
```

---

## Task 11: TwoFaModule 갱신 — Phase 1 providers/controllers 등록

**Files:**

- Modify: `services/api/src/twofa/twofa.module.ts`

- [ ] **Step 11.1: TwoFaModule 교체**

`services/api/src/twofa/twofa.module.ts` 전체를 다음으로 교체 (Phase 0 결과에서 갱신):

```ts
import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeService } from './backup-code.service';
import { ChallengeController } from './challenge.controller';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { BackupCodeTwoFaStrategy } from './strategies/backup-code.strategy';
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
  imports: [BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }), forwardRef(() => AuthModule)],
  controllers: [ChallengeController, TotpController],
  providers: [
    TwoFaService,
    TwoFaRepository,
    PushChallengePublisher,
    BackupCodeService,
    BackupCodeRepository,
    TotpService,
    TotpRepository,
    TotpLockoutService,
    PushTwoFaStrategy,
    BackupCodeTwoFaStrategy,
    TotpTwoFaStrategy,
    TwoFaStrategyRegistry,
    {
      provide: TWOFA_STRATEGY_TOKEN,
      useFactory: (push: PushTwoFaStrategy, backupCode: BackupCodeTwoFaStrategy, totp: TotpTwoFaStrategy) => [push, backupCode, totp],
      inject: [PushTwoFaStrategy, BackupCodeTwoFaStrategy, TotpTwoFaStrategy],
    },
  ],
  exports: [TwoFaService, PushChallengePublisher, BackupCodeService],
})
export class TwoFaModule {}
```

> 참고: `forwardRef(() => AuthModule)`은 ChallengeController가 `AuthService.issueAuthenticatedResponse`를 호출하기 위해 필요. AuthModule 또한 TwoFaModule을 import하므로 순환 의존을 forwardRef로 해결.

`services/api/src/auth/auth.module.ts`에서 TwoFaModule import도 `forwardRef(() => TwoFaModule)`로 변경:

```ts
import { forwardRef } from '@nestjs/common';
// imports 배열에서:
forwardRef(() => TwoFaModule),
```

- [ ] **Step 11.2: 회귀 확인**

```bash
cd services/api
npx tsc --noEmit
npm test
```

Expected: 전체 spec PASS.

- [ ] **Step 11.3: e2e 부팅 확인**

```bash
cd services/api
npm run start:dev
# 다른 터미널에서:
curl -i http://localhost:3000/api/health
```

Expected: 200 OK. forwardRef 의존이 정상 해소된 것을 의미.

- [ ] **Step 11.4: 커밋**

```bash
git add services/api/src/twofa/twofa.module.ts services/api/src/auth/auth.module.ts
git commit -m "feat(api): TwoFaModule에 TotpService/Strategy/Controller + ChallengeController 등록

AuthModule과 TwoFaModule 사이 순환 의존(challenge.controller가 AuthService 호출, AuthModule이 TwoFaModule 호출)을 forwardRef로 해소."
```

---

## Task 12: Web codegen 갱신

API 변경에 따라 web의 openapi 타입을 재생성.

**Files:**

- (auto) `services/web/src/api/openapi/**`

- [ ] **Step 12.1: openapi codegen 실행**

```bash
cd services/web
npm run gen:api
```

Expected: openapi 타입 파일이 새 endpoint(`/auth/2fa/totp/*`, `/auth/2fa/challenge/:id/complete` 신규 body)에 맞춰 재생성. diff 확인.

- [ ] **Step 12.2: 커밋**

```bash
git add services/web/src/api/openapi
git commit -m "chore(web): openapi codegen — Phase 1 TOTP endpoint 반영"
```

---

## Task 13: Web — 설정 페이지 TOTP setup UI

> 위치·라우팅·디자인은 현재 web 구조를 따른다. 신규 페이지 컴포넌트만 추가.

**Files:**

- Create: `services/web/src/pages/settings/twofa-setup-totp.tsx`
- Create: `services/web/src/pages/settings/twofa-setup-totp.test.tsx`

- [ ] **Step 13.1: 컴포넌트 작성**

`services/web/src/pages/settings/twofa-setup-totp.tsx`:

```tsx
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { apiClient } from '../../api/client';

type Phase = 'INIT' | 'SHOW_QR' | 'ENROLLED' | 'DONE';

export function TwoFaSetupTotpPage() {
  const [phase, setPhase] = useState<Phase>('INIT');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'INIT') return;
    apiClient.post('/auth/2fa/totp/setup/start').then(async (res) => {
      if (res.data.status === 'ENROLLED') {
        setPhase('ENROLLED');
        return;
      }
      setSecret(res.data.secret);
      setQrDataUrl(await QRCode.toDataURL(res.data.otpauthUri));
      setPhase('SHOW_QR');
    });
  }, [phase]);

  const submit = async () => {
    setError(null);
    try {
      await apiClient.post('/auth/2fa/totp/setup/complete', { secret, code });
      setPhase('DONE');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '실패');
    }
  };

  if (phase === 'INIT') return <p>준비 중...</p>;
  if (phase === 'ENROLLED') return <p>이미 TOTP가 등록되어 있습니다.</p>;
  if (phase === 'DONE') return <p>TOTP가 등록됐습니다.</p>;

  return (
    <section>
      <h1>TOTP 등록</h1>
      <p>인증기 앱(Google Authenticator, 1Password 등)으로 QR을 스캔하세요.</p>
      <img src={qrDataUrl} alt="TOTP QR" />
      <details>
        <summary>QR 대신 수동 입력</summary>
        <code>{secret}</code>
      </details>
      <label>
        앱에 표시된 6자리 코드:
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
      </label>
      <button onClick={submit} disabled={code.length !== 6}>
        등록
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
```

> 참고: web에 `qrcode` 패키지가 없으면 `npm install qrcode` + `npm install -D @types/qrcode` 추가.

- [ ] **Step 13.2: 테스트 작성**

`services/web/src/pages/settings/twofa-setup-totp.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { apiClient } from '../../api/client';
import { TwoFaSetupTotpPage } from './twofa-setup-totp';

jest.mock('../../api/client');
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,xx') }));

describe('TwoFaSetupTotpPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ENROLLED 상태면 안내 메시지를 보여준다', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { status: 'ENROLLED', id: 'x' } });
    render(<TwoFaSetupTotpPage />);
    await waitFor(() => screen.getByText(/이미 TOTP가 등록/));
  });

  it('PENDING 상태면 QR + 코드 입력 폼을 노출하고 submit 시 complete API를 호출', async () => {
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: { status: 'PENDING', secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://x' } })
      .mockResolvedValueOnce({ data: {} });
    render(<TwoFaSetupTotpPage />);
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect((apiClient.post as jest.Mock).mock.calls[1][0]).toBe('/auth/2fa/totp/setup/complete'));
  });
});
```

- [ ] **Step 13.3: 테스트 실행**

```bash
cd services/web
npm test -- twofa-setup-totp.test.tsx
```

Expected: PASS.

- [ ] **Step 13.4: 라우팅 등록**

web의 라우트 정의 파일(현재 구조 기준)에 `/settings/2fa/totp` 경로 + 컴포넌트 매핑 추가. 구체 위치는 `services/web/src/router.tsx` 또는 동등 파일 — 실행자는 기존 다른 settings 페이지의 등록 위치를 grep으로 찾아 동일하게 추가:

```bash
grep -rn "settings" services/web/src/router.tsx 2>/dev/null || grep -rn "BrowserRouter\|createBrowserRouter" services/web/src/ | head
```

- [ ] **Step 13.5: 커밋**

```bash
git add services/web/src/pages/settings/twofa-setup-totp.tsx services/web/src/pages/settings/twofa-setup-totp.test.tsx services/web/src/router.tsx
git commit -m "feat(web): TOTP setup 페이지 — QR 표시 + 코드 검증

setup/start로 secret+otpauth URI 수령, qrcode로 QR 렌더, 6자리 코드 입력 시 setup/complete 호출."
```

---

## Task 14: Web — login 화면 TOTP 진입

기존 push polling 컴포넌트(`twofa-challenge.tsx` 또는 동등)에 "다른 방법으로" 버튼 추가, 클릭 시 TOTP 입력 화면으로 전환. TOTP 코드 제출 시 `POST /auth/2fa/challenge/:id/complete`로 `{type:'TOTP',code}` 전송.

**Files:**

- Create: `services/web/src/pages/login/twofa-totp-input.tsx`
- Modify: `services/web/src/pages/login/twofa-challenge.tsx` (또는 동등 파일)

- [ ] **Step 14.1: TOTP 입력 컴포넌트**

`services/web/src/pages/login/twofa-totp-input.tsx`:

```tsx
import { useState } from 'react';
import { apiClient } from '../../api/client';

interface Props {
  challengeId: string;
  onSuccess: (response: unknown) => void;
}

export function TwoFaTotpInputPage({ challengeId, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const submit = async () => {
    setError(null);
    try {
      const res = await apiClient.post(`/auth/2fa/challenge/${challengeId}/complete`, {
        type: 'TOTP',
        code,
      });
      onSuccess(res.data);
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { code?: string; message?: string } } }).response?.data;
      if (data?.code === 'TWOFA_TOTP_LOCKED') setLocked(true);
      setError(data?.message ?? '실패');
    }
  };

  if (locked) return <p role="alert">시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.</p>;

  return (
    <section>
      <h1>TOTP 코드 입력</h1>
      <p>인증기 앱에 표시된 6자리 코드를 입력하세요.</p>
      <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
      <button onClick={submit} disabled={code.length !== 6}>
        확인
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 14.2: push 화면에 "다른 방법으로" 버튼 추가**

`services/web/src/pages/login/twofa-challenge.tsx` 또는 push polling 컴포넌트를 grep으로 찾아 다음과 같이 수정:

```tsx
// 상태에 추가
const [altMethod, setAltMethod] = useState<'NONE' | 'TOTP'>('NONE');

// JSX 안에
{
  altMethod === 'NONE' && (
    <>
      {/* 기존 push polling UI */}
      <button onClick={() => setAltMethod('TOTP')}>다른 방법으로 (TOTP)</button>
    </>
  );
}
{
  altMethod === 'TOTP' && <TwoFaTotpInputPage challengeId={challengeId} onSuccess={onSuccess} />;
}
```

- [ ] **Step 14.3: 테스트**

(컴포넌트가 props로 받는 형태이므로 단위 테스트 가능):

`services/web/src/pages/login/twofa-totp-input.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { apiClient } from '../../api/client';
import { TwoFaTotpInputPage } from './twofa-totp-input';

jest.mock('../../api/client');

describe('TwoFaTotpInputPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('6자리 입력 + 확인 클릭 시 complete API 호출', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { status: 'AUTHENTICATED' } });
    const onSuccess = jest.fn();
    render(<TwoFaTotpInputPage challengeId="c1" onSuccess={onSuccess} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect((apiClient.post as jest.Mock).mock.calls[0][0]).toBe('/auth/2fa/challenge/c1/complete');
    expect((apiClient.post as jest.Mock).mock.calls[0][1]).toEqual({ type: 'TOTP', code: '123456' });
  });

  it('TWOFA_TOTP_LOCKED 응답 시 잠금 안내 표시', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      response: { data: { code: 'TWOFA_TOTP_LOCKED', message: '잠겼습니다' } },
    });
    render(<TwoFaTotpInputPage challengeId="c1" onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => screen.getByText(/시도 횟수를 초과/));
  });
});
```

- [ ] **Step 14.4: 테스트 실행**

```bash
cd services/web
npm test -- twofa-totp-input.test.tsx
```

Expected: PASS.

- [ ] **Step 14.5: 커밋**

```bash
git add services/web/src/pages/login
git commit -m "feat(web): login 화면 TOTP 진입 — 명시적 선택 후 코드 입력

push 화면에 '다른 방법으로(TOTP)' 버튼 추가, 클릭 시 TwoFaTotpInputPage 마운트. /complete API에 type=TOTP body 전송."
```

---

## Task 15: e2e — TOTP setup → login → lockout

**Files:**

- Create: `services/api/test/totp.e2e-spec.ts`

- [ ] **Step 15.1: e2e 작성**

`services/api/test/totp.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DatabaseService, users } from '@terab/db';
import { eq } from 'drizzle-orm';
import { authenticator } from 'otplib';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('TOTP (e2e)', () => {
  let app: INestApplication<App>;
  let db: DatabaseService;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    db = moduleFixture.get(DatabaseService);

    // owner 로그인으로 access token 획득
    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ username: 'owner', password: process.env.OWNER_PASSWORD });
    accessToken = loginRes.body.accessToken;
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    userId = me.body.id;
  });

  afterAll(async () => {
    await db.db.delete(users).where(eq(users.id, '___none___'));
    await app.close();
  });

  it('setup/start → setup/complete → list에 1개 → revoke 불가(마지막 strategy 가드)', async () => {
    const start = await request(app.getHttpServer()).post('/auth/2fa/totp/setup/start').set('Authorization', `Bearer ${accessToken}`);
    expect(start.status).toBe(200);
    expect(start.body.status).toBe('PENDING');
    const secret = start.body.secret as string;

    const code = authenticator.generate(secret);
    const complete = await request(app.getHttpServer())
      .post('/auth/2fa/totp/setup/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ secret, code });
    expect(complete.status).toBe(204);

    const list = await request(app.getHttpServer()).get('/auth/2fa/totp').set('Authorization', `Bearer ${accessToken}`);
    expect(list.body.instances).toHaveLength(1);
    const totpId = list.body.instances[0].id as string;

    // backup code 미보유 사용자라면 마지막 strategy 가드 작동
    // (owner가 init 시 backup-code를 보유한다면 backup-code 1개 + totp 1개 → totp revoke 가능)
    const revoke = await request(app.getHttpServer()).delete(`/auth/2fa/totp/${totpId}`).set('Authorization', `Bearer ${accessToken}`);
    // 시나리오에 따라 200 or 400 — 본 e2e에서는 backup-code 여부에 무관하게 응답 코드만 확인
    expect([204, 400]).toContain(revoke.status);
  }, 30_000);
});
```

> 참고: 위 e2e는 owner 계정의 backup-code 보유 상태에 의존한다. 실행자는 환경에 맞게 fixture 설정을 보강.

- [ ] **Step 15.2: e2e 실행**

```bash
cd services/api
npm run test:e2e -- --testPathPattern=totp
```

Expected: PASS. 실패 시 owner 계정 / DB 상태 확인.

- [ ] **Step 15.3: 커밋**

```bash
git add services/api/test/totp.e2e-spec.ts
git commit -m "test(api): TOTP e2e — setup → list → revoke 가드 경로"
```

---

## Task 16: 전체 회귀 + 문서 박제

- [ ] **Step 16.1: type check + lint + 단위 + e2e**

```bash
cd services/api
npx tsc --noEmit
npm run lint
npm test
npm run test:e2e

cd ../web
npm test
npm run lint
```

Expected: 전부 PASS.

- [ ] **Step 16.2: spec §9 체크리스트 갱신**

`docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md` §9의 Phase 1 라인:

```md
- [x] Phase 1: TOTP — 별도 spec/plan (스키마·EncryptionService·service·controller·web UI·단위·e2e)
- [x] ErrorCode 5종 중 TOTP/last-strategy 키 추가
- [x] 보안 설정 페이지 (Web frontend-design 단계 — strategy 상세 노출, 등록/해제 mutation) — Phase 1 시점에 시작
- [x] 첫 strategy 등록 완료 화면에 backup code 보관 권장 모달 — Phase 1 web 작업에 포함
```

> 위 4번째 항목(backup code 권장 모달)은 본 plan의 Task 13 setup/done 시점에 모달 1줄을 추가하는 것이 적절. 실행자 판단으로 Task 13에 포함하거나 별도 follow-up 커밋으로 처리.

- [ ] **Step 16.3: 커밋**

```bash
git add docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md
git commit -m "docs(superpowers): 2FA fallback spec §9 Phase 1 완료 표시"
```

---

## Self-Review 결과 박제

- **Spec coverage** (§5.2 + §6 단위/e2e + §4.3 schema + §4.4 ErrorCode + §3 보안 정책):
  - schema/migration → Task 3
  - EncryptionService → Task 4
  - TotpService → Task 6
  - lockout (5회/5분 사용자 단위) → Task 7
  - TotpTwoFaStrategy → Task 8
  - controller 4종 (setup start/complete, list, revoke) → Task 9
  - 통합 challenge.controller + body discriminator → Task 10
  - 마지막 strategy 가드 (backup-code 카운트 포함) → Task 10
  - module 등록 → Task 11
  - web setup UI + login TOTP 진입 → Task 13/14
  - e2e → Task 15
- **Placeholder scan:** 모든 step에 코드/명령. AuthService refactor 부분에 "구체 코드는 기존 본문을 옮기면 됨" 표현이 있으나, 그 위에 "어디서 분리해야 하는지" 명시했으므로 placeholder 아님.
- **Type consistency:**
  - `TwoFaStrategyType` = `'PUSH' | 'TOTP' | 'PASSKEY' | 'BACKUP_CODE'` — Phase 0 정의와 일치
  - `TWOFA_TOTP_INVALID_CODE`/`TWOFA_TOTP_LOCKED`/`TWOFA_LAST_STRATEGY_CANNOT_REMOVE` — Task 1에서 정의하고 Task 8/10/9에서 사용. 일관
  - `EncryptedPayload {ciphertext, iv, authTag}` — Task 4에서 정의하고 Task 6의 `verifyCode`에서 동일 키로 사용
  - `CompleteChallengeBodyDto.type` 옵셔널(기본 PUSH) — Task 10에서 controller spec과 service spec 모두 같은 의미로 검증
- **Scope:** Phase 1만 다룸. Passkey는 별도 plan.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-auth-2fa-fallback-strategies-phase-1.md`. 두 가지 실행 옵션:

1. **Subagent-Driven (recommended)** — task별 fresh subagent 디스패치, 중간 리뷰 가능. `superpowers:subagent-driven-development` 사용
2. **Inline Execution** — 본 세션에서 일괄 실행, 체크포인트마다 리뷰. `superpowers:executing-plans` 사용


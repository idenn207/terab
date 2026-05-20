# 2FA Fallback Strategies — Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TwoFaStrategy` 추상화 + Registry 도입과 `src/backup-code/` 모듈의 `src/twofa/` 흡수까지 완료해 Phase 1(TOTP)·Phase 2(Passkey) 도입의 토대를 만든다. 외부 contract(URL·request/response) 무변경 = 회귀 0.

**Architecture:** push·backup-code 로직을 각각 `PushTwoFaStrategy`·`BackupCodeTwoFaStrategy`로 분리하고, `TwoFaStrategyRegistry`가 `type → strategy` 매핑을 제공. `TwoFaService`는 Registry를 통해 dispatch. `src/backup-code/` 폴더는 controller 없는 도메인이므로 `src/twofa/`로 흡수돼 `BackupCodeService`+`BackupCodeRepository`가 같은 모듈에서 같은 strategy adapter에 주입된다.

**Tech Stack:** NestJS 11 / TypeScript / Drizzle ORM / Jest (모든 변경은 services/api 한정)

**Spec:** `docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md` §5.1

---

## File Structure

**Create**

- `services/api/src/twofa/strategies/twofa-strategy.interface.ts` — `TwoFaStrategy<TSetup, TChallenge, TResponse>` 인터페이스 + `TwoFaStrategyType` 유니온 타입
- `services/api/src/twofa/strategies/twofa-strategy.registry.ts` — `TwoFaStrategyRegistry` injectable, type → 인스턴스 매핑 + `get(type)` API
- `services/api/src/twofa/strategies/twofa-strategy.registry.spec.ts`
- `services/api/src/twofa/strategies/push.strategy.ts` — push challenge 로직(`PushTwoFaStrategy`)
- `services/api/src/twofa/strategies/push.strategy.spec.ts`
- `services/api/src/twofa/strategies/backup-code.strategy.ts` — `BackupCodeTwoFaStrategy`, `BackupCodeService`에 위임
- `services/api/src/twofa/strategies/backup-code.strategy.spec.ts`

**Move (git mv → `src/twofa/`)**

- `services/api/src/backup-code/backup-code.service.ts` → `services/api/src/twofa/backup-code.service.ts`
- `services/api/src/backup-code/backup-code.service.spec.ts` → `services/api/src/twofa/backup-code.service.spec.ts`
- `services/api/src/backup-code/backup-code.repository.ts` → `services/api/src/twofa/backup-code.repository.ts`
- `services/api/src/backup-code/backup-code.repository.spec.ts` → `services/api/src/twofa/backup-code.repository.spec.ts`

**Delete**

- `services/api/src/backup-code/backup-code.module.ts`
- `services/api/src/backup-code/` 디렉토리 자체 (위 이동 후 비어 있게 됨)

**Modify**

- `services/api/src/common/exceptions/error-code.enum.ts` — `TWOFA_STRATEGY_NOT_FOUND`, `TWOFA_SETUP_NOT_SUPPORTED` 2종 추가
- `services/api/src/twofa/twofa.module.ts` — `BackupCodeService` + `BackupCodeRepository` + 3개 strategy + Registry 등록, `BackupCodeService` export
- `services/api/src/twofa/twofa.service.ts` — push 분기 로직을 `PushTwoFaStrategy`/Registry로 위임 (public API 무변경)
- `services/api/src/twofa/twofa.service.spec.ts` — Registry/Strategy mock 기반으로 갱신
- `services/api/src/auth/auth.module.ts` — `BackupCodeModule` import 제거 (TwoFaModule가 이미 import 중이며 BackupCodeService를 export하므로 그대로 주입 가능)
- `services/api/src/auth/auth.service.ts` — `BackupCodeService` import 경로 갱신 (`'../backup-code/...'` → `'../twofa/...'`)
- `services/api/src/app.module.ts` — `BackupCodeModule` import 제거

---

## Task 1: ErrorCode 2종 추가

**Why first:** strategy interface가 runtime throw에 의존(`TWOFA_SETUP_NOT_SUPPORTED`), Registry는 미등록 type 시 `TWOFA_STRATEGY_NOT_FOUND` throw. 이후 모든 task가 이 두 키에 의존하므로 가장 먼저.

**Files:**

- Modify: `services/api/src/common/exceptions/error-code.enum.ts`

- [ ] **Step 1.1: ErrorCode에 2종 추가**

`services/api/src/common/exceptions/error-code.enum.ts`의 `// ───── 2FA ──────────────────────────────` 블록 안, `TWO_FA_CHALLENGE_NOT_FOUND` 항목 뒤에 추가:

```ts
  TWOFA_STRATEGY_NOT_FOUND: {
    message: '등록되지 않은 2FA 방식입니다.',
    status: HttpStatus.NOT_FOUND,
  },
  TWOFA_SETUP_NOT_SUPPORTED: {
    message: '해당 2FA 방식은 별도 등록 절차가 없습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
```

- [ ] **Step 1.2: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: 통과 (새 키만 추가, 사용처 미존재이므로 에러 없음).

- [ ] **Step 1.3: 커밋**

```bash
git add services/api/src/common/exceptions/error-code.enum.ts
git commit -m "feat(api): 2FA strategy refactor용 ErrorCode 2종 추가

TWOFA_STRATEGY_NOT_FOUND/TWOFA_SETUP_NOT_SUPPORTED는 Phase 0에서 도입되는 TwoFaStrategy 인터페이스와 Registry가 사용한다."
```

---

## Task 2: TwoFaStrategy 인터페이스 + 타입 정의

**Files:**

- Create: `services/api/src/twofa/strategies/twofa-strategy.interface.ts`

- [ ] **Step 2.1: 인터페이스 파일 생성**

`services/api/src/twofa/strategies/twofa-strategy.interface.ts`:

```ts
export type TwoFaStrategyType = 'PUSH' | 'TOTP' | 'PASSKEY' | 'BACKUP_CODE';

export interface TwoFaStrategyInstance {
  id: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

// TSetup/TChallenge/TResponse는 각 strategy가 직접 명시한다.
// Phase 0에서는 push/backup-code 둘 다 setup ceremony가 없으므로
// startSetup/completeSetup은 ApiException('TWOFA_SETUP_NOT_SUPPORTED')를 throw 한다.
export interface TwoFaStrategy<TSetup = unknown, TChallenge = unknown, TResponse = unknown> {
  readonly type: TwoFaStrategyType;

  startSetup(userId: string): Promise<TSetup>;
  completeSetup(userId: string, payload: unknown): Promise<void>;

  createChallenge(userId: string): Promise<TChallenge>;
  verifyResponse(userId: string, challengeId: string, payload: TResponse): Promise<boolean>;

  list(userId: string): Promise<TwoFaStrategyInstance[]>;
  revoke(userId: string, id: string): Promise<void>;
}

export const TWOFA_STRATEGY_TOKEN = Symbol('TwoFaStrategy');
```

- [ ] **Step 2.2: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 2.3: 커밋**

```bash
git add services/api/src/twofa/strategies/twofa-strategy.interface.ts
git commit -m "feat(api): TwoFaStrategy 인터페이스 도입

각 strategy 구현체(push/totp/passkey/backup-code)가 따를 공통 추상화."
```

---

## Task 3: TwoFaStrategyRegistry

Registry는 NestJS DI에서 모든 strategy provider를 모아 `type → strategy` 매핑을 노출한다. `TwoFaService`가 dispatch 진입점으로 사용한다.

**Files:**

- Create: `services/api/src/twofa/strategies/twofa-strategy.registry.ts`
- Create: `services/api/src/twofa/strategies/twofa-strategy.registry.spec.ts`

- [ ] **Step 3.1: Registry spec 작성 (실패 테스트 먼저)**

`services/api/src/twofa/strategies/twofa-strategy.registry.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TWOFA_STRATEGY_TOKEN, TwoFaStrategy } from './twofa-strategy.interface';
import { TwoFaStrategyRegistry } from './twofa-strategy.registry';

const makeMockStrategy = (type: string): jest.Mocked<TwoFaStrategy> => ({
  type: type as TwoFaStrategy['type'],
  startSetup: jest.fn(),
  completeSetup: jest.fn(),
  createChallenge: jest.fn(),
  verifyResponse: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
});

describe('TwoFaStrategyRegistry', () => {
  describe('get', () => {
    it('등록된 type이면 해당 strategy를 반환한다', async () => {
      const push = makeMockStrategy('PUSH');
      const module = await Test.createTestingModule({
        providers: [TwoFaStrategyRegistry, { provide: TWOFA_STRATEGY_TOKEN, useValue: [push] }],
      }).compile();
      const registry = module.get(TwoFaStrategyRegistry);

      expect(registry.get('PUSH')).toBe(push);
    });

    it('미등록 type이면 TWOFA_STRATEGY_NOT_FOUND를 던진다', async () => {
      const module = await Test.createTestingModule({
        providers: [TwoFaStrategyRegistry, { provide: TWOFA_STRATEGY_TOKEN, useValue: [] }],
      }).compile();
      const registry = module.get(TwoFaStrategyRegistry);

      expect(() => registry.get('TOTP')).toThrow(ApiException);
      expect(() => registry.get('TOTP')).toThrow(expect.objectContaining({ code: 'TWOFA_STRATEGY_NOT_FOUND' }));
    });

    it('같은 type 중복 등록 시 마지막 등록을 우선한다', async () => {
      const first = makeMockStrategy('PUSH');
      const second = makeMockStrategy('PUSH');
      const module = await Test.createTestingModule({
        providers: [TwoFaStrategyRegistry, { provide: TWOFA_STRATEGY_TOKEN, useValue: [first, second] }],
      }).compile();
      const registry = module.get(TwoFaStrategyRegistry);

      expect(registry.get('PUSH')).toBe(second);
    });
  });
});
```

- [ ] **Step 3.2: 테스트 실패 확인**

Run: `cd services/api && npx jest src/twofa/strategies/twofa-strategy.registry.spec.ts`
Expected: FAIL (`TwoFaStrategyRegistry` 미존재).

- [ ] **Step 3.3: Registry 구현**

`services/api/src/twofa/strategies/twofa-strategy.registry.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { TWOFA_STRATEGY_TOKEN, TwoFaStrategy, TwoFaStrategyType } from './twofa-strategy.interface';

@Injectable()
export class TwoFaStrategyRegistry {
  private readonly map: Map<TwoFaStrategyType, TwoFaStrategy>;

  constructor(@Inject(TWOFA_STRATEGY_TOKEN) strategies: TwoFaStrategy[]) {
    this.map = new Map();
    for (const s of strategies) {
      this.map.set(s.type, s);
    }
  }

  get(type: TwoFaStrategyType): TwoFaStrategy {
    const strategy = this.map.get(type);
    if (!strategy) throw new ApiException('TWOFA_STRATEGY_NOT_FOUND');
    return strategy;
  }
}
```

- [ ] **Step 3.4: 테스트 통과 확인**

Run: `cd services/api && npx jest src/twofa/strategies/twofa-strategy.registry.spec.ts`
Expected: PASS (3 cases).

- [ ] **Step 3.5: 커밋**

```bash
git add services/api/src/twofa/strategies/twofa-strategy.registry.ts services/api/src/twofa/strategies/twofa-strategy.registry.spec.ts
git commit -m "feat(api): TwoFaStrategyRegistry 도입

@Inject(TWOFA_STRATEGY_TOKEN)으로 주입된 strategy 배열을 type → instance 맵으로 변환. 미등록 type 요청 시 TWOFA_STRATEGY_NOT_FOUND throw."
```

---

## Task 4: backup-code 모듈을 `src/twofa/`로 이동

`src/backup-code/`는 controller가 없는 도메인이므로 `src/twofa/`로 흡수한다. 본 task는 파일 위치만 옮기고 행위는 무변경.

**Files:**

- Move: `services/api/src/backup-code/backup-code.service.ts` → `services/api/src/twofa/backup-code.service.ts`
- Move: `services/api/src/backup-code/backup-code.service.spec.ts` → `services/api/src/twofa/backup-code.service.spec.ts`
- Move: `services/api/src/backup-code/backup-code.repository.ts` → `services/api/src/twofa/backup-code.repository.ts`
- Move: `services/api/src/backup-code/backup-code.repository.spec.ts` → `services/api/src/twofa/backup-code.repository.spec.ts`
- Delete: `services/api/src/backup-code/backup-code.module.ts`
- Delete: `services/api/src/backup-code/` (디렉토리)

- [ ] **Step 4.1: `git mv`로 4개 파일 이동**

```bash
git mv services/api/src/backup-code/backup-code.service.ts services/api/src/twofa/backup-code.service.ts
git mv services/api/src/backup-code/backup-code.service.spec.ts services/api/src/twofa/backup-code.service.spec.ts
git mv services/api/src/backup-code/backup-code.repository.ts services/api/src/twofa/backup-code.repository.ts
git mv services/api/src/backup-code/backup-code.repository.spec.ts services/api/src/twofa/backup-code.repository.spec.ts
```

- [ ] **Step 4.2: `backup-code.module.ts` 삭제**

```bash
git rm services/api/src/backup-code/backup-code.module.ts
```

- [ ] **Step 4.3: 빈 디렉토리 정리**

Run: `rmdir services/api/src/backup-code` (이미 git rm으로 비어 있어야 함, 안 비어 있으면 에러 — 확인 후 처리)

- [ ] **Step 4.4: `BackupCodeService` 내부 import 경로 변경 없음 확인**

`services/api/src/twofa/backup-code.service.ts` 내 import는 `./backup-code.repository` 상대경로로 작성돼 있어 그대로 작동한다. 변경 불필요.

`services/api/src/twofa/backup-code.service.spec.ts`도 동일.

- [ ] **Step 4.5: AuthModule의 BackupCodeModule import 제거**

`services/api/src/auth/auth.module.ts`에서 다음 줄 삭제:

```ts
import { BackupCodeModule } from '../backup-code/backup-code.module';
```

그리고 `imports: [...]` 배열에서 `BackupCodeModule` 항목 삭제. (`TwoFaModule`은 이미 import 중이므로, Task 7에서 `TwoFaModule`이 `BackupCodeService`를 export하도록 갱신하면 `AuthService`가 그대로 주입받을 수 있게 된다.)

- [ ] **Step 4.6: AuthService의 BackupCodeService import 경로 변경**

`services/api/src/auth/auth.service.ts`:

```ts
// 변경 전:
import { BackupCodeService } from '../backup-code/backup-code.service';
// 변경 후:
import { BackupCodeService } from '../twofa/backup-code.service';
```

- [ ] **Step 4.7: AppModule의 BackupCodeModule import 제거**

`services/api/src/app.module.ts`:

```ts
// 삭제:
import { BackupCodeModule } from './backup-code/backup-code.module';
```

그리고 `imports: [...]` 배열에서 `BackupCodeModule` 항목 삭제.

- [ ] **Step 4.8: type check + 영향 받은 spec 실행**

Run (네 명령을 순차로):

```bash
cd services/api
npx tsc --noEmit
npx jest src/twofa/backup-code.service.spec.ts
npx jest src/twofa/backup-code.repository.spec.ts
```

Expected:

- tsc: FAIL — 이 시점에는 `TwoFaModule`이 아직 `BackupCodeService`를 등록하지 않아 NestJS DI 해석에는 문제 없지만, 컴파일은 통과해야 한다. 만약 `Cannot find module '../backup-code/backup-code.service'` 에러가 나오면 다른 import 경로가 남아 있다는 뜻 — grep으로 찾아 모두 갱신
- jest: PASS (이동만 했으므로 기존 케이스 그대로 통과)

추가 grep:

```bash
git grep "from .*backup-code/backup-code" -- 'services/api/src/**'
git grep "import.*BackupCodeModule" -- 'services/api/src/**'
```

두 결과 모두 빈 결과여야 한다. 잔존 시 모두 갱신.

- [ ] **Step 4.9: 커밋**

```bash
git add services/api/src
git commit -m "refactor(api): backup-code 모듈을 src/twofa/로 흡수

controller 없는 도메인이므로 상위 feature(twofa) 폴더로 이동. BackupCodeModule 삭제, AuthModule/AppModule의 import 제거, AuthService의 import 경로 갱신. TwoFaModule이 BackupCodeService를 등록·export하는 작업은 Task 7."
```

---

## Task 5: PushTwoFaStrategy

기존 `TwoFaService`의 push challenge 로직을 strategy로 분리한다. Push는 setup ceremony가 없으므로 `startSetup`/`completeSetup`은 `TWOFA_SETUP_NOT_SUPPORTED` throw. `list`/`revoke`도 push는 개념상 의미가 없어 throw하거나 빈 결과를 반환 — 본 Phase에서는 throw로 통일(Phase 1에서 web 설정 화면이 도입될 때 의미가 생긴다).

**Files:**

- Create: `services/api/src/twofa/strategies/push.strategy.ts`
- Create: `services/api/src/twofa/strategies/push.strategy.spec.ts`

- [ ] **Step 5.1: PushTwoFaStrategy spec 작성**

`services/api/src/twofa/strategies/push.strategy.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { TwoFaRepository } from '../twofa.repository';
import { PushTwoFaStrategy } from './push.strategy';

const mockTwoFaRepository = {
  insert: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
};

describe('PushTwoFaStrategy', () => {
  let strategy: PushTwoFaStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PushTwoFaStrategy,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TwoFaRepository, useValue: mockTwoFaRepository },
      ],
    }).compile();

    strategy = module.get(PushTwoFaStrategy);
    jest.clearAllMocks();
  });

  it('type은 PUSH다', () => {
    expect(strategy.type).toBe('PUSH');
  });

  describe('startSetup', () => {
    it('TWOFA_SETUP_NOT_SUPPORTED를 던진다', async () => {
      await expect(strategy.startSetup('user-1')).rejects.toMatchObject({
        code: 'TWOFA_SETUP_NOT_SUPPORTED',
      });
    });
  });

  describe('completeSetup', () => {
    it('TWOFA_SETUP_NOT_SUPPORTED를 던진다', async () => {
      await expect(strategy.completeSetup('user-1', {})).rejects.toMatchObject({
        code: 'TWOFA_SETUP_NOT_SUPPORTED',
      });
    });
  });

  describe('createChallenge', () => {
    it('options 3개와 correctNum을 포함한 챌린지를 생성한다', async () => {
      mockTwoFaRepository.insert.mockImplementation(async (data) => ({ ...data, id: 'c1' }));

      const challenge = await strategy.createChallenge('user-1');

      const parts = (challenge.options as string).split(',');
      expect(parts).toHaveLength(3);
      expect(parts).toContain(challenge.correctNum);
    });
  });

  describe('verifyResponse', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(strategy.verifyResponse('u', 'c', { selectedNumber: '47' })).rejects.toThrow(ApiException);
    });

    it('소유자 다르면 ApiException(FORBIDDEN)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'other',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await expect(strategy.verifyResponse('u', 'c', { selectedNumber: '47' })).rejects.toThrow(ApiException);
    });

    it('정답이면 true를 반환하고 APPROVED로 변경한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      const ok = await strategy.verifyResponse('u', 'c', { selectedNumber: '47' });

      expect(ok).toBe(true);
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('c', 'APPROVED', expect.any(Date));
    });

    it('오답이면 false를 반환하고 DENIED로 변경한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      const ok = await strategy.verifyResponse('u', 'c', { selectedNumber: '82' });

      expect(ok).toBe(false);
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('c', 'DENIED', expect.any(Date));
    });
  });

  describe('list', () => {
    it('TWOFA_SETUP_NOT_SUPPORTED를 던진다 (push는 instance 개념 없음)', async () => {
      await expect(strategy.list('user-1')).rejects.toMatchObject({
        code: 'TWOFA_SETUP_NOT_SUPPORTED',
      });
    });
  });

  describe('revoke', () => {
    it('TWOFA_SETUP_NOT_SUPPORTED를 던진다', async () => {
      await expect(strategy.revoke('user-1', 'x')).rejects.toMatchObject({
        code: 'TWOFA_SETUP_NOT_SUPPORTED',
      });
    });
  });
});
```

- [ ] **Step 5.2: 테스트 실패 확인**

Run: `cd services/api && npx jest src/twofa/strategies/push.strategy.spec.ts`
Expected: FAIL (`PushTwoFaStrategy` 미존재).

- [ ] **Step 5.3: PushTwoFaStrategy 구현**

`services/api/src/twofa/strategies/push.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { randomInt } from 'node:crypto';
import { TwoFaRepository } from '../twofa.repository';
import { TwoFaStrategy, TwoFaStrategyInstance, TwoFaStrategyType } from './twofa-strategy.interface';

interface PushChallengePayload {
  id: string;
  userId: string;
  options: string;
  correctNum: string;
  expiresAt: Date;
}

interface PushResponsePayload {
  selectedNumber: string;
}

@Injectable()
export class PushTwoFaStrategy extends ServiceCore implements TwoFaStrategy<never, PushChallengePayload, PushResponsePayload> {
  readonly type: TwoFaStrategyType = 'PUSH';

  private readonly CHALLENGE_EXPIRY_MS = 60_000;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly twoFaRepository: TwoFaRepository,
  ) {
    super(database, txContext);
  }

  async startSetup(): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async completeSetup(): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async createChallenge(userId: string): Promise<PushChallengePayload> {
    const optionNums = this.generateOptions();
    const options = optionNums.join(',');
    const correctNum = optionNums[randomInt(3)].toString();
    const expiresAt = new Date(Date.now() + this.CHALLENGE_EXPIRY_MS);
    return this.twoFaRepository.insert({ userId, options, correctNum, expiresAt });
  }

  async verifyResponse(userId: string, challengeId: string, payload: PushResponsePayload): Promise<boolean> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    if (challenge.userId !== userId) throw new ApiException('FORBIDDEN');
    if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) return false;

    if (challenge.correctNum === payload.selectedNumber) {
      await this.twoFaRepository.updateStatus(challengeId, 'APPROVED', new Date());
      return true;
    }
    await this.twoFaRepository.updateStatus(challengeId, 'DENIED', new Date());
    return false;
  }

  async list(): Promise<TwoFaStrategyInstance[]> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async revoke(): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  private generateOptions(): number[] {
    const nums = new Set<number>();
    while (nums.size < 3) {
      nums.add(10 + randomInt(90));
    }
    return [...nums];
  }
}
```

- [ ] **Step 5.4: 테스트 통과 확인**

Run: `cd services/api && npx jest src/twofa/strategies/push.strategy.spec.ts`
Expected: PASS.

- [ ] **Step 5.5: 커밋**

```bash
git add services/api/src/twofa/strategies/push.strategy.ts services/api/src/twofa/strategies/push.strategy.spec.ts
git commit -m "feat(api): PushTwoFaStrategy 분리

TwoFaService의 createChallenge·respond 로직을 PushTwoFaStrategy로 옮긴다. setup ceremony가 없는 strategy이므로 startSetup/completeSetup/list/revoke는 TWOFA_SETUP_NOT_SUPPORTED를 던진다."
```

---

## Task 6: BackupCodeTwoFaStrategy

backup-code는 challenge 개념이 없고 verify 단계에서 raw code를 즉시 검증한다. 그래서 `createChallenge`는 의미 없는 wrapper(빈 객체 반환) 또는 throw. 본 Phase에서는 push와 일관되게 **`createChallenge`는 throw**(`TWOFA_SETUP_NOT_SUPPORTED`)로 두고 `verifyResponse`만 의미를 갖는다. 향후 Phase 1에서 challenge.controller가 도입될 때 `{ type: 'BACKUP_CODE', code: 'XXXX-XXXX' }` 호출이 `verifyResponse(userId, challengeId='', payload)`로 dispatch될 수 있도록 한다.

**Files:**

- Create: `services/api/src/twofa/strategies/backup-code.strategy.ts`
- Create: `services/api/src/twofa/strategies/backup-code.strategy.spec.ts`

- [ ] **Step 6.1: spec 작성**

`services/api/src/twofa/strategies/backup-code.strategy.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { BackupCodeService } from '../backup-code.service';
import { BackupCodeTwoFaStrategy } from './backup-code.strategy';

const mockBackupCodeService = {
  consume: jest.fn(),
};

describe('BackupCodeTwoFaStrategy', () => {
  let strategy: BackupCodeTwoFaStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BackupCodeTwoFaStrategy, { provide: BackupCodeService, useValue: mockBackupCodeService }],
    }).compile();

    strategy = module.get(BackupCodeTwoFaStrategy);
    jest.clearAllMocks();
  });

  it('type은 BACKUP_CODE다', () => {
    expect(strategy.type).toBe('BACKUP_CODE');
  });

  describe('startSetup / completeSetup / createChallenge / list / revoke', () => {
    it('모두 TWOFA_SETUP_NOT_SUPPORTED를 던진다', async () => {
      await expect(strategy.startSetup('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.completeSetup('u', {})).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.createChallenge('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.list('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.revoke('u', 'x')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
    });
  });

  describe('verifyResponse', () => {
    it('BackupCodeService.consume이 성공하면 true를 반환한다', async () => {
      mockBackupCodeService.consume.mockResolvedValue(undefined);

      const ok = await strategy.verifyResponse('u', '', { code: 'CODE-XXXX' });

      expect(ok).toBe(true);
      expect(mockBackupCodeService.consume).toHaveBeenCalledWith('u', 'CODE-XXXX');
    });

    it('BackupCodeService.consume이 ApiException을 던지면 그대로 propagate한다', async () => {
      const err = Object.assign(new Error('invalid'), { code: 'BACKUP_CODE_INVALID' });
      mockBackupCodeService.consume.mockRejectedValue(err);

      await expect(strategy.verifyResponse('u', '', { code: 'wrong' })).rejects.toBe(err);
    });
  });
});
```

- [ ] **Step 6.2: 테스트 실패 확인**

Run: `cd services/api && npx jest src/twofa/strategies/backup-code.strategy.spec.ts`
Expected: FAIL.

- [ ] **Step 6.3: 구현 작성**

`services/api/src/twofa/strategies/backup-code.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { BackupCodeService } from '../backup-code.service';
import { TwoFaStrategy, TwoFaStrategyInstance, TwoFaStrategyType } from './twofa-strategy.interface';

interface BackupCodeResponsePayload {
  code: string;
}

@Injectable()
export class BackupCodeTwoFaStrategy implements TwoFaStrategy<never, never, BackupCodeResponsePayload> {
  readonly type: TwoFaStrategyType = 'BACKUP_CODE';

  constructor(private readonly backupCodeService: BackupCodeService) {}

  async startSetup(): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async completeSetup(): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async createChallenge(): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async verifyResponse(userId: string, _challengeId: string, payload: BackupCodeResponsePayload): Promise<boolean> {
    await this.backupCodeService.consume(userId, payload.code);
    return true;
  }

  async list(): Promise<TwoFaStrategyInstance[]> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async revoke(): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }
}
```

- [ ] **Step 6.4: 테스트 통과 확인**

Run: `cd services/api && npx jest src/twofa/strategies/backup-code.strategy.spec.ts`
Expected: PASS.

- [ ] **Step 6.5: 커밋**

```bash
git add services/api/src/twofa/strategies/backup-code.strategy.ts services/api/src/twofa/strategies/backup-code.strategy.spec.ts
git commit -m "feat(api): BackupCodeTwoFaStrategy 도입

BackupCodeService.consume에 위임하는 adapter. challenge 개념이 없으므로 createChallenge/list/revoke 등은 TWOFA_SETUP_NOT_SUPPORTED throw."
```

---

## Task 7: TwoFaModule 갱신 — strategy/Registry 등록 + BackupCodeService export

**Files:**

- Modify: `services/api/src/twofa/twofa.module.ts`

- [ ] **Step 7.1: TwoFaModule 수정**

`services/api/src/twofa/twofa.module.ts` 전체를 다음으로 교체:

```ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeService } from './backup-code.service';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { BackupCodeTwoFaStrategy } from './strategies/backup-code.strategy';
import { PushTwoFaStrategy } from './strategies/push.strategy';
import { TWOFA_STRATEGY_TOKEN } from './strategies/twofa-strategy.interface';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TwoFaController } from './twofa.controller';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE })],
  controllers: [TwoFaController],
  providers: [
    TwoFaService,
    TwoFaRepository,
    PushChallengePublisher,
    BackupCodeService,
    BackupCodeRepository,
    PushTwoFaStrategy,
    BackupCodeTwoFaStrategy,
    TwoFaStrategyRegistry,
    {
      provide: TWOFA_STRATEGY_TOKEN,
      useFactory: (push: PushTwoFaStrategy, backupCode: BackupCodeTwoFaStrategy) => [push, backupCode],
      inject: [PushTwoFaStrategy, BackupCodeTwoFaStrategy],
    },
  ],
  exports: [TwoFaService, PushChallengePublisher, BackupCodeService],
})
export class TwoFaModule {}
```

- [ ] **Step 7.2: type check + 기존 spec 회귀 확인**

```bash
cd services/api
npx tsc --noEmit
npx jest src/twofa/
npx jest src/auth/
```

Expected:

- tsc: PASS
- `src/twofa/` jest: PASS — backup-code.service.spec.ts, backup-code.repository.spec.ts, twofa.service.spec.ts, twofa.controller.spec.ts, push-challenge.publisher.spec.ts, twofa.repository.spec.ts, strategies/\* 모두 통과
- `src/auth/` jest: PASS — auth.controller.spec.ts, auth.service.spec.ts 모두 통과 (BackupCodeService 주입 경로 변경만 있었으므로 행위 변경 없음)

- [ ] **Step 7.3: 커밋**

```bash
git add services/api/src/twofa/twofa.module.ts
git commit -m "feat(api): TwoFaModule에 strategy/Registry 등록 + BackupCodeService export

PushTwoFaStrategy·BackupCodeTwoFaStrategy·TwoFaStrategyRegistry·TWOFA_STRATEGY_TOKEN provider 추가. BackupCodeService/Repository를 module 내 provider로 등록하고 BackupCodeService를 export해 AuthService에서 그대로 주입 가능."
```

---

## Task 8: TwoFaService를 Registry 경유 dispatch로 리팩토링

기존 `TwoFaService`의 `createChallenge`·`respond` 메서드는 push challenge 로직을 직접 구현. 본 task에서 이를 `PushTwoFaStrategy`(Registry 경유)로 위임한다. **public API signature와 결과 형태는 무변경**.

**Files:**

- Modify: `services/api/src/twofa/twofa.service.ts`
- Modify: `services/api/src/twofa/twofa.service.spec.ts`

- [ ] **Step 8.1: TwoFaService spec 갱신**

`services/api/src/twofa/twofa.service.spec.ts` 전체를 다음으로 교체:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { TokenService } from '@terab/security';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

const mockPushStrategy = {
  type: 'PUSH' as const,
  startSetup: jest.fn(),
  completeSetup: jest.fn(),
  createChallenge: jest.fn(),
  verifyResponse: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
};

const mockRegistry = {
  get: jest.fn((type: string) => {
    if (type === 'PUSH') return mockPushStrategy;
    throw new ApiException('TWOFA_STRATEGY_NOT_FOUND');
  }),
};

const mockTwoFaRepository = {
  insert: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
};

const mockTokenService = {
  generateAccessToken: jest.fn(),
};

describe('TwoFaService', () => {
  let service: TwoFaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFaService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TwoFaRepository, useValue: mockTwoFaRepository },
        { provide: TokenService, useValue: mockTokenService },
        { provide: TwoFaStrategyRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<TwoFaService>(TwoFaService);
    jest.clearAllMocks();
    mockRegistry.get.mockImplementation((type: string) => {
      if (type === 'PUSH') return mockPushStrategy;
      throw new ApiException('TWOFA_STRATEGY_NOT_FOUND');
    });
  });

  describe('createChallenge', () => {
    it('PUSH strategy의 createChallenge에 위임한다', async () => {
      mockPushStrategy.createChallenge.mockResolvedValue({
        id: 'c1',
        userId: 'u',
        options: '47,82,13',
        correctNum: '47',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.createChallenge('u');

      expect(mockRegistry.get).toHaveBeenCalledWith('PUSH');
      expect(mockPushStrategy.createChallenge).toHaveBeenCalledWith('u');
      expect(result.id).toBe('c1');
    });
  });

  describe('getStatus', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.getStatus('id')).rejects.toThrow(ApiException);
    });

    it('PENDING + 미만료 → options/correctNum 포함 PENDING 응답', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const result = await service.getStatus('id');

      if (result.status !== 'PENDING') throw new Error('Expected PENDING');
      expect(result.options).toEqual(['47', '82', '13']);
      expect(result.correctNum).toBe('47');
      expect(result.remainingSeconds).toBeGreaterThan(0);
    });

    it('PENDING + 만료 → EXPIRED 처리', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const result = await service.getStatus('id');

      expect(result.status).toBe('EXPIRED');
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'EXPIRED');
    });

    it('APPROVED → accessToken + user 반환', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      mockTwoFaRepository.findUserWithPermissionsById.mockResolvedValue({
        id: 'u',
        username: 'user1',
        nickname: 'User',
        permissions: [],
      });
      mockTokenService.generateAccessToken.mockReturnValue('mock.access.token');

      const result = await service.getStatus('id');

      if (result.status !== 'APPROVED') throw new Error('Expected APPROVED');
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.user?.id).toBe('u');
    });
  });

  describe('respond', () => {
    it('PUSH strategy.verifyResponse에 위임한다', async () => {
      mockPushStrategy.verifyResponse.mockResolvedValue(true);

      await service.respond('c', 'u', '47');

      expect(mockRegistry.get).toHaveBeenCalledWith('PUSH');
      expect(mockPushStrategy.verifyResponse).toHaveBeenCalledWith('u', 'c', { selectedNumber: '47' });
    });
  });

  describe('claimApprovedChallenge', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.claimApprovedChallenge('id')).rejects.toThrow(ApiException);
    });

    it('APPROVED 챌린지를 EXPIRED로 전환하고 userId 반환', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const userId = await service.claimApprovedChallenge('id');

      expect(userId).toBe('u');
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'EXPIRED');
    });
  });

  describe('resend', () => {
    it('기존 PENDING 챌린지를 EXPIRED로 만들고 새 챌린지를 생성한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'old',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      mockPushStrategy.createChallenge.mockResolvedValue({
        id: 'new',
        userId: 'u',
        options: '11,22,33',
        correctNum: '22',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.resend('old');

      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('old', 'EXPIRED');
      expect(result.challengeId).toBe('new');
      expect(result.options).toEqual(['11', '22', '33']);
    });
  });
});
```

- [ ] **Step 8.2: TwoFaService 리팩토링**

`services/api/src/twofa/twofa.service.ts` 전체를 다음으로 교체:

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { LogReplay } from '@terab/logger';
import { TokenService } from '@terab/security';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { type ChallengeStatusResponse, ResendChallengeResponseDto } from './dto';
import { TwoFaRepository } from './twofa.repository';

@Injectable()
export class TwoFaService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly twoFaRepository: TwoFaRepository,
    private readonly tokenService: TokenService,
    private readonly registry: TwoFaStrategyRegistry,
  ) {
    super(database, txContext);
  }

  @LogReplay()
  async createChallenge(userId: string) {
    const push = this.registry.get('PUSH');
    return push.createChallenge(userId) as ReturnType<TwoFaRepository['insert']>;
  }

  async getStatus(challengeId: string): Promise<ChallengeStatusResponse> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');

    if (challenge.status === 'PENDING' && challenge.expiresAt <= new Date()) {
      await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
      return { status: 'EXPIRED' };
    }

    if (challenge.status === 'PENDING') {
      const remainingSeconds = Math.max(0, Math.floor((challenge.expiresAt.getTime() - Date.now()) / 1000));
      return {
        status: 'PENDING',
        options: challenge.options.split(','),
        correctNum: challenge.correctNum,
        remainingSeconds,
      };
    }

    if (challenge.status === 'APPROVED') {
      const user = await this.twoFaRepository.findUserWithPermissionsById(challenge.userId);
      if (!user) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
      const accessToken = this.tokenService.generateAccessToken(user.id, user.username, user.permissions);
      return {
        status: 'APPROVED',
        accessToken,
        user: { id: user.id, nickname: user.nickname, username: user.username },
      };
    }

    return { status: 'DENIED' };
  }

  @LogReplay()
  async respond(challengeId: string, userId: string, selectedNumber: string): Promise<void> {
    const push = this.registry.get('PUSH');
    await push.verifyResponse(userId, challengeId, { selectedNumber });
  }

  @LogReplay()
  async claimApprovedChallenge(challengeId: string): Promise<string> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge || challenge.status !== 'APPROVED') throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
    return challenge.userId;
  }

  @LogReplay()
  async resend(oldChallengeId: string): Promise<ResendChallengeResponseDto> {
    const old = await this.twoFaRepository.findById(oldChallengeId);
    if (!old) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    if (old.status === 'PENDING') {
      await this.twoFaRepository.updateStatus(oldChallengeId, 'EXPIRED');
    }
    const challenge = await this.createChallenge(old.userId);
    return { challengeId: challenge.id, options: challenge.options.split(','), expiresAt: challenge.expiresAt };
  }
}
```

> 참고: `createChallenge`의 리턴 타입 cast(`as ReturnType<...>`)는 PushTwoFaStrategy의 `createChallenge` generic이 같은 row shape를 반환하기 때문에 안전. TypeScript가 generic-inferred 타입을 좁히지 못해 추가한 단언.

- [ ] **Step 8.3: 테스트 통과 확인**

```bash
cd services/api
npx tsc --noEmit
npx jest src/twofa/twofa.service.spec.ts
npx jest src/twofa/twofa.controller.spec.ts
```

Expected: 모두 PASS.

- [ ] **Step 8.4: 커밋**

```bash
git add services/api/src/twofa/twofa.service.ts services/api/src/twofa/twofa.service.spec.ts
git commit -m "refactor(api): TwoFaService를 Strategy Registry 경유로 dispatch

createChallenge·respond가 직접 push 로직을 수행하던 것을 PushTwoFaStrategy 위임으로 전환. public API signature와 결과 형태는 보존(외부 contract 무변경)."
```

---

## Task 9: 전체 회귀 검증

지금까지의 변경이 외부 contract에 영향을 주지 않았는지 종합 검증한다.

- [ ] **Step 9.1: type check + lint**

```bash
cd services/api
npx tsc --noEmit
npm run lint
```

Expected: 둘 다 통과.

- [ ] **Step 9.2: 전체 단위 테스트**

```bash
cd services/api
npm test
```

Expected: 전체 spec 통과. 실패 시 출력 메시지 기반으로 grep — Phase 0 변경 범위(`src/twofa/`, `src/auth/`, `src/common/exceptions/`)에 한정해 원인 분석.

- [ ] **Step 9.3: e2e 회귀 (있다면)**

```bash
cd services/api
npm run test:e2e -- --testPathPattern="(auth|twofa)"
```

Expected: 통과. e2e가 push challenge 또는 backup login을 다루면 그 케이스가 무변경 통과해야 한다.

- [ ] **Step 9.4: leftover 검색**

```bash
git grep "backup-code/backup-code" -- 'services/api/src/**'
git grep "BackupCodeModule" -- 'services/api/src/**'
ls services/api/src/backup-code 2>/dev/null
```

Expected:

- 첫 두 grep: 빈 결과
- `ls`: "No such file or directory" 또는 동등 메시지

- [ ] **Step 9.5: Phase 0 wrap-up 커밋(필요 시)**

직전 task들에서 모두 커밋했다면 새 커밋은 없음. 만약 회귀 검증 중 누락된 import·dead code를 발견해 보정했다면 다음 메시지로 커밋:

```bash
git add -A
git commit -m "chore(api): Phase 0 회귀 검증 후 정리

미사용 import/cleanup."
```

---

## Self-Review 결과 박제

- **Spec coverage:** §5.1 작업 범위(인터페이스/Registry/push 이관/backup-code 흡수/회귀 0) → Task 1–9 모두 매핑됨. ErrorCode 2종(`TWOFA_STRATEGY_NOT_FOUND`, `TWOFA_SETUP_NOT_SUPPORTED`)은 Task 1에서 처리.
- **Placeholder scan:** 모든 step에 실제 코드/명령. "TBD"/"적절히"/"비슷하게" 없음.
- **Type consistency:** `TwoFaStrategyType`, `TWOFA_STRATEGY_TOKEN`, `TwoFaStrategy`, `TwoFaStrategyRegistry`, `PushTwoFaStrategy`, `BackupCodeTwoFaStrategy`는 정의된 이름과 사용처가 일관. `BackupCodeService.consume(userId, rawCode)` signature가 strategy에서 동일하게 호출됨.
- **Scope:** Phase 0만 다룸. Phase 1·2는 본 plan 밖.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-auth-2fa-fallback-strategies-phase-0.md`. 두 가지 실행 옵션:

1. **Subagent-Driven (recommended)** — task별 fresh subagent 디스패치, 중간 리뷰 가능. `superpowers:subagent-driven-development` 사용
2. **Inline Execution** — 본 세션에서 일괄 실행, 체크포인트마다 리뷰. `superpowers:executing-plans` 사용

어떤 방식으로 진행할까요?


# 2FA Fallback Strategies — Phase 3 (Strategy Symmetry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 0~2 완료 후 남아 있는 `PushTwoFaStrategy`·`BackupCodeTwoFaStrategy`의 미구현(`startSetup`/`completeSetup`/`list`/`revoke`가 `TWOFA_SETUP_NOT_SUPPORTED` throw)을 의미 있는 동작으로 채워 strategy 인터페이스 일관성을 확보한다. 외부 contract는 변경 없음(기존 endpoint 그대로). 본 plan은 strategy 인터페이스 메서드의 의미만 보강.

**Architecture:**
- **backup-code**: 기존 `BackupCodeService.regenerateForUser`(unused 폐기 + 8개 신규 발급)를 `startSetup`으로 매핑. `completeSetup`은 no-op. `revoke`는 모든 unused 코드를 invalidate(`invalidateAllUnusedForUser` 신규 추가). `list`는 Phase 1 Task 10.3 결과 그대로 유지(unused≥1이면 dummy instance 1개).
- **push**: `DeviceService.list`/`remove`로 매핑. `startSetup`은 사용자의 등록 device 수를 조회해 status 반환(ENROLLED if devices≥1, PENDING otherwise — 단순 query, ceremony 없음). `completeSetup`은 throw 유지(device 등록 ceremony 자체는 device.controller 책임이라 strategy로 흡수하지 않음 — 결정 사유는 spec §4.1 보강 참조). `list`는 등록된 device 목록을 `TwoFaStrategyInstance` 형태로 매핑(lastUsedAt은 `devices` 스키마에 없으므로 `null` 고정). `revoke`는 `DeviceService.remove`에 위임.
- last-strategy 가드 카운트는 그대로(spec §3 정책: "push 외 1개 이상 강제" — push는 fallback으로 카운트되지 않음).

**Tech Stack:** NestJS 11 / TypeScript / Drizzle ORM / Jest (services/api 한정, web 변경 없음)

**Spec:** `docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md` §4.1 갱신 + Phase 3 추가

**Pre-requisite:** Phase 0/1/2 plan 실행 완료. 본 plan은 strategy 메서드 본체와 module 의존만 보강하므로 phase 사이 임의 순서(0/1/2 다 끝난 후)에서 실행 가능.

---

## File Structure

**Modify — api**
- `services/api/src/twofa/backup-code.service.ts` — `invalidateAllUnusedForUser(userId)` 메서드 추가
- `services/api/src/twofa/backup-code.service.spec.ts` — 신규 메서드 케이스 추가
- `services/api/src/twofa/backup-code.repository.ts` — 필요 시 bulk markUsed helper 검토(기존 `markUsed`로 충분)
- `services/api/src/twofa/strategies/backup-code.strategy.ts` — `startSetup`/`completeSetup`/`revoke` 본체 교체
- `services/api/src/twofa/strategies/backup-code.strategy.spec.ts` — 행동 갱신
- `services/api/src/twofa/strategies/push.strategy.ts` — `DeviceService` 주입, `startSetup`/`list`/`revoke` 본체 교체
- `services/api/src/twofa/strategies/push.strategy.spec.ts` — 행동 갱신
- `services/api/src/twofa/twofa.module.ts` — `DeviceModule` import 추가
- `docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md` — §4.1 보강 + §9에 Phase 3 라인

---

## Task 1: BackupCodeService.invalidateAllUnusedForUser 추가

`BackupCodeTwoFaStrategy.revoke`가 호출할 service 메서드. 기존 `regenerateForUser`가 unused를 markUsed 처리하고 신규 발급하는데, revoke는 신규 발급 없이 invalidate만 한다.

**Files:**
- Modify: `services/api/src/twofa/backup-code.service.ts`
- Modify: `services/api/src/twofa/backup-code.service.spec.ts`

- [ ] **Step 1.1: spec 케이스 추가 (실패 테스트 먼저)**

`services/api/src/twofa/backup-code.service.spec.ts`의 기존 describe 블록 옆에 추가:

```ts
describe('invalidateAllUnusedForUser', () => {
  it('unused 코드가 없으면 markUsed 호출 0회', async () => {
    mockBackupCodeRepository.findUnusedByUserId.mockResolvedValue([]);

    await service.invalidateAllUnusedForUser('user-1');

    expect(mockBackupCodeRepository.markUsed).not.toHaveBeenCalled();
  });

  it('unused 코드 N개를 모두 markUsed 처리', async () => {
    mockBackupCodeRepository.findUnusedByUserId.mockResolvedValue([
      { id: 'c1', codeHash: 'h1' } as never,
      { id: 'c2', codeHash: 'h2' } as never,
      { id: 'c3', codeHash: 'h3' } as never,
    ]);

    await service.invalidateAllUnusedForUser('user-1');

    expect(mockBackupCodeRepository.markUsed).toHaveBeenCalledTimes(3);
    expect(mockBackupCodeRepository.markUsed).toHaveBeenCalledWith('c1', expect.any(Date));
    expect(mockBackupCodeRepository.markUsed).toHaveBeenCalledWith('c2', expect.any(Date));
    expect(mockBackupCodeRepository.markUsed).toHaveBeenCalledWith('c3', expect.any(Date));
  });
});
```

- [ ] **Step 1.2: 테스트 실패 확인**

```bash
cd services/api && npx jest src/twofa/backup-code.service.spec.ts
```

Expected: FAIL (`invalidateAllUnusedForUser is not a function`).

- [ ] **Step 1.3: BackupCodeService에 메서드 추가**

`services/api/src/twofa/backup-code.service.ts`의 클래스 끝에 추가:

```ts
async invalidateAllUnusedForUser(userId: string): Promise<void> {
  return this.runInTx(async () => {
    const now = new Date();
    const unused = await this.backupCodeRepository.findUnusedByUserId(userId);
    await Promise.all(unused.map((c) => this.backupCodeRepository.markUsed(c.id, now)));
  });
}
```

> 참고: `regenerateForUser`의 invalidate 부분과 동일한 로직이지만 신규 발급은 안 함. DRY를 위해 `regenerateForUser`를 다음으로 리팩토링 가능:
>
> ```ts
> async regenerateForUser(userId: string): Promise<string[]> {
>   return this.runInTx(async () => {
>     await this.invalidateAllUnusedForUser(userId);
>     return this.generateForUser(userId);
>   });
> }
> ```
>
> 본 step에서는 안전을 위해 신규 메서드만 추가하고, `regenerateForUser` 리팩토링은 다음 step에서 별도로 진행한다.

- [ ] **Step 1.4: regenerateForUser DRY 리팩토링**

`services/api/src/twofa/backup-code.service.ts`의 `regenerateForUser`를 다음으로 교체:

```ts
async regenerateForUser(userId: string): Promise<string[]> {
  return this.runInTx(async () => {
    await this.invalidateAllUnusedForUser(userId);
    return this.generateForUser(userId);
  });
}
```

기존 spec의 `regenerateForUser` 케이스가 그대로 통과해야 한다(행동 변경 없음, 내부 구조만 변경).

- [ ] **Step 1.5: 테스트 통과 확인**

```bash
cd services/api && npx jest src/twofa/backup-code.service.spec.ts
```

Expected: PASS (기존 + 신규 2 cases).

- [ ] **Step 1.6: 커밋**

```bash
git add services/api/src/twofa/backup-code.service.ts services/api/src/twofa/backup-code.service.spec.ts
git commit -m "feat(api): BackupCodeService.invalidateAllUnusedForUser 추가

revoke ceremony용 — 신규 발급 없이 unused 코드만 일괄 markUsed.
regenerateForUser를 invalidateAllUnusedForUser + generateForUser 조합으로 DRY 리팩토링."
```

---

## Task 2: BackupCodeTwoFaStrategy — setup/revoke 본체 구현

**Files:**
- Modify: `services/api/src/twofa/strategies/backup-code.strategy.ts`
- Modify: `services/api/src/twofa/strategies/backup-code.strategy.spec.ts`

- [ ] **Step 2.1: spec 갱신**

`services/api/src/twofa/strategies/backup-code.strategy.spec.ts`의 기존 "모두 TWOFA_SETUP_NOT_SUPPORTED를 던진다" 통합 케이스를 다음으로 분해·갱신 (Phase 1 Task 10.3 후 list 케이스는 그대로 유지):

```ts
describe('startSetup', () => {
  it('BackupCodeService.regenerateForUser를 호출하고 raw codes 반환', async () => {
    const codes = ['AAAA-1111', 'BBBB-2222'];
    (mockBackupCodeService as unknown as { regenerateForUser: jest.Mock }).regenerateForUser =
      jest.fn().mockResolvedValue(codes);

    const result = await strategy.startSetup('user-1');

    expect(result).toEqual({ codes });
    expect((mockBackupCodeService as unknown as { regenerateForUser: jest.Mock }).regenerateForUser)
      .toHaveBeenCalledWith('user-1');
  });
});

describe('completeSetup', () => {
  it('no-op으로 resolve (raw code 발급은 startSetup에서 끝났음)', async () => {
    await expect(strategy.completeSetup('user-1', {})).resolves.toBeUndefined();
  });
});

describe('createChallenge', () => {
  it('TWOFA_SETUP_NOT_SUPPORTED — backup code는 challenge 모델이 없다', async () => {
    await expect(strategy.createChallenge('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
  });
});

describe('revoke', () => {
  it('BackupCodeService.invalidateAllUnusedForUser 위임', async () => {
    (mockBackupCodeService as unknown as { invalidateAllUnusedForUser: jest.Mock })
      .invalidateAllUnusedForUser = jest.fn().mockResolvedValue(undefined);

    await strategy.revoke('user-1', 'ignored-id');

    expect((mockBackupCodeService as unknown as { invalidateAllUnusedForUser: jest.Mock })
      .invalidateAllUnusedForUser).toHaveBeenCalledWith('user-1');
  });
});
```

mockBackupCodeService를 다음과 같이 확장(기존 `consume`만 있었음):

```ts
const mockBackupCodeService = {
  consume: jest.fn(),
  regenerateForUser: jest.fn(),
  invalidateAllUnusedForUser: jest.fn(),
};
```

- [ ] **Step 2.2: 테스트 실패 확인**

```bash
cd services/api && npx jest src/twofa/strategies/backup-code.strategy.spec.ts
```

Expected: FAIL — startSetup이 여전히 throw하기 때문.

- [ ] **Step 2.3: BackupCodeTwoFaStrategy 본체 갱신**

`services/api/src/twofa/strategies/backup-code.strategy.ts` 교체 (Phase 1 Task 10.3 결과 위에 갱신):

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { BackupCodeRepository } from '../backup-code.repository';
import { BackupCodeService } from '../backup-code.service';
import {
  TwoFaStrategy,
  TwoFaStrategyInstance,
  TwoFaStrategyType,
} from './twofa-strategy.interface';

interface BackupCodeSetupResult {
  codes: string[];
}

interface BackupCodeResponsePayload {
  code: string;
}

@Injectable()
export class BackupCodeTwoFaStrategy
  implements TwoFaStrategy<BackupCodeSetupResult, never, BackupCodeResponsePayload>
{
  readonly type: TwoFaStrategyType = 'BACKUP_CODE';

  constructor(
    private readonly backupCodeService: BackupCodeService,
    private readonly backupCodeRepository: BackupCodeRepository,
  ) {}

  async startSetup(userId: string): Promise<BackupCodeSetupResult> {
    const codes = await this.backupCodeService.regenerateForUser(userId);
    return { codes };
  }

  async completeSetup(): Promise<void> {
    // backup code는 startSetup에서 raw codes를 즉시 발급·반환하므로
    // 별도 confirmation step이 없다. 호출자(controller/strategy dispatcher)가
    // signature 일관성을 위해 호출해도 안전한 no-op.
  }

  async createChallenge(): Promise<never> {
    // backup code는 server-side challenge 모델이 없다 — raw code 자체가 proof.
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async verifyResponse(
    userId: string,
    _challengeId: string,
    payload: BackupCodeResponsePayload,
  ): Promise<boolean> {
    await this.backupCodeService.consume(userId, payload.code);
    return true;
  }

  async list(userId: string): Promise<TwoFaStrategyInstance[]> {
    const unused = await this.backupCodeRepository.findUnusedByUserId(userId);
    if (unused.length === 0) return [];
    return [{ id: 'backup-code', createdAt: unused[0].createdAt, lastUsedAt: null }];
  }

  async revoke(userId: string, _id: string): Promise<void> {
    // backup-code는 user당 1 instance(dummy id='backup-code')라 id는 무시.
    await this.backupCodeService.invalidateAllUnusedForUser(userId);
  }
}
```

- [ ] **Step 2.4: 테스트 통과 확인**

```bash
cd services/api && npx jest src/twofa/strategies/backup-code.strategy.spec.ts
```

Expected: PASS.

- [ ] **Step 2.5: 커밋**

```bash
git add services/api/src/twofa/strategies/backup-code.strategy.ts services/api/src/twofa/strategies/backup-code.strategy.spec.ts
git commit -m "feat(api): BackupCodeTwoFaStrategy setup/revoke 본체 구현

- startSetup: regenerateForUser 위임 (raw codes 발급·반환)
- completeSetup: no-op (signature 일관성)
- revoke: invalidateAllUnusedForUser 위임 (모든 미사용 코드 폐기)
- createChallenge만 throw 유지 (backup code는 challenge 모델 없음)"
```

---

## Task 3: PushTwoFaStrategy — DeviceService 주입 + setup/list/revoke 구현

**Files:**
- Modify: `services/api/src/twofa/strategies/push.strategy.ts`
- Modify: `services/api/src/twofa/strategies/push.strategy.spec.ts`

- [ ] **Step 3.1: spec 갱신**

`services/api/src/twofa/strategies/push.strategy.spec.ts`의 `startSetup`/`list`/`revoke` 케이스를 갱신:

```ts
import { DeviceService } from '../../device/device.service';
// ...
const mockDeviceService = {
  list: jest.fn(),
  remove: jest.fn(),
};

beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      PushTwoFaStrategy,
      { provide: DatabaseService, useValue: mockDatabaseService },
      { provide: TransactionContext, useValue: mockTransactionContext },
      { provide: TwoFaRepository, useValue: mockTwoFaRepository },
      { provide: DeviceService, useValue: mockDeviceService },
    ],
  }).compile();
  // ...
});

describe('startSetup', () => {
  it('등록된 device가 있으면 status=ENROLLED + count', async () => {
    mockDeviceService.list.mockResolvedValue([
      { id: 'd1', userAgent: 'ua1', createdAt: new Date() },
      { id: 'd2', userAgent: 'ua2', createdAt: new Date() },
    ]);
    const result = await strategy.startSetup('user-1');
    expect(result).toEqual({ status: 'ENROLLED', deviceCount: 2 });
  });

  it('등록된 device가 없으면 status=PENDING', async () => {
    mockDeviceService.list.mockResolvedValue([]);
    const result = await strategy.startSetup('user-1');
    expect(result).toEqual({ status: 'PENDING', deviceCount: 0 });
  });
});

describe('completeSetup', () => {
  it('TWOFA_SETUP_NOT_SUPPORTED — device 등록은 device.controller 책임', async () => {
    await expect(strategy.completeSetup('user-1', {})).rejects.toMatchObject({
      code: 'TWOFA_SETUP_NOT_SUPPORTED',
    });
  });
});

describe('list', () => {
  it('DeviceService.list 결과를 TwoFaStrategyInstance로 매핑 (lastUsedAt=null)', async () => {
    const d1 = { id: 'd1', userAgent: 'ua1', createdAt: new Date('2026-01-01') };
    const d2 = { id: 'd2', userAgent: 'ua2', createdAt: new Date('2026-02-01') };
    mockDeviceService.list.mockResolvedValue([d1, d2]);

    const result = await strategy.list('user-1');

    expect(result).toEqual([
      { id: 'd1', createdAt: d1.createdAt, lastUsedAt: null },
      { id: 'd2', createdAt: d2.createdAt, lastUsedAt: null },
    ]);
  });
});

describe('revoke', () => {
  it('DeviceService.remove에 위임', async () => {
    mockDeviceService.remove.mockResolvedValue(undefined);
    await strategy.revoke('user-1', 'device-1');
    expect(mockDeviceService.remove).toHaveBeenCalledWith('device-1', 'user-1');
  });

  it('DeviceService.remove가 던진 ApiException(DEVICE_NOT_FOUND)을 그대로 propagate', async () => {
    const err = Object.assign(new Error('not found'), { code: 'DEVICE_NOT_FOUND' });
    mockDeviceService.remove.mockRejectedValue(err);
    await expect(strategy.revoke('user-1', 'device-x')).rejects.toBe(err);
  });
});
```

기존 `verifyResponse`/`createChallenge` 케이스는 변경 없음.

- [ ] **Step 3.2: 테스트 실패 확인**

```bash
cd services/api && npx jest src/twofa/strategies/push.strategy.spec.ts
```

Expected: FAIL — startSetup이 여전히 throw.

- [ ] **Step 3.3: PushTwoFaStrategy 본체 갱신**

`services/api/src/twofa/strategies/push.strategy.ts` 교체 (Phase 0 Task 5 결과 위에 갱신):

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { randomInt } from 'node:crypto';
import { DeviceService } from '../../device/device.service';
import { TwoFaRepository } from '../twofa.repository';
import {
  TwoFaStrategy,
  TwoFaStrategyInstance,
  TwoFaStrategyType,
} from './twofa-strategy.interface';

interface PushSetupResult {
  status: 'ENROLLED' | 'PENDING';
  deviceCount: number;
}

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
export class PushTwoFaStrategy
  extends ServiceCore
  implements TwoFaStrategy<PushSetupResult, PushChallengePayload, PushResponsePayload>
{
  readonly type: TwoFaStrategyType = 'PUSH';

  private readonly CHALLENGE_EXPIRY_MS = 60_000;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly twoFaRepository: TwoFaRepository,
    private readonly deviceService: DeviceService,
  ) {
    super(database, txContext);
  }

  async startSetup(userId: string): Promise<PushSetupResult> {
    const devices = await this.deviceService.list(userId);
    return {
      status: devices.length > 0 ? 'ENROLLED' : 'PENDING',
      deviceCount: devices.length,
    };
  }

  async completeSetup(): Promise<void> {
    // push 등록 ceremony는 src/device/device.controller가 담당한다.
    // (POST /devices가 pushToken을 받아 upsert. 그 자체가 enrollment 이다.)
    // strategy 인터페이스를 통한 completeSetup은 의미 부여가 어려워 차단.
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async createChallenge(userId: string): Promise<PushChallengePayload> {
    const optionNums = this.generateOptions();
    const options = optionNums.join(',');
    const correctNum = optionNums[randomInt(3)].toString();
    const expiresAt = new Date(Date.now() + this.CHALLENGE_EXPIRY_MS);
    return this.twoFaRepository.insert({ userId, options, correctNum, expiresAt });
  }

  async verifyResponse(
    userId: string,
    challengeId: string,
    payload: PushResponsePayload,
  ): Promise<boolean> {
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

  async list(userId: string): Promise<TwoFaStrategyInstance[]> {
    const devices = await this.deviceService.list(userId);
    return devices.map((d) => ({ id: d.id, createdAt: d.createdAt, lastUsedAt: null }));
  }

  async revoke(userId: string, id: string): Promise<void> {
    await this.deviceService.remove(id, userId);
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

- [ ] **Step 3.4: 테스트 통과 확인**

```bash
cd services/api && npx jest src/twofa/strategies/push.strategy.spec.ts
```

Expected: PASS.

- [ ] **Step 3.5: 커밋**

```bash
git add services/api/src/twofa/strategies/push.strategy.ts services/api/src/twofa/strategies/push.strategy.spec.ts
git commit -m "feat(api): PushTwoFaStrategy DeviceService 연동 + list/revoke 구현

- startSetup: device 목록 조회 → ENROLLED/PENDING + deviceCount
- list: DeviceService.list 결과를 TwoFaStrategyInstance로 매핑 (lastUsedAt=null)
- revoke: DeviceService.remove(id, userId)에 위임
- completeSetup만 throw 유지 (device 등록 ceremony는 device.controller 책임)"
```

---

## Task 4: TwoFaModule — DeviceModule import

PushTwoFaStrategy가 DeviceService를 주입받으므로 DeviceModule을 import해야 한다.

**Files:**
- Modify: `services/api/src/twofa/twofa.module.ts`

- [ ] **Step 4.1: TwoFaModule 갱신**

`services/api/src/twofa/twofa.module.ts`의 `imports` 배열에 `DeviceModule` 추가 (Phase 2 결과 위에 갱신):

```ts
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    forwardRef(() => AuthModule),
    DeviceModule,
  ],
  // ... providers/controllers/exports 그대로
})
export class TwoFaModule {}
```

> 참고: `DeviceModule`은 이미 `DeviceService`를 export하고 있어 `forwardRef`/추가 변경 불필요. AppModule에서도 그대로 등록되어 있음.

- [ ] **Step 4.2: type check + 전체 단위 테스트**

```bash
cd services/api
npx tsc --noEmit
npm test
```

Expected: 전체 PASS. 만약 `DeviceService 의존성 미해결` 오류가 나오면 import 경로 확인.

- [ ] **Step 4.3: 부팅 확인**

```bash
cd services/api && npm run start:dev
# 다른 터미널:
curl -i http://localhost:3000/api/health
```

Expected: 200 OK.

- [ ] **Step 4.4: 커밋**

```bash
git add services/api/src/twofa/twofa.module.ts
git commit -m "feat(api): TwoFaModule에 DeviceModule import 추가

PushTwoFaStrategy가 DeviceService에 의존하게 됐기 때문."
```

---

## Task 5: spec §4.1 / §9 갱신

본 plan으로 spec의 "push·backup-code는 setup ceremony 개념이 없으므로 throw" 결정이 부분적으로 뒤집힌다. spec 본문을 현재 사실에 맞게 갱신.

**Files:**
- Modify: `docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md`

- [ ] **Step 5.1: §4.1 갱신**

`docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md`의 §4.1 (추상화) 마지막 줄("push·backup-code는 setup ceremony 개념이 없으므로 startSetup/completeSetup 호출 시 TWOFA_SETUP_NOT_SUPPORTED throw")을 다음으로 교체:

```md
- 각 strategy의 setup/list/revoke 의미는 도메인 특성을 반영해 매핑한다 (2026-05-20 Phase 3에서 push·backup-code도 인터페이스 완전 구현):
  - **TOTP**: startSetup이 secret + otpauth URI 발급, completeSetup이 1회 검증 후 영구 저장 (Phase 1)
  - **Passkey**: 등록 ceremony가 2단계 + opaque payload라 PasskeyController가 PasskeyService를 직접 호출하고, strategy interface 메서드는 throw로 차단(verify/list/revoke만 의미). 별도 endpoint(`/auth/2fa/passkey/setup/start|complete`)를 노출 (Phase 2)
  - **Push**: startSetup은 device 등록 상태 조회(ENROLLED if devices≥1, PENDING otherwise), list/revoke는 DeviceService로 매핑. completeSetup은 throw 유지 — device 등록 ceremony 자체는 `src/device/device.controller`가 담당 (Phase 3)
  - **Backup Code**: startSetup이 `regenerateForUser`(unused 폐기 + 신규 8개 raw codes 발급), completeSetup은 no-op, revoke는 모든 unused 폐기. createChallenge만 throw — backup code는 server-side challenge 모델이 없다 (Phase 3)
```

- [ ] **Step 5.2: §9에 Phase 3 추가**

§9 체크리스트 끝에 추가:

```md
- [x] Phase 3 (2026-05-20): push·backup-code strategy 인터페이스 완전 구현 — DeviceService 연동, BackupCodeService.invalidateAllUnusedForUser 추가. setup ceremony 의미 매핑(§4.1 갱신)
```

- [ ] **Step 5.3: 커밋**

```bash
git add docs/superpowers/specs/2026-05-19-auth-2fa-fallback-strategies-design.md
git commit -m "docs(superpowers): 2FA fallback spec §4.1/§9 갱신 — Phase 3 박제

push·backup-code strategy의 setup/list/revoke 의미를 도메인별로 명시.
spec §4.1의 'throw 결정'을 strategy별 매핑 표로 교체."
```

---

## Task 6: 전체 회귀 검증

- [ ] **Step 6.1: api 전체 검증**

```bash
cd services/api
npx tsc --noEmit
npm run lint
npm test
npm run test:e2e
```

Expected: 전부 PASS. 특히 다음 영향 spec 확인:
- `twofa.service.spec.ts` (removeStrategy 가드가 strategy.list 결과에 의존 — push.list가 device 목록을 반환하게 됐으므로 가드 카운트는 변하지 않음: spec §3은 "push 외 카운트"라 push는 가드 대상이 아님)
- `auth.controller.spec.ts` / `auth.service.spec.ts` (backup-code regenerate flow — 내부 구현만 변경, public API 무변경)

- [ ] **Step 6.2: 영향 분석 — last-strategy 가드 카운트 재확인**

본 plan은 push.list가 의미를 갖게 만들었지만, `TwoFaService.countRemainingNonPushStrategiesExcluding`(Phase 1 Task 10에서 정의)의 type 배열에는 PUSH가 포함되어 있지 않다. 의도된 정책(§3 "push 외 1개 이상 강제")에 부합. 코드 변경 불필요.

확인 방법:

```bash
git grep "countRemainingNonPushStrategiesExcluding" services/api/src
```

해당 메서드 본문이 `const types: TwoFaStrategyType[] = ['TOTP', 'BACKUP_CODE', 'PASSKEY'];` 형태로 PUSH 미포함이어야 한다.

- [ ] **Step 6.3: leftover 검색**

```bash
git grep "TWOFA_SETUP_NOT_SUPPORTED" services/api/src/twofa/strategies/
```

Expected: backup-code.strategy.ts의 createChallenge, push.strategy.ts의 completeSetup, passkey.strategy.ts의 startSetup/completeSetup/createChallenge 만 잔존(의도된 throw). 추가 잔존이 보이면 review.

- [ ] **Step 6.4: wrap-up 커밋(필요 시)**

추가 보정이 있었다면:

```bash
git add -A
git commit -m "chore(api): Phase 3 회귀 검증 후 정리"
```

없으면 커밋 생략.

---

## Self-Review

- **Spec coverage:**
  - backup-code의 startSetup/completeSetup/revoke 본체 구현 → Task 1/2
  - push의 startSetup/list/revoke 본체 구현 → Task 3
  - DeviceService 의존 등록 → Task 4
  - spec §4.1 갱신(throw 결정 부분 교체) + §9 박제 → Task 5
- **Placeholder scan:** "필요 시 ... 검토" 표현이 Step 1.3에 1회 있으나 그 옆에 구체 본문 코드가 명시돼 placeholder 아님. 다른 모든 step에 코드/명령 명시.
- **Type consistency:**
  - `PushSetupResult { status: 'ENROLLED' | 'PENDING'; deviceCount: number }` — Task 3에서 정의, 같은 Task의 spec에서 동일 키로 검증
  - `BackupCodeSetupResult { codes: string[] }` — Task 2에서 정의, spec과 일관
  - `TwoFaStrategyInstance { id, createdAt, lastUsedAt }` — Phase 0 정의 그대로, push.list/backup-code.list 둘 다 동일 shape
  - `DeviceService.list/remove` signature — `DeviceService.list(userId): Promise<DeviceResponseDto[]>`, `DeviceService.remove(id, userId): Promise<void>` (실제 코드 확인 완료)
- **Scope:** strategy 메서드 본체와 module 의존만 변경. 신규 endpoint/DTO/스키마 없음. 외부 contract 무변경 (회귀 0).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-auth-2fa-fallback-strategies-phase-3.md`. 두 가지 실행 옵션:

1. **Subagent-Driven (recommended)** — task별 fresh subagent 디스패치, 중간 리뷰 가능. `superpowers:subagent-driven-development` 사용
2. **Inline Execution** — 본 세션에서 일괄 실행, 체크포인트마다 리뷰. `superpowers:executing-plans` 사용

> Phase 3는 Phase 0/1/2의 strategy 추상화·DeviceModule·last-strategy 가드를 모두 전제로 한다. 선행 phase가 미실행이면 본 plan 실행 시점에 컴파일·런타임 의존성이 깨진다.

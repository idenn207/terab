# API Core / Logging 일관성 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API 서비스의 `ServiceCore`/`RepositoryCore` 패턴 미적용 케이스 일괄 마이그레이션, `@LogReplay` 운영 재현 자료 적용, BullMQ 경로 pino 로깅 추가.

**Architecture:** 5개 Phase로 분할. Phase 1(Repository) → Phase 2(AuthService.register 분해) → Phase 3(Service) → Phase 4(`@LogReplay`) → Phase 5(BullMQ + 결정 노트). 각 Phase는 독립 머지 가능. TDD: 실패 테스트 → 구현 → 통과 → 커밋.

**Tech Stack:** NestJS 11, Drizzle ORM, BullMQ, nestjs-pino, Jest.

**Spec Reference:** [docs/superpowers/specs/2026-05-14-api-core-and-logging-consistency-design.md](../specs/2026-05-14-api-core-and-logging-consistency-design.md)

---

## File Structure

### Phase 1 — Repository
- Modify: `services/api/src/device/device.repository.ts`
- Modify: `services/api/src/trusted-device/trusted-device.repository.ts`
- Modify: `services/api/src/twofa/twofa.repository.ts`
- Modify: `services/api/src/invitation/invitation.repository.ts` (+ `consume` 신설)
- Modify: `services/api/src/auth/auth.repository.ts` (단순 메서드만 `this.conn` 전환, `registerUser` 유지는 Phase 2에서 제거)
- Modify: 각 repository.spec.ts (5개)

### Phase 2 — AuthService.register 분해
- Modify: `services/api/src/auth/auth.repository.ts` (`registerUser` 삭제)
- Modify: `services/api/src/invitation/invitation.service.ts` (`markUsed` → `consume` 시그니처 교체)
- Modify: `services/api/src/auth/auth.service.ts` (`register()` 재작성)
- Modify: `services/api/src/auth/auth.module.ts` (`InvitationModule` import)
- Modify: `services/api/src/common/exceptions/error-code.enum.ts` (`ROLE_NOT_FOUND` 추가)
- Modify: 관련 spec 4개 + e2e 1개

### Phase 3 — Service Core/AutoTrace
- Modify: `services/api/src/auth/auth.service.ts` (extends ServiceCore)
- Modify: `services/api/src/invitation/invitation.service.ts` (extends ServiceCore)
- Modify: `services/api/src/twofa/twofa.service.ts`
- Modify: `services/api/src/device/device.service.ts`
- Modify: `services/api/src/trusted-device/trusted-device.service.ts`
- Modify: `services/api/src/security/token.service.ts` (`@AutoTrace()`)
- Modify: 각 service.spec.ts (6개)

### Phase 4 — @LogReplay
- Modify: `services/api/src/minio/minio.service.ts` (5개 메서드 추가)
- Modify: `services/api/src/auth/auth.service.ts` (`register`/`login`/`refresh`/`logout`)
- Modify: `services/api/src/twofa/twofa.service.ts`
- Modify: `services/api/src/device/device.service.ts`
- Modify: `services/api/src/trusted-device/trusted-device.service.ts`
- Modify: `services/api/src/invitation/invitation.service.ts`
- Modify: `services/api/src/twofa/push-challenge.publisher.ts`

### Phase 5 — BullMQ / 결정 노트
- Modify: `services/api/src/twofa/push-challenge.publisher.ts`
- Modify: `services/api/src/file/upload-session.cleanup.worker.ts`
- Modify: `services/api/src/file/upload-session.service.ts` (`cleanupExpired` 반환 시그니처)
- Modify: `services/api/src/common/filters/api-exception.filter.ts` (주석 추가만)
- Modify: 관련 spec

---

## Phase 1 — Repository → RepositoryCore

### Task 1.1: DeviceRepository → RepositoryCore

**Files:**
- Modify: `services/api/src/device/device.repository.ts`
- Test: `services/api/src/device/device.repository.spec.ts`

- [ ] **Step 1: 기존 spec 실행하여 baseline 확인**

```bash
cd services/api && npx jest device/device.repository.spec.ts
```
Expected: 모든 테스트 PASS

- [ ] **Step 2: spec에 TransactionContext provider 추가**

`services/api/src/device/device.repository.spec.ts`의 `Test.createTestingModule` providers에 추가:
```ts
import { TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';

providers: [
  DeviceRepository,
  { provide: DatabaseService, useValue: mockDatabaseService },
  { provide: TransactionContext, useValue: mockTransactionContext },
],
```

- [ ] **Step 3: spec 재실행하여 PASS 유지 확인**

Run: `cd services/api && npx jest device/device.repository.spec.ts`
Expected: 모든 테스트 PASS (DI는 변경 없음, mock만 추가됨)

- [ ] **Step 4: DeviceRepository를 RepositoryCore로 마이그레이션**

`services/api/src/device/device.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, RepositoryCore, TransactionContext } from '@terab/db';
// ... 기존 imports

@Injectable()
export class DeviceRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  // 모든 메서드 본문에서 this.database.db → this.conn 치환
}
```

- [ ] **Step 5: spec 재실행하여 PASS 유지 확인**

Run: `cd services/api && npx jest device/device.repository.spec.ts`
Expected: 모든 테스트 PASS (`this.conn`은 `txContext.current=undefined`일 때 `this.database.db`로 폴백, 동일 mock 체인)

- [ ] **Step 6: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: 커밋**

```bash
git add services/api/src/device/device.repository.ts services/api/src/device/device.repository.spec.ts
git commit -m "refactor(api): DeviceRepository를 RepositoryCore로 마이그레이션"
```

---

### Task 1.2: TrustedDeviceRepository → RepositoryCore

**Files:**
- Modify: `services/api/src/trusted-device/trusted-device.repository.ts`
- Test: `services/api/src/trusted-device/trusted-device.repository.spec.ts`

- [ ] **Step 1: spec에 TransactionContext provider 추가**

Task 1.1 Step 2와 동일한 형태로 providers에 `TransactionContext` 추가.

- [ ] **Step 2: spec 재실행 PASS 확인**

Run: `cd services/api && npx jest trusted-device/trusted-device.repository.spec.ts`

- [ ] **Step 3: RepositoryCore 마이그레이션**

`services/api/src/trusted-device/trusted-device.repository.ts`:
```ts
@Injectable()
export class TrustedDeviceRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }
  // this.database.db → this.conn 치환
}
```

- [ ] **Step 4: spec 재실행 PASS 확인**

Run: `cd services/api && npx jest trusted-device/trusted-device.repository.spec.ts`

- [ ] **Step 5: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/trusted-device/trusted-device.repository.ts services/api/src/trusted-device/trusted-device.repository.spec.ts
git commit -m "refactor(api): TrustedDeviceRepository를 RepositoryCore로 마이그레이션"
```

---

### Task 1.3: TwoFaRepository → RepositoryCore

**Files:**
- Modify: `services/api/src/twofa/twofa.repository.ts`
- Test: `services/api/src/twofa/twofa.repository.spec.ts`

- [ ] **Step 1: spec에 TransactionContext provider 추가**

- [ ] **Step 2: spec 재실행 PASS 확인**

Run: `cd services/api && npx jest twofa/twofa.repository.spec.ts`

- [ ] **Step 3: RepositoryCore 마이그레이션**

```ts
@Injectable()
export class TwoFaRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }
  // this.database.db → this.conn 치환
}
```

- [ ] **Step 4: spec 재실행 PASS 확인**

- [ ] **Step 5: 컴파일 확인**

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/twofa/twofa.repository.ts services/api/src/twofa/twofa.repository.spec.ts
git commit -m "refactor(api): TwoFaRepository를 RepositoryCore로 마이그레이션"
```

---

### Task 1.4: InvitationRepository → RepositoryCore + `consume` 신설

**Files:**
- Modify: `services/api/src/invitation/invitation.repository.ts`
- Test: `services/api/src/invitation/invitation.repository.spec.ts`

- [ ] **Step 1: spec에 TransactionContext provider 추가**

- [ ] **Step 2: 실패 테스트 작성 — `consume` 성공/실패 케이스**

`services/api/src/invitation/invitation.repository.spec.ts`에 추가:
```ts
import { mockDbReturning, mockDbWhere } from '@terab/test'; // 필요한 mock 추가

describe('consume', () => {
  it('아직 사용되지 않은 토큰이면 row를 반환한다', async () => {
    mockDbReturning.mockResolvedValue([{ id: 'invitation-id-1' }]);

    const result = await repo.consume('valid-token', 'user-id-1');

    expect(result).toEqual({ id: 'invitation-id-1' });
  });

  it('이미 사용된 토큰이면 null을 반환한다', async () => {
    mockDbReturning.mockResolvedValue([]);

    const result = await repo.consume('used-token', 'user-id-1');

    expect(result).toBeNull();
  });
});
```

mock 체인 확인: update().set().where().returning() 흐름이 필요. `setupMockDbUpdateChain` 유틸이 없다면 spec 안에 inline로:
```ts
beforeEach(() => {
  jest.clearAllMocks();
  setupMockDbSelectChain();
  mockDbUpdate.mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: mockDbReturning,
      }),
    }),
  });
});
```
`mockDbReturning`은 `@terab/test`에 없다면 `database.service.mock.ts`에 추가 필요.

- [ ] **Step 3: 실패 확인**

Run: `cd services/api && npx jest invitation/invitation.repository.spec.ts -t consume`
Expected: FAIL (`consume is not a function`)

- [ ] **Step 4: RepositoryCore 마이그레이션 + consume 구현**

`services/api/src/invitation/invitation.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, invitations, Invitations$Insert, RepositoryCore, TransactionContext } from '@terab/db';
import { and, eq, isNull } from 'drizzle-orm';

@Injectable()
export class InvitationRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async insert(data: Pick<Invitations$Insert, 'createdBy' | 'expiresAt'>) {
    const [row] = await this.conn.insert(invitations).values(data).returning();
    return row;
  }

  async findByToken(token: string) {
    const [row = null] = await this.conn.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    return row;
  }

  async deactivate(token: string): Promise<boolean> {
    const result = await this.conn
      .update(invitations)
      .set({ deactivatedAt: new Date() })
      .where(eq(invitations.token, token))
      .returning({ id: invitations.id });
    return result.length > 0;
  }

  async consume(token: string, usedBy: NonNullable<Invitations$Insert['usedBy']>): Promise<{ id: string } | null> {
    const [row = null] = await this.conn
      .update(invitations)
      .set({ usedAt: new Date(), usedBy })
      .where(and(eq(invitations.token, token), isNull(invitations.usedAt)))
      .returning({ id: invitations.id });
    return row;
  }
}
```

기존 `markUsed` 메서드는 삭제 (Phase 2에서 service 레이어도 함께 정리).

- [ ] **Step 5: 테스트 PASS 확인**

Run: `cd services/api && npx jest invitation/invitation.repository.spec.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: `markUsed` 호출처에서 컴파일 에러 발생 가능 → Phase 2에서 해결되므로 Task 1.4 단독으로는 service 레이어의 markUsed 호출도 제거해야 함. **`InvitationService.markUsed`도 함께 제거**하고 `auth.service.ts`의 `validateOrThrow` 호출은 그대로 유지.

`services/api/src/invitation/invitation.service.ts`에서 `markUsed` 메서드 제거. 호출처 없음을 grep으로 확인 후 진행:
```bash
grep -rn "invitationService\.markUsed\|invitationRepository\.markUsed" services/api/src
```
결과가 spec 파일/본인 파일 외 없으면 안전하게 제거 가능.

- [ ] **Step 7: 컴파일 재확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: 커밋**

```bash
git add services/api/src/invitation/
git commit -m "refactor(api): InvitationRepository RepositoryCore 마이그레이션 + consume 메서드 신설"
```

---

### Task 1.5: AuthRepository 단순 메서드 → `this.conn`

**Files:**
- Modify: `services/api/src/auth/auth.repository.ts`
- Test: `services/api/src/auth/auth.repository.spec.ts`

> **주의:** 이 Task에서는 `registerUser`를 **유지**한다 (Phase 2에서 제거). 단순 메서드들만 `this.conn`으로 전환하고 `RepositoryCore`를 extends한다.

- [ ] **Step 1: spec에 TransactionContext provider 추가**

- [ ] **Step 2: 기존 spec 실행 PASS 확인**

Run: `cd services/api && npx jest auth/auth.repository.spec.ts`

- [ ] **Step 3: AuthRepository → RepositoryCore**

`services/api/src/auth/auth.repository.ts`:
```ts
import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import {
  BackupCodes$Insert,
  DatabaseService,
  Permissions$Select,
  RefreshTokens$Insert,
  RepositoryCore,
  TransactionContext,
  // ... 기존 imports
} from '@terab/db';

@Injectable()
export class AuthRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  // findUserWithPermissionsByUsername / findUserWithPermissionsById / findActiveRefreshTokenByHash /
  // insertRefreshToken / revokeRefreshTokenById / findUnusedBackupCodes / markBackupCodeUsed /
  // findUserByUsername / findRoleByName / insertUser / insertUserRole / insertBackupCodes / aggregateUser
  // 모두 this.database.db → this.conn 으로 치환

  // registerUser 메서드는 그대로 유지 (Phase 2에서 제거)
}
```

`registerUser` 내부의 `this.database.db.transaction(...)`은 유지 (이번 task에서 건드리지 않음).

- [ ] **Step 4: spec 재실행 PASS 확인**

Run: `cd services/api && npx jest auth/auth.repository.spec.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/auth/auth.repository.ts services/api/src/auth/auth.repository.spec.ts
git commit -m "refactor(api): AuthRepository를 RepositoryCore로 마이그레이션 (registerUser는 Phase 2에서 분해)"
```

---

### Task 1.6: Phase 1 통합 확인

- [ ] **Step 1: 전체 단위 테스트 실행**

Run: `cd services/api && npm test`
Expected: 모든 테스트 PASS

- [ ] **Step 2: 전체 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: e2e 테스트 실행**

Run: `cd services/api && npm run test:e2e`
Expected: 모든 테스트 PASS

---

## Phase 2 — AuthService.register 분해

### Task 2.1: ErrorCode `ROLE_NOT_FOUND` 추가

**Files:**
- Modify: `services/api/src/common/exceptions/error-code.enum.ts`

- [ ] **Step 1: ROLE_NOT_FOUND 추가**

`services/api/src/common/exceptions/error-code.enum.ts`에 추가:
```ts
ROLE_NOT_FOUND: {
  message: '역할 정보를 찾을 수 없습니다. 관리자에게 문의하세요.',
  status: HttpStatus.INTERNAL_SERVER_ERROR,
},
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/common/exceptions/error-code.enum.ts
git commit -m "feat(api): ROLE_NOT_FOUND ErrorCode 추가"
```

---

### Task 2.2: InvitationService.consume 신설

**Files:**
- Modify: `services/api/src/invitation/invitation.service.ts`
- Test: `services/api/src/invitation/invitation.service.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/invitation/invitation.service.spec.ts`에 추가:
```ts
describe('consume', () => {
  it('repository가 row를 반환하면 정상 종료한다', async () => {
    mockInvitationRepository.consume.mockResolvedValue({ id: 'invitation-1' });

    await expect(service.consume('valid-token', 'user-1')).resolves.toBeUndefined();
    expect(mockInvitationRepository.consume).toHaveBeenCalledWith('valid-token', 'user-1');
  });

  it('repository가 null을 반환하면 INVITATION_ALREADY_USED 예외를 던진다', async () => {
    mockInvitationRepository.consume.mockResolvedValue(null);

    await expect(service.consume('used-token', 'user-1')).rejects.toThrow(ApiException);
    await expect(service.consume('used-token', 'user-1')).rejects.toMatchObject({
      errorCode: 'INVITATION_ALREADY_USED',
    });
  });
});
```

`mockInvitationRepository`에 `consume: jest.fn()`을 추가하고 기존 `markUsed`는 제거.

- [ ] **Step 2: 실패 확인**

Run: `cd services/api && npx jest invitation/invitation.service.spec.ts -t consume`
Expected: FAIL

- [ ] **Step 3: consume 구현**

`services/api/src/invitation/invitation.service.ts`:
```ts
async consume(token: string, usedBy: string): Promise<void> {
  const row = await this.invitationRepository.consume(token, usedBy);
  if (!row) throw new ApiException('INVITATION_ALREADY_USED');
}
```

기존 `markUsed` 메서드는 Task 1.4에서 이미 제거됨 (또는 본 task에서 제거).

- [ ] **Step 4: 테스트 PASS 확인**

Run: `cd services/api && npx jest invitation/invitation.service.spec.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/invitation/invitation.service.ts services/api/src/invitation/invitation.service.spec.ts
git commit -m "feat(api): InvitationService.consume — atomic invitation 소비 메서드 신설"
```

---

### Task 2.3: AuthModule이 InvitationModule import

**Files:**
- Modify: `services/api/src/auth/auth.module.ts`

- [ ] **Step 1: 현재 auth.module 확인**

Run: `cat services/api/src/auth/auth.module.ts`

- [ ] **Step 2: InvitationModule import 추가**

`services/api/src/auth/auth.module.ts`의 `imports` 배열에 `InvitationModule` 추가:
```ts
import { InvitationModule } from '../invitation/invitation.module';

@Module({
  imports: [
    // ... 기존
    InvitationModule,
  ],
  // ...
})
```

- [ ] **Step 3: 순환 의존 확인**

Run: `grep -n "AuthModule\|AuthService" services/api/src/invitation/`
Expected: InvitationModule이 AuthModule/AuthService를 의존하지 않음을 확인

- [ ] **Step 4: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/auth/auth.module.ts
git commit -m "chore(api): AuthModule에 InvitationModule import 추가"
```

---

### Task 2.4: AuthService.register 분해 — TDD

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Test: `services/api/src/auth/auth.service.spec.ts`

> **주의:** 이 task에서는 아직 `ServiceCore`를 적용하지 않는다. Phase 3에서 ServiceCore 적용 후 `runInTx()`로 마무리한다. **임시로 트랜잭션을 명시적으로 호출하지 않는 형태**로 작성하고, Phase 3에서 `runInTx`로 감싼다.

- [ ] **Step 1: 실패 테스트 작성 — ROLE_NOT_FOUND 케이스**

`services/api/src/auth/auth.service.spec.ts`의 `describe('register', ...)` 블록에 추가/수정:
```ts
describe('register', () => {
  it('USER role이 없으면 ROLE_NOT_FOUND 예외를 던진다', async () => {
    mockAuthRepository.findRoleByName.mockResolvedValue(null);

    await expect(service.register(validRegisterInput)).rejects.toThrow(ApiException);
    await expect(service.register(validRegisterInput)).rejects.toMatchObject({
      errorCode: 'ROLE_NOT_FOUND',
    });
  });

  it('invitation이 이미 사용되었으면 INVITATION_ALREADY_USED 예외를 던지고 user 생성을 호출하지 않는다', async () => {
    mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-1' });
    mockInvitationService.validateOrThrow.mockResolvedValue({});
    mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-1' });
    mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
    mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
    mockInvitationService.consume.mockRejectedValue(new ApiException('INVITATION_ALREADY_USED'));

    await expect(service.register(validRegisterInput)).rejects.toMatchObject({
      errorCode: 'INVITATION_ALREADY_USED',
    });
  });

  it('성공 시 insertUser → insertUserRole → insertBackupCodes → invitationService.consume 순서로 호출한다', async () => {
    mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-1' });
    mockInvitationService.validateOrThrow.mockResolvedValue({});
    mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-1' });
    mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
    mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
    mockInvitationService.consume.mockResolvedValue(undefined);
    mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
    // issueTokenPair용 mock 설정...

    await service.register(validRegisterInput);

    const order = [
      mockAuthRepository.insertUser.mock.invocationCallOrder[0],
      mockAuthRepository.insertUserRole.mock.invocationCallOrder[0],
      mockAuthRepository.insertBackupCodes.mock.invocationCallOrder[0],
      mockInvitationService.consume.mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
```

mock 객체에 `mockInvitationService.consume: jest.fn()` 추가, 기존 `mockInvitationService.markUsed` 제거.

- [ ] **Step 2: 실패 확인**

Run: `cd services/api && npx jest auth/auth.service.spec.ts -t register`
Expected: FAIL (`ROLE_NOT_FOUND` 등 새 분기 미구현)

- [ ] **Step 3: AuthService.register 재작성**

`services/api/src/auth/auth.service.ts`의 `register` 메서드를 다음과 같이 교체:
```ts
async register(
  data: ServerInferRequest<typeof contract.auth.register>['body'],
): Promise<
  ServerInferResponseBody<typeof contract.auth.register> & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
> {
  await this.invitationService.validateOrThrow(data.token);

  const userRole = await this.authRepository.findRoleByName('USER');
  if (!userRole) throw new ApiException('ROLE_NOT_FOUND');

  const pepperedPassword = this.tokenService.pepperPassword(data.password);
  const hashedPassword = await bcrypt.hash(pepperedPassword, this.BCRYPT_ROUNDS);

  const rawCodes = this.generateBackupCodes();
  const codeHashes = await Promise.all(rawCodes.map((code) => bcrypt.hash(code, this.BCRYPT_ROUNDS)));

  // Phase 3에서 this.runInTx로 감싼다.
  let newUser: { id: string };
  try {
    newUser = await this.authRepository.insertUser({
      username: data.username,
      nickname: data.nickname,
      password: hashedPassword,
    });
    await this.authRepository.insertUserRole(newUser.id, userRole.id);
    await this.authRepository.insertBackupCodes(newUser.id, codeHashes);
    await this.invitationService.consume(data.token, newUser.id);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new ApiException('USERNAME_TAKEN');
    throw err;
  }

  const userWithPermissions = await this.authRepository.findUserWithPermissionsById(newUser.id);
  if (!userWithPermissions) throw new ApiException('REGISTRATION_FAILED');

  const tokens = await this.issueTokenPair(userWithPermissions);

  return {
    accessToken: tokens.accessToken,
    user: { id: newUser.id, username: data.username, nickname: data.nickname },
    backupCodes: rawCodes,
    rawRefreshToken: tokens.rawRefreshToken,
    refreshTokenExpMs: tokens.refreshTokenExpMs,
  };
}
```

> **주의:** `'가입 직후 사용자 조회 실패'` 같은 throw new Error는 ApiException으로 교체. `REGISTRATION_FAILED` ErrorCode가 없으면 추가 (`HttpStatus.INTERNAL_SERVER_ERROR`).

- [ ] **Step 4: REGISTRATION_FAILED ErrorCode 추가 (없는 경우)**

Run: `grep -n "REGISTRATION_FAILED" services/api/src/common/exceptions/error-code.enum.ts`
없으면 추가:
```ts
REGISTRATION_FAILED: {
  message: '회원가입 중 오류가 발생했습니다.',
  status: HttpStatus.INTERNAL_SERVER_ERROR,
},
```

- [ ] **Step 5: 테스트 PASS 확인**

Run: `cd services/api && npx jest auth/auth.service.spec.ts -t register`
Expected: 모든 register 테스트 PASS

- [ ] **Step 6: 전체 auth.service.spec PASS 확인**

Run: `cd services/api && npx jest auth/auth.service.spec.ts`

- [ ] **Step 7: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 8: 커밋**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts services/api/src/common/exceptions/error-code.enum.ts
git commit -m "refactor(api): AuthService.register 분해 — Repository tx → Service 레이어 책임 이관"
```

---

### Task 2.5: AuthRepository.registerUser 메서드 제거

**Files:**
- Modify: `services/api/src/auth/auth.repository.ts`
- Test: `services/api/src/auth/auth.repository.spec.ts`

- [ ] **Step 1: 호출처 없음 확인**

Run: `grep -rn "authRepository\.registerUser\|\.registerUser(" services/api/src`
Expected: spec 외 호출처 없음

- [ ] **Step 2: registerUser 메서드 제거**

`services/api/src/auth/auth.repository.ts`에서 `registerUser` 메서드 + 관련 import (`ConflictException`, `InternalServerErrorException`, `invitations`) 정리.

> `InternalServerErrorException`은 `insertUser`에서 `throw new InternalServerErrorException('사용자 생성 실패')`로 사용되므로 ApiException으로 교체:
> ```ts
> async insertUser(data: Pick<Users$Insert, 'username' | 'nickname' | 'password'>) {
>   const [row] = await this.conn.insert(users).values(data).returning({ id: users.id });
>   if (!row) throw new ApiException('REGISTRATION_FAILED');
>   return row;
> }
> ```
> import 변경: `from '@terab/common'`에서 `ApiException` 추가.

- [ ] **Step 3: registerUser describe 블록 제거 (spec)**

`services/api/src/auth/auth.repository.spec.ts`에서 `describe('registerUser', ...)` 전체 블록 삭제. `insertUser`의 실패 케이스(`REGISTRATION_FAILED` throw) 테스트 추가:
```ts
describe('insertUser', () => {
  it('insert가 row를 반환하지 않으면 REGISTRATION_FAILED 예외를 던진다', async () => {
    const mockReturning = jest.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({
      values: jest.fn().mockReturnValue({ returning: mockReturning }),
    });

    await expect(repo.insertUser({ username: 'x', nickname: 'y', password: 'z' }))
      .rejects.toMatchObject({ errorCode: 'REGISTRATION_FAILED' });
  });
});
```

- [ ] **Step 4: 테스트 PASS 확인**

Run: `cd services/api && npx jest auth/auth.repository.spec.ts`

- [ ] **Step 5: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/auth/auth.repository.ts services/api/src/auth/auth.repository.spec.ts
git commit -m "refactor(api): AuthRepository.registerUser 제거 — 책임이 Service로 이관됨"
```

---

### Task 2.6: e2e 검증 — invitation 롤백

**Files:**
- Modify: `services/api/test/auth.e2e-spec.ts` (또는 기존 register e2e 파일)

- [ ] **Step 1: 기존 register e2e 확인**

Run: `find services/api/test -name "*.e2e-spec.ts" | xargs grep -l "register"`

- [ ] **Step 2: e2e 케이스 추가 — invitation 이미 사용 시 user 미생성**

기존 e2e 파일에 추가:
```ts
describe('register — invitation 롤백', () => {
  it('이미 사용된 invitation 토큰으로 register 시도 시 실패하고 users 테이블에 row가 생성되지 않는다', async () => {
    // 1. invitation 생성 + 사용
    const invitation = await createInvitation();
    await consumeInvitation(invitation.token);

    // 2. 동일 토큰으로 register 시도
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        token: invitation.token,
        username: 'rollback-test',
        nickname: 'rollback',
        password: 'Password1234!',
      });

    expect(res.status).toBe(HttpStatus.CONFLICT);
    expect(res.body.code).toBe('INVITATION_ALREADY_USED');

    // 3. users 테이블에 row 없음 확인
    const found = await db.select().from(users).where(eq(users.username, 'rollback-test'));
    expect(found).toEqual([]);
  });
});
```

> 헬퍼 함수가 없다면 e2e 파일의 setup 패턴을 따라 inline으로 작성.

- [ ] **Step 3: e2e 실행**

Run: `cd services/api && npm run test:e2e -- --testPathPattern auth`
Expected: 신규 케이스 PASS

> **현재 시점에서는 ServiceCore 미적용이므로 트랜잭션이 없어 user가 생성될 수 있음 — 이 경우 Phase 3에서 통과하도록 보장됨.** 본 task에서는 e2e가 실패해도 Phase 2.7에서 fail 마킹 후 진행, Phase 3.1 이후 PASS 검증.

- [ ] **Step 4: 커밋**

```bash
git add services/api/test/
git commit -m "test(api): register invitation 롤백 e2e 케이스 추가"
```

---

### Task 2.7: Phase 2 통합 확인

- [ ] **Step 1: 전체 단위 테스트 PASS**

Run: `cd services/api && npm test`

- [ ] **Step 2: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 3: e2e 실행 (rollback 케이스는 Phase 3 후 PASS 예정 — 현 시점에서 fail 가능)**

Run: `cd services/api && npm run test:e2e`

---

## Phase 3 — Service ServiceCore / AutoTrace 적용

### Task 3.1: AuthService → ServiceCore + runInTx

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Test: `services/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: spec module setup에 mockTransactionContext provider 추가**

`services/api/src/auth/auth.service.spec.ts`:
```ts
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbTransactionChain } from '@terab/test';

beforeEach(async () => {
  // ...
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: DatabaseService, useValue: mockDatabaseService },
      { provide: TransactionContext, useValue: mockTransactionContext },
      // ... 기존 mock providers
    ],
  }).compile();

  service = module.get(AuthService);
  jest.clearAllMocks();
  setupMockDbTransactionChain();
});
```

- [ ] **Step 2: 실패 테스트 작성 — runInTx 호출 검증**

```ts
it('register는 user 생성 + invitation consume을 트랜잭션 안에서 수행한다', async () => {
  mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-1' });
  mockInvitationService.validateOrThrow.mockResolvedValue({});
  mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-1' });
  mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
  mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
  mockInvitationService.consume.mockResolvedValue(undefined);
  mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);

  await service.register(validRegisterInput);

  expect(mockDbTransaction).toHaveBeenCalled();
});
```

- [ ] **Step 3: 실패 확인**

Run: `cd services/api && npx jest auth/auth.service.spec.ts -t '트랜잭션'`
Expected: FAIL (`mockDbTransaction not called`)

- [ ] **Step 4: AuthService → ServiceCore + runInTx**

`services/api/src/auth/auth.service.ts`:
```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
// ... 기존

@Injectable()
export class AuthService extends ServiceCore implements OnModuleInit {
  protected readonly BCRYPT_ROUNDS = 10;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly pushChallengePublisher: PushChallengePublisher,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly deviceService: DeviceService,
    private readonly twoFaService: TwoFaService,
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly invitationService: InvitationService,
    private readonly authRepository: AuthRepository,
  ) {
    super(database, txContext);
  }

  // ...

  async register(data: ...): Promise<...> {
    await this.invitationService.validateOrThrow(data.token);

    const userRole = await this.authRepository.findRoleByName('USER');
    if (!userRole) throw new ApiException('ROLE_NOT_FOUND');

    const pepperedPassword = this.tokenService.pepperPassword(data.password);
    const hashedPassword = await bcrypt.hash(pepperedPassword, this.BCRYPT_ROUNDS);
    const rawCodes = this.generateBackupCodes();
    const codeHashes = await Promise.all(rawCodes.map((code) => bcrypt.hash(code, this.BCRYPT_ROUNDS)));

    const newUser = await this.runInTx(async () => {
      let inserted: { id: string };
      try {
        inserted = await this.authRepository.insertUser({
          username: data.username,
          nickname: data.nickname,
          password: hashedPassword,
        });
      } catch (err) {
        if ((err as { code?: string }).code === '23505') throw new ApiException('USERNAME_TAKEN');
        throw err;
      }
      await this.authRepository.insertUserRole(inserted.id, userRole.id);
      await this.authRepository.insertBackupCodes(inserted.id, codeHashes);
      await this.invitationService.consume(data.token, inserted.id);
      return inserted;
    });

    const userWithPermissions = await this.authRepository.findUserWithPermissionsById(newUser.id);
    if (!userWithPermissions) throw new ApiException('REGISTRATION_FAILED');

    const tokens = await this.issueTokenPair(userWithPermissions);
    return {
      accessToken: tokens.accessToken,
      user: { id: newUser.id, username: data.username, nickname: data.nickname },
      backupCodes: rawCodes,
      rawRefreshToken: tokens.rawRefreshToken,
      refreshTokenExpMs: tokens.refreshTokenExpMs,
    };
  }
}
```

> 다른 AuthModule 호출처에 `AuthService`를 inject받는 곳이 있으면 영향 없음 (생성자 변경은 NestJS DI가 자동 처리).

- [ ] **Step 5: 테스트 PASS 확인**

Run: `cd services/api && npx jest auth/auth.service.spec.ts`

- [ ] **Step 6: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 7: e2e 롤백 케이스 PASS 확인 (Task 2.6의 케이스가 이제 PASS)**

Run: `cd services/api && npm run test:e2e -- --testPathPattern auth`
Expected: invitation 롤백 케이스 PASS

- [ ] **Step 8: 커밋**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "refactor(api): AuthService를 ServiceCore로 마이그레이션 + register runInTx 적용"
```

---

### Task 3.2: InvitationService → ServiceCore

**Files:**
- Modify: `services/api/src/invitation/invitation.service.ts`
- Test: `services/api/src/invitation/invitation.service.spec.ts`

- [ ] **Step 1: spec module setup에 TransactionContext provider 추가**

- [ ] **Step 2: 기존 spec PASS 확인**

Run: `cd services/api && npx jest invitation/invitation.service.spec.ts`

- [ ] **Step 3: ServiceCore 적용**

`services/api/src/invitation/invitation.service.ts`:
```ts
@Injectable()
export class InvitationService extends ServiceCore {
  protected readonly DEFAULT_EXPIRES_DAYS = 7;
  protected readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly invitationRepository: InvitationRepository,
    private readonly configService: ConfigService,
  ) {
    super(database, txContext);
  }
  // ... 메서드 본문 변경 없음
}
```

- [ ] **Step 4: spec PASS 확인**

Run: `cd services/api && npx jest invitation/invitation.service.spec.ts`

- [ ] **Step 5: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/invitation/invitation.service.ts services/api/src/invitation/invitation.service.spec.ts
git commit -m "refactor(api): InvitationService를 ServiceCore로 마이그레이션"
```

---

### Task 3.3: TwoFaService → ServiceCore

**Files:**
- Modify: `services/api/src/twofa/twofa.service.ts`
- Test: `services/api/src/twofa/twofa.service.spec.ts`

- [ ] **Step 1: spec module setup 갱신**

`mockTransactionContext` provider 추가.

- [ ] **Step 2: ServiceCore 적용**

```ts
@Injectable()
export class TwoFaService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly twoFaRepository: TwoFaRepository,
    // ... 기존 의존성
  ) {
    super(database, txContext);
  }
}
```

- [ ] **Step 3: spec PASS 확인**

Run: `cd services/api && npx jest twofa/twofa.service.spec.ts`

- [ ] **Step 4: 컴파일 확인**

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/twofa/twofa.service.ts services/api/src/twofa/twofa.service.spec.ts
git commit -m "refactor(api): TwoFaService를 ServiceCore로 마이그레이션"
```

---

### Task 3.4: DeviceService → ServiceCore

**Files:**
- Modify: `services/api/src/device/device.service.ts`
- Test: `services/api/src/device/device.service.spec.ts`

- [ ] **Step 1: spec module setup 갱신**

- [ ] **Step 2: ServiceCore 적용**

```ts
@Injectable()
export class DeviceService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly deviceRepository: DeviceRepository,
    // ...
  ) {
    super(database, txContext);
  }
}
```

- [ ] **Step 3: spec PASS 확인**

- [ ] **Step 4: 컴파일 확인**

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/device/device.service.ts services/api/src/device/device.service.spec.ts
git commit -m "refactor(api): DeviceService를 ServiceCore로 마이그레이션"
```

---

### Task 3.5: TrustedDeviceService → ServiceCore

**Files:**
- Modify: `services/api/src/trusted-device/trusted-device.service.ts`
- Test: `services/api/src/trusted-device/trusted-device.service.spec.ts`

- [ ] **Step 1: spec module setup 갱신**

- [ ] **Step 2: ServiceCore 적용**

```ts
@Injectable()
export class TrustedDeviceService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly trustedDeviceRepository: TrustedDeviceRepository,
    // ...
  ) {
    super(database, txContext);
  }
}
```

- [ ] **Step 3: spec PASS 확인**

- [ ] **Step 4: 컴파일 확인**

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/trusted-device/trusted-device.service.ts services/api/src/trusted-device/trusted-device.service.spec.ts
git commit -m "refactor(api): TrustedDeviceService를 ServiceCore로 마이그레이션"
```

---

### Task 3.6: TokenService → @AutoTrace

**Files:**
- Modify: `services/api/src/security/token.service.ts`
- Test: `services/api/src/security/token.service.spec.ts`

- [ ] **Step 1: 기존 spec PASS 확인**

Run: `cd services/api && npx jest security/token.service.spec.ts`

- [ ] **Step 2: @AutoTrace 적용**

`services/api/src/security/token.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { AutoTrace } from '@terab/logger';

@Injectable()
@AutoTrace()
export class TokenService {
  // ... 변경 없음
}
```

- [ ] **Step 3: spec PASS 확인**

> `@AutoTrace`는 메서드 wrap 동작이지만 RequestTraceContext가 spec에서 활성화되지 않으므로 spec 결과에 영향 없음.

- [ ] **Step 4: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/security/token.service.ts
git commit -m "feat(api): TokenService에 @AutoTrace 적용 (ServiceCore 비대상 — Repository 없음)"
```

---

### Task 3.7: Phase 3 통합 확인

- [ ] **Step 1: 전체 단위 테스트 PASS**

Run: `cd services/api && npm test`

- [ ] **Step 2: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 3: e2e 실행**

Run: `cd services/api && npm run test:e2e`
Expected: 모든 테스트 PASS (invitation 롤백 케이스 포함)

---

## Phase 4 — @LogReplay 적용

### Task 4.1: MinioService 외부 경계 메서드에 @LogReplay 추가

**Files:**
- Modify: `services/api/src/minio/minio.service.ts`

- [ ] **Step 1: 데코레이터 추가**

`services/api/src/minio/minio.service.ts`의 다음 메서드에 `@LogReplay()` 추가:
- `copyObject` (line 60)
- `removeObject` (line 72)
- `removeObjects` (line 76)
- `createMultipartUpload` (line 85)
- `completeMultipartUpload` (line 100)
- `abortMultipartUpload` (line 109)

```ts
@LogReplay()
async copyObject(sourceKey: string, destKey: string): Promise<void> { ... }
```

기존 `putObject`의 `@LogReplay()`는 유지.

- [ ] **Step 2: spec PASS 확인**

Run: `cd services/api && npx jest minio/minio.service.spec.ts`

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/minio/minio.service.ts
git commit -m "feat(api): MinioService 외부 경계 메서드에 @LogReplay 일괄 적용"
```

---

### Task 4.2: AuthService 보안 민감 메서드에 @LogReplay 추가

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`

- [ ] **Step 1: 데코레이터 추가**

`services/api/src/auth/auth.service.ts`:
```ts
@LogReplay()
async register(...) { ... }

@LogReplay({ captureResult: true })
async login(...) { ... }

@LogReplay({ captureResult: true })
async refresh(...) { ... }

@LogReplay()
async logout(...) { ... }
```

import 추가: `import { LogReplay } from '@terab/logger';`

- [ ] **Step 2: spec PASS 확인**

Run: `cd services/api && npx jest auth/auth.service.spec.ts`

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/auth/auth.service.ts
git commit -m "feat(api): AuthService 보안 민감 메서드에 @LogReplay 적용"
```

---

### Task 4.3: TwoFaService에 @LogReplay 추가

**Files:**
- Modify: `services/api/src/twofa/twofa.service.ts`

- [ ] **Step 1: challenge / consume 메서드에 @LogReplay 추가**

`services/api/src/twofa/twofa.service.ts`의 challenge 생성 및 consume 관련 public 메서드에 `@LogReplay()` 부착. 구체 메서드는 파일 확인 후 적용 (예: `createChallenge`, `approveChallenge`, `claimApprovedChallenge` 등 보안 민감 메서드).

- [ ] **Step 2: spec PASS 확인**

Run: `cd services/api && npx jest twofa/twofa.service.spec.ts`

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/twofa/twofa.service.ts
git commit -m "feat(api): TwoFaService 챌린지 메서드에 @LogReplay 적용"
```

---

### Task 4.4: DeviceService.register / TrustedDeviceService.trust 에 @LogReplay 추가

**Files:**
- Modify: `services/api/src/device/device.service.ts`
- Modify: `services/api/src/trusted-device/trusted-device.service.ts`

- [ ] **Step 1: 데코레이터 추가**

각 파일에서 `register` 또는 `trust` 메서드(실제 메서드명 확인 후 대응) 위에 `@LogReplay()` 부착.

- [ ] **Step 2: spec PASS 확인**

Run: `cd services/api && npx jest device/ trusted-device/`

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/device/device.service.ts services/api/src/trusted-device/trusted-device.service.ts
git commit -m "feat(api): DeviceService / TrustedDeviceService 등록 메서드에 @LogReplay 적용"
```

---

### Task 4.5: InvitationService.create / consume 에 @LogReplay 추가

**Files:**
- Modify: `services/api/src/invitation/invitation.service.ts`

- [ ] **Step 1: 데코레이터 추가**

```ts
@LogReplay()
async create(...) { ... }

@LogReplay()
async consume(...) { ... }
```

- [ ] **Step 2: spec PASS 확인**

Run: `cd services/api && npx jest invitation/`

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/invitation/invitation.service.ts
git commit -m "feat(api): InvitationService create / consume 에 @LogReplay 적용"
```

---

### Task 4.6: Phase 4 통합 확인

- [ ] **Step 1: 전체 단위 테스트 PASS**

Run: `cd services/api && npm test`

- [ ] **Step 2: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 3: e2e PASS**

Run: `cd services/api && npm run test:e2e`

---

## Phase 5 — BullMQ 로깅 + 결정 노트

### Task 5.1: PushChallengePublisher pino + @AutoTrace + @LogReplay 적용

**Files:**
- Modify: `services/api/src/twofa/push-challenge.publisher.ts`
- Test: `services/api/src/twofa/push-challenge.publisher.spec.ts` (없으면 생성)

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/twofa/push-challenge.publisher.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { createPinoLoggerProvider } from '@terab/test';
import { PushChallengePublisher, PUSH_CHALLENGE_QUEUE } from './push-challenge.publisher';

describe('PushChallengePublisher', () => {
  let publisher: PushChallengePublisher;
  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PushChallengePublisher,
        { provide: getQueueToken(PUSH_CHALLENGE_QUEUE), useValue: mockQueue },
        createPinoLoggerProvider(PushChallengePublisher.name),
      ],
    }).compile();

    publisher = module.get(PushChallengePublisher);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(publisher).toBeDefined();
  });

  describe('publish', () => {
    const job = { userId: 'u1', pushToken: 't1', challengeId: 'c1', options: 'a,b', expiresAt: 'iso' };

    it('queue.add가 실패하면 예외를 전파한다', async () => {
      const err = new Error('enqueue failed');
      mockQueue.add.mockRejectedValue(err);

      await expect(publisher.publish(job)).rejects.toThrow('enqueue failed');
    });

    it('정상 enqueue 시 throw하지 않는다', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      await expect(publisher.publish(job)).resolves.toBeUndefined();
      expect(mockQueue.add).toHaveBeenCalledWith('send', job, expect.objectContaining({ attempts: 3 }));
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd services/api && npx jest push-challenge.publisher.spec.ts`
Expected: FAIL (또는 spec 없으면 NotFound)

- [ ] **Step 3: PushChallengePublisher 재작성**

`services/api/src/twofa/push-challenge.publisher.ts`:
```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { AutoTrace, LogReplay } from '@terab/logger';
import type { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { PushChallengeJob } from './types/push-challenge-job.interface';

export const PUSH_CHALLENGE_QUEUE = 'push-challenge';

@Injectable()
@AutoTrace()
export class PushChallengePublisher {
  constructor(
    @InjectQueue(PUSH_CHALLENGE_QUEUE) private readonly queue: Queue<PushChallengeJob>,
    @InjectPinoLogger(PushChallengePublisher.name) private readonly logger: PinoLogger,
  ) {}

  @LogReplay()
  async publish(job: PushChallengeJob): Promise<void> {
    try {
      const added = await this.queue.add('send', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      this.logger.info({ jobId: added.id, queue: PUSH_CHALLENGE_QUEUE }, '푸시 챌린지 enqueue 완료');
    } catch (err) {
      this.logger.error({ err, queue: PUSH_CHALLENGE_QUEUE }, '푸시 챌린지 enqueue 실패');
      throw err;
    }
  }
}
```

- [ ] **Step 4: spec PASS 확인**

Run: `cd services/api && npx jest push-challenge.publisher.spec.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/twofa/push-challenge.publisher.ts services/api/src/twofa/push-challenge.publisher.spec.ts
git commit -m "feat(api): PushChallengePublisher pino 로깅 + @AutoTrace + @LogReplay 적용"
```

---

### Task 5.2: UploadSessionService.cleanupExpired 반환 시그니처 변경

**Files:**
- Modify: `services/api/src/file/upload-session.service.ts`
- Test: `services/api/src/file/upload-session.service.spec.ts`

- [ ] **Step 1: 현재 시그니처 확인**

Run: `grep -n "cleanupExpired" services/api/src/file/upload-session.service.ts`

- [ ] **Step 2: 실패 테스트 작성**

`services/api/src/file/upload-session.service.spec.ts`의 `cleanupExpired` describe에 추가:
```ts
it('처리한 세션 수를 stats 객체로 반환한다', async () => {
  mockUploadSessionRepository.findExpired.mockResolvedValue([
    { id: 's1', minioKey: 'k1', uploadId: 'u1' },
    { id: 's2', minioKey: 'k2', uploadId: 'u2' },
  ]);
  mockMinioService.abortMultipartUpload.mockResolvedValue(undefined);
  mockMinioService.removeObject.mockResolvedValue(undefined);
  mockUploadSessionRepository.markExpired.mockResolvedValue(undefined);

  const stats = await service.cleanupExpired(500);

  expect(stats).toEqual({
    scannedCount: 2,
    abortedCount: 2,
    removedCount: 2,
  });
});
```

(실제 메서드 시그니처/내부 구현에 맞춰 stats 키 이름을 조정. 본 plan에서는 spec 명세 `{ scannedCount, abortedCount, removedCount }`를 따른다.)

- [ ] **Step 3: 실패 확인**

Run: `cd services/api && npx jest upload-session.service.spec.ts -t cleanupExpired`
Expected: FAIL (반환값이 undefined 또는 number)

- [ ] **Step 4: 시그니처 변경**

`services/api/src/file/upload-session.service.ts`의 `cleanupExpired` 구현 변경:
```ts
async cleanupExpired(batchSize: number): Promise<{
  scannedCount: number;
  abortedCount: number;
  removedCount: number;
}> {
  const expired = await this.uploadSessionRepository.findExpired(batchSize);
  let abortedCount = 0;
  let removedCount = 0;
  for (const session of expired) {
    try {
      await this.minioService.abortMultipartUpload(session.minioKey, session.uploadId);
      abortedCount++;
    } catch {
      // best-effort
    }
    try {
      await this.minioService.removeObject(session.minioKey);
      removedCount++;
    } catch {
      // best-effort
    }
    await this.uploadSessionRepository.markExpired(session.id);
  }
  return { scannedCount: expired.length, abortedCount, removedCount };
}
```

(기존 본문의 best-effort 흐름을 보존하면서 카운터만 추가.)

- [ ] **Step 5: spec PASS 확인**

Run: `cd services/api && npx jest upload-session.service.spec.ts`

- [ ] **Step 6: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 7: 커밋**

```bash
git add services/api/src/file/upload-session.service.ts services/api/src/file/upload-session.service.spec.ts
git commit -m "refactor(api): UploadSessionService.cleanupExpired에서 처리 통계 반환"
```

---

### Task 5.3: UploadSessionCleanupWorker pino + worker 이벤트 핸들러

**Files:**
- Modify: `services/api/src/file/upload-session.cleanup.worker.ts`
- Test: `services/api/src/file/upload-session.cleanup.worker.spec.ts`

- [ ] **Step 1: 실패 테스트 작성 — 핸들러 동작 검증**

`services/api/src/file/upload-session.cleanup.worker.spec.ts`의 기존 구조에 추가:
```ts
describe('worker.on(failed)', () => {
  it('attemptsMade < maxAttempts면 error 로깅을 호출하지 않는다', async () => {
    const handler = await registerHandlersAndReturnFailedHandler();
    const job = { id: 'j1', attemptsMade: 1, opts: { attempts: 3 } };

    handler(job, new Error('partial fail'));

    expect(mockPinoLogger.error).not.toHaveBeenCalled();
  });

  it('attemptsMade >= maxAttempts면 error 로깅을 호출한다', async () => {
    const handler = await registerHandlersAndReturnFailedHandler();
    const job = { id: 'j1', attemptsMade: 3, opts: { attempts: 3 } };

    handler(job, new Error('final fail'));

    expect(mockPinoLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'j1', attemptsMade: 3 }),
      expect.stringContaining('최종 실패'),
    );
  });
});
```

> `registerHandlersAndReturnFailedHandler`는 worker `onApplicationBootstrap`을 호출한 뒤 `this.worker.on` mock에서 'failed' 이벤트 핸들러를 추출하는 헬퍼. spec 내부에 inline 작성.

`this.worker`는 `WorkerHost`의 getter — spec에서는 Object.defineProperty로 mock injection 또는 publisher.spec.ts 패턴 참고.

- [ ] **Step 2: 실패 확인**

Run: `cd services/api && npx jest upload-session.cleanup.worker.spec.ts -t worker`
Expected: FAIL

- [ ] **Step 3: Worker 재작성**

`services/api/src/file/upload-session.cleanup.worker.ts`:
```ts
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UploadSessionService } from './upload-session.service';

@Processor('upload-session-cleanup')
export class UploadSessionCleanupWorker extends WorkerHost implements OnApplicationBootstrap {
  private readonly TICK_JOB_ID = 'upload-session-cleanup-tick';
  private readonly TICK_INTERVAL_MS = 15 * 60 * 1000;
  private readonly BATCH_SIZE = 500;

  constructor(
    @InjectQueue('upload-session-cleanup') private readonly queue: Queue,
    private readonly uploadSessionService: UploadSessionService,
    @InjectPinoLogger(UploadSessionCleanupWorker.name) private readonly logger: PinoLogger,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.removeJobScheduler(this.TICK_JOB_ID).catch(() => undefined);
    await this.queue.add(
      this.TICK_JOB_ID,
      {},
      {
        jobId: this.TICK_JOB_ID,
        repeat: { every: this.TICK_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.worker.on('failed', (job, err) => {
      if (!job) return;
      const max = job.opts.attempts ?? 1;
      if (job.attemptsMade >= max) {
        this.logger.error(
          { err, jobId: job.id, attemptsMade: job.attemptsMade, maxAttempts: max },
          'upload-session-cleanup 최종 실패 — 재시도 소진',
        );
      }
    });

    this.worker.on('error', (err) => {
      this.logger.error({ err }, 'upload-session-cleanup worker 내부 오류');
    });

    this.logger.info(
      { intervalMs: this.TICK_INTERVAL_MS, batchSize: this.BATCH_SIZE },
      'upload-session-cleanup 스케줄러 등록 완료',
    );
  }

  async process(_job: Job): Promise<void> {
    const start = Date.now();
    const stats = await this.uploadSessionService.cleanupExpired(this.BATCH_SIZE);
    this.logger.info(
      { ...stats, durationMs: Date.now() - start, batchSize: this.BATCH_SIZE },
      '업로드 세션 정리 tick 완료',
    );
  }
}
```

> `@AutoTrace()`는 의도적으로 부착하지 않음. 사유는 spec §4.2.

- [ ] **Step 4: spec PASS 확인**

Run: `cd services/api && npx jest upload-session.cleanup.worker.spec.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 6: 커밋**

```bash
git add services/api/src/file/upload-session.cleanup.worker.ts services/api/src/file/upload-session.cleanup.worker.spec.ts
git commit -m "feat(api): UploadSessionCleanupWorker pino 로깅 + worker lifecycle 이벤트 핸들러"
```

---

### Task 5.4: ApiExceptionFilter 결정 노트 (코드 주석)

**Files:**
- Modify: `services/api/src/common/filters/api-exception.filter.ts`

- [ ] **Step 1: 결정 주석 추가**

`services/api/src/common/filters/api-exception.filter.ts` 상단(`@Catch()` 데코레이터 위)에 주석 추가:

```ts
// ─────────────────────────────────────────────────────────────────
// 결정: pino 로거를 의도적으로 주입하지 않는다.
//
// 요청 단위 오류 로깅은 TraceFlusher.flushError가 권위적으로 담당한다.
// TraceInterceptor의 RxJS error path가 filter보다 먼저 호출되며,
// 4xx ApiException은 trace.meta info로, 5xx와 unhandled는 trace.detail error로
// stack과 모든 span을 포함해 기록한다.
//
// filter에 별도 로깅을 추가하면 동일 예외가 두 record로 분리 기록되어
// reqId로 손수 묶어야 하는 분석 부담이 생긴다. filter는 응답 직렬화만 담당한다.
//
// (과거 4e62b7c에서 logger를 추가했다가 이 중복 문제로 롤백된 이력 있음.)
// 자세한 근거: docs/superpowers/specs/2026-05-14-api-core-and-logging-consistency-design.md §5
// ─────────────────────────────────────────────────────────────────

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  // ...
}
```

- [ ] **Step 2: spec PASS 확인 (변경 없음)**

Run: `cd services/api && npx jest common/filters/api-exception.filter.spec.ts`

- [ ] **Step 3: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 4: 커밋**

```bash
git add services/api/src/common/filters/api-exception.filter.ts
git commit -m "docs(api): ApiExceptionFilter에 pino 미주입 결정 근거 주석 추가"
```

---

### Task 5.5: Phase 5 통합 확인

- [ ] **Step 1: 전체 단위 테스트 PASS**

Run: `cd services/api && npm test`

- [ ] **Step 2: 컴파일 확인**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 3: e2e PASS**

Run: `cd services/api && npm run test:e2e`

- [ ] **Step 4: 빌드 확인**

Run: `cd services/api && npm run build`
Expected: 0 errors

---

## 최종 검증

- [ ] **모든 phase의 변경이 누적된 상태에서 다음 명령 모두 PASS:**
  - `cd services/api && npm test`
  - `cd services/api && npm run test:e2e`
  - `cd services/api && npm run build`
  - `cd services/api && npx tsc --noEmit`

- [ ] **`grep -rn "this.database.db" services/api/src` 결과가 RepositoryCore 비대상(예: AuthService의 owner 초기화 등) 외에 0건임을 확인**

- [ ] **`grep -rn "registerUser" services/api/src` 결과가 0건임을 확인**

- [ ] **`grep -rn "extends ServiceCore\|extends RepositoryCore" services/api/src | wc -l`이 기대치(11개 = 5 repo + 6 service)와 일치**

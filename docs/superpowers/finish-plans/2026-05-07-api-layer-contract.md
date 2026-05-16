# API 레이어 계약 재정의 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TransactionContext` + `RepositoryCore` + `ServiceCore`를 `@terab/db`에 구현하여 레이어 계약을 강제하고 AsyncLocalStorage 기반 트랜잭션 자동 전파를 가능하게 한다.

**Architecture:** `database.service.ts`에 `DrizzleTx` 타입을 추가하고, `TransactionContext`(AsyncLocalStorage 래퍼), `RepositoryCore`(conn getter 제공), `ServiceCore`(runInTx 제공) 세 클래스를 구현한다. `DatabaseModule`(@Global)에 `TransactionContext`를 provider/export로 등록하여 전역 DI 가능하게 한다. CLAUDE.md 규칙(`layer-service.md`, `layer-repository.md`)은 이미 업데이트 완료.

**Tech Stack:** NestJS 11, Drizzle ORM (node-postgres), AsyncLocalStorage (Node.js 내장), Jest

---

## 파일 맵

```
Create:
  services/api/src/database/transaction-context.ts
  services/api/src/database/transaction-context.spec.ts
  services/api/src/database/repository.core.ts
  services/api/src/database/repository.core.spec.ts
  services/api/src/database/service.core.ts
  services/api/src/database/service.core.spec.ts
  services/api/src/test/mocks/transaction-context.mock.ts

Modify:
  services/api/src/database/database.service.ts   ← DrizzleTx 타입 추가
  services/api/src/database/database.module.ts    ← TransactionContext 등록
  services/api/src/database/index.ts              ← 신규 3개 + DrizzleTx re-export
  services/api/src/test/mocks/index.ts            ← mockTransactionContext re-export
```

---

### Task 1: DrizzleTx 타입 추가

**Files:**
- Modify: `services/api/src/database/database.service.ts`

- [ ] **Step 1: database.service.ts 하단에 DrizzleTx 타입 추가**

`services/api/src/database/database.service.ts` 파일 마지막 줄 뒤에 추가. `NodePgDatabase`와 `schema`는 이미 import되어 있으므로 추가 import 불필요.

```typescript
type Db = NodePgDatabase<typeof schema>;
export type DrizzleTx = Parameters<Parameters<Db['transaction']>[0]>[0];
```

완성된 파일 끝부분:

```typescript
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

type Db = NodePgDatabase<typeof schema>;
export type DrizzleTx = Parameters<Parameters<Db['transaction']>[0]>[0];
```

- [ ] **Step 2: 타입 오류 없는지 확인**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 출력 없음(오류 없음).

- [ ] **Step 3: 커밋**

```bash
cd services/api && git add src/database/database.service.ts
git commit -m "feat: DrizzleTx 타입 추가"
```

---

### Task 2: TransactionContext 구현

**Files:**
- Create: `services/api/src/database/transaction-context.ts`
- Create: `services/api/src/database/transaction-context.spec.ts`
- Modify: `services/api/src/database/database.module.ts`
- Modify: `services/api/src/database/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`services/api/src/database/transaction-context.spec.ts` 생성:

```typescript
import type { DrizzleTx } from './database.service';
import { TransactionContext } from './transaction-context';

describe('TransactionContext', () => {
  let ctx: TransactionContext;

  beforeEach(() => {
    ctx = new TransactionContext();
  });

  it('인스턴스가 생성된다', () => {
    expect(ctx).toBeDefined();
  });

  it('트랜잭션 컨텍스트 밖에서 current는 undefined를 반환한다', () => {
    expect(ctx.current).toBeUndefined();
  });

  it('run() 내에서 current는 주입된 tx를 반환한다', async () => {
    const fakeTx = {} as DrizzleTx;
    let captured: DrizzleTx | undefined;

    await ctx.run(fakeTx, async () => {
      captured = ctx.current;
    });

    expect(captured).toBe(fakeTx);
  });

  it('run() 종료 후 current는 undefined로 돌아온다', async () => {
    const fakeTx = {} as DrizzleTx;
    await ctx.run(fakeTx, async () => {});
    expect(ctx.current).toBeUndefined();
  });

  it('중첩 run()에서 내부 tx가 외부 tx보다 우선한다', async () => {
    const outerTx = {} as DrizzleTx;
    const innerTx = {} as DrizzleTx;
    let innerCaptured: DrizzleTx | undefined;
    let outerAfterInner: DrizzleTx | undefined;

    await ctx.run(outerTx, async () => {
      await ctx.run(innerTx, async () => {
        innerCaptured = ctx.current;
      });
      outerAfterInner = ctx.current;
    });

    expect(innerCaptured).toBe(innerTx);
    expect(outerAfterInner).toBe(outerTx);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- --testPathPattern="transaction-context.spec" --watchAll=false 2>&1 | tail -10
```

Expected: `Cannot find module './transaction-context'` 오류.

- [ ] **Step 3: TransactionContext 구현**

`services/api/src/database/transaction-context.ts` 생성:

```typescript
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import type { DrizzleTx } from './database.service';

@Injectable()
export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<DrizzleTx>();

  get current(): DrizzleTx | undefined {
    return this.storage.getStore();
  }

  run<T>(tx: DrizzleTx, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(tx, fn);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- --testPathPattern="transaction-context.spec" --watchAll=false 2>&1 | tail -10
```

Expected:
```
PASS src/database/transaction-context.spec.ts
Tests: 5 passed, 5 total
```

- [ ] **Step 5: DatabaseModule에 TransactionContext 등록**

`services/api/src/database/database.module.ts` 전체 교체:

```typescript
import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TransactionContext } from './transaction-context';

@Global()
@Module({
  providers: [DatabaseService, TransactionContext],
  exports: [DatabaseService, TransactionContext],
})
export class DatabaseModule {}
```

- [ ] **Step 6: index.ts에 TransactionContext re-export 추가**

`services/api/src/database/index.ts` 전체 교체:

```typescript
export * from './database.module';
export * from './database.service';
export * from './schema';
export * from './transaction-context';
```

- [ ] **Step 7: 전체 테스트 통과 확인**

```bash
cd services/api && npm test -- --watchAll=false 2>&1 | tail -15
```

Expected: 기존 테스트 모두 통과.

- [ ] **Step 8: 커밋**

```bash
cd services/api && git add src/database/transaction-context.ts \
  src/database/transaction-context.spec.ts \
  src/database/database.module.ts \
  src/database/index.ts
git commit -m "feat: TransactionContext 구현 및 DatabaseModule 등록"
```

---

### Task 3: RepositoryCore 구현

**Files:**
- Create: `services/api/src/database/repository.core.ts`
- Create: `services/api/src/database/repository.core.spec.ts`
- Modify: `services/api/src/database/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`services/api/src/database/repository.core.spec.ts` 생성:

```typescript
import type { DrizzleTx } from './database.service';
import { DatabaseService } from './database.service';
import { TransactionContext } from './transaction-context';
import { RepositoryCore } from './repository.core';

class TestRepository extends RepositoryCore {
  getConn() {
    return this.conn;
  }
}

describe('RepositoryCore', () => {
  const mockTxCtx = { current: undefined as DrizzleTx | undefined };
  const mockDb = { db: {} };
  let repo: TestRepository;

  beforeEach(() => {
    mockTxCtx.current = undefined;
    repo = new TestRepository(
      mockDb as unknown as DatabaseService,
      mockTxCtx as unknown as TransactionContext,
    );
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  it('tx 컨텍스트가 없으면 conn은 database.db를 반환한다', () => {
    expect(repo.getConn()).toBe(mockDb.db);
  });

  it('tx 컨텍스트가 있으면 conn은 해당 tx를 반환한다', () => {
    const fakeTx = {} as DrizzleTx;
    mockTxCtx.current = fakeTx;
    expect(repo.getConn()).toBe(fakeTx);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- --testPathPattern="repository.core.spec" --watchAll=false 2>&1 | tail -10
```

Expected: `Cannot find module './repository.core'` 오류.

- [ ] **Step 3: RepositoryCore 구현**

`services/api/src/database/repository.core.ts` 생성:

```typescript
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { DrizzleTx } from './database.service';
import { DatabaseService } from './database.service';
import * as schema from './schema';
import { TransactionContext } from './transaction-context';

export abstract class RepositoryCore {
  constructor(
    protected readonly database: DatabaseService,
    protected readonly txContext: TransactionContext,
  ) {}

  protected get conn(): DrizzleTx | NodePgDatabase<typeof schema> {
    return this.txContext.current ?? this.database.db;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- --testPathPattern="repository.core.spec" --watchAll=false 2>&1 | tail -10
```

Expected:
```
PASS src/database/repository.core.spec.ts
Tests: 3 passed, 3 total
```

- [ ] **Step 5: index.ts에 RepositoryCore re-export 추가**

`services/api/src/database/index.ts` 전체 교체:

```typescript
export * from './database.module';
export * from './database.service';
export * from './repository.core';
export * from './schema';
export * from './transaction-context';
```

- [ ] **Step 6: 전체 테스트 통과 확인**

```bash
cd services/api && npm test -- --watchAll=false 2>&1 | tail -15
```

Expected: 기존 테스트 모두 통과.

- [ ] **Step 7: 커밋**

```bash
cd services/api && git add src/database/repository.core.ts \
  src/database/repository.core.spec.ts \
  src/database/index.ts
git commit -m "feat: RepositoryCore 구현"
```

---

### Task 4: ServiceCore 구현

**Files:**
- Create: `services/api/src/database/service.core.ts`
- Create: `services/api/src/database/service.core.spec.ts`
- Modify: `services/api/src/database/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`services/api/src/database/service.core.spec.ts` 생성:

```typescript
import type { DrizzleTx } from './database.service';
import { DatabaseService } from './database.service';
import { TransactionContext } from './transaction-context';
import { ServiceCore } from './service.core';

class TestService extends ServiceCore {
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.runInTx(fn);
  }
}

describe('ServiceCore', () => {
  const mockTransaction = jest.fn();
  const mockTxCtx = {
    current: undefined as DrizzleTx | undefined,
    run: jest.fn((_tx: DrizzleTx, fn: () => Promise<unknown>) => fn()),
  };
  const mockDb = { db: { transaction: mockTransaction } };
  let service: TestService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTxCtx.current = undefined;
    mockTxCtx.run.mockImplementation((_tx: DrizzleTx, fn: () => Promise<unknown>) => fn());
    service = new TestService(
      mockDb as unknown as DatabaseService,
      mockTxCtx as unknown as TransactionContext,
    );
  });

  it('인스턴스가 생성된다', () => {
    expect(service).toBeDefined();
  });

  it('tx 컨텍스트가 없으면 database.db.transaction을 호출한다', async () => {
    const fakeTx = {} as DrizzleTx;
    const fn = jest.fn().mockResolvedValue('result');
    mockTransaction.mockImplementation((cb: (tx: DrizzleTx) => Promise<unknown>) => cb(fakeTx));

    await service.execute(fn);

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockTxCtx.run).toHaveBeenCalledWith(fakeTx, fn);
  });

  it('이미 tx 컨텍스트가 있으면 새 트랜잭션 없이 fn을 직접 실행한다', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    mockTxCtx.current = {} as DrizzleTx;

    await service.execute(fn);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });

  it('runInTx의 반환값을 그대로 전달한다', async () => {
    const fakeTx = {} as DrizzleTx;
    const fn = jest.fn().mockResolvedValue('expected-value');
    mockTransaction.mockImplementation((cb: (tx: DrizzleTx) => Promise<unknown>) => cb(fakeTx));

    const result = await service.execute(fn);

    expect(result).toBe('expected-value');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- --testPathPattern="service.core.spec" --watchAll=false 2>&1 | tail -10
```

Expected: `Cannot find module './service.core'` 오류.

- [ ] **Step 3: ServiceCore 구현**

`services/api/src/database/service.core.ts` 생성:

```typescript
import { DatabaseService } from './database.service';
import { TransactionContext } from './transaction-context';

export abstract class ServiceCore {
  constructor(
    protected readonly database: DatabaseService,
    protected readonly txContext: TransactionContext,
  ) {}

  protected runInTx<T>(fn: () => Promise<T>): Promise<T> {
    if (this.txContext.current) {
      return fn();
    }
    return this.database.db.transaction((tx) => this.txContext.run(tx, fn));
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- --testPathPattern="service.core.spec" --watchAll=false 2>&1 | tail -10
```

Expected:
```
PASS src/database/service.core.spec.ts
Tests: 4 passed, 4 total
```

- [ ] **Step 5: index.ts에 ServiceCore re-export 추가**

`services/api/src/database/index.ts` 전체 교체:

```typescript
export * from './database.module';
export * from './database.service';
export * from './repository.core';
export * from './schema';
export * from './service.core';
export * from './transaction-context';
```

- [ ] **Step 6: 전체 테스트 통과 확인**

```bash
cd services/api && npm test -- --watchAll=false 2>&1 | tail -15
```

Expected: 기존 테스트 모두 통과.

- [ ] **Step 7: 커밋**

```bash
cd services/api && git add src/database/service.core.ts \
  src/database/service.core.spec.ts \
  src/database/index.ts
git commit -m "feat: ServiceCore 구현"
```

---

### Task 5: mockTransactionContext 테스트 유틸 추가

**Files:**
- Create: `services/api/src/test/mocks/transaction-context.mock.ts`
- Modify: `services/api/src/test/mocks/index.ts`

- [ ] **Step 1: mock 파일 생성**

`services/api/src/test/mocks/transaction-context.mock.ts` 생성:

```typescript
import type { DrizzleTx } from '@terab/db';

export const mockTransactionContext = {
  current: undefined as DrizzleTx | undefined,
  run: jest.fn((_tx: unknown, fn: () => Promise<unknown>) => fn()),
};
```

- `current`는 일반 프로퍼티로 선언하여 테스트에서 `mockTransactionContext.current = fakeTx` 직접 할당 가능
- `jest.clearAllMocks()` 후에도 `run`의 기본 구현(`fn()` 그대로 호출)은 유지됨

- [ ] **Step 2: mocks/index.ts에 re-export 추가**

`services/api/src/test/mocks/index.ts` 전체 교체:

```typescript
export * from './config.service.mock';
export * from './database.service.mock';
export * from './transaction-context.mock';
```

- [ ] **Step 3: 전체 테스트 통과 확인**

```bash
cd services/api && npm test -- --watchAll=false 2>&1 | tail -15
```

Expected: 기존 테스트 모두 통과. `mockTransactionContext`가 `@terab/test`로 import 가능.

- [ ] **Step 4: 커밋**

```bash
cd services/api && git add src/test/mocks/transaction-context.mock.ts \
  src/test/mocks/index.ts
git commit -m "feat: mockTransactionContext 테스트 유틸 추가"
```

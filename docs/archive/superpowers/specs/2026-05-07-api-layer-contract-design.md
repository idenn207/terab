# API 레이어 계약 재정의 설계

**날짜:** 2026-05-07
**브랜치:** feat/file-management
**상태:** 승인됨

---

## 배경 및 목표

NestJS API 서비스의 레이어 간 계약을 명문화하고 트랜잭션 처리 패턴을 표준화한다.

### 레이어 계약 규칙

1. **Service → 타 도메인 Repository 직접 참조 금지** — 타 도메인 데이터가 필요하면 해당 Service를 통해 호출한다.
2. **Service → Service 호출 허용** — 크로스 도메인 로직은 Service 간 조합으로 처리한다.
3. **트랜잭션 조율은 Service 책임** — tx 컨텍스트를 Service에서 시작하고 Repository는 자동으로 참여한다.

### 문제

- 모든 Service 메서드에 `(args: any, tx?: DrizzleTransaction)` 시그니처를 강제하면 패턴 누락 및 보일러플레이트가 증가한다.
- Repository 내부 트랜잭션이 cross-service 시나리오를 커버하지 못한다.

---

## 결정된 방식: A — TransactionContext + ServiceCore + RepositoryCore

`AsyncLocalStorage`를 사용해 트랜잭션 컨텍스트를 async 체인에 자동 전파한다. Service/Repository 메서드 시그니처에 `tx?` 파라미터가 없어도 된다.

### 선택 근거

- Node.js 24에서 `AsyncLocalStorage` 오버헤드는 ~50–200ns / 호출로 DB 쿼리 대비 무시 가능
- Service → Service 호출 시에도 tx가 자동 전파되므로 레이어 계약 규칙 2번과 자연스럽게 일치
- NestJS DI 표준 방식을 벗어나지 않음 (전역 싱글턴, 데코레이터 AOP 불필요)

---

## 컴포넌트 구조

모든 신규 파일은 `src/database/` (`@terab/db`)에 추가한다.

```
src/database/
  transaction-context.ts    ← 신규
  repository.core.ts        ← 신규
  service.core.ts           ← 신규
  database.module.ts        ← 수정: TransactionContext provider/export 추가
  index.ts                  ← 수정: 신규 3개 + DrizzleTx 타입 re-export
```

### 의존 관계

```
TransactionContext  ←── RepositoryCore
                    ←── ServiceCore
DatabaseService     ←── RepositoryCore
                    ←── ServiceCore
```

---

## 구현 상세

### DrizzleTx 타입

드라이즐 내부 타입을 직접 import하지 않고 `db.transaction` 콜백 파라미터에서 추론한다. `database.service.ts`에 정의해 순환 import를 방지한다 (`index.ts` 정의 시 `transaction-context.ts` ↔ `index.ts` 순환 발생).

```typescript
// src/database/database.service.ts 하단에 추가
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

type Db = NodePgDatabase<typeof schema>;
export type DrizzleTx = Parameters<Parameters<Db['transaction']>[0]>[0];
```

`index.ts`에서 `DrizzleTx`를 re-export한다.

### TransactionContext

```typescript
// src/database/transaction-context.ts
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

### RepositoryCore

```typescript
// src/database/repository.core.ts
import { DatabaseService } from './database.service';
import { TransactionContext } from './transaction-context';
import type { DrizzleTx } from './database.service';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

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

### ServiceCore

중첩 `runInTx` 호출 시 이미 활성 tx가 있으면 새 트랜잭션 없이 참여한다 (Spring의 `REQUIRED` 전파와 동일한 동작).

```typescript
// src/database/service.core.ts
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

### DatabaseModule 수정

```typescript
@Global()
@Module({
  providers: [DatabaseService, TransactionContext],
  exports: [DatabaseService, TransactionContext],
})
export class DatabaseModule {}
```

---

## 마이그레이션 패턴

### Repository

```typescript
// Before
@Injectable()
export class FileRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<Files$Select | null> {
    const [row = null] = await this.database.db
      .select().from(files).where(eq(files.id, id)).limit(1);
    return row;
  }
}

// After
@Injectable()
export class FileRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findById(id: string): Promise<Files$Select | null> {
    const [row = null] = await this.conn
      .select().from(files).where(eq(files.id, id)).limit(1);
    return row;
  }
}
```

변경 포인트: `extends RepositoryCore`, constructor 패턴, `this.database.db` → `this.conn`.

### Service

```typescript
// After
@Injectable()
export class FileService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly fileRepository: FileRepository,
    private readonly folderService: FolderService,
  ) {
    super(database, txContext);
  }

  async moveFile(fileId: string, targetFolderId: string): Promise<void> {
    return this.runInTx(async () => {
      const file = await this.fileRepository.findById(fileId);
      if (!file) throw new ApiException('FILE_NOT_FOUND');

      await this.fileRepository.updateFolder(fileId, targetFolderId);
      await this.folderService.decrementItemCount(file.folderId);   // tx 자동 전파
      await this.folderService.incrementItemCount(targetFolderId);  // tx 자동 전파
    });
  }
}
```

### 기존 Repository 내부 트랜잭션

`AuthRepository.registerUser()`처럼 Repository 내부에서 트랜잭션을 직접 시작하는 기존 코드는 **즉시 마이그레이션 대상이 아니다.** cross-repo 원자성 요구가 생겼을 때 Service로 분리한다.

---

## 테스트 유틸 추가

`src/test/mocks/transaction-context.mock.ts` 신규 추가:

```typescript
export const mockTransactionContext = {
  current: undefined,
  run: jest.fn((tx, fn) => fn()),
} satisfies Partial<TransactionContext>;
```

`src/test/mocks/index.ts`에 re-export 추가.

Repository 테스트 provider:
```typescript
{ provide: TransactionContext, useValue: mockTransactionContext }
```

---

## 적용 범위

### 즉시 적용 (이번 구현)

- `TransactionContext`, `RepositoryCore`, `ServiceCore` 구현
- `DatabaseModule` 수정
- `@terab/db` export 업데이트
- `mockTransactionContext` 테스트 유틸 추가
- 신규 도메인(File, Folder)에 패턴 적용

### 점진적 마이그레이션 (이후)

- 기존 도메인(Auth, Device, TrustedDevice, TwoFa, Invitation) — 해당 도메인 작업 시 자연스럽게 적용

---

## 적용 기준

| 클래스 | extends 조건 |
| --- | --- |
| Repository | DB 쿼리가 있는 모든 Repository — `RepositoryCore` 필수 |
| Service | `runInTx()`가 필요한 Service만 `ServiceCore` extends. 트랜잭션 불필요 시 extends 생략 가능 |

트랜잭션이 필요 없는 단순 조회 전용 Service(`InvitationService.validate` 등)는 `ServiceCore`를 extends하지 않아도 된다. 단, 미래에 트랜잭션이 필요해지면 그 시점에 추가한다.

---

## CLAUDE.md 업데이트 항목

`services/api/.claude/rules/layer-service.md`:

- 트랜잭션이 필요한 Service는 `ServiceCore`를 extends하고 `runInTx()`로 시작한다
- cross-service 원자성은 `runInTx()` 안에서 다른 서비스를 호출하는 방식으로 처리한다

`services/api/.claude/rules/layer-repository.md`:

- Repository는 `RepositoryCore`를 extends한다
- DB 쿼리는 `this.conn`을 사용한다 (`this.database.db` 직접 사용 금지)

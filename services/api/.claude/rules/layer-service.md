---
description: NestJS Service 작성 패턴 (비즈니스 로직)
globs:
  - "src/**/*.service.ts"
alwaysApply: false
---

# Service 작성 패턴

## 클래스 구조

트랜잭션이 필요한 Service는 `ServiceCore`를 extends한다.

```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { ApiException } from '@terab/common';

@Injectable()
export class ExampleService extends ServiceCore {
  private readonly SOME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 상수는 클래스 최상단

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly exampleRepository: ExampleRepository,
  ) {
    super(database, txContext);
  }

  async doSomething(input: string): Promise<ResultType> {
    const item = await this.exampleRepository.findById(input);
    if (!item) throw new ApiException('ITEM_NOT_FOUND');
    return item;
  }
}
```

- `database`, `txContext`는 `super()`로 전달 — `private readonly` 선언 없음
- 트랜잭션이 전혀 필요 없는 단순 조회 전용 Service는 `ServiceCore` extends 생략 가능. 미래에 필요해지면 그 시점에 추가한다

## 트랜잭션 패턴

트랜잭션이 필요한 로직은 `runInTx()`로 감싼다. 중첩 호출 시 이미 활성 tx가 있으면 새 트랜잭션 없이 참여한다 (Spring의 `REQUIRED` 전파와 동일).

```ts
async moveFile(fileId: string, targetFolderId: string): Promise<void> {
  return this.runInTx(async () => {
    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');

    await this.fileRepository.updateFolder(fileId, targetFolderId);
    await this.folderService.decrementItemCount(file.folderId);  // tx 자동 전파
    await this.folderService.incrementItemCount(targetFolderId); // tx 자동 전파
  });
}
```

- `runInTx()` 안에서 호출된 Repository의 `this.conn`이 자동으로 활성 tx를 선택한다
- `runInTx()` 안에서 다른 Service를 호출하면 그 Service의 Repository도 동일한 tx에 참여한다
- Service에서 `database.db.transaction()` 직접 호출 금지

## 크로스 도메인 로직

타 도메인 데이터가 필요한 경우 해당 도메인 Repository가 아닌 Service를 통해 호출한다.

```ts
// ❌ 타 도메인 Repository 직접 참조
@Injectable()
export class FileService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly fileRepository: FileRepository,
    private readonly folderRepository: FolderRepository, // 금지 — 타 도메인 Repository
  ) {
    super(database, txContext);
  }
}

// ✅ 타 도메인 Service 경유
@Injectable()
export class FileService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly fileRepository: FileRepository,
    private readonly folderService: FolderService, // 허용 — 타 도메인 Service
  ) {
    super(database, txContext);
  }
}
```

## 예외 처리

```ts
// ✅ 도메인 예외 — ErrorCode에 등록된 키 사용 (타입 안전)
throw new ApiException('ERROR_CODE_KEY');

// ❌ 서비스에서 직접 DB 접근 금지
await this.database.db.select()...
```

## 핵심 규칙

- DB 직접 접근 금지 — 항상 자신의 도메인 Repository 경유
- **타 도메인 Repository 직접 참조 금지** — 크로스 도메인 로직은 해당 도메인 Service를 주입받아 호출한다
- 트랜잭션이 필요한 Service는 `ServiceCore` extends 후 `runInTx()`로 시작
- cross-service 원자성은 `runInTx()` 안에서 다른 Service를 호출하는 방식으로 처리
- `database.db.transaction()` 직접 호출 금지 — `runInTx()` 위임
- 상수·헬퍼 함수는 클래스 내부에 (`private readonly` / `private` 메서드) — `class-patterns.md` 참조
- `ServiceCore` import: `import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db'`
- `ApiException` import: `import { ApiException } from '@terab/common'`

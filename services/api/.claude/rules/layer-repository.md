---
description: NestJS Repository 작성 패턴 (Drizzle ORM)
globs:
  - "src/**/*.repository.ts"
alwaysApply: false
---

# Repository 작성 패턴

## 클래스 구조

모든 Repository는 `RepositoryCore`를 extends한다.

```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, RepositoryCore, TransactionContext } from '@terab/db';

@Injectable()
export class ExampleRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }
}
```

- `database`, `txContext`는 `super()`로 전달 — `private readonly` 선언 없음
- DB 쿼리는 `this.database.db` 대신 **`this.conn`** 사용 (`RepositoryCore`가 tx 컨텍스트를 자동으로 선택)

## 단건 조회 — [row = null] 패턴

```ts
async findById(id: string): Promise<ExampleTable$Select | null> {
  const [row = null] = await this.conn
    .select()
    .from(exampleTable)
    .where(eq(exampleTable.id, id))
    .limit(1);
  return row;
}
```

- 단일 테이블은 `select()` 전체 컬럼 허용; Join 포함 시 컬럼 명시 필수 (컬럼 이름 충돌 방지)
- `.limit(1)` 필수 — 단건 조회 의도를 명확히

## 다건 조회 + Join 집계 패턴

```ts
async findWithRelations(userId: string): Promise<UserWithPermissions | null> {
  const rows = await this.conn
    .select({
      id: users.id,
      name: users.username,
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(permissions, eq(permissions.id, userRoles.roleId))
    .where(eq(users.id, userId));

  if (!rows.length) return null;
  return this.aggregateResult(rows);
}

private aggregateResult(rows: RawRow[]): UserWithPermissions {
  const first = rows[0];
  const permSet = new Set(
    rows.filter((r) => r.resource && r.action).map((r) => `${r.resource}:${r.action}`),
  );
  return { id: first.id, name: first.name, permissions: [...permSet] };
}
```

## 트랜잭션 참여 패턴

Repository는 트랜잭션을 직접 시작하지 않는다. `this.conn`이 `TransactionContext`에 활성 tx가 있으면 자동으로 참여하고, 없으면 일반 DB 연결을 사용한다.

```ts
// ✅ this.conn — tx 컨텍스트를 자동으로 선택
async updateFolder(fileId: string, folderId: string): Promise<void> {
  await this.conn
    .update(files)
    .set({ folderId })
    .where(eq(files.id, fileId));
}

// ❌ 직접 트랜잭션 시작 금지 (신규 코드)
async createWithRelations(data: CreateData) {
  return this.database.db.transaction(async (tx) => { // 금지
    ...
  });
}
```

> **기존 코드 예외:** `AuthRepository`처럼 Repository 내부에서 직접 트랜잭션을 시작하는 기존 코드는 즉시 마이그레이션 대상이 아니다. cross-repo 원자성 요구가 생겼을 때 Service로 분리한다.

## 핵심 규칙

- `RepositoryCore` extends 필수 — `import { RepositoryCore } from '@terab/db'`
- `TransactionContext` import: `import { TransactionContext } from '@terab/db'`
- `DatabaseService` import: `import { DatabaseService } from '@terab/db'`
- 스키마·타입 import: `import { tableName, TableName$Insert, TableName$Select } from '@terab/db'`
- Drizzle 연산자 import: `import { and, eq, gt, isNull } from 'drizzle-orm'`
- 반환 타입 명시 필수: `Promise<T>` 또는 `Promise<T | null>`
- DB 쿼리는 `this.conn` 사용 — `this.database.db` 직접 사용 금지
- **타 Repository 직접 참조 금지** — Repository는 다른 Repository를 주입받거나 호출하지 않는다. 타 도메인 데이터가 필요한 경우 해당 도메인 Service를 통해 주입받는다

```ts
// ❌ Repository에서 타 Repository 직접 참조
@Injectable()
export class FileRepository extends RepositoryCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly folderRepository: FolderRepository, // 금지
  ) {
    super(database, txContext);
  }
}

// ✅ Service에서 조합
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
}
```

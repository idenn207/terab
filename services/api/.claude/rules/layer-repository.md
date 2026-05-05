---
description: NestJS Repository 작성 패턴 (Drizzle ORM)
globs:
  - "src/**/*.repository.ts"
alwaysApply: false
---

# Repository 작성 패턴

## 클래스 구조

```ts
@Injectable()
export class ExampleRepository {
  constructor(private readonly database: DatabaseService) {}
}
```

## 단건 조회 — [row = null] 패턴

```ts
async findById(id: string): Promise<ExampleTable$Select | null> {
  const [row = null] = await this.database.db
    .select({ id: exampleTable.id, name: exampleTable.name })  // 컬럼 명시
    .from(exampleTable)
    .where(eq(exampleTable.id, id))
    .limit(1);
  return row;
}
```

- `select()` 빈 호출(전체 컬럼) 지양 — 필요한 컬럼만 명시
- `.limit(1)` 필수 — 단건 조회 의도를 명확히

## 다건 조회 + Join 집계 패턴

```ts
async findWithRelations(userId: string): Promise<UserWithPermissions | null> {
  const rows = await this.database.db
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

## 트랜잭션 패턴

```ts
async createWithRelations(data: CreateData): Promise<{ id: string }> {
  return this.database.db.transaction(async (tx) => {
    const [item] = await tx.insert(table).values(data).returning({ id: table.id });
    if (!item) throw new InternalServerErrorException('생성 실패');
    await tx.insert(relatedTable).values({ itemId: item.id });
    return item;
  });
}
```

## 핵심 규칙

- `DatabaseService` import: `import { DatabaseService } from '@terab/db'`
- 스키마·타입 import: `import { tableName, TableName$Insert, TableName$Select } from '@terab/db'`
- Drizzle 연산자 import: `import { and, eq, gt, isNull } from 'drizzle-orm'`
- 반환 타입 명시 필수: `Promise<T>` 또는 `Promise<T | null>`

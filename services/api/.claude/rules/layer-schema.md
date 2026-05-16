---
description: Drizzle Schema 작성 패턴
globs:
  - "src/database/schema/**/*.ts"
alwaysApply: false
---

# Schema 작성 패턴

## 파일 구조

```ts
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';

export const exampleTable = table(
  'example_table',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    name: t.varchar('name', { length: 100 }).notNull(),
    active: t.boolean('active').notNull().default(true),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    t.uniqueIndex().on(table.name),
    t.index().on(table.createdAt),
  ],
);

export type ExampleTable$Insert = typeof exampleTable.$inferInsert;
export type ExampleTable$Select = typeof exampleTable.$inferSelect;
```

## 표준 컬럼 패턴

| 컬럼 용도 | 타입 | 패턴 |
|---|---|---|
| PK | uuid | `t.uuid('id').primaryKey().defaultRandom()` |
| 문자열 | varchar | `t.varchar('col', { length: N }).notNull()` |
| 생성/수정 시각 | timestamp | `t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow()` |
| 외래 키 | uuid | `t.uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })` — soft reference(감사 로그 등)는 `onDelete` 생략 가능 |
| nullable 시각 (used_at 등) | timestamp | `t.timestamp('used_at', { withTimezone: true })` (`.notNull()` 없음) |
| Junction PK | — | `(table) => [t.primaryKey({ columns: [table.aId, table.bId] })]` |

## 타입 네이밍

- `$Insert`: INSERT 시 사용 — `typeof table.$inferInsert`
- `$Select`: SELECT 결과 — `typeof table.$inferSelect`
- 파일 하단에 선언

## 등록

새 스키마 파일 작성 후 `src/database/schema/index.ts`에 반드시 re-export 추가:

```ts
export * from './example-table.schema';
```

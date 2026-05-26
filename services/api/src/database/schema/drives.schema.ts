import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const drives = table(
  'drives',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    ownerId: t
      .uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: t.varchar('name', { length: 100 }).notNull(),
    kind: t.varchar('kind', { length: 16 }).notNull(),
    mountPath: t.varchar('mount_path', { length: 255 }).notNull().unique(),
    quotaBytes: t.bigint('quota_bytes', { mode: 'number' }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.ownerId), t.index().on(table.kind)],
);

export type Drives$Insert = typeof drives.$inferInsert;
export type Drives$Select = typeof drives.$inferSelect;

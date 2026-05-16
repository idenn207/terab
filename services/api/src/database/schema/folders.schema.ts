import * as t from 'drizzle-orm/pg-core';
import { type AnyPgColumn, pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const folders = table(
  'folders',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: t.uuid('parent_id').references((): AnyPgColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: t.varchar('name', { length: 255 }).notNull(),
    softDeletedAt: t.timestamp('soft_deleted_at', { withTimezone: true }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.userId), t.index().on(table.parentId)],
);

export type Folders$Insert = typeof folders.$inferInsert;
export type Folders$Select = typeof folders.$inferSelect;

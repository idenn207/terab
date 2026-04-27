import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const backupCodes = table(
  'backup_codes',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: t.varchar('code_hash', { length: 60 }).notNull(),
    usedAt: t.timestamp('used_at', { withTimezone: true }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.userId)],
);

export type BackupCodes$Insert = typeof backupCodes.$inferInsert;
export type BackupCodes$Select = typeof backupCodes.$inferSelect;

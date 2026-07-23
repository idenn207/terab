import { sql } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { drives } from './drives.schema';
import { users } from './users.schema';

export const mountCredentials = table(
  'mount_credentials',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    driveId: t
      .uuid('drive_id')
      .notNull()
      .references(() => drives.id, { onDelete: 'cascade' }),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    protocol: t.varchar('protocol', { length: 16 }).notNull(),
    osUsername: t.varchar('os_username', { length: 64 }).notNull(),
    secretRef: t.varchar('secret_ref', { length: 255 }).notNull(),
    iqn: t.varchar('iqn', { length: 255 }),
    lastUsedAt: t.timestamp('last_used_at', { withTimezone: true }),
    revokedAt: t.timestamp('revoked_at', { withTimezone: true }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    t.index().on(table.driveId),
    t.index().on(table.userId),
    // active(회수 전) 자격증명만 유니크 — revoked 행은 제약에서 빠져 회수 후 재발급 허용
    t
      .uniqueIndex('mount_credentials_active_unique')
      .on(table.driveId, table.userId, table.protocol)
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);

export type MountCredentials$Insert = typeof mountCredentials.$inferInsert;
export type MountCredentials$Select = typeof mountCredentials.$inferSelect;

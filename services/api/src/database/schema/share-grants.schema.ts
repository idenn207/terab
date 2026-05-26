import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { drives } from './drives.schema';
import { users } from './users.schema';

export const shareGrants = table(
  'share_grants',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    driveId: t
      .uuid('drive_id')
      .notNull()
      .references(() => drives.id, { onDelete: 'cascade' }),
    granteeUserId: t
      .uuid('grantee_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessMode: t.varchar('access_mode', { length: 16 }).notNull(),
    grantedByUserId: t
      .uuid('granted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: t.timestamp('expires_at', { withTimezone: true }),
    revokedAt: t.timestamp('revoked_at', { withTimezone: true }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    t.index().on(table.driveId),
    t.index().on(table.granteeUserId),
    t.unique().on(table.driveId, table.granteeUserId, table.accessMode),
  ],
);

export type ShareGrants$Insert = typeof shareGrants.$inferInsert;
export type ShareGrants$Select = typeof shareGrants.$inferSelect;

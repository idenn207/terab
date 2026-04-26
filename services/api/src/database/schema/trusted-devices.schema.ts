import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const trustedDevices = table(
  'trusted_devices',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: t.varchar('token_hash', { length: 64 }).notNull(),
    userAgent: t.varchar('user_agent', { length: 500 }),
    expiresAt: t.timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.userId), t.index().on(table.tokenHash)],
);

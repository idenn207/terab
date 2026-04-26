import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { devices } from './devices.schema';
import { users } from './users.schema';

export const refreshTokens = table(
  'refresh_tokens',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: t.varchar('token_hash', { length: 255 }).notNull(),
    deviceId: t.uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
    expiresAt: t.timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: t.timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [t.index().on(table.userId), t.index().on(table.tokenHash)],
);

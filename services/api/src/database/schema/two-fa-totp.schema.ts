import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const twoFaTotp = table(
  'two_fa_totp',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secretEncrypted: t
      .customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })('secret_encrypted')
      .notNull(),
    iv: t
      .customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })('iv')
      .notNull(),
    authTag: t
      .customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })('auth_tag')
      .notNull(),
    algorithm: t
      .varchar('algorithm', { length: 16, enum: ['SHA1'] })
      .notNull()
      .default('SHA1'),
    digits: t.integer('digits').notNull().default(6),
    periodSec: t.integer('period_sec').notNull().default(30),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: t.timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [t.uniqueIndex().on(table.userId)],
);

export type TwoFaTotp$Insert = typeof twoFaTotp.$inferInsert;
export type TwoFaTotp$Select = typeof twoFaTotp.$inferSelect;

import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const twoFaChallenges = table(
  'two_fa_challenges',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    options: t.varchar('options', { length: 20 }).notNull(),
    correctNum: t.varchar('correct_num', { length: 2 }).notNull(),
    status: t
      .varchar('status', { length: 10, enum: ['PENDING', 'APPROVED', 'DENIED', 'EXPIRED'] })
      .notNull()
      .default('PENDING'),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: t.timestamp('expires_at', { withTimezone: true }).notNull(),
    respondedAt: t.timestamp('responded_at', { withTimezone: true }),
  },
  (table) => [t.index().on(table.userId), t.index().on(table.status)],
);

export type TwoFaChallenges$Insert = typeof twoFaChallenges.$inferInsert;
export type TwoFaChallenges$Select = typeof twoFaChallenges.$inferSelect;

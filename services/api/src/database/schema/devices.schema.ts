import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const devices = table(
  'devices',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pushToken: t.text('push_token').notNull().unique(),
    userAgent: t.varchar('user_agent', { length: 500 }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.userId), t.index().on(table.pushToken)],
);

export type Devices$Insert = typeof devices.$inferInsert;
export type Devices$Select = typeof devices.$inferSelect;

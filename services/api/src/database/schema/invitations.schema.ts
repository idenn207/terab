import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const invitations = table(
  'invitations',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    token: t.uuid('token').notNull().unique().defaultRandom(),
    createdBy: t
      .uuid('created_by')
      .notNull()
      .references(() => users.id),
    usedBy: t.uuid('used_by').references(() => users.id),
    usedAt: t.timestamp('used_at', { withTimezone: true }),
    expiresAt: t.timestamp('expires_at', { withTimezone: true }).notNull(),
    deactivatedAt: t.timestamp('deactivated_at', { withTimezone: true }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.usedAt), t.index().on(table.expiresAt), t.index().on(table.createdAt)],
);

export type Invitations$Insert = typeof invitations.$inferInsert;
export type Invitations$Select = typeof invitations.$inferSelect;

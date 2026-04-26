import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';

export const users = table(
  'users',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    username: t.varchar('username', { length: 50 }).notNull().unique(),
    nickname: t.varchar('nickname', { length: 100 }).notNull(),
    email: t.varchar('email', { length: 255 }).unique(),
    password: t.varchar('password', { length: 255 }).notNull(),
    active: t.boolean('active').notNull().default(true),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.uniqueIndex().on(table.username), t.index().on(table.nickname), t.index().on(table.createdAt)],
);

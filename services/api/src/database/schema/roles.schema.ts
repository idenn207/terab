import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';

export const roles = table('roles', {
  id: t.uuid('id').primaryKey().defaultRandom(),
  name: t.varchar('name', { length: 50 }).notNull().unique(),
  isSystem: t.boolean('is_system').notNull().default(false),
  createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Roles$Insert = typeof roles.$inferInsert;
export type Roles$Select = typeof roles.$inferSelect;

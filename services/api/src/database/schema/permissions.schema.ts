import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';

export const permissions = table(
  'permissions',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    resource: t.varchar('resource', { length: 50 }).notNull(),
    action: t.varchar('action', { length: 50 }).notNull(),
  },
  (table) => [t.unique().on(table.resource, table.action)],
);

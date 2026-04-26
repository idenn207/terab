import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { roles } from './roles.schema';
import { users } from './users.schema';

export const userRoles = table(
  'user_roles',
  {
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: t
      .uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (table) => [t.primaryKey({ columns: [table.userId, table.roleId] })],
);

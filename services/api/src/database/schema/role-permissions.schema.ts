import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { permissions } from './permissions.schema';
import { roles } from './roles.schema';

export const rolePermissions = table(
  'role_permissions',
  {
    roleId: t
      .uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: t
      .uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [t.primaryKey({ columns: [table.roleId, table.permissionId] })],
);

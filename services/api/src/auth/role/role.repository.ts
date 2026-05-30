import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
  RepositoryCore,
  TransactionContext,
  UserRoles$Insert,
  permissions,
  rolePermissions,
  roles,
  userRoles,
} from '@terab/db';
import { eq, inArray } from 'drizzle-orm';

@Injectable()
export class RoleRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findByName(name: string): Promise<{ id: string } | null> {
    const [row = null] = await this.conn.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
    return row;
  }

  async insertUserRole(userId: UserRoles$Insert['userId'], roleId: UserRoles$Insert['roleId']): Promise<void> {
    await this.conn.insert(userRoles).values({ userId, roleId });
  }

  async findPermissionsByUserId(userId: string): Promise<string[]> {
    const rows = await this.conn
      .select({ resource: permissions.resource, action: permissions.action })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, userId));
    return [...new Set(rows.map((r) => `${r.resource}:${r.action}`))];
  }

  async findRoleNamesByUserIds(userIds: string[]): Promise<Array<{ userId: string; name: string }>> {
    return this.conn
      .select({ userId: userRoles.userId, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(inArray(userRoles.userId, userIds))
      .orderBy(userRoles.userId, roles.name);
  }
}

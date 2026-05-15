import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
  RepositoryCore,
  TransactionContext,
  permissions,
  rolePermissions,
  roles,
  twoFaChallenges,
  userRoles,
  users,
  type TwoFaChallenges$Insert,
} from '@terab/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class TwoFaRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async insert(data: Pick<TwoFaChallenges$Insert, 'userId' | 'options' | 'correctNum' | 'expiresAt'>) {
    const [row] = await this.conn.insert(twoFaChallenges).values(data).returning();
    return row;
  }

  async findById(id: string) {
    const [twoFa] = await this.conn.select().from(twoFaChallenges).where(eq(twoFaChallenges.id, id));
    return twoFa;
  }

  async updateStatus(
    id: string,
    status: NonNullable<TwoFaChallenges$Insert['status']>,
    respondedAt?: TwoFaChallenges$Insert['respondedAt'],
  ): Promise<void> {
    await this.conn.update(twoFaChallenges).set({ status, respondedAt }).where(eq(twoFaChallenges.id, id));
  }

  async findUserWithPermissionsById(userId: string) {
    const rows = await this.conn
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        resource: permissions.resource,
        action: permissions.action,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(users.id, userId));
    if (!rows.length) return null;
    const first = rows[0];
    return {
      id: first.id,
      username: first.username,
      nickname: first.nickname,
      permissions: rows.filter((r) => r.resource && r.action).map((r) => `${r.resource}:${r.action}`),
    };
  }
}

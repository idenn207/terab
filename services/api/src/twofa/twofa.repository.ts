import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
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
export class TwoFaRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(data: Pick<TwoFaChallenges$Insert, 'userId' | 'options' | 'correctNum' | 'expiresAt'>) {
    const [row] = await this.database.db.insert(twoFaChallenges).values(data).returning();
    return row;
  }

  async findById(id: string) {
    const [twoFa] = await this.database.db.select().from(twoFaChallenges).where(eq(twoFaChallenges.id, id));
    return twoFa;
  }

  async updateStatus(
    id: string,
    status: NonNullable<TwoFaChallenges$Insert['status']>,
    respondedAt?: TwoFaChallenges$Insert['respondedAt'],
  ): Promise<void> {
    await this.database.db.update(twoFaChallenges).set({ status, respondedAt }).where(eq(twoFaChallenges.id, id));
  }

  async findUserWithPermissionsById(userId: string) {
    const rows = await this.database.db
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

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  backupCodes,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '../database/schema/index';

export interface UserWithPermissions {
  id: string;
  username: string;
  nickname: string;
  password: string;
  active: boolean;
  permissions: string[];
}

export interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface BackupCodeRow {
  id: string;
  codeHash: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  async findUserWithPermissionsByUsername(username: string): Promise<UserWithPermissions | null> {
    const rows = await this.database.db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        password: users.password,
        active: users.active,
        resource: permissions.resource,
        action: permissions.action,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(users.username, username));

    if (!rows.length) return null;
    return this.aggregateUser(rows);
  }

  async findUserWithPermissionsById(id: string): Promise<UserWithPermissions | null> {
    const rows = await this.database.db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        password: users.password,
        active: users.active,
        resource: permissions.resource,
        action: permissions.action,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(users.id, id));

    if (!rows.length) return null;
    return this.aggregateUser(rows);
  }

  async findActiveRefreshTokens(now: Date): Promise<RefreshTokenRow[]> {
    return this.database.db
      .select()
      .from(refreshTokens)
      .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)));
  }

  async insertRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.database.db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  }

  async revokeRefreshTokenById(id: string, revokedAt: Date): Promise<void> {
    await this.database.db.update(refreshTokens).set({ revokedAt }).where(eq(refreshTokens.id, id));
  }

  async findUnusedBackupCodes(userId: string): Promise<BackupCodeRow[]> {
    return this.database.db
      .select({ id: backupCodes.id, codeHash: backupCodes.codeHash })
      .from(backupCodes)
      .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
  }

  async markBackupCodeUsed(id: string, usedAt: Date): Promise<void> {
    await this.database.db.update(backupCodes).set({ usedAt }).where(eq(backupCodes.id, id));
  }

  async findUserByUsername(username: string): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return rows[0] ?? null;
  }

  async findRoleByName(name: string): Promise<{ id: string } | null> {
    const rows = await this.database.db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
    return rows[0] ?? null;
  }

  async insertUser(data: { username: string; nickname: string; password: string }): Promise<{ id: string }> {
    const [row] = await this.database.db.insert(users).values(data).returning({ id: users.id });
    if (!row) throw new InternalServerErrorException('사용자 생성 실패');
    return row;
  }

  async insertUserRole(userId: string, roleId: string): Promise<void> {
    await this.database.db.insert(userRoles).values({ userId, roleId });
  }

  private aggregateUser(
    rows: Array<{
      id: string;
      username: string;
      nickname: string;
      password: string;
      active: boolean;
      resource: string | null;
      action: string | null;
    }>,
  ): UserWithPermissions {
    const first = rows[0];
    const permSet = new Set(rows.filter((r) => r.resource && r.action).map((r) => `${r.resource}:${r.action}`));
    return {
      id: first.id,
      username: first.username,
      nickname: first.nickname,
      password: first.password,
      active: first.active,
      permissions: [...permSet],
    };
  }
}

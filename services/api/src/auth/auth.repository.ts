import { Injectable } from '@nestjs/common';
import {
  BackupCodes$Insert,
  DatabaseService,
  Permissions$Select,
  RefreshTokens$Insert,
  RepositoryCore,
  TransactionContext,
  UserRoles$Insert,
  Users$Insert,
  Users$Select,
  backupCodes,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '@terab/db';
import { ApiException } from '@terab/common';
import { and, eq, gt, isNull } from 'drizzle-orm';

export interface UserWithPermissions {
  id: string;
  username: string;
  nickname: string;
  password: string;
  active: boolean;
  permissions: string[];
}

@Injectable()
export class AuthRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findUserWithPermissionsByUsername(username: string): Promise<UserWithPermissions | null> {
    const rows = await this.conn
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
    const rows = await this.conn
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

  async findActiveRefreshTokenByHash(tokenHash: string, now: Date) {
    const [row = null] = await this.conn
      .select()
      .from(refreshTokens)
      .where(
        and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)),
      )
      .limit(1);
    return row;
  }

  async insertRefreshToken(data: Pick<RefreshTokens$Insert, 'userId' | 'tokenHash' | 'expiresAt'>): Promise<void> {
    await this.conn.insert(refreshTokens).values(data);
  }

  async revokeRefreshTokenById(id: string, revokedAt: RefreshTokens$Insert['revokedAt']): Promise<void> {
    await this.conn.update(refreshTokens).set({ revokedAt }).where(eq(refreshTokens.id, id));
  }

  async findUnusedBackupCodes(userId: string) {
    return this.conn
      .select({ id: backupCodes.id, codeHash: backupCodes.codeHash })
      .from(backupCodes)
      .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
  }

  async markBackupCodeUsed(id: string, usedAt: BackupCodes$Insert['usedAt']): Promise<void> {
    await this.conn.update(backupCodes).set({ usedAt }).where(eq(backupCodes.id, id));
  }

  async findUserByUsername(username: string) {
    const [row = null] = await this.conn
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return row;
  }

  async findRoleByName(name: string) {
    const [row = null] = await this.conn
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);
    return row;
  }

  async insertUser(data: Pick<Users$Insert, 'username' | 'nickname' | 'password'>) {
    const [row] = await this.conn.insert(users).values(data).returning({ id: users.id });
    if (!row) throw new ApiException('REGISTRATION_FAILED');
    return row;
  }

  async insertUserRole(userId: UserRoles$Insert['userId'], roleId: UserRoles$Insert['roleId']): Promise<void> {
    await this.conn.insert(userRoles).values({ userId, roleId });
  }

  private aggregateUser(
    rows: Combine<
      Pick<Users$Select, 'id' | 'username' | 'nickname' | 'password' | 'active'>,
      NullableRecord<Pick<Permissions$Select, 'action' | 'resource'>>
    >[],
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

  async insertBackupCodes(
    userId: BackupCodes$Insert['userId'],
    codeHashes: BackupCodes$Insert['codeHash'][],
  ): Promise<void> {
    await this.conn.insert(backupCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })));
  }
}

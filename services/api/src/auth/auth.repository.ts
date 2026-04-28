import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  BackupCodes$Insert,
  DatabaseService,
  Permissions$Select,
  RefreshTokens$Insert,
  UserRoles$Insert,
  Users$Insert,
  Users$Select,
  backupCodes,
  invitations,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '@terab/db';
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

  async findActiveRefreshTokenByHash(tokenHash: string, now: Date) {
    const [row = null] = await this.database.db
      .select()
      .from(refreshTokens)
      .where(
        and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)),
      )
      .limit(1);
    return row;
  }

  async insertRefreshToken(data: Pick<RefreshTokens$Insert, 'userId' | 'tokenHash' | 'expiresAt'>): Promise<void> {
    await this.database.db.insert(refreshTokens).values(data);
  }

  async revokeRefreshTokenById(id: string, revokedAt: RefreshTokens$Insert['revokedAt']): Promise<void> {
    await this.database.db.update(refreshTokens).set({ revokedAt }).where(eq(refreshTokens.id, id));
  }

  async findUnusedBackupCodes(userId: string) {
    return this.database.db
      .select({ id: backupCodes.id, codeHash: backupCodes.codeHash })
      .from(backupCodes)
      .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
  }

  async markBackupCodeUsed(id: string, usedAt: BackupCodes$Insert['usedAt']): Promise<void> {
    await this.database.db.update(backupCodes).set({ usedAt }).where(eq(backupCodes.id, id));
  }

  async findUserByUsername(username: string) {
    const [row = null] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return row;
  }

  async findRoleByName(name: string) {
    const [row = null] = await this.database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);
    return row;
  }

  async insertUser(data: Pick<Users$Insert, 'username' | 'nickname' | 'password'>) {
    const [row] = await this.database.db.insert(users).values(data).returning({ id: users.id });
    if (!row) throw new InternalServerErrorException('사용자 생성 실패');
    return row;
  }

  async insertUserRole(userId: UserRoles$Insert['userId'], roleId: UserRoles$Insert['roleId']): Promise<void> {
    await this.database.db.insert(userRoles).values({ userId, roleId });
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
    await this.database.db.insert(backupCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })));
  }

  // ─── Register ────────────────────────────────────────────────────────

  async registerUser(data: {
    username: string;
    nickname: string;
    password: string;
    roleId: string;
    codeHashes: string[];
    invitationToken: string;
  }): Promise<{ id: string }> {
    return this.database.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({ username: data.username, nickname: data.nickname, password: data.password })
        .returning({ id: users.id });
      if (!newUser) throw new InternalServerErrorException('사용자 생성 실패');

      await tx.insert(userRoles).values({ userId: newUser.id, roleId: data.roleId });
      await tx.insert(backupCodes).values(data.codeHashes.map((codeHash) => ({ userId: newUser.id, codeHash })));
      const updated = await tx
        .update(invitations)
        .set({ usedAt: new Date(), usedBy: newUser.id })
        .where(and(eq(invitations.token, data.invitationToken), isNull(invitations.usedAt)))
        .returning({ id: invitations.id });

      if (updated.length === 0) throw new ConflictException('INVITATION_ALREADY_USED');
      return newUser;
    });
  }

  // ─── Login ───────────────────────────────────────────────────────────
}

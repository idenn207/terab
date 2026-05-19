import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

@Injectable()
export class RbacSeeder {
  private readonly PERMISSIONS = [
    { resource: 'file', action: 'read' },
    { resource: 'file', action: 'write' },
    { resource: 'file', action: 'delete' },
    { resource: 'share', action: 'create' },
    { resource: 'share', action: 'manage' },
    { resource: 'user', action: 'read' },
    { resource: 'user', action: 'invite' },
    { resource: 'user', action: 'manage' },
    { resource: 'user', action: 'role' },
    { resource: 'storage', action: 'read' },
    { resource: 'storage', action: 'manage' },
    { resource: 'system', action: 'monitor' },
    { resource: 'system', action: 'config' },
    { resource: 'audit', action: 'read' },
  ] as const;

  private readonly ROLE_PERMISSIONS: Record<string, string[]> = {
    USER: ['file:read', 'file:write', 'file:delete', 'share:create', 'storage:read'],
    ADMIN: [
      'file:read',
      'file:write',
      'file:delete',
      'share:create',
      'storage:read',
      'share:manage',
      'user:read',
      'user:invite',
      'user:manage',
      'storage:manage',
      'system:monitor',
      'audit:read',
    ],
    OWNER: this.PERMISSIONS.map((p) => `${p.resource}:${p.action}`),
  };

  async seed(db: NodePgDatabase<typeof schema>): Promise<void> {
    await db
      .insert(schema.permissions)
      .values([...this.PERMISSIONS])
      .onConflictDoNothing();

    await db
      .insert(schema.roles)
      .values([
        { name: 'OWNER', isSystem: true },
        { name: 'ADMIN', isSystem: true },
        { name: 'USER', isSystem: true },
      ])
      .onConflictDoNothing();

    const allRoles = await db.select().from(schema.roles);
    const allPermissions = await db.select().from(schema.permissions);

    const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));
    const permMap = Object.fromEntries(allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id]));

    const entries = Object.entries(this.ROLE_PERMISSIONS).flatMap(([roleName, perms]) =>
      perms
        .filter((perm) => roleMap[roleName] && permMap[perm])
        .map((perm) => ({ roleId: roleMap[roleName], permissionId: permMap[perm] })),
    );

    if (entries.length > 0) {
      await db.insert(schema.rolePermissions).values(entries).onConflictDoNothing();
    }
  }
}

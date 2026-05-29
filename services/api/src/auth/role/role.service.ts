import { Injectable } from '@nestjs/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { RoleRepository } from './role.repository';

@Injectable()
export class RoleService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly roleRepository: RoleRepository,
  ) {
    super(database, txContext);
  }

  async findByName(name: string): Promise<{ id: string } | null> {
    return this.roleRepository.findByName(name);
  }

  async assignUserRole(userId: string, roleId: string): Promise<void> {
    await this.roleRepository.insertUserRole(userId, roleId);
  }

  async getPermissionsByUserId(userId: string): Promise<string[]> {
    return this.roleRepository.findPermissionsByUserId(userId);
  }

  async getRoleNamesByUserIds(userIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (userIds.length === 0) return result;
    const rows = await this.roleRepository.findRoleNamesByUserIds(userIds);
    for (const { userId, name } of rows) {
      const existing = result.get(userId);
      if (existing) {
        existing.push(name);
      } else {
        result.set(userId, [name]);
      }
    }
    return result;
  }
}

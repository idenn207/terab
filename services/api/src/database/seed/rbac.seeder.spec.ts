import { RbacSeeder } from './rbac.seeder';

describe('RbacSeeder', () => {
  let seeder: RbacSeeder;

  beforeEach(() => {
    seeder = new RbacSeeder();
  });

  describe('seed', () => {
    it('permissions·roles·role_permissions를 onConflictDoNothing으로 insert한다', async () => {
      const permsOnConflict = jest.fn().mockResolvedValue(undefined);
      const rolesOnConflict = jest.fn().mockResolvedValue(undefined);
      const rolePermOnConflict = jest.fn().mockResolvedValue(undefined);
      const insertCalls: unknown[] = [];

      const db = {
        insert: jest.fn().mockImplementation((table) => {
          insertCalls.push(table);
          return {
            values: jest.fn().mockReturnValue({
              onConflictDoNothing:
                insertCalls.length === 1
                  ? permsOnConflict
                  : insertCalls.length === 2
                    ? rolesOnConflict
                    : rolePermOnConflict,
            }),
          };
        }),
        select: jest.fn().mockReturnValue({
          from: jest
            .fn()
            .mockResolvedValueOnce([
              { id: 'role-owner', name: 'OWNER' },
              { id: 'role-admin', name: 'ADMIN' },
              { id: 'role-user', name: 'USER' },
            ])
            .mockResolvedValueOnce([
              { id: 'perm-1', resource: 'file', action: 'read' },
              { id: 'perm-2', resource: 'file', action: 'write' },
            ]),
        }),
      };

      await seeder.seed(db as never);

      expect(permsOnConflict).toHaveBeenCalled();
      expect(rolesOnConflict).toHaveBeenCalled();
      expect(rolePermOnConflict).toHaveBeenCalled();
    });

    it('role-permission 매핑이 비어 있으면 role_permissions insert를 건너뛴다', async () => {
      const onConflictDoNothing = jest.fn().mockResolvedValue(undefined);
      const db = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({ onConflictDoNothing }),
        }),
        select: jest.fn().mockReturnValue({
          from: jest
            .fn()
            // 빈 roles → roleMap이 비어 매핑 entries 0개
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
        }),
      };

      await seeder.seed(db as never);

      // permissions + roles insert만 호출되어야 함 (총 2회)
      expect(db.insert).toHaveBeenCalledTimes(2);
    });
  });
});

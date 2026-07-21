import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { RoleRepository } from './role.repository';
import { RoleService } from './role.service';

const mockRoleRepository = {
  findByName: jest.fn(),
  insertUserRole: jest.fn(),
  findPermissionsByUserId: jest.fn(),
  findRoleNamesByUserIds: jest.fn(),
};

describe('RoleService', () => {
  let service: RoleService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: RoleRepository, useValue: mockRoleRepository },
      ],
    }).compile();

    service = module.get(RoleService);
    jest.clearAllMocks();
  });

  describe('getPermissionsByUserId', () => {
    it('userId의 권한 배열이 비어 있으면 빈 배열을 반환한다', async () => {
      mockRoleRepository.findPermissionsByUserId.mockResolvedValue([]);

      const result = await service.getPermissionsByUserId('user-1');

      expect(result).toEqual([]);
    });

    it('RoleRepository에서 반환된 권한 배열을 그대로 전달한다', async () => {
      mockRoleRepository.findPermissionsByUserId.mockResolvedValue(['file:read']);

      const result = await service.getPermissionsByUserId('user-1');

      expect(result).toEqual(['file:read']);
    });
  });

  describe('getRoleNamesByUserIds', () => {
    it('빈 배열을 받으면 빈 Map을 반환하고 repository를 호출하지 않는다', async () => {
      const result = await service.getRoleNamesByUserIds([]);

      expect(result).toEqual(new Map());
      expect(mockRoleRepository.findRoleNamesByUserIds).not.toHaveBeenCalled();
    });

    it('userId별로 role 이름을 그룹핑한 Map을 반환한다', async () => {
      mockRoleRepository.findRoleNamesByUserIds.mockResolvedValue([
        { userId: 'u1', name: 'ADMIN' },
        { userId: 'u1', name: 'USER' },
        { userId: 'u2', name: 'USER' },
      ]);

      const result = await service.getRoleNamesByUserIds(['u1', 'u2']);

      expect(mockRoleRepository.findRoleNamesByUserIds).toHaveBeenCalledWith(['u1', 'u2']);
      expect(result.get('u1')).toEqual(['ADMIN', 'USER']);
      expect(result.get('u2')).toEqual(['USER']);
    });

    it('역할이 없는 userId는 Map에 등장하지 않는다', async () => {
      mockRoleRepository.findRoleNamesByUserIds.mockResolvedValue([]);

      const result = await service.getRoleNamesByUserIds(['u1', 'u2']);

      expect(result.size).toBe(0);
    });
  });
});

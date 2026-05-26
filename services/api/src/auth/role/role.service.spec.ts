import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { RoleRepository } from './role.repository';
import { RoleService } from './role.service';

const mockRoleRepository = {
  findByName: jest.fn(),
  insertUserRole: jest.fn(),
  findPermissionsByUserId: jest.fn(),
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
});

import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbFrom,
  mockDbLimit,
  mockDbSelect,
  mockDbWhere,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
import { RoleRepository } from './role.repository';

describe('RoleRepository', () => {
  let repo: RoleRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RoleRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get(RoleRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  describe('findByName', () => {
    it('일치하는 role이 없으면 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findByName('GHOST');

      expect(result).toBeNull();
    });
  });

  describe('findRoleNamesByUserIds', () => {
    it('userIds에 대응하는 (userId, name) 행 배열을 그대로 반환한다', async () => {
      const rows = [
        { userId: 'u1', name: 'ADMIN' },
        { userId: 'u1', name: 'USER' },
        { userId: 'u2', name: 'USER' },
      ];
      // findRoleNamesByUserIds는 select().from(userRoles).innerJoin(roles, ...).where(...)에서 종료
      // → mockDbWhere를 최종 resolve 지점으로 설정
      const mockInnerJoin = jest.fn().mockReturnValue({ where: mockDbWhere });
      mockDbFrom.mockReturnValue({ innerJoin: mockInnerJoin });
      mockDbWhere.mockResolvedValue(rows);

      const result = await repo.findRoleNamesByUserIds(['u1', 'u2']);

      expect(mockDbSelect).toHaveBeenCalled();
      expect(result).toEqual(rows);
    });

    it('일치하는 행이 없으면 빈 배열을 반환한다', async () => {
      const mockInnerJoin = jest.fn().mockReturnValue({ where: mockDbWhere });
      mockDbFrom.mockReturnValue({ innerJoin: mockInnerJoin });
      mockDbWhere.mockResolvedValue([]);

      const result = await repo.findRoleNamesByUserIds(['u1']);

      expect(result).toEqual([]);
    });
  });
});

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
      // findRoleNamesByUserIds는 select().from(userRoles).innerJoin(...).where(...).orderBy(...)에서 종료
      // → orderBy를 최종 resolve 지점으로 설정
      const mockOrderBy = jest.fn().mockResolvedValue(rows);
      const mockInnerJoin = jest.fn().mockReturnValue({
        where: mockDbWhere.mockReturnValue({ orderBy: mockOrderBy }),
      });
      mockDbFrom.mockReturnValue({ innerJoin: mockInnerJoin });

      const result = await repo.findRoleNamesByUserIds(['u1', 'u2']);

      expect(mockDbSelect).toHaveBeenCalled();
      expect(result).toEqual(rows);
    });

    it('결정성 보장을 위해 (userId, name) asc 정렬을 적용한다', async () => {
      // 결정성 verification — DataLoader caller 가 동일 userId 의 role 순서를 가정해도
      // postgres 가 row 순서를 보장하지 않으므로 .orderBy 필수 (PR #70 review M-2)
      const mockOrderBy = jest.fn().mockResolvedValue([]);
      const mockInnerJoin = jest.fn().mockReturnValue({
        where: mockDbWhere.mockReturnValue({ orderBy: mockOrderBy }),
      });
      mockDbFrom.mockReturnValue({ innerJoin: mockInnerJoin });

      await repo.findRoleNamesByUserIds(['u1']);

      expect(mockOrderBy).toHaveBeenCalledTimes(1);
      // (userRoles.userId, roles.name) 두 컬럼이 인자로 전달됐는지 — drizzle column 객체
      expect(mockOrderBy.mock.calls[0]).toHaveLength(2);
    });

    it('일치하는 행이 없으면 빈 배열을 반환한다', async () => {
      const mockOrderBy = jest.fn().mockResolvedValue([]);
      const mockInnerJoin = jest.fn().mockReturnValue({
        where: mockDbWhere.mockReturnValue({ orderBy: mockOrderBy }),
      });
      mockDbFrom.mockReturnValue({ innerJoin: mockInnerJoin });

      const result = await repo.findRoleNamesByUserIds(['u1']);

      expect(result).toEqual([]);
    });
  });
});

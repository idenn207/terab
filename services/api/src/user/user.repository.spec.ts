import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbFrom,
  mockDbInsert,
  mockDbLimit,
  mockDbSelect,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repo: UserRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get(UserRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  describe('findById', () => {
    it('일치하는 행이 없으면 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findById('ghost-id');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('일치하는 행이 없으면 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findByUsername('ghost');

      expect(result).toBeNull();
    });
  });

  describe('insert', () => {
    it('insert가 row를 반환하지 않으면 REGISTRATION_FAILED 예외를 던진다', async () => {
      const mockReturning = jest.fn().mockResolvedValue([]);
      mockDbInsert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: mockReturning }),
      });

      await expect(repo.insert({ username: 'x', nickname: 'y', password: 'z' })).rejects.toMatchObject({
        code: 'REGISTRATION_FAILED',
      });
    });
  });

  describe('listUsers', () => {
    it('items 쿼리(orderBy → limit → offset)와 count 쿼리를 결합해 {items, total}을 반환한다', async () => {
      const items = [
        { id: 'u1', username: 'admin1', nickname: 'Admin', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'u2', username: 'user1', nickname: 'User', createdAt: new Date('2025-12-15T00:00:00Z') },
      ];
      const mockOffset = jest.fn().mockResolvedValue(items);
      const mockItemsLimit = jest.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = jest.fn().mockReturnValue({ limit: mockItemsLimit });
      const mockItemsFrom = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockCountFrom = jest.fn().mockResolvedValue([{ value: 17 }]);

      // 1번째 select() = items 쿼리, 2번째 select() = count 쿼리
      mockDbSelect.mockReturnValueOnce({ from: mockItemsFrom }).mockReturnValueOnce({ from: mockCountFrom });

      const result = await repo.listUsers(10, 20);

      expect(mockItemsFrom).toHaveBeenCalled();
      expect(mockItemsLimit).toHaveBeenCalledWith(10);
      expect(mockOffset).toHaveBeenCalledWith(20);
      expect(result).toEqual({ items, total: 17 });
    });

    it('항목이 없으면 items=[]/total=0을 반환한다', async () => {
      const mockOffset = jest.fn().mockResolvedValue([]);
      const mockItemsLimit = jest.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = jest.fn().mockReturnValue({ limit: mockItemsLimit });
      const mockItemsFrom = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockCountFrom = jest.fn().mockResolvedValue([{ value: 0 }]);

      mockDbSelect.mockReturnValueOnce({ from: mockItemsFrom }).mockReturnValueOnce({ from: mockCountFrom });

      const result = await repo.listUsers(50, 0);

      expect(result).toEqual({ items: [], total: 0 });
    });
  });
});

import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbInsert,
  mockDbLimit,
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

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
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
});

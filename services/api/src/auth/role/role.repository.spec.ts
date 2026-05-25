import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockDbLimit, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
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

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  describe('findByName', () => {
    it('일치하는 role이 없으면 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findByName('GHOST');

      expect(result).toBeNull();
    });
  });
});

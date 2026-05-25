import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockDbLimit, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
import { TotpRepository } from './totp.repository';

describe('TotpRepository', () => {
  let repo: TotpRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TotpRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();
    repo = module.get(TotpRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  describe('findByUserId', () => {
    it('userId에 등록된 TOTP가 없으면 null', async () => {
      mockDbLimit.mockResolvedValue([]);
      const result = await repo.findByUserId('user-1');
      expect(result).toBeNull();
    });

    it('userId에 등록된 TOTP가 있으면 row 반환', async () => {
      const row = {
        id: 'totp-1',
        userId: 'user-1',
        secretEncrypted: Buffer.from([1, 2]),
        iv: Buffer.from([3]),
        authTag: Buffer.from([4]),
        algorithm: 'SHA1',
        digits: 6,
        periodSec: 30,
        createdAt: new Date(),
        lastUsedAt: null,
      };
      mockDbLimit.mockResolvedValue([row]);
      const result = await repo.findByUserId('user-1');
      expect(result).toEqual(row);
    });
  });
});

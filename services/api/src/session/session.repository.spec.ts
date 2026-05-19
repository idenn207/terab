import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbLimit,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
import { SessionRepository } from './session.repository';

describe('SessionRepository', () => {
  let repo: SessionRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SessionRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get(SessionRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  describe('findActiveByHash', () => {
    const now = new Date('2025-01-01T00:00:00.000Z');

    const activeToken = {
      id: 'token-uuid-1',
      userId: 'user-uuid-1',
      tokenHash: 'valid-hash',
      expiresAt: new Date('2025-01-02T00:00:00.000Z'),
      revokedAt: null,
    };

    it('일치하는 hash가 없으면 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findActiveByHash('wrong-hash', now);

      expect(result).toBeNull();
    });

    it('토큰이 만료된 경우(expiresAt < now)는 DB where 절이 거르므로 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findActiveByHash('valid-hash', now);

      expect(result).toBeNull();
    });

    it('이미 revoke된 토큰은 DB where 절이 거르므로 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findActiveByHash('valid-hash', now);

      expect(result).toBeNull();
    });

    it('유효한 활성 토큰이 있으면 해당 행을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([activeToken]);

      const result = await repo.findActiveByHash('valid-hash', now);

      expect(result).toEqual(activeToken);
    });
  });
});

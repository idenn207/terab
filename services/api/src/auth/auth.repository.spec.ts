import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockDbInsert, mockDbLimit, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
import { AuthRepository } from './auth.repository';

describe('AuthRepository', () => {
  let repo: AuthRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get(AuthRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  describe('findActiveRefreshTokenByHash', () => {
    const now = new Date('2025-01-01T00:00:00.000Z');

    const activeToken = {
      id: 'token-uuid-1',
      userId: 'user-uuid-1',
      tokenHash: 'valid-hash',
      expiresAt: new Date('2025-01-02T00:00:00.000Z'), // now 이후
      revokedAt: null,
    };

    it('유효한 hash와 만료되지 않은 토큰이 있으면 해당 행을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([activeToken]);

      const result = await repo.findActiveRefreshTokenByHash('valid-hash', now);

      expect(result).toEqual(activeToken);
    });

    it('일치하는 hash가 없으면 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findActiveRefreshTokenByHash('wrong-hash', now);

      expect(result).toBeNull();
    });

    it('토큰이 만료된 경우(expiresAt < now) null을 반환한다', async () => {
      // where 절에서 gt(expiresAt, now) 조건으로 DB가 행을 반환하지 않는 상황을 시뮬레이션
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findActiveRefreshTokenByHash('valid-hash', now);

      expect(result).toBeNull();
    });

    it('이미 revoke된 토큰(revokedAt이 있음)이면 null을 반환한다', async () => {
      // where 절에서 isNull(revokedAt) 조건으로 DB가 행을 반환하지 않는 상황을 시뮬레이션
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findActiveRefreshTokenByHash('valid-hash', now);

      expect(result).toBeNull();
    });
  });

  describe('insertUser', () => {
    it('insert가 row를 반환하지 않으면 REGISTRATION_FAILED 예외를 던진다', async () => {
      const mockReturning = jest.fn().mockResolvedValue([]);
      mockDbInsert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: mockReturning }),
      });

      await expect(
        repo.insertUser({ username: 'x', nickname: 'y', password: 'z' }),
      ).rejects.toMatchObject({ code: 'REGISTRATION_FAILED' });
    });
  });
});

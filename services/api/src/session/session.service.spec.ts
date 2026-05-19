import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { TokenService } from '@terab/security';
import {
  mockDatabaseService,
  mockDbTransaction,
  mockTransactionContext,
  setupMockDbTransactionChain,
} from '@terab/test';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';

const mockSessionRepository = {
  findActiveByHash: jest.fn(),
  insert: jest.fn(),
  revokeById: jest.fn(),
};

const mockTokenService = {
  issueRefreshToken: jest.fn(),
  hashToken: jest.fn(),
  refreshExpMs: 86400000,
};

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TokenService, useValue: mockTokenService },
        { provide: SessionRepository, useValue: mockSessionRepository },
      ],
    }).compile();

    service = module.get(SessionService);
    jest.clearAllMocks();
    setupMockDbTransactionChain();
    mockTokenService.issueRefreshToken.mockReturnValue({
      rawRefreshToken: 'raw-token',
      tokenHash: 'hash',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    mockSessionRepository.insert.mockResolvedValue(undefined);
    mockSessionRepository.revokeById.mockResolvedValue(undefined);
  });

  it('인스턴스가 생성된다', () => {
    expect(service).toBeDefined();
  });

  describe('issueForUser', () => {
    it('TokenService로 새 토큰을 만들고 SessionRepository에 insert한 뒤 raw + exp를 반환한다', async () => {
      const result = await service.issueForUser('user-1');

      expect(mockTokenService.issueRefreshToken).toHaveBeenCalled();
      expect(mockSessionRepository.insert).toHaveBeenCalledWith({
        userId: 'user-1',
        tokenHash: 'hash',
        expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      expect(result).toEqual({
        rawRefreshToken: 'raw-token',
        refreshTokenExpMs: 86400000,
      });
    });
  });

  describe('rotate', () => {
    it('일치하는 활성 토큰이 없으면 REFRESH_TOKEN_INVALID 예외를 던진다', async () => {
      mockTokenService.hashToken.mockReturnValue('h');
      mockSessionRepository.findActiveByHash.mockResolvedValue(null);

      await expect(service.rotate('raw')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALID' });
      expect(mockSessionRepository.revokeById).not.toHaveBeenCalled();
      expect(mockSessionRepository.insert).not.toHaveBeenCalled();
    });

    it('성공 시 revoke → insert 순서로 호출하고 새 토큰 + userId를 반환한다', async () => {
      mockTokenService.hashToken.mockReturnValue('h');
      mockSessionRepository.findActiveByHash.mockResolvedValue({ id: 'old-id', userId: 'user-1' });

      const result = await service.rotate('raw');

      const revokeOrder = mockSessionRepository.revokeById.mock.invocationCallOrder[0];
      const insertOrder = mockSessionRepository.insert.mock.invocationCallOrder[0];
      expect(revokeOrder).toBeLessThan(insertOrder);
      expect(mockDbTransaction).toHaveBeenCalled();
      expect(result).toEqual({
        userId: 'user-1',
        rawRefreshToken: 'raw-token',
        refreshTokenExpMs: 86400000,
      });
    });
  });

  describe('revokeByRawToken', () => {
    it('일치하는 활성 토큰이 없으면 revokeById를 호출하지 않는다', async () => {
      mockTokenService.hashToken.mockReturnValue('h');
      mockSessionRepository.findActiveByHash.mockResolvedValue(null);

      await service.revokeByRawToken('raw');

      expect(mockSessionRepository.revokeById).not.toHaveBeenCalled();
    });

    it('일치하는 토큰이 있으면 해당 id를 revoke한다', async () => {
      mockTokenService.hashToken.mockReturnValue('h');
      mockSessionRepository.findActiveByHash.mockResolvedValue({ id: 'tok-id' });

      await service.revokeByRawToken('raw');

      expect(mockSessionRepository.revokeById).toHaveBeenCalledWith('tok-id', expect.any(Date));
    });
  });
});

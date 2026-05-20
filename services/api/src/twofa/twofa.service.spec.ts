import { Test, TestingModule } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { TokenService } from '@terab/security';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

const mockPushStrategy = {
  type: 'PUSH' as const,
  startSetup: jest.fn(),
  completeSetup: jest.fn(),
  createChallenge: jest.fn(),
  verifyResponse: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
};

const mockRegistry = {
  get: jest.fn((type: string) => {
    if (type === 'PUSH') return mockPushStrategy;
    throw new ApiException('TWO_FA_STRATEGY_NOT_FOUND');
  }),
};

const mockTwoFaRepository = {
  insert: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
};

const mockTokenService = {
  generateAccessToken: jest.fn(),
};

describe('TwoFaService', () => {
  let service: TwoFaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFaService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TwoFaRepository, useValue: mockTwoFaRepository },
        { provide: TokenService, useValue: mockTokenService },
        { provide: TwoFaStrategyRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<TwoFaService>(TwoFaService);
    jest.clearAllMocks();
    mockRegistry.get.mockImplementation((type: string) => {
      if (type === 'PUSH') return mockPushStrategy;
      throw new ApiException('TWO_FA_STRATEGY_NOT_FOUND');
    });
  });

  describe('createChallenge', () => {
    it('PUSH strategy의 createChallenge에 위임한다', async () => {
      mockPushStrategy.createChallenge.mockResolvedValue({
        id: 'c1',
        userId: 'u',
        options: '47,82,13',
        correctNum: '47',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.createChallenge('u');

      expect(mockRegistry.get).toHaveBeenCalledWith('PUSH');
      expect(mockPushStrategy.createChallenge).toHaveBeenCalledWith('u');
      expect(result.id).toBe('c1');
    });
  });

  describe('getStatus', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.getStatus('id')).rejects.toThrow(ApiException);
    });

    it('PENDING + 미만료 → options/correctNum 포함 PENDING 응답', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const result = await service.getStatus('id');

      if (result.status !== 'PENDING') throw new Error('Expected PENDING');
      expect(result.options).toEqual(['47', '82', '13']);
      expect(result.correctNum).toBe('47');
      expect(result.remainingSeconds).toBeGreaterThan(0);
    });

    it('PENDING + 만료 → EXPIRED 처리', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const result = await service.getStatus('id');

      expect(result.status).toBe('EXPIRED');
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'EXPIRED');
    });

    it('APPROVED → accessToken + user 반환', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      mockTwoFaRepository.findUserWithPermissionsById.mockResolvedValue({
        id: 'u',
        username: 'user1',
        nickname: 'User',
        permissions: [],
      });
      mockTokenService.generateAccessToken.mockReturnValue('mock.access.token');

      const result = await service.getStatus('id');

      if (result.status !== 'APPROVED') throw new Error('Expected APPROVED');
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.user?.id).toBe('u');
    });
  });

  describe('respond', () => {
    it('PUSH strategy.verifyResponse에 위임한다', async () => {
      mockPushStrategy.verifyResponse.mockResolvedValue(true);

      await service.respond('c', 'u', '47');

      expect(mockRegistry.get).toHaveBeenCalledWith('PUSH');
      expect(mockPushStrategy.verifyResponse).toHaveBeenCalledWith('u', 'c', { selectedNumber: '47' });
    });
  });

  describe('claimApprovedChallenge', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.claimApprovedChallenge('id')).rejects.toThrow(ApiException);
    });

    it('APPROVED 챌린지를 EXPIRED로 전환하고 userId 반환', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const userId = await service.claimApprovedChallenge('id');

      expect(userId).toBe('u');
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'EXPIRED');
    });
  });

  describe('resend', () => {
    it('기존 PENDING 챌린지를 EXPIRED로 만들고 새 챌린지를 생성한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'old',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      mockPushStrategy.createChallenge.mockResolvedValue({
        id: 'new',
        userId: 'u',
        options: '11,22,33',
        correctNum: '22',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.resend('old');

      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('old', 'EXPIRED');
      expect(result.challengeId).toBe('new');
      expect(result.options).toEqual(['11', '22', '33']);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbTransactionChain } from '@terab/test';
import { AuthService } from '../auth/auth.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

type AnyStrategy = unknown;

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
  get: jest.fn<AnyStrategy, any[]>((type: string) => {
    if (type === 'PUSH') return mockPushStrategy;
    throw new ApiException('TWOFA_STRATEGY_NOT_FOUND');
  }),
};

const mockTwoFaRepository = {
  insert: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
};

const mockAuthService = {
  issueAfterTwoFa: jest.fn(),
  setTrustCookie: jest.fn(),
};

const mockTrustedDeviceService = {
  register: jest.fn(),
  trustDurationMs: 30 * 24 * 60 * 60 * 1000,
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
        { provide: AuthService, useValue: mockAuthService },
        { provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
        { provide: TwoFaStrategyRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<TwoFaService>(TwoFaService);
    jest.clearAllMocks();
    setupMockDbTransactionChain();
    mockTrustedDeviceService.register.mockReset();
    mockRegistry.get.mockImplementation((type: string) => {
      if (type === 'PUSH') return mockPushStrategy;
      throw new ApiException('TWOFA_STRATEGY_NOT_FOUND');
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
    it('챌린지가 없으면 ApiException(TWOFA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
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

    it('APPROVED 상태면 userId만 반환한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'ch-1',
        userId: 'u1',
        status: 'APPROVED',
        options: '1,2,3',
        correctNum: '2',
        expiresAt: new Date(Date.now() + 60000),
        respondedAt: new Date(),
      });

      const result = await service.getStatus('ch-1');

      expect(result).toEqual({ status: 'APPROVED', userId: 'u1' });
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
    it('챌린지가 없으면 ApiException(TWOFA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
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

  describe('completeChallenge', () => {
    it('type=PUSH면 claimApprovedChallenge에 위임하고 userId만 반환 (trustDevice 미지정)', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      const result = await service.completeChallenge('c', { type: 'PUSH' }, undefined);
      expect(result).toEqual({ userId: 'u' });
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('c', 'EXPIRED');
      expect(mockTrustedDeviceService.register).not.toHaveBeenCalled();
    });

    it('type=TOTP면 challenge가 PENDING이어야 하고, strategy.verifyResponse 호출 후 EXPIRED 처리', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      const totpStrategy = { type: 'TOTP', verifyResponse: jest.fn().mockResolvedValue(true) };
      mockRegistry.get.mockImplementation((t: string) => (t === 'TOTP' ? totpStrategy : mockPushStrategy));

      const result = await service.completeChallenge('c', { type: 'TOTP', code: '123456' }, undefined);

      expect(totpStrategy.verifyResponse).toHaveBeenCalledWith('u', 'c', { code: '123456' });
      expect(result).toEqual({ userId: 'u' });
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('c', 'EXPIRED');
    });

    it('type=TOTP인데 challenge가 PENDING이 아니면 TWO_FA_CHALLENGE_NOT_FOUND', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      await expect(service.completeChallenge('c', { type: 'TOTP', code: '1' }, undefined)).rejects.toMatchObject({
        code: 'TWOFA_CHALLENGE_NOT_FOUND',
      });
    });

    it('trustDevice=true 시 같은 흐름 안에서 TrustedDeviceService.register 호출 + rawTrustToken 반환', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      mockTrustedDeviceService.register.mockResolvedValue('raw-trust-1');

      const result = await service.completeChallenge('c', { type: 'PUSH', trustDevice: true }, 'Mozilla/UA');

      expect(mockTrustedDeviceService.register).toHaveBeenCalledWith('u', 'Mozilla/UA');
      expect(result).toEqual({ userId: 'u', rawTrustToken: 'raw-trust-1' });
    });

    it('trustDevice=false 시 register 미호출 + rawTrustToken 미반환', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const result = await service.completeChallenge('c', { type: 'PUSH', trustDevice: false }, 'UA');

      expect(mockTrustedDeviceService.register).not.toHaveBeenCalled();
      expect(result.rawTrustToken).toBeUndefined();
    });

    it('trustDevice=true 인데 register 실패 시 에러 전파 — 트랜잭션 rollback 으로 claim 도 무효', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      mockTrustedDeviceService.register.mockRejectedValue(new Error('db-down'));

      await expect(service.completeChallenge('c', { type: 'PUSH', trustDevice: true }, 'UA')).rejects.toThrow(
        'db-down',
      );
    });
  });

  describe('issueAuthenticatedResponse', () => {
    it('rawTrustToken 없으면 setTrustCookie 미호출', async () => {
      mockAuthService.issueAfterTwoFa.mockResolvedValue({ status: 'AUTHENTICATED' });

      await service.issueAuthenticatedResponse('u', {} as never);

      expect(mockAuthService.setTrustCookie).not.toHaveBeenCalled();
    });

    it('rawTrustToken 있으면 setTrustCookie 호출 (trustDurationMs 동봉)', async () => {
      mockAuthService.issueAfterTwoFa.mockResolvedValue({ status: 'AUTHENTICATED' });
      const res = {} as never;

      await service.issueAuthenticatedResponse('u', res, 'raw-trust-1');

      expect(mockAuthService.setTrustCookie).toHaveBeenCalledWith(
        res,
        'raw-trust-1',
        mockTrustedDeviceService.trustDurationMs,
      );
    });
  });

  describe('removeStrategy', () => {
    it('마지막 push-외 strategy면 TWOFA_LAST_STRATEGY_CANNOT_REMOVE', async () => {
      const totpStrategy = {
        type: 'TOTP',
        list: jest.fn().mockResolvedValue([{ id: 'totp-1', createdAt: new Date(), lastUsedAt: null }]),
        revoke: jest.fn(),
      };
      const backupCodeStrategy = { type: 'BACKUP_CODE', list: jest.fn().mockResolvedValue([]), revoke: jest.fn() };
      mockRegistry.get.mockImplementation((t: string) => {
        if (t === 'TOTP') return totpStrategy;
        if (t === 'BACKUP_CODE') return backupCodeStrategy;
        return mockPushStrategy;
      });

      await expect(service.removeStrategy('u', 'TOTP', 'totp-1')).rejects.toMatchObject({
        code: 'TWOFA_LAST_STRATEGY_CANNOT_REMOVE',
      });
      expect(totpStrategy.revoke).not.toHaveBeenCalled();
    });

    it('남은 strategy가 있으면 revoke 수행', async () => {
      const totpStrategy = {
        type: 'TOTP',
        list: jest.fn().mockResolvedValue([{ id: 'totp-1', createdAt: new Date(), lastUsedAt: null }]),
        revoke: jest.fn(),
      };
      const backupCodeStrategy = {
        type: 'BACKUP_CODE',
        list: jest.fn().mockResolvedValue([{ id: 'backup-code', createdAt: new Date(), lastUsedAt: null }]),
        revoke: jest.fn(),
      };
      mockRegistry.get.mockImplementation((t: string) => {
        if (t === 'TOTP') return totpStrategy;
        if (t === 'BACKUP_CODE') return backupCodeStrategy;
        return mockPushStrategy;
      });

      await service.removeStrategy('u', 'TOTP', 'totp-1');
      expect(totpStrategy.revoke).toHaveBeenCalledWith('u', 'totp-1');
    });
  });
});

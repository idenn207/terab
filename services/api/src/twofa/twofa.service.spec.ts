import { Test, TestingModule } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TokenService } from '@terab/core';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

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
        { provide: TwoFaRepository, useValue: mockTwoFaRepository },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<TwoFaService>(TwoFaService);
    jest.clearAllMocks();
  });

  describe('createChallenge', () => {
    it('3개의 2자리 숫자 options를 생성한다', async () => {
      mockTwoFaRepository.insert.mockImplementation(async (data) => ({ ...data, id: 'challenge-id' }));

      const result = await service.createChallenge('user-id');

      const parts = result.options.split(',');
      expect(parts).toHaveLength(3);
      parts.forEach((p) => {
        const n = parseInt(p, 10);
        expect(n).toBeGreaterThanOrEqual(10);
        expect(n).toBeLessThanOrEqual(99);
      });
    });

    it('correctNum은 options 중 하나다', async () => {
      mockTwoFaRepository.insert.mockImplementation(async (data) => ({ ...data, id: 'challenge-id' }));

      const result = await service.createChallenge('user-id');

      expect(result.options.split(',')).toContain(result.correctNum);
    });
  });

  describe('getStatus', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.getStatus('id')).rejects.toThrow(ApiException);
    });

    it('PENDING 상태이고 만료되지 않으면 options와 correctNum을 포함한 PENDING 응답을 반환한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const result = await service.getStatus('id');

      expect(result.status).toBe('PENDING');
      expect(result.options).toEqual(['47', '82', '13']);
      expect(result.correctNum).toBe('47');
      expect(result.remainingSeconds).toBeGreaterThan(0);
    });

    it('PENDING 상태이지만 만료됐으면 EXPIRED 처리 후 DENIED를 반환한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1_000),
        options: '47,82,13',
        correctNum: '47',
      });

      const result = await service.getStatus('id');

      expect(result.status).toBe('DENIED');
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'EXPIRED');
    });

    it('APPROVED 상태이면 accessToken과 user 정보를 반환한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        options: '47,82,13',
        correctNum: '47',
      });
      mockTwoFaRepository.findUserWithPermissionsById.mockResolvedValue({
        id: 'user-id',
        username: 'user1',
        nickname: 'User',
        permissions: [],
      });
      mockTokenService.generateAccessToken.mockReturnValue('mock.access.token');

      const result = await service.getStatus('id');

      expect(result.status).toBe('APPROVED');
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.user?.id).toBe('user-id');
    });
  });

  describe('respond', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.respond('id', 'userId', '47')).rejects.toThrow(ApiException);
    });

    it('소유자가 다르면 ApiException(FORBIDDEN)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'other-user',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await expect(service.respond('id', 'user-id', '47')).rejects.toThrow(ApiException);
    });

    it('이미 처리된 챌린지는 아무것도 하지 않는다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await service.respond('id', 'user-id', '47');

      expect(mockTwoFaRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('정답이면 APPROVED로 변경한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await service.respond('id', 'user-id', '47');

      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'APPROVED', expect.any(Date));
    });

    it('오답이면 DENIED로 변경한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await service.respond('id', 'user-id', '82');

      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'DENIED', expect.any(Date));
    });
  });

  describe('claimApprovedChallenge', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.claimApprovedChallenge('id')).rejects.toThrow(ApiException);
    });

    it('APPROVED 상태가 아니면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await expect(service.claimApprovedChallenge('id')).rejects.toThrow(ApiException);
    });

    it('APPROVED 챌린지를 EXPIRED로 전환하고 userId를 반환한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      const userId = await service.claimApprovedChallenge('id');

      expect(userId).toBe('user-id');
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'EXPIRED');
    });
  });
});

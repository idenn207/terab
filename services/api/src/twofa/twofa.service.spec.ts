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
      mockTwoFaRepository.insert.mockImplementation(async (userId, options, correctNum, expiresAt) => ({
        id: 'challenge-id',
        userId,
        options,
        correctNum,
        expiresAt,
      }));

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
      mockTwoFaRepository.insert.mockImplementation(async (userId, options, correctNum, expiresAt) => ({
        id: 'challenge-id',
        userId,
        options,
        correctNum,
        expiresAt,
      }));

      const result = await service.createChallenge('user-id');

      expect(result.options.split(',')).toContain(result.correctNum);
    });
  });

  describe('respond', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(service.respond('id', 'userId', '47', false)).rejects.toThrow(ApiException);
    });

    it('소유자가 다르면 ApiException(FORBIDDEN)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'other-user',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await expect(service.respond('id', 'user-id', '47', false)).rejects.toThrow(ApiException);
    });

    it('이미 처리된 챌린지는 아무것도 하지 않는다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'id',
        userId: 'user-id',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await service.respond('id', 'user-id', '47', false);

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

      await service.respond('id', 'user-id', '47', false);

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

      await service.respond('id', 'user-id', '82', false);

      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('id', 'DENIED', expect.any(Date));
    });
  });
});

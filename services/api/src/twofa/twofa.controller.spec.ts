import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthUser } from '@terab/test';
import { TwoFaController } from './twofa.controller';
import { TwoFaService } from './twofa.service';

describe('TwoFaController', () => {
  let controller: TwoFaController;
  let service: jest.Mocked<TwoFaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TwoFaController],
      providers: [
        {
          provide: TwoFaService,
          useValue: {
            getStatus: jest.fn(),
            respond: jest.fn(),
            resend: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TwoFaController);
    service = module.get(TwoFaService);
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('TWOFA_CHALLENGE_NOT_FOUND이 발생하면 그대로 전파한다', async () => {
      service.getStatus.mockRejectedValue(new ApiException('TWOFA_CHALLENGE_NOT_FOUND'));

      await expect(controller.getStatus('ghost-id')).rejects.toThrow(ApiException);
      await expect(controller.getStatus('ghost-id')).rejects.toMatchObject({
        code: 'TWOFA_CHALLENGE_NOT_FOUND',
      });
    });

    it('PENDING 상태를 반환한다', async () => {
      const pending = {
        status: 'PENDING' as const,
        options: ['47', '82', '13'],
        correctNum: '47',
        remainingSeconds: 55,
      };
      service.getStatus.mockResolvedValue(pending);

      const result = await controller.getStatus('challenge-id');

      expect(service.getStatus).toHaveBeenCalledWith('challenge-id');
      expect(result).toEqual(pending);
    });

    it('APPROVED 상태를 반환한다', async () => {
      const approved = {
        status: 'APPROVED' as const,
        userId: mockAuthUser.userId,
      };
      service.getStatus.mockResolvedValue(approved);

      const result = await controller.getStatus('challenge-id');

      expect(result).toEqual(approved);
    });

    it('DENIED 상태를 반환한다', async () => {
      service.getStatus.mockResolvedValue({ status: 'DENIED' });

      const result = await controller.getStatus('challenge-id');

      expect(result).toEqual({ status: 'DENIED' });
    });

    it('EXPIRED 상태를 반환한다', async () => {
      service.getStatus.mockResolvedValue({ status: 'EXPIRED' });

      const result = await controller.getStatus('challenge-id');

      expect(result).toEqual({ status: 'EXPIRED' });
    });
  });

  describe('respond', () => {
    it('TWOFA_CHALLENGE_NOT_FOUND이 발생하면 그대로 전파한다', async () => {
      service.respond.mockRejectedValue(new ApiException('TWOFA_CHALLENGE_NOT_FOUND'));

      await expect(controller.respond(mockAuthUser, 'ghost-id', { selectedNumber: '47' })).rejects.toThrow(
        ApiException,
      );
      await expect(controller.respond(mockAuthUser, 'ghost-id', { selectedNumber: '47' })).rejects.toMatchObject({
        code: 'TWOFA_CHALLENGE_NOT_FOUND',
      });
    });

    it('서비스에 challengeId, userId, selectedNumber를 전달한다', async () => {
      service.respond.mockResolvedValue(undefined);

      await controller.respond(mockAuthUser, 'challenge-id', { selectedNumber: '47' });

      expect(service.respond).toHaveBeenCalledWith('challenge-id', mockAuthUser.userId, '47');
    });
  });

  describe('resend', () => {
    it('TWOFA_CHALLENGE_NOT_FOUND이 발생하면 그대로 전파한다', async () => {
      service.resend.mockRejectedValue(new ApiException('TWOFA_CHALLENGE_NOT_FOUND'));

      await expect(controller.resend('ghost-id')).rejects.toThrow(ApiException);
      await expect(controller.resend('ghost-id')).rejects.toMatchObject({
        code: 'TWOFA_CHALLENGE_NOT_FOUND',
      });
    });

    it('서비스 응답을 반환한다', async () => {
      const expiresAt = new Date();
      const resendResult = {
        challengeId: 'new-challenge-id',
        options: ['47', '82', '13'],
        expiresAt,
      };
      service.resend.mockResolvedValue(resendResult);

      const result = await controller.resend('old-id');

      expect(service.resend).toHaveBeenCalledWith('old-id');
      expect(result).toEqual(resendResult);
    });
  });
});

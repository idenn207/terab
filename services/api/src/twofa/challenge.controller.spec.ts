import { Test } from '@nestjs/testing';
import { ChallengeController } from './challenge.controller';
import { TwoFaService } from './twofa.service';

const mockTwoFaService = {
  getStatus: jest.fn(),
  respond: jest.fn(),
  resend: jest.fn(),
  completeChallenge: jest.fn(),
  issueAuthenticatedResponse: jest.fn(),
};

describe('ChallengeController', () => {
  let controller: ChallengeController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ChallengeController],
      providers: [{ provide: TwoFaService, useValue: mockTwoFaService }],
    }).compile();
    controller = module.get(ChallengeController);
    jest.clearAllMocks();
  });

  describe('complete', () => {
    it('type=TOTP면 completeChallenge → issueAuthenticatedResponse 위임 (userAgent 전달)', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue({ userId: 'user-1' });
      mockTwoFaService.issueAuthenticatedResponse.mockResolvedValue({
        response: { status: 'AUTHENTICATED' } as never,
        rawRefreshToken: 'rt',
        refreshTokenExpMs: 1000,
      });

      const res = {} as any;
      await controller.complete('challenge-id', { type: 'TOTP', code: '123456' }, 'Mozilla/UA', res);

      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith(
        'challenge-id',
        { type: 'TOTP', code: '123456' },
        'Mozilla/UA',
      );
      expect(mockTwoFaService.issueAuthenticatedResponse).toHaveBeenCalledWith('user-1', res, undefined);
    });

    it('body 비어 있으면 type=PUSH로 dispatch (userAgent 없을 수도)', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue({ userId: 'user-1' });
      mockTwoFaService.issueAuthenticatedResponse.mockResolvedValue({
        response: { status: 'AUTHENTICATED' } as never,
        rawRefreshToken: 'rt',
        refreshTokenExpMs: 1000,
      });
      const res = {} as any;

      await controller.complete('challenge-id', {}, undefined, res);

      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('challenge-id', {}, undefined);
    });

    it('type=PUSH면 completeChallenge → issueAuthenticatedResponse 위임 후 AUTHENTICATED 반환', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue({ userId: 'u1' });
      mockTwoFaService.issueAuthenticatedResponse.mockResolvedValue({
        status: 'AUTHENTICATED',
        accessToken: 'JWT',
        user: { id: 'u1', username: 'a', nickname: 'A' },
      });
      const res = {} as any;

      const result = await controller.complete('ch-1', { type: 'PUSH' }, 'UA', res);

      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('ch-1', { type: 'PUSH' }, 'UA');
      expect(mockTwoFaService.issueAuthenticatedResponse).toHaveBeenCalledWith('u1', res, undefined);
      expect(result.status).toBe('AUTHENTICATED');
    });

    it('trustDevice=true 시 service 의 rawTrustToken 을 issueAuthenticatedResponse 로 전달', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue({
        userId: 'u1',
        rawTrustToken: 'raw-trust-1',
      });
      mockTwoFaService.issueAuthenticatedResponse.mockResolvedValue({
        status: 'AUTHENTICATED',
        accessToken: 'JWT',
        user: { id: 'u1', username: 'a', nickname: 'A' },
      });
      const res = {} as any;

      await controller.complete('ch-1', { type: 'PUSH', trustDevice: true }, 'Mozilla/UA', res);

      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith(
        'ch-1',
        { type: 'PUSH', trustDevice: true },
        'Mozilla/UA',
      );
      expect(mockTwoFaService.issueAuthenticatedResponse).toHaveBeenCalledWith('u1', res, 'raw-trust-1');
    });
  });
});

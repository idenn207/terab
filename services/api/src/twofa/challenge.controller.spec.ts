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
    it('type=TOTP면 completeChallenge → issueAuthenticatedResponse 위임', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue('user-1');
      mockTwoFaService.issueAuthenticatedResponse.mockResolvedValue({
        response: { status: 'AUTHENTICATED' } as never,
        rawRefreshToken: 'rt',
        refreshTokenExpMs: 1000,
      });

      const res = {} as any;
      const result = await controller.complete('challenge-id', { type: 'TOTP', code: '123456' }, res);

      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('challenge-id', {
        type: 'TOTP',
        code: '123456',
      });
      expect(mockTwoFaService.issueAuthenticatedResponse).toHaveBeenCalledWith('user-1', {});
    });

    it('body 비어 있으면 type=PUSH로 dispatch', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue('user-1');
      mockTwoFaService.issueAuthenticatedResponse.mockResolvedValue({
        response: { status: 'AUTHENTICATED' } as never,
        rawRefreshToken: 'rt',
        refreshTokenExpMs: 1000,
      });
      const res = {} as any;
      await controller.complete('challenge-id', {}, res);
      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('challenge-id', {});
    });

    it('type=PUSH면 completeChallenge → issueAuthenticatedResponse 위임 후 AUTHENTICATED 반환', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue('u1');
      mockTwoFaService.issueAuthenticatedResponse.mockResolvedValue({
        status: 'AUTHENTICATED',
        accessToken: 'JWT',
        user: { id: 'u1', username: 'a', nickname: 'A' },
      });
      const res = {} as any;

      const result = await controller.complete('ch-1', { type: 'PUSH' }, res);

      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('ch-1', { type: 'PUSH' });
      expect(mockTwoFaService.issueAuthenticatedResponse).toHaveBeenCalledWith('u1', res);
      expect(result.status).toBe('AUTHENTICATED');
    });
  });
});

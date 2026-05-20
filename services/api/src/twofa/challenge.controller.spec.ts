import { Test } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { ChallengeController } from './challenge.controller';
import { TwoFaService } from './twofa.service';

const mockTwoFaService = {
  getStatus: jest.fn(),
  respond: jest.fn(),
  resend: jest.fn(),
  completeChallenge: jest.fn(),
};
const mockAuthService = {
  issueAuthenticatedResponse: jest.fn(),
};

describe('ChallengeController', () => {
  let controller: ChallengeController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ChallengeController],
      providers: [
        { provide: TwoFaService, useValue: mockTwoFaService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();
    controller = module.get(ChallengeController);
    jest.clearAllMocks();
  });

  describe('complete', () => {
    it('type=TOTP면 completeChallenge → issueAuthenticatedResponse 위임', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue('user-1');
      mockAuthService.issueAuthenticatedResponse.mockResolvedValue({
        response: { status: 'AUTHENTICATED' } as never,
        rawRefreshToken: 'rt',
        refreshTokenExpMs: 1000,
      });

      const result = await controller.complete('challenge-id', { type: 'TOTP', code: '123456' });

      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('challenge-id', {
        type: 'TOTP',
        code: '123456',
      });
      expect(mockAuthService.issueAuthenticatedResponse).toHaveBeenCalledWith('user-1');
    });

    it('body 비어 있으면 type=PUSH로 dispatch', async () => {
      mockTwoFaService.completeChallenge.mockResolvedValue('user-1');
      mockAuthService.issueAuthenticatedResponse.mockResolvedValue({
        response: { status: 'AUTHENTICATED' } as never,
        rawRefreshToken: 'rt',
        refreshTokenExpMs: 1000,
      });
      await controller.complete('challenge-id', {});
      expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('challenge-id', {});
    });
  });
});

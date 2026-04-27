import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeStatusResponseDto } from './dto/challenge-status-response.dto';
import { TwoFaController } from './twofa.controller';
import { TwoFaService } from './twofa.service';

const mockTwoFaService = {
  getStatus: jest.fn(),
  respond: jest.fn(),
  resend: jest.fn(),
};

describe('TwoFaController', () => {
  let controller: TwoFaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TwoFaController],
      providers: [{ provide: TwoFaService, useValue: mockTwoFaService }],
    }).compile();

    controller = module.get<TwoFaController>(TwoFaController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET challenge/:id/status', () => {
    it('TwoFaService.getStatus 결과를 반환한다', async () => {
      const dto = ChallengeStatusResponseDto.pending(['47', '82', '13'], '47', 55);
      mockTwoFaService.getStatus.mockResolvedValue(dto);

      const result = await controller.getStatus('challenge-id');

      expect(mockTwoFaService.getStatus).toHaveBeenCalledWith('challenge-id');
      expect(result).toBe(dto);
    });
  });

  describe('POST challenge/:id/respond', () => {
    it('TwoFaService.respond를 호출한다', async () => {
      mockTwoFaService.respond.mockResolvedValue(undefined);
      const user = { userId: 'user-id', username: 'user1', permissions: [] };

      await controller.respond('challenge-id', { selectedNumber: '47' }, user);

      expect(mockTwoFaService.respond).toHaveBeenCalledWith('challenge-id', 'user-id', '47');
    });
  });

  describe('POST challenge/:id/resend', () => {
    it('TwoFaService.resend 결과를 반환한다', async () => {
      const resendResult = { id: 'new-id', options: ['47', '82', '13'], expiresAt: new Date() };
      mockTwoFaService.resend.mockResolvedValue(resendResult);

      const result = await controller.resend('old-challenge-id');

      expect(mockTwoFaService.resend).toHaveBeenCalledWith('old-challenge-id');
      expect(result.challengeId).toBe('new-id');
    });
  });
});

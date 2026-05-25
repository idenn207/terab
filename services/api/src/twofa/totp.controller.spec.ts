import { Test } from '@nestjs/testing';
import { TotpTwoFaStrategy } from './strategies/totp.strategy';
import { TotpController } from './totp.controller';
import { TwoFaService } from './twofa.service';

const mockStrategy = {
  startSetup: jest.fn(),
  completeSetup: jest.fn(),
  list: jest.fn(),
};
const mockTwoFaService = {
  removeStrategy: jest.fn(),
};

describe('TotpController', () => {
  let controller: TotpController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TotpController],
      providers: [
        { provide: TotpTwoFaStrategy, useValue: mockStrategy },
        { provide: TwoFaService, useValue: mockTwoFaService },
      ],
    }).compile();
    controller = module.get(TotpController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => expect(controller).toBeDefined());

  describe('startSetup', () => {
    it('PENDING 상태면 secret + otpauthUri 반환', async () => {
      mockStrategy.startSetup.mockResolvedValue({ status: 'PENDING', secret: 's', otpauthUri: 'uri' });
      const result = await controller.startSetup({ userId: 'u' } as never);
      expect(result).toEqual({ status: 'PENDING', secret: 's', otpauthUri: 'uri' });
    });
  });

  describe('completeSetup', () => {
    it('payload를 strategy에 위임', async () => {
      await controller.completeSetup({ userId: 'u' } as never, { secret: 's', code: '123456' });
      expect(mockStrategy.completeSetup).toHaveBeenCalledWith('u', { secret: 's', code: '123456' });
    });
  });

  describe('revoke', () => {
    it('TwoFaService.removeStrategy 위임', async () => {
      await controller.revoke({ userId: 'u' } as never, 'totp-1');
      expect(mockTwoFaService.removeStrategy).toHaveBeenCalledWith('u', 'TOTP', 'totp-1');
    });
  });
});

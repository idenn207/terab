import { Test } from '@nestjs/testing';
import { TotpLockoutService } from '../totp-lockout.service';
import { TotpService } from '../totp.service';
import { TotpTwoFaStrategy } from './totp.strategy';

const mockTotpService = {
  startSetup: jest.fn(),
  completeSetup: jest.fn(),
  verifyCode: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
};
const mockLockout = {
  isLocked: jest.fn(),
  recordFailure: jest.fn(),
  clearLockout: jest.fn(),
};

describe('TotpTwoFaStrategy', () => {
  let strategy: TotpTwoFaStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TotpTwoFaStrategy,
        { provide: TotpService, useValue: mockTotpService },
        { provide: TotpLockoutService, useValue: mockLockout },
      ],
    }).compile();
    strategy = module.get(TotpTwoFaStrategy);
    jest.clearAllMocks();
  });

  it('type은 TOTP다', () => {
    expect(strategy.type).toBe('TOTP');
  });

  describe('startSetup / completeSetup', () => {
    it('TotpService에 위임', async () => {
      mockTotpService.startSetup.mockResolvedValue({ status: 'PENDING', secret: 's', otpauthUri: 'uri' });
      await strategy.startSetup('u');
      expect(mockTotpService.startSetup).toHaveBeenCalledWith('u');

      await strategy.completeSetup('u', { secret: 's', code: '123456' });
      expect(mockTotpService.completeSetup).toHaveBeenCalledWith('u', 's', '123456');
    });

    it('completeSetup payload 형식이 잘못되면 throw', async () => {
      await expect(strategy.completeSetup('u', { secret: 's' } as unknown)).rejects.toThrow();
      await expect(strategy.completeSetup('u', { code: '123456' } as unknown)).rejects.toThrow();
    });
  });

  describe('createChallenge', () => {
    it('TOTP는 challenge가 client-side이므로 TWOFA_SETUP_NOT_SUPPORTED', async () => {
      await expect(strategy.createChallenge('u')).rejects.toMatchObject({
        code: 'TWOFA_SETUP_NOT_SUPPORTED',
      });
    });
  });

  describe('verifyResponse', () => {
    it('lockout 상태면 TWOFA_TOTP_LOCKED', async () => {
      mockLockout.isLocked.mockResolvedValue(true);
      await expect(strategy.verifyResponse('u', '', { code: '123456' })).rejects.toMatchObject({
        code: 'TWOFA_TOTP_LOCKED',
      });
    });

    it('올바른 코드면 true + lockout clear', async () => {
      mockLockout.isLocked.mockResolvedValue(false);
      mockTotpService.verifyCode.mockResolvedValue(true);
      const ok = await strategy.verifyResponse('u', '', { code: '123456' });
      expect(ok).toBe(true);
      expect(mockLockout.clearLockout).toHaveBeenCalledWith('u');
    });

    it('잘못된 코드면 실패 카운트 증가 후 TWOFA_TOTP_INVALID_CODE', async () => {
      mockLockout.isLocked.mockResolvedValue(false);
      mockTotpService.verifyCode.mockResolvedValue(false);
      await expect(strategy.verifyResponse('u', '', { code: '000000' })).rejects.toMatchObject({
        code: 'TWOFA_TOTP_INVALID_CODE',
      });
      expect(mockLockout.recordFailure).toHaveBeenCalledWith('u');
    });
  });

  describe('list / revoke', () => {
    it('list — 등록 없으면 빈 배열', async () => {
      mockTotpService.list.mockResolvedValue(null);
      const result = await strategy.list('u');
      expect(result).toEqual([]);
    });

    it('list — 등록 row 있으면 단일 항목 반환', async () => {
      const row = { id: 'totp-1', createdAt: new Date(), lastUsedAt: null };
      mockTotpService.list.mockResolvedValue(row);
      const result = await strategy.list('u');
      expect(result).toEqual([{ id: 'totp-1', createdAt: row.createdAt, lastUsedAt: null }]);
    });

    it('revoke — 소유자 아니면 ApiException(FORBIDDEN)', async () => {
      mockTotpService.revoke.mockResolvedValue(false);
      await expect(strategy.revoke('u', 'totp-x')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('revoke — 본인 소유 row면 정상 삭제', async () => {
      mockTotpService.revoke.mockResolvedValue(true);
      await strategy.revoke('u', 'totp-1');
      expect(mockTotpService.revoke).toHaveBeenCalledWith('totp-1', 'u');
    });
  });
});

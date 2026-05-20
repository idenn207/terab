import { Test } from '@nestjs/testing';
import { BackupCodeService } from '../backup-code.service';
import { BackupCodeTwoFaStrategy } from './backup-code.strategy';

const mockBackupCodeService = {
  consume: jest.fn(),
};

describe('BackupCodeTwoFaStrategy', () => {
  let strategy: BackupCodeTwoFaStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BackupCodeTwoFaStrategy, { provide: BackupCodeService, useValue: mockBackupCodeService }],
    }).compile();

    strategy = module.get(BackupCodeTwoFaStrategy);
    jest.clearAllMocks();
  });

  it('type은 BACKUP_CODE다', () => {
    expect(strategy.type).toBe('BACKUP_CODE');
  });

  describe('startSetup / completeSetup / createChallenge / list / revoke', () => {
    it('모두 TWOFA_SETUP_NOT_SUPPORTED를 던진다', async () => {
      await expect(strategy.startSetup('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.completeSetup('u', {})).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.createChallenge('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.list('u')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
      await expect(strategy.revoke('u', 'x')).rejects.toMatchObject({ code: 'TWOFA_SETUP_NOT_SUPPORTED' });
    });
  });

  describe('verifyResponse', () => {
    it('BackupCodeService.consume이 성공하면 true를 반환한다', async () => {
      mockBackupCodeService.consume.mockResolvedValue(undefined);

      const ok = await strategy.verifyResponse('u', '', { code: 'CODE-XXXX' });

      expect(ok).toBe(true);
      expect(mockBackupCodeService.consume).toHaveBeenCalledWith('u', 'CODE-XXXX');
    });

    it('BackupCodeService.consume이 ApiException을 던지면 그대로 propagate한다', async () => {
      const err = Object.assign(new Error('invalid'), { code: 'BACKUP_CODE_INVALID' });
      mockBackupCodeService.consume.mockRejectedValue(err);

      await expect(strategy.verifyResponse('u', '', { code: 'wrong' })).rejects.toBe(err);
    });
  });
});

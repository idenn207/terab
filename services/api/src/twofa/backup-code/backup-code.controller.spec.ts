import { Test } from '@nestjs/testing';
import { mockAuthUser } from '@terab/test';
import { BackupCodeController } from './backup-code.controller';
import { BackupCodeService } from './backup-code.service';

const mockBackupCodeService = { regenerateForUser: jest.fn() };

describe('BackupCodeController', () => {
  let controller: BackupCodeController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BackupCodeController],
      providers: [{ provide: BackupCodeService, useValue: mockBackupCodeService }],
    }).compile();

    controller = module.get(BackupCodeController);
    jest.clearAllMocks();
  });

  describe('regenerate', () => {
    it('정상 흐름 — backup codes 재발급 반환', async () => {
      mockBackupCodeService.regenerateForUser.mockResolvedValue(['c1', 'c2']);

      const result = await controller.regenerate(mockAuthUser, { currentPassword: 'p' });

      expect(result).toEqual({ backupCodes: ['c1', 'c2'] });
    });
  });
});

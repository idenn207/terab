import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbTransaction,
  mockTransactionContext,
  mockUser,
  setupMockDbTransactionChain,
} from '@terab/test';
import bcrypt from 'bcryptjs';
import { AuthService } from '../../auth/auth.service';
import { UserService } from '../../user/user.service';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeService } from './backup-code.service';
import { BackupCodeRegenerateBodyDto } from './dto';

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockUserService = { findById: jest.fn() };
const mockAuthService = { validateCredentials: jest.fn() };
const mockBackupCodeRepository = {
  findUnusedByUserId: jest.fn(),
  insertMany: jest.fn(),
  markUsed: jest.fn(),
};

describe('BackupCodeService', () => {
  let service: BackupCodeService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BackupCodeService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: BackupCodeRepository, useValue: mockBackupCodeRepository },
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get(BackupCodeService);
    jest.clearAllMocks();
    setupMockDbTransactionChain();
    mockBackupCodeRepository.insertMany.mockResolvedValue(undefined);
    mockBackupCodeRepository.markUsed.mockResolvedValue(undefined);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
  });

  describe('generateForUser', () => {
    it('8개의 raw 코드를 생성하고 hash 후 insertMany를 호출한다', async () => {
      const result = await service.generateForUser('user-1');

      expect(result).toHaveLength(8);
      expect(mockBackupCodeRepository.insertMany).toHaveBeenCalledTimes(1);
      const [userId, hashes] = mockBackupCodeRepository.insertMany.mock.calls[0];
      expect(userId).toBe('user-1');
      expect(hashes).toHaveLength(8);
    });
  });

  describe('consume', () => {
    it('unused 코드가 비어 있으면 BACKUP_CODE_INVALID를 던진다', async () => {
      mockBackupCodeRepository.findUnusedByUserId.mockResolvedValue([]);

      await expect(service.consume('user-1', 'CODE-XXXX')).rejects.toMatchObject({
        code: 'BACKUP_CODE_INVALID',
      });
      expect(mockBackupCodeRepository.markUsed).not.toHaveBeenCalled();
    });

    it('어떤 코드와도 매칭되지 않으면 BACKUP_CODE_INVALID를 던지고 markUsed를 호출하지 않는다', async () => {
      mockBackupCodeRepository.findUnusedByUserId.mockResolvedValue([
        { id: 'bc-1', codeHash: 'h1' },
        { id: 'bc-2', codeHash: 'h2' },
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.consume('user-1', 'wrong')).rejects.toThrow(ApiException);
      expect(mockBackupCodeRepository.markUsed).not.toHaveBeenCalled();
    });

    it('타이밍 오라클 방지를 위해 매칭 후에도 모든 코드를 순회한다', async () => {
      mockBackupCodeRepository.findUnusedByUserId.mockResolvedValue([
        { id: 'bc-1', codeHash: 'h1' },
        { id: 'bc-2', codeHash: 'h2' },
        { id: 'bc-3', codeHash: 'h3' },
      ]);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await service.consume('user-1', 'CODE-XXXX');

      expect(bcrypt.compare).toHaveBeenCalledTimes(3);
      expect(mockBackupCodeRepository.markUsed).toHaveBeenCalledWith('bc-1', expect.any(Date));
    });
  });

  describe('regenerateForUser', () => {
    it('기존 unused 코드를 모두 markUsed로 폐기하고 새 8개를 발급한다', async () => {
      const mockData: BackupCodeRegenerateBodyDto = { currentPassword: 'abcd' };
      mockUserService.findById.mockResolvedValue(mockUser);
      mockAuthService.validateCredentials.mockResolvedValue(undefined);
      mockBackupCodeRepository.findUnusedByUserId.mockResolvedValue([
        { id: 'bc-1', codeHash: 'h1' },
        { id: 'bc-2', codeHash: 'h2' },
      ]);

      const result = await service.regenerateForUser('user-1', mockData);

      expect(mockBackupCodeRepository.markUsed).toHaveBeenCalledTimes(2);
      expect(mockBackupCodeRepository.insertMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(8);
    });

    it('폐기 + 재발급이 동일 트랜잭션 안에서 수행된다', async () => {
      const mockData: BackupCodeRegenerateBodyDto = { currentPassword: mockUser.password };
      mockUserService.findById.mockResolvedValue(mockUser);
      mockAuthService.validateCredentials.mockResolvedValue(undefined);
      mockBackupCodeRepository.findUnusedByUserId.mockResolvedValue([{ id: 'bc-1', codeHash: 'h1' }]);

      await service.regenerateForUser('user-1', mockData);

      expect(mockDbTransaction).toHaveBeenCalled();
      expect(mockAuthService.validateCredentials).toHaveBeenCalledWith(mockUser, mockUser.password);
      const txOrder = mockDbTransaction.mock.invocationCallOrder[0];
      expect(mockBackupCodeRepository.markUsed.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(mockBackupCodeRepository.insertMany.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
    });
  });
});

import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbInsert,
  mockDbLimit,
  mockDbReturning,
  mockDbUpdate,
  mockDbWhere,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
import { MountCredentialRepository } from './mount-credential.repository';

const sample = {
  id: 'cred-1',
  driveId: 'drive-1',
  userId: 'user-1',
  protocol: 'iscsi',
  osUsername: 'mount-cred-abc',
  secretRef: 'mount-cred-abc',
  iqn: 'iqn.2026-05.com.terab:drive-1',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('MountCredentialRepository', () => {
  let repo: MountCredentialRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MountCredentialRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();
    repo = module.get(MountCredentialRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  describe('findActiveByUserId', () => {
    it('active row 목록 반환 (revokedAt IS NULL)', async () => {
      mockDbWhere.mockResolvedValueOnce([sample]);
      const result = await repo.findActiveByUserId('user-1');
      expect(result).toEqual([sample]);
    });
  });

  describe('findActiveByDriveAndProtocol', () => {
    it('동일 (driveId,userId,protocol) active 가 있으면 row 반환', async () => {
      mockDbLimit.mockResolvedValue([sample]);
      const result = await repo.findActiveByDriveAndProtocol('drive-1', 'user-1', 'iscsi');
      expect(result).toEqual(sample);
    });

    it('없으면 null', async () => {
      mockDbLimit.mockResolvedValue([]);
      const result = await repo.findActiveByDriveAndProtocol('drive-1', 'user-1', 'iscsi');
      expect(result).toBeNull();
    });
  });

  describe('findByIdAndUserId', () => {
    it('소유자 일치 시 row 반환, 불일치 시 null', async () => {
      mockDbLimit.mockResolvedValue([sample]);
      const found = await repo.findByIdAndUserId('cred-1', 'user-1');
      expect(found).toEqual(sample);
      mockDbLimit.mockResolvedValue([]);
      const notFound = await repo.findByIdAndUserId('cred-1', 'other');
      expect(notFound).toBeNull();
    });
  });

  describe('insertIssued', () => {
    it('insert → returning 으로 새 row 반환', async () => {
      const valuesMock = jest.fn().mockReturnValue({ returning: mockDbReturning });
      mockDbInsert.mockReturnValue({ values: valuesMock });
      mockDbReturning.mockResolvedValue([sample]);
      const result = await repo.insertIssued({
        driveId: sample.driveId,
        userId: sample.userId,
        protocol: sample.protocol,
        osUsername: sample.osUsername,
        secretRef: sample.secretRef,
        iqn: sample.iqn,
      });
      expect(result).toEqual(sample);
    });
  });

  describe('softRevoke', () => {
    it('update set revokedAt=now', async () => {
      const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
      mockDbUpdate.mockReturnValue({ set: setMock });
      await repo.softRevoke('cred-1', new Date('2026-02-01T00:00:00Z'));
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date), updatedAt: expect.any(Date) }),
      );
    });
  });
});

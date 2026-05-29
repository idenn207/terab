import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbTransactionChain } from '@terab/test';
import { DriveRepository } from './drive.repository';
import { DriveService } from './drive.service';

const mockDriveRepository = {
  findPersonalByOwnerId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn(),
};

describe('DriveService', () => {
  let service: DriveService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DriveService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: DriveRepository, useValue: mockDriveRepository },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(DriveService);
    jest.clearAllMocks();
    setupMockDbTransactionChain();
    mockConfig.getOrThrow.mockReturnValue('/volume1/drives');
  });

  describe('ensurePersonalDrive', () => {
    it('이미 PRIVATE drive 가 있으면 기존 row 반환하고 create 호출 없음', async () => {
      const existing = { id: 'drive-1', ownerId: 'user-1', kind: 'PRIVATE' } as never;
      mockDriveRepository.findPersonalByOwnerId.mockResolvedValue(existing);

      const result = await service.ensurePersonalDrive('user-1');

      expect(result).toBe(existing);
      expect(mockDriveRepository.create).not.toHaveBeenCalled();
    });

    it('없으면 STORAGE_DRIVE_ROOT/${driveId} mountPath 로 새 row INSERT', async () => {
      mockDriveRepository.findPersonalByOwnerId.mockResolvedValue(null);
      const created = { id: 'drive-new', ownerId: 'user-1', kind: 'PRIVATE' } as never;
      mockDriveRepository.create.mockResolvedValue(created);

      const result = await service.ensurePersonalDrive('user-1');

      expect(result).toBe(created);
      expect(mockConfig.getOrThrow).toHaveBeenCalledWith('STORAGE_DRIVE_ROOT');
      const insertArgs = mockDriveRepository.create.mock.calls[0][0];
      expect(insertArgs.ownerId).toBe('user-1');
      expect(insertArgs.kind).toBe('PRIVATE');
      expect(insertArgs.name).toBe('내 드라이브');
      expect(insertArgs.mountPath).toBe(`/volume1/drives/${insertArgs.id}`);
    });
  });

  describe('findByIdOrThrow', () => {
    it('row 가 없으면 DRIVE_NOT_FOUND', async () => {
      mockDriveRepository.findById.mockResolvedValue(null);
      await expect(service.findByIdOrThrow('drive-1', 'user-1')).rejects.toBeInstanceOf(ApiException);
    });

    it('ownerId 불일치 시 DRIVE_FORBIDDEN', async () => {
      mockDriveRepository.findById.mockResolvedValue({ id: 'drive-1', ownerId: 'other' });
      await expect(service.findByIdOrThrow('drive-1', 'user-1')).rejects.toBeInstanceOf(ApiException);
    });

    it('ownership 일치 시 row 반환', async () => {
      const drive = { id: 'drive-1', ownerId: 'user-1' };
      mockDriveRepository.findById.mockResolvedValue(drive);
      const result = await service.findByIdOrThrow('drive-1', 'user-1');
      expect(result).toBe(drive);
    });
  });
});

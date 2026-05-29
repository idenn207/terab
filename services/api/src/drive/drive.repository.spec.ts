import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbInsert,
  mockDbLimit,
  mockDbReturning,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
import { DriveRepository } from './drive.repository';

const sampleDrive = {
  id: 'drive-1',
  ownerId: 'user-1',
  name: '내 드라이브',
  kind: 'PRIVATE',
  mountPath: '/volume1/drives/drive-1',
  quotaBytes: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('DriveRepository', () => {
  let repo: DriveRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DriveRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();
    repo = module.get(DriveRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  describe('findPersonalByOwnerId', () => {
    it('해당 ownerId 의 PRIVATE drive 가 없으면 null 반환', async () => {
      mockDbLimit.mockResolvedValue([]);
      const result = await repo.findPersonalByOwnerId('user-1');
      expect(result).toBeNull();
    });

    it('PRIVATE drive 가 있으면 row 그대로 반환', async () => {
      mockDbLimit.mockResolvedValue([sampleDrive]);
      const result = await repo.findPersonalByOwnerId('user-1');
      expect(result).toEqual(sampleDrive);
    });
  });

  describe('findById', () => {
    it('id 에 해당하는 row 가 없으면 null', async () => {
      mockDbLimit.mockResolvedValue([]);
      const result = await repo.findById('drive-1');
      expect(result).toBeNull();
    });

    it('id 일치 시 row 반환', async () => {
      mockDbLimit.mockResolvedValue([sampleDrive]);
      const result = await repo.findById('drive-1');
      expect(result).toEqual(sampleDrive);
    });
  });

  describe('create', () => {
    it('insert → returning 체인으로 새 row 반환', async () => {
      const valuesMock = jest.fn().mockReturnValue({ returning: mockDbReturning });
      mockDbInsert.mockReturnValue({ values: valuesMock });
      mockDbReturning.mockResolvedValue([sampleDrive]);

      const result = await repo.create({
        id: sampleDrive.id,
        ownerId: sampleDrive.ownerId,
        name: sampleDrive.name,
        kind: sampleDrive.kind,
        mountPath: sampleDrive.mountPath,
      });

      expect(result).toEqual(sampleDrive);
      expect(valuesMock).toHaveBeenCalledTimes(1);
    });
  });
});

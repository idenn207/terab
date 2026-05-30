import { Test } from '@nestjs/testing';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';

const mockDriveService = {
  ensurePersonalDrive: jest.fn(),
  findByIdOrThrow: jest.fn(),
};

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

describe('DriveController', () => {
  let controller: DriveController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DriveController],
      providers: [{ provide: DriveService, useValue: mockDriveService }],
    }).compile();
    controller = module.get(DriveController);
    jest.clearAllMocks();
  });

  describe('getMyDrive', () => {
    it('service.ensurePersonalDrive 위임 후 DriveDto 만 노출 (ownerId/updatedAt/quotaBytes 미포함)', async () => {
      mockDriveService.ensurePersonalDrive.mockResolvedValue(sampleDrive);

      const result = await controller.getMyDrive({ userId: 'user-1' } as never);

      expect(mockDriveService.ensurePersonalDrive).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        id: sampleDrive.id,
        name: sampleDrive.name,
        kind: 'PRIVATE',
        mountPath: sampleDrive.mountPath,
        createdAt: sampleDrive.createdAt,
      });
      expect((result as never as { ownerId?: string }).ownerId).toBeUndefined();
      expect((result as never as { updatedAt?: Date }).updatedAt).toBeUndefined();
      expect((result as never as { quotaBytes?: number | null }).quotaBytes).toBeUndefined();
    });
  });

  describe('getDrive', () => {
    it('service.findByIdOrThrow(driveId, userId) 순서로 위임 후 DTO 반환', async () => {
      mockDriveService.findByIdOrThrow.mockResolvedValue(sampleDrive);

      const result = await controller.getDrive({ userId: 'user-1' } as never, 'drive-1');

      expect(mockDriveService.findByIdOrThrow).toHaveBeenCalledWith('drive-1', 'user-1');
      expect(result.id).toBe('drive-1');
      expect((result as never as { ownerId?: string }).ownerId).toBeUndefined();
    });
  });
});

import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { FILE_ID, FOLDER_ID, mockAuthUser, mockTrashItem } from '@terab/test';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

describe('TrashController', () => {
  let controller: TrashController;
  let service: jest.Mocked<TrashService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TrashController],
      providers: [
        {
          provide: TrashService,
          useValue: {
            list: jest.fn(),
            restore: jest.fn(),
            permanentDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TrashController);
    service = module.get(TrashService) as jest.Mocked<TrashService>;
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('빈 목록을 반환한다', async () => {
      service.list.mockResolvedValue({ items: [] });

      const result = await controller.list(mockAuthUser);

      expect(service.list).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result.items).toHaveLength(0);
    });

    it('휴지통 항목을 반환한다', async () => {
      service.list.mockResolvedValue({ items: [mockTrashItem] });

      const result = await controller.list(mockAuthUser);

      expect(service.list).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(mockTrashItem);
    });
  });

  describe('restore', () => {
    it('file 타입 - FILE_NOT_FOUND 전파', async () => {
      service.restore.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));

      await expect(controller.restore(mockAuthUser, FILE_ID, { type: 'file' })).rejects.toThrow(ApiException);
      await expect(controller.restore(mockAuthUser, FILE_ID, { type: 'file' })).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });

    it('folder 타입 - FOLDER_NOT_FOUND 전파', async () => {
      service.restore.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await expect(controller.restore(mockAuthUser, FOLDER_ID, { type: 'folder' })).rejects.toThrow(ApiException);
      await expect(controller.restore(mockAuthUser, FOLDER_ID, { type: 'folder' })).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('file 복원 성공', async () => {
      service.restore.mockResolvedValue(undefined);

      await controller.restore(mockAuthUser, FILE_ID, { type: 'file' });

      expect(service.restore).toHaveBeenCalledWith(mockAuthUser.userId, FILE_ID, 'file');
    });

    it('folder 복원 성공', async () => {
      service.restore.mockResolvedValue(undefined);

      await controller.restore(mockAuthUser, FOLDER_ID, { type: 'folder' });

      expect(service.restore).toHaveBeenCalledWith(mockAuthUser.userId, FOLDER_ID, 'folder');
    });
  });

  describe('permanentDelete', () => {
    it('file 타입 - FILE_NOT_FOUND 전파', async () => {
      service.permanentDelete.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));

      await expect(controller.permanentDelete(mockAuthUser, FILE_ID, { type: 'file' })).rejects.toThrow(ApiException);
      await expect(controller.permanentDelete(mockAuthUser, FILE_ID, { type: 'file' })).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });

    it('folder 타입 - FOLDER_NOT_FOUND 전파', async () => {
      service.permanentDelete.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await expect(controller.permanentDelete(mockAuthUser, FOLDER_ID, { type: 'folder' })).rejects.toThrow(ApiException);
      await expect(controller.permanentDelete(mockAuthUser, FOLDER_ID, { type: 'folder' })).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('file 영구 삭제 성공', async () => {
      service.permanentDelete.mockResolvedValue(undefined);

      await controller.permanentDelete(mockAuthUser, FILE_ID, { type: 'file' });

      expect(service.permanentDelete).toHaveBeenCalledWith(mockAuthUser.userId, FILE_ID, 'file');
    });

    it('folder 영구 삭제 성공', async () => {
      service.permanentDelete.mockResolvedValue(undefined);

      await controller.permanentDelete(mockAuthUser, FOLDER_ID, { type: 'folder' });

      expect(service.permanentDelete).toHaveBeenCalledWith(mockAuthUser.userId, FOLDER_ID, 'folder');
    });
  });
});

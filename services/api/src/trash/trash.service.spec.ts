import { Test, TestingModule } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { MinioService } from '../minio/minio.service';
import { TrashRepository } from './trash.repository';
import { TrashService } from './trash.service';

const mockTrashRepository = {
  findAllDeleted: jest.fn(),
  findDeletedFile: jest.fn(),
  findDeletedFolder: jest.fn(),
  restoreFile: jest.fn(),
  restoreFolder: jest.fn(),
  permanentDeleteFile: jest.fn(),
  permanentDeleteFolderTree: jest.fn(),
  isParentInTrash: jest.fn(),
};

const mockMinioService = { removeObject: jest.fn(), removeObjects: jest.fn() };

describe('TrashService', () => {
  let service: TrashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrashService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TrashRepository, useValue: mockTrashRepository },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    service = module.get<TrashService>(TrashService);
    jest.clearAllMocks();
    mockTrashRepository.isParentInTrash.mockResolvedValue(false);
  });

  describe('restore', () => {
    it('cascade child file 은 PARENT_IN_TRASH 로 거부된다', async () => {
      mockTrashRepository.isParentInTrash.mockResolvedValue(true);
      await expect(service.restore('u1', 'id', 'file')).rejects.toMatchObject({ code: 'PARENT_IN_TRASH' });
      expect(mockTrashRepository.findDeletedFile).not.toHaveBeenCalled();
      expect(mockTrashRepository.restoreFile).not.toHaveBeenCalled();
    });

    it('cascade child folder 은 PARENT_IN_TRASH 로 거부된다', async () => {
      mockTrashRepository.isParentInTrash.mockResolvedValue(true);
      await expect(service.restore('u1', 'id', 'folder')).rejects.toMatchObject({ code: 'PARENT_IN_TRASH' });
      expect(mockTrashRepository.findDeletedFolder).not.toHaveBeenCalled();
      expect(mockTrashRepository.restoreFolder).not.toHaveBeenCalled();
    });

    it('파일이 없으면 FILE_NOT_FOUND 를 던진다', async () => {
      mockTrashRepository.findDeletedFile.mockResolvedValue(null);
      await expect(service.restore('u1', 'id', 'file')).rejects.toThrow(ApiException);
    });

    it('가드 통과 + file 발견 시 restoreFile 을 호출한다', async () => {
      mockTrashRepository.findDeletedFile.mockResolvedValue({ id: 'id' });
      mockTrashRepository.restoreFile.mockResolvedValue(true);
      await service.restore('u1', 'id', 'file');
      expect(mockTrashRepository.restoreFile).toHaveBeenCalledWith('id', 'u1');
    });

    it('가드 통과 + folder 발견 시 restoreFolder 를 호출한다', async () => {
      mockTrashRepository.findDeletedFolder.mockResolvedValue({ id: 'id' });
      await service.restore('u1', 'id', 'folder');
      expect(mockTrashRepository.restoreFolder).toHaveBeenCalledWith('id', 'u1');
    });
  });

  describe('permanentDelete', () => {
    it('cascade child file 은 PARENT_IN_TRASH 로 거부된다', async () => {
      mockTrashRepository.isParentInTrash.mockResolvedValue(true);
      await expect(service.permanentDelete('u1', 'id', 'file')).rejects.toMatchObject({ code: 'PARENT_IN_TRASH' });
      expect(mockTrashRepository.permanentDeleteFile).not.toHaveBeenCalled();
      expect(mockMinioService.removeObject).not.toHaveBeenCalled();
    });

    it('cascade child folder 은 PARENT_IN_TRASH 로 거부된다', async () => {
      mockTrashRepository.isParentInTrash.mockResolvedValue(true);
      await expect(service.permanentDelete('u1', 'id', 'folder')).rejects.toMatchObject({ code: 'PARENT_IN_TRASH' });
      expect(mockTrashRepository.permanentDeleteFolderTree).not.toHaveBeenCalled();
    });

    it('가드 통과 시 minioKey 를 조회 후 MinIO 와 DB 를 삭제한다 (file)', async () => {
      mockTrashRepository.permanentDeleteFile.mockResolvedValue('user-1/key-1');
      await service.permanentDelete('u1', 'id', 'file');
      expect(mockMinioService.removeObject).toHaveBeenCalledWith('user-1/key-1');
    });

    it('가드 통과 시 folder tree 의 minioKey 들을 일괄 삭제한다 (folder)', async () => {
      mockTrashRepository.findDeletedFolder.mockResolvedValue({ id: 'id' });
      mockTrashRepository.permanentDeleteFolderTree.mockResolvedValue(['k1', 'k2']);
      await service.permanentDelete('u1', 'id', 'folder');
      expect(mockMinioService.removeObjects).toHaveBeenCalledWith(['k1', 'k2']);
    });
  });
});

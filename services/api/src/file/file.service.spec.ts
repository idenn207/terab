import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService } from '@terab/test';
import { FolderService } from '../folder/folder.service';
import { MinioService } from '../minio/minio.service';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';

const mockFileRepository = {
  findByIdAndUser: jest.fn(),
  findRootFiles: jest.fn(),
  findByFolder: jest.fn(),
  insert: jest.fn(),
  rename: jest.fn(),
  move: jest.fn(),
  softDelete: jest.fn(),
  folderBelongsToUser: jest.fn(),
  search: jest.fn(),
  toFileItem: jest.fn((row) => ({ ...row, folderId: row.folderId ?? null })),
};

const mockFolderService = {
  assertBelongsToUser: jest.fn(),
};

const mockMinioService = {
  bucketName: 'drive',
  putObject: jest.fn(),
  getObject: jest.fn(),
  statObject: jest.fn(),
  copyObject: jest.fn(),
  removeObject: jest.fn(),
};

const mockCacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

const mockTransactionContext = {
  current: undefined,
  run: jest.fn((_tx: unknown, fn: () => Promise<unknown>) => fn()),
};

describe('FileService', () => {
  let service: FileService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: FileRepository, useValue: mockFileRepository },
        { provide: FolderService, useValue: mockFolderService },
        { provide: MinioService, useValue: mockMinioService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();
    service = module.get<FileService>(FileService);
    jest.clearAllMocks();
  });

  describe('rename', () => {
    it('파일이 없으면 FILE_NOT_FOUND를 던진다', async () => {
      mockFileRepository.rename.mockResolvedValue(null);
      await expect(service.rename('f1', 'u1', 'new.txt')).rejects.toThrow(ApiException);
    });
  });
  describe('move', () => {
    it('대상 폴더가 없으면 FOLDER_NOT_FOUND를 던진다', async () => {
      mockFileRepository.findByIdAndUser.mockResolvedValue({ id: 'f1', folderId: null });
      mockFileRepository.folderBelongsToUser.mockResolvedValue(false);
      await expect(service.move('f1', 'u1', 'folder-1')).rejects.toThrow(ApiException);
    });
  });
  describe('remove', () => {
    it('remove는 파일이 없으면 FILE_NOT_FOUND를 던진다', async () => {
      mockFileRepository.softDelete.mockResolvedValue(false);
      await expect(service.remove('f1', 'u1')).rejects.toThrow(ApiException);
    });
  });
});

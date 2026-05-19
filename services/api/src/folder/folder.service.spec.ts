import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService } from '@terab/test';
import { FolderRepository } from './folder.repository';
import { FolderService } from './folder.service';

const mockFolderRepository = {
  findRootChildren: jest.fn(),
  findChildren: jest.fn(),
  findRootFiles: jest.fn(),
  findFilesByFolder: jest.fn(),
  findByIdAndUser: jest.fn(),
  insert: jest.fn(),
  rename: jest.fn(),
  move: jest.fn(),
  isDescendant: jest.fn(),
  softDeleteCascade: jest.fn(),
  toFolderItem: jest.fn((row) => ({ ...row, parentId: row.parentId ?? null })),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockTransactionContext = {
  current: undefined,
  run: jest.fn((_tx: unknown, fn: () => Promise<unknown>) => fn()),
};

describe('FolderService', () => {
  let service: FolderService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FolderService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: FolderRepository, useValue: mockFolderRepository },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();
    service = module.get<FolderService>(FolderService);
    jest.clearAllMocks();
  });

  describe('getRoot', () => {
    it('캐시 미스 시 DB를 조회하고 캐시를 저장한다', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockFolderRepository.findRootChildren.mockResolvedValue([]);
      mockFolderRepository.findRootFiles.mockResolvedValue([]);

      const result = await service.getRoot('user-1');

      expect(mockFolderRepository.findRootChildren).toHaveBeenCalledWith('user-1');
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(result).toEqual({ folders: [], files: [] });
    });

    it('getRoot는 캐시 히트 시 DB를 조회하지 않는다', async () => {
      const cached = { folders: [], files: [] };
      mockCacheManager.get.mockResolvedValue(cached);

      const result = await service.getRoot('user-1');

      expect(mockFolderRepository.findRootChildren).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });
  });

  describe('create', () => {
    it('parentId가 없으면 루트에 폴더를 생성한다', async () => {
      const folder = {
        id: 'f1',
        name: 'test',
        parentId: null,
        userId: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
        softDeletedAt: null,
      };
      mockFolderRepository.insert.mockResolvedValue(folder);

      const result = await service.create('u1', { name: 'test', parentId: null });

      expect(mockFolderRepository.insert).toHaveBeenCalledWith({ userId: 'u1', name: 'test', parentId: null });
      expect(result.name).toBe('test');
    });
  });

  describe('remove', () => {
    it('폴더가 없으면 FOLDER_NOT_FOUND를 던진다', async () => {
      mockFolderRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(service.remove('u1', 'f1')).rejects.toThrow(ApiException);
    });
  });

  describe('assertBelongsToUser', () => {
    it('폴더가 없으면 FOLDER_NOT_FOUND를 던진다', async () => {
      mockFolderRepository.findByIdAndUser.mockResolvedValue(null);
      await expect(service.assertBelongsToUser('ghost', 'u1')).rejects.toThrow(ApiException);
      await expect(service.assertBelongsToUser('ghost', 'u1')).rejects.toMatchObject({ code: 'FOLDER_NOT_FOUND' });
    });

    it('폴더가 존재하면 정상 종료한다', async () => {
      mockFolderRepository.findByIdAndUser.mockResolvedValue({ id: 'f1' });
      await expect(service.assertBelongsToUser('f1', 'u1')).resolves.toBeUndefined();
    });
  });
});

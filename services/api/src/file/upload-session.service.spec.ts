import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockUploadSessionSingle } from '@terab/test';
import { FolderService } from '../folder/folder.service';
import { MinioService } from '../minio/minio.service';
import { FileRepository } from './file.repository';
import { UploadSessionRepository } from './upload-session.repository';
import { UploadSessionService } from './upload-session.service';

const mockUploadSessionRepository = {
  findById: jest.fn(),
  findByIdForUpdate: jest.fn(),
  insert: jest.fn(),
  deleteById: jest.fn(),
  findExpiredForCleanup: jest.fn(),
};

const mockFileRepository = {
  insert: jest.fn(),
  toFileItem: jest.fn((row) => ({ ...row, folderId: row.folderId ?? null })),
};

const mockFolderService = {
  assertBelongsToUser: jest.fn(),
};

const mockMinioService = {
  bucketName: 'drive',
  presignedPutObject: jest.fn(),
  createMultipartUpload: jest.fn(),
  presignedPutPart: jest.fn(),
  completeMultipartUpload: jest.fn(),
  abortMultipartUpload: jest.fn(),
  statObject: jest.fn(),
  removeObject: jest.fn(),
};

const mockTransactionContext = {
  current: undefined,
  run: jest.fn((_tx: unknown, fn: () => Promise<unknown>) => fn()),
};

describe('UploadSessionService', () => {
  let service: UploadSessionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadSessionService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: UploadSessionRepository, useValue: mockUploadSessionRepository },
        { provide: FileRepository, useValue: mockFileRepository },
        { provide: FolderService, useValue: mockFolderService },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();
    service = module.get(UploadSessionService);
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('size가 100GB를 초과하면 FILE_TOO_LARGE를 던진다', async () => {
      await expect(
        service.init('u1', { name: 'big.bin', size: 101 * 1024 * 1024 * 1024, mimeType: 'application/octet-stream' }),
      ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    });

    it('folderId가 주어지면 FolderService.assertBelongsToUser를 호출한다', async () => {
      mockFolderService.assertBelongsToUser.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));
      await expect(
        service.init('u1', { folderId: 'ghost', name: 't.txt', size: 100, mimeType: 'text/plain' }),
      ).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('100MB 미만이면 단일 PUT으로 presigned URL 1개를 발급한다', async () => {
      mockMinioService.presignedPutObject.mockResolvedValue('https://storage.example/put');
      mockUploadSessionRepository.insert.mockResolvedValue(mockUploadSessionSingle);

      const result = await service.init('u1', { name: 't.png', size: 1024, mimeType: 'image/png' });

      expect(mockMinioService.presignedPutObject).toHaveBeenCalledTimes(1);
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].partNumber).toBe(1);
      expect(result.parts[0].uploadUrl).toBe('https://storage.example/put');
      expect(result.uploadHeaders['Content-Type']).toBe('image/png');
      expect(mockUploadSessionRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ uploadKind: 'single', multipartUploadId: null }),
      );
    });

    it('위험 mime은 application/octet-stream으로 sanitize한다', async () => {
      mockMinioService.presignedPutObject.mockResolvedValue('https://storage.example/put');
      mockUploadSessionRepository.insert.mockResolvedValue(mockUploadSessionSingle);

      const result = await service.init('u1', { name: 'evil.html', size: 100, mimeType: 'text/html' });

      expect(result.uploadHeaders['Content-Type']).toBe('application/octet-stream');
      expect(mockUploadSessionRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: 'application/octet-stream' }),
      );
    });
  });
});

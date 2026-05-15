import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockUploadSessionExpired,
  mockUploadSessionMultipart,
  mockUploadSessionSingle,
  setupMockDbTransactionChain,
} from '@terab/test';
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
    setupMockDbTransactionChain();
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

    it('100MB 이상이면 multipart로 part별 presigned URL을 발급한다', async () => {
      mockMinioService.createMultipartUpload.mockResolvedValue({ uploadId: 'mp-1' });
      mockMinioService.presignedPutPart.mockImplementation(
        async (_k, _u, partNumber: number) => `https://storage.example/part/${partNumber}`,
      );
      mockUploadSessionRepository.insert.mockResolvedValue({
        ...mockUploadSessionSingle,
        uploadKind: 'multipart',
        multipartUploadId: 'mp-1',
      });

      const size = 250 * 1024 * 1024;
      const result = await service.init('u1', { name: 'v.mp4', size, mimeType: 'video/mp4' });

      // 100MB part size → 3 parts
      expect(mockMinioService.createMultipartUpload).toHaveBeenCalledWith(expect.any(String), 'video/mp4');
      expect(result.parts).toHaveLength(3);
      expect(result.parts.map((p) => p.partNumber)).toEqual([1, 2, 3]);
      expect(mockUploadSessionRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ uploadKind: 'multipart', multipartUploadId: 'mp-1' }),
      );
    });

    it('5TB 가까운 size에도 MAX_PARTS=10000을 넘지 않도록 part size를 조정한다', async () => {
      // 이 케이스는 100GB cap에 의해 도달 불가하지만 partSize 공식 검증용
      // 100GB / 100MB = 1024 parts
      mockMinioService.createMultipartUpload.mockResolvedValue({ uploadId: 'mp-2' });
      mockMinioService.presignedPutPart.mockResolvedValue('https://storage.example/part');
      mockUploadSessionRepository.insert.mockResolvedValue({ ...mockUploadSessionSingle, uploadKind: 'multipart' });

      const size = 100 * 1024 * 1024 * 1024; // 100GB
      const result = await service.init('u1', { name: 'big.bin', size, mimeType: 'application/octet-stream' });

      expect(result.parts.length).toBeLessThanOrEqual(10000);
      expect(result.parts.length).toBe(1024);
    });
  });

  describe('complete', () => {
    it('session이 없으면 UPLOAD_SESSION_NOT_FOUND를 던진다', async () => {
      mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(null);
      await expect(service.complete('u1', 'ghost-id', [{ partNumber: 1, etag: 'e' }])).rejects.toMatchObject({
        code: 'UPLOAD_SESSION_NOT_FOUND',
      });
    });

    it('session 소유자가 다르면 UPLOAD_SESSION_NOT_FOUND를 던진다 (정보 누출 차단)', async () => {
      mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue({
        ...mockUploadSessionSingle,
        userId: 'other-user',
      });
      await expect(
        service.complete('u1', mockUploadSessionSingle.id, [{ partNumber: 1, etag: 'e' }]),
      ).rejects.toMatchObject({
        code: 'UPLOAD_SESSION_NOT_FOUND',
      });
    });

    it('만료된 session이고 객체도 없으면 UPLOAD_SESSION_EXPIRED를 던진다', async () => {
      mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionExpired);
      mockUploadSessionRepository.deleteById.mockResolvedValue(true);
      mockMinioService.statObject.mockRejectedValue(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' }));
      await expect(
        service.complete('uuid-1', mockUploadSessionExpired.id, [{ partNumber: 1, etag: 'e' }]),
      ).rejects.toMatchObject({
        code: 'UPLOAD_SESSION_EXPIRED',
      });
    });

    it('statObject가 NoSuchKey면 UPLOAD_OBJECT_MISSING을 던진다', async () => {
      mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionSingle);
      mockMinioService.statObject.mockRejectedValue(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' }));
      await expect(
        service.complete('uuid-1', mockUploadSessionSingle.id, [{ partNumber: 1, etag: 'e' }]),
      ).rejects.toMatchObject({
        code: 'UPLOAD_OBJECT_MISSING',
      });
    });

    it('size 불일치이면 UPLOAD_SIZE_MISMATCH + removeObject 호출', async () => {
      mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionSingle); // size: 1024
      mockUploadSessionRepository.deleteById.mockResolvedValue(true);
      mockMinioService.statObject.mockResolvedValue({ size: 2048, mimeType: 'image/png' });
      mockMinioService.removeObject.mockResolvedValue(undefined);
      await expect(
        service.complete('uuid-1', mockUploadSessionSingle.id, [{ partNumber: 1, etag: 'e' }]),
      ).rejects.toMatchObject({
        code: 'UPLOAD_SIZE_MISMATCH',
      });
      expect(mockMinioService.removeObject).toHaveBeenCalledWith(mockUploadSessionSingle.minioKey);
    });

    it('단일 PUT 성공 시 files row INSERT + session DELETE', async () => {
      mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionSingle);
      mockMinioService.statObject.mockResolvedValue({ size: 1024, mimeType: 'image/png' });
      mockFileRepository.insert.mockResolvedValue({
        id: 'new-file-id',
        userId: 'uuid-1',
        folderId: null,
        name: 'test.png',
        minioKey: mockUploadSessionSingle.minioKey,
        size: 1024,
        mimeType: 'image/png',
        softDeletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockUploadSessionRepository.deleteById.mockResolvedValue(true);

      const result = await service.complete('uuid-1', mockUploadSessionSingle.id, [{ partNumber: 1, etag: 'e' }]);

      expect(mockMinioService.completeMultipartUpload).not.toHaveBeenCalled();
      expect(mockFileRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'uuid-1',
          name: 'test.png',
          minioKey: mockUploadSessionSingle.minioKey,
          size: 1024,
          mimeType: 'image/png',
        }),
      );
      expect(mockUploadSessionRepository.deleteById).toHaveBeenCalledWith(mockUploadSessionSingle.id);
      expect(result.name).toBe('test.png');
    });

    it('multipart 성공 시 completeMultipartUpload 호출 후 files INSERT', async () => {
      mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionMultipart);
      mockMinioService.statObject.mockResolvedValue({ size: 150 * 1024 * 1024, mimeType: 'image/png' });
      mockFileRepository.insert.mockResolvedValue({
        id: 'new-file-id',
        userId: 'uuid-1',
        folderId: null,
        name: 'test.png',
        minioKey: mockUploadSessionMultipart.minioKey,
        size: 150 * 1024 * 1024,
        mimeType: 'image/png',
        softDeletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.complete('uuid-1', mockUploadSessionMultipart.id, [
        { partNumber: 1, etag: 'e1' },
        { partNumber: 2, etag: 'e2' },
      ]);

      expect(mockMinioService.completeMultipartUpload).toHaveBeenCalledWith(
        mockUploadSessionMultipart.minioKey,
        'multipart-upload-id-1',
        [
          { partNumber: 1, etag: 'e1' },
          { partNumber: 2, etag: 'e2' },
        ],
      );
    });

    it('grace period: 만료지만 객체가 있으면 정상 처리한다', async () => {
      // expires_at이 25초 전 (grace 30초 내)
      const recentlyExpired = {
        ...mockUploadSessionSingle,
        expiresAt: new Date(Date.now() - 25 * 1000),
      };
      mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(recentlyExpired);
      mockMinioService.statObject.mockResolvedValue({ size: 1024, mimeType: 'image/png' });
      mockFileRepository.insert.mockResolvedValue({
        id: 'new-file-id',
        userId: 'uuid-1',
        folderId: null,
        name: 'test.png',
        minioKey: recentlyExpired.minioKey,
        size: 1024,
        mimeType: 'image/png',
        softDeletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.complete('uuid-1', recentlyExpired.id, [{ partNumber: 1, etag: 'e' }]);
      expect(result).toBeDefined();
    });
  });

  describe('cleanupExpired', () => {
    it('만료 single session은 removeObject + deleteById를 호출한다', async () => {
      mockUploadSessionRepository.findExpiredForCleanup.mockResolvedValue([mockUploadSessionExpired]);
      mockUploadSessionRepository.deleteById.mockResolvedValue(true);
      mockMinioService.removeObject.mockResolvedValue(undefined);

      const stats = await service.cleanupExpired(500);

      expect(mockMinioService.removeObject).toHaveBeenCalledWith(mockUploadSessionExpired.minioKey);
      expect(mockMinioService.abortMultipartUpload).not.toHaveBeenCalled();
      expect(mockUploadSessionRepository.deleteById).toHaveBeenCalledWith(mockUploadSessionExpired.id);
      expect(stats.removedCount).toBe(1);
      expect(stats.abortedCount).toBe(0);
    });

    it('만료 multipart session은 abortMultipartUpload + removeObject + deleteById를 호출한다', async () => {
      const expiredMp = { ...mockUploadSessionMultipart, expiresAt: new Date('2020-01-01') };
      mockUploadSessionRepository.findExpiredForCleanup.mockResolvedValue([expiredMp]);
      mockUploadSessionRepository.deleteById.mockResolvedValue(true);
      mockMinioService.abortMultipartUpload.mockResolvedValue(undefined);
      mockMinioService.removeObject.mockResolvedValue(undefined);

      const stats = await service.cleanupExpired(500);

      expect(mockMinioService.abortMultipartUpload).toHaveBeenCalledWith(
        expiredMp.minioKey,
        expiredMp.multipartUploadId,
      );
      expect(mockMinioService.removeObject).toHaveBeenCalledWith(expiredMp.minioKey);
      expect(stats.abortedCount).toBe(1);
      expect(stats.removedCount).toBe(1);
    });

    it('MinIO 에러가 나도 deleteById는 진행하고 removedCount는 증가하지 않는다', async () => {
      mockUploadSessionRepository.findExpiredForCleanup.mockResolvedValue([mockUploadSessionExpired]);
      mockMinioService.removeObject.mockRejectedValue(new Error('boom'));
      mockUploadSessionRepository.deleteById.mockResolvedValue(true);

      const stats = await service.cleanupExpired(500);

      expect(mockUploadSessionRepository.deleteById).toHaveBeenCalled();
      expect(stats.scannedCount).toBe(1);
      expect(stats.removedCount).toBe(0);
    });

    it('처리한 세션 수를 stats 객체로 반환한다', async () => {
      mockUploadSessionRepository.findExpiredForCleanup.mockResolvedValue([
        { ...mockUploadSessionExpired, id: 's1' },
        { ...mockUploadSessionMultipart, id: 's2', expiresAt: new Date('2020-01-01') },
      ]);
      mockMinioService.abortMultipartUpload.mockResolvedValue(undefined);
      mockMinioService.removeObject.mockResolvedValue(undefined);
      mockUploadSessionRepository.deleteById.mockResolvedValue(true);

      const stats = await service.cleanupExpired(500);

      expect(stats).toEqual({
        scannedCount: 2,
        abortedCount: 1, // multipart session만 abort; single session은 multipartUploadId 없음
        removedCount: 2,
      });
    });
  });
});

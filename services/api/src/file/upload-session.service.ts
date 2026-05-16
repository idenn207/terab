import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { FileItem, UploadCompletePart, UploadInitBody, UploadInitResponse } from '@terab/contract';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { randomUUID } from 'node:crypto';
import { FolderService } from '../folder/folder.service';
import { MinioService } from '../minio/minio.service';
import { FileRepository } from './file.repository';
import { UploadSessionRepository } from './upload-session.repository';

@Injectable()
export class UploadSessionService extends ServiceCore {
  /** 3600s */ private readonly TTL_MS = 60 * 60 * 1000;
  /** 30s */ private readonly GRACE_MS = 30 * 1000;
  /** 100MB */ private readonly MULTIPART_THRESHOLD = 100 * 1024 * 1024;
  /** 100MB */ private readonly DEFAULT_PART_SIZE = 100 * 1024 * 1024;
  private readonly MAX_PARTS = 10000;
  private readonly URL_EXPIRY_SEC = 3600;
  /** 100GB */ private readonly MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024;

  private readonly DANGEROUS_MIME_PREFIXES = [
    'text/html',
    'application/javascript',
    'text/javascript',
    'application/xhtml+xml',
    'text/xml',
    'application/xml',
  ];

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly uploadSessionRepository: UploadSessionRepository,
    private readonly fileRepository: FileRepository,
    private readonly folderService: FolderService,
    private readonly minioService: MinioService,
  ) {
    super(database, txContext);
  }

  private sanitizeMime(mimeType: string): string {
    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    return this.DANGEROUS_MIME_PREFIXES.includes(normalized) ? 'application/octet-stream' : mimeType;
  }

  async init(userId: string, body: UploadInitBody): Promise<UploadInitResponse> {
    if (body.size > this.MAX_FILE_SIZE) throw new ApiException('FILE_TOO_LARGE');
    if (body.folderId) await this.folderService.assertBelongsToUser(body.folderId, userId);

    const safeMime = this.sanitizeMime(body.mimeType);
    const minioKey = `${userId}/${randomUUID()}`;
    const expiresAt = new Date(Date.now() + this.TTL_MS);

    // Direct Put
    if (body.size < this.MULTIPART_THRESHOLD) {
      const uploadUrl = await this.minioService.presignedPutObject(minioKey, this.URL_EXPIRY_SEC);
      const session = await this.uploadSessionRepository.insert({
        userId,
        folderId: body.folderId ?? null,
        name: body.name,
        size: body.size,
        mimeType: safeMime,
        minioKey,
        uploadKind: 'single',
        multipartUploadId: null,
        expiresAt,
      });
      return {
        sessionId: session.id,
        parts: [{ partNumber: 1, uploadUrl }],
        uploadHeaders: { 'Content-Type': safeMime },
        expiresAt,
      };
    }

    // Multipart 경로
    const partSize = Math.max(this.DEFAULT_PART_SIZE, Math.ceil(body.size / 9000));
    const partCount = Math.ceil(body.size / partSize);
    if (partCount > this.MAX_PARTS) throw new ApiException('FILE_TOO_LARGE');

    const { uploadId } = await this.minioService.createMultipartUpload(minioKey, safeMime);
    const parts = await Promise.all(
      Array.from({ length: partCount }, async (_, i) => {
        const partNumber = i + 1;
        const uploadUrl = await this.minioService.presignedPutPart(minioKey, uploadId, partNumber, this.URL_EXPIRY_SEC);
        return { partNumber, uploadUrl };
      }),
    );

    const session = await this.uploadSessionRepository.insert({
      userId,
      folderId: body.folderId ?? null,
      name: body.name,
      size: body.size,
      mimeType: safeMime,
      minioKey,
      uploadKind: 'multipart',
      multipartUploadId: uploadId,
      expiresAt,
    });

    return {
      sessionId: session.id,
      parts,
      uploadHeaders: { 'Content-Type': safeMime },
      expiresAt,
    };
  }

  async complete(userId: string, sessionId: string, parts: UploadCompletePart[]): Promise<FileItem> {
    return this.runInTx(async () => {
      const session = await this.uploadSessionRepository.findByIdForUpdate(sessionId);
      if (!session || session.userId !== userId) throw new ApiException('UPLOAD_SESSION_NOT_FOUND');

      const now = Date.now();
      const expired = session.expiresAt.getTime() + this.GRACE_MS < now;

      if (expired) {
        // grace 안에서도 객체가 있으면 진행, 없으면 만료 처리
        const exist = await this.minioService.statObject(session.minioKey).catch(() => null);
        if (!exist) {
          await this.uploadSessionRepository.deleteById(session.id).catch(() => undefined);
          throw new ApiException('UPLOAD_SESSION_EXPIRED');
        }
      }

      if (session.uploadKind === 'multipart') {
        if (!session.multipartUploadId) throw new ApiException('UPLOAD_OBJECT_MISSING');
        await this.minioService.completeMultipartUpload(session.minioKey, session.multipartUploadId, parts);
      }

      const stat = await this.minioService.statObject(session.minioKey).catch((err: unknown) => {
        // minio-js의 에러 코드 노출: err.code === 'NoSuchKey' 또는 message
        const code = (err as { code?: string } | null)?.code;
        if (code === 'NoSuchKey' || (err instanceof Error && err.message.includes('NoSuchKey'))) {
          return null;
        }
        throw err;
      });
      if (!stat) throw new ApiException('UPLOAD_OBJECT_MISSING');

      if (stat.size !== session.size) {
        await this.minioService.removeObject(session.minioKey).catch(() => undefined);
        await this.uploadSessionRepository.deleteById(session.id).catch(() => undefined);
        throw new ApiException('UPLOAD_SIZE_MISMATCH');
      }

      const row = await this.fileRepository.insert({
        userId,
        folderId: session.folderId,
        name: session.name,
        minioKey: session.minioKey,
        size: session.size,
        mimeType: session.mimeType,
      });
      await this.uploadSessionRepository.deleteById(session.id);
      return this.fileRepository.toFileItem(row);
    });
  }

  async cleanupExpired(batchSize: number): Promise<{ scannedCount: number; abortedCount: number; removedCount: number }> {
    const sessions = await this.uploadSessionRepository.findExpiredForCleanup(this.GRACE_MS, batchSize);
    let abortedCount = 0;
    let removedCount = 0;
    for (const session of sessions) {
      if (session.uploadKind === 'multipart' && session.multipartUploadId) {
        await this.minioService.abortMultipartUpload(session.minioKey, session.multipartUploadId).then(() => {
          abortedCount += 1;
        }).catch(() => undefined);
      }
      await this.minioService.removeObject(session.minioKey).then(() => {
        removedCount += 1;
      }).catch(() => undefined);
      await this.uploadSessionRepository.deleteById(session.id);
    }
    return { scannedCount: sessions.length, abortedCount, removedCount };
  }
}

import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { UploadInitBody, UploadInitResponse } from '@terab/contract';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { randomUUID } from 'node:crypto';
import { FolderService } from '../folder/folder.service';
import { MinioService } from '../minio/minio.service';
import { FileRepository } from './file.repository';
import { UploadSessionRepository } from './upload-session.repository';

@Injectable()
export class UploadSessionService extends ServiceCore {
  private readonly TTL_MS = 60 * 60 * 1000;
  private readonly GRACE_MS = 30 * 1000;
  private readonly MULTIPART_THRESHOLD = 100 * 1024 * 1024;
  private readonly DEFAULT_PART_SIZE = 100 * 1024 * 1024;
  private readonly MAX_PARTS = 10000;
  private readonly URL_EXPIRY_SEC = 3600;
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024;

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

    // multipart 경로는 Task 12에서 구현
    throw new Error('multipart not implemented');
  }
}

import { RequestWithAuthUser } from '@terab/common';
import { StorageEngine } from 'multer';
import { randomUUID } from 'node:crypto';
import { MinioService } from './minio.service';

export class MinioStorageEngine implements StorageEngine {
  // 브라우저가 실행할 수 있는 콘텐츠 타입 — 저장 시점에 차단
  private readonly DANGEROUS_MIME_PREFIXES = [
    'text/html',
    'application/javascript',
    'text/javascript',
    'application/xhtml+xml',
    'text/xml',
    'application/xml',
  ];

  constructor(private readonly minioService: MinioService) {}

  private sanitizeMimeType(mimeType: string): string {
    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    return this.DANGEROUS_MIME_PREFIXES.includes(normalized) ? 'application/octet-stream' : mimeType;
  }

  _handleFile(
    req: RequestWithAuthUser,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const userId = req.user?.userId;
    if (!userId) return callback(new Error('Unauthenticated'));

    const key = `${userId}/${randomUUID()}`;
    const safeMimeType = this.sanitizeMimeType(file.mimetype);
    this.minioService
      .putObject(key, file.stream, safeMimeType)
      .then(() => this.minioService.statObject(key))
      .then(({ size }) => callback(null, { filename: key, size, mimetype: safeMimeType }))
      .catch(callback);
  }

  _removeFile(_req: RequestWithAuthUser, file: Express.Multer.File, callback: (error: Error | null) => void): void {
    this.minioService
      .removeObject(file.filename)
      .then(() => callback(null))
      .catch(callback);
  }
}

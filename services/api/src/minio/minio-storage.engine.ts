import { StorageEngine } from 'multer';
import { randomUUID } from 'node:crypto';
import { RequestWithAuthUser } from '../auth/types/auth-user.type';
import { MinioService } from './minio.service';

export class MinioStorageEngine implements StorageEngine {
  constructor(private readonly minioService: MinioService) {}

  _handleFile(
    req: RequestWithAuthUser,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const userId = req.user?.userId;
    if (!userId) return callback(new Error('Unauthenticated'));

    const key = `${userId}/${randomUUID()}`;
    this.minioService
      .putObject(key, file.stream, file.mimetype)
      .then(() => this.minioService.statObject(key))
      .then(({ size }) => callback(null, { filename: key, size }))
      .catch(callback);
  }

  _removeFile(_req: RequestWithAuthUser, file: Express.Multer.File, callback: (error: Error | null) => void): void {
    this.minioService
      .removeObject(file.filename)
      .then(() => callback(null))
      .catch(callback);
  }
}

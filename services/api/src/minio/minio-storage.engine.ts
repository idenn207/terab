import { StorageEngine } from 'multer';
import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
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
    const counter = new PassThrough();
    let size = 0;
    counter.on('data', (chunk: Buffer) => {
      size += chunk.length;
    });
    file.stream.pipe(counter);

    this.minioService
      .putObject(key, counter, file.mimetype)
      .then(() => callback(null, { filename: key, size }))
      .catch(callback);
  }

  _removeFile(_req: RequestWithAuthUser, file: Express.Multer.File, callback: (error: Error | null) => void): void {
    this.minioService
      .removeObject(file.filename)
      .then(() => callback(null))
      .catch(callback);
  }
}

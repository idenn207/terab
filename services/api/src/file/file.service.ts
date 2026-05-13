import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { FileItem, FileSearchResponse } from '@terab/contract';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { extension as mimeExtension } from 'mime-types';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import sanitizeFilename from 'sanitize-filename';
import { FolderService } from '../folder/folder.service';
import { MinioService } from '../minio/minio.service';
import { FileRepository } from './file.repository';

@Injectable()
export class FileService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly fileRepository: FileRepository,
    private readonly folderService: FolderService,
    private readonly minioService: MinioService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    super(database, txContext);
  }

  private cacheKey(userId: string, folderId: string | null): string {
    return `files:user:${userId}:folder:${folderId ?? 'root'}`;
  }

  private async invalidate(userId: string, folderId: string | null): Promise<void> {
    await this.cache.del(this.cacheKey(userId, folderId));
  }

  private ensureExtension(name: string, mimeType: string): string {
    if (extname(name)) return name;
    const ext = mimeExtension(mimeType);
    return ext ? `${name}.${ext}` : name;
  }

  async upload(userId: string, file: Express.Multer.File, folderId?: string): Promise<FileItem> {
    if (folderId) await this.folderService.assertBelongsToUser(folderId, userId);

    const row = await this.fileRepository.insert({
      userId,
      folderId: folderId ?? null,
      name: sanitizeFilename(file.originalname),
      minioKey: file.filename,
      size: file.size,
      mimeType: file.mimetype,
    });

    await this.invalidate(userId, folderId ?? null);
    return this.fileRepository.toFileItem(row);
  }

  async getDownloadStream(
    userId: string,
    fileId: string,
  ): Promise<{ stream: Readable; name: string; size: number; mimeType: string }> {
    const file = await this.fileRepository.findByIdAndUser(fileId, userId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');
    const stream = await this.getObjectStream(file.minioKey);
    const name = this.ensureExtension(file.name, file.mimeType);
    return { stream, name, size: file.size, mimeType: file.mimeType };
  }

  async getObjectStream(minioKey: string): Promise<Readable> {
    return this.minioService.getObject(minioKey);
  }

  async resolveZipFiles(fileIds: string[], userId: string): Promise<Array<{ name: string; key: string }>> {
    const rows = await Promise.all(fileIds.map((id) => this.fileRepository.findByIdAndUser(id, userId)));
    return rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({ name: this.ensureExtension(r.name, r.mimeType), key: r.minioKey }));
  }

  async rename(id: string, userId: string, name: string): Promise<FileItem> {
    const row = await this.fileRepository.rename(id, userId, name);
    if (!row) throw new ApiException('FILE_NOT_FOUND');
    await this.invalidate(userId, row.folderId ?? null);
    return this.fileRepository.toFileItem(row);
  }

  async move(id: string, userId: string, folderId: string | null): Promise<FileItem> {
    const file = await this.fileRepository.findByIdAndUser(id, userId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');
    if (folderId) await this.folderService.assertBelongsToUser(folderId, userId);

    const row = await this.fileRepository.move(id, userId, folderId);
    if (!row) throw new ApiException('FILE_NOT_FOUND');

    await Promise.all([this.invalidate(userId, file.folderId ?? null), this.invalidate(userId, folderId)]);
    return this.fileRepository.toFileItem(row);
  }

  async copy(id: string, userId: string, folderId: string | null): Promise<FileItem> {
    const file = await this.fileRepository.findByIdAndUser(id, userId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');
    if (folderId) await this.folderService.assertBelongsToUser(folderId, userId);

    const newKey = `${userId}/${randomUUID()}`;
    await this.minioService.copyObject(file.minioKey, newKey);
    // DB insert 실패 시 MinIO에 생성된 복사본을 정리하여 orphan 방지
    const row = await this.fileRepository
      .insert({ userId, folderId, name: file.name, minioKey: newKey, size: file.size, mimeType: file.mimeType })
      .catch(async (err) => {
        await this.minioService.removeObject(newKey).catch(() => undefined);
        throw err;
      });
    await this.invalidate(userId, folderId);
    return this.fileRepository.toFileItem(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const file = await this.fileRepository.findByIdAndUser(id, userId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');
    const deleted = await this.fileRepository.softDelete(id, userId);
    if (!deleted) throw new ApiException('FILE_NOT_FOUND');
    await this.invalidate(userId, file.folderId ?? null);
  }

  async search(userId: string, q: string, scope: 'all' | 'folder', folderId?: string): Promise<FileSearchResponse> {
    if (scope === 'folder' && !folderId) throw new ApiException('FOLDER_NOT_FOUND');
    const rows = await this.fileRepository.search(userId, q, scope === 'folder' ? folderId : undefined);
    return { files: rows.map((r) => this.fileRepository.toFileItem(r)) };
  }
}

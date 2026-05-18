import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { TrashListResponseDto } from './dto';
import { MinioService } from '../minio/minio.service';
import { TrashRepository } from './trash.repository';

@Injectable()
export class TrashService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly trashRepository: TrashRepository,
    private readonly minioService: MinioService,
  ) {
    super(database, txContext);
  }

  async list(userId: string): Promise<TrashListResponseDto> {
    const items = await this.trashRepository.findAllDeleted(userId);
    return { items };
  }

  async restore(userId: string, id: string, type: 'file' | 'folder'): Promise<void> {
    if (type === 'file') {
      const file = await this.trashRepository.findDeletedFile(id, userId);
      if (!file) throw new ApiException('FILE_NOT_FOUND');
      await this.trashRepository.restoreFile(id, userId);
    } else {
      const folder = await this.trashRepository.findDeletedFolder(id, userId);
      if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
      await this.trashRepository.restoreFolder(id, userId);
    }
  }

  async permanentDelete(userId: string, id: string, type: 'file' | 'folder'): Promise<void> {
    if (type === 'file') {
      const minioKey = await this.trashRepository.permanentDeleteFile(id, userId);
      if (!minioKey) throw new ApiException('FILE_NOT_FOUND');
      await this.minioService.removeObject(minioKey);
    } else {
      const folder = await this.trashRepository.findDeletedFolder(id, userId);
      if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
      const minioKeys = await this.trashRepository.permanentDeleteFolderTree(id, userId);
      if (minioKeys.length > 0) {
        await this.minioService.removeObjects(minioKeys);
      }
    }
  }
}

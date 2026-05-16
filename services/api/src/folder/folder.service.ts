import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { FolderChildrenResponse, FolderItem } from '@terab/contract';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { FolderRepository } from './folder.repository';

@Injectable()
export class FolderService extends ServiceCore {
  private readonly MAX_FOLDER_DEPTH = 20;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly folderRepository: FolderRepository,
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

  async findById(id: string, userId: string): Promise<FolderItem | null> {
    const row = await this.folderRepository.findByIdAndUser(id, userId);
    return row ? this.folderRepository.toFolderItem(row) : null;
  }

  async getRoot(userId: string): Promise<FolderChildrenResponse> {
    const key = this.cacheKey(userId, null);
    const cached = await this.cache.get<FolderChildrenResponse>(key);
    if (cached) return cached;

    const [folderRows, files] = await Promise.all([
      this.folderRepository.findRootChildren(userId),
      this.folderRepository.findRootFiles(userId),
    ]);
    const result: FolderChildrenResponse = {
      folders: folderRows.map((f) => this.folderRepository.toFolderItem(f)),
      files,
    };
    await this.cache.set(key, result);
    return result;
  }

  async getChildren(folderId: string, userId: string): Promise<FolderChildrenResponse> {
    const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
    if (!folder) throw new ApiException('FOLDER_NOT_FOUND');

    const key = this.cacheKey(userId, folderId);
    const cached = await this.cache.get<FolderChildrenResponse>(key);
    if (cached) return cached;

    const [folderRows, files] = await Promise.all([
      this.folderRepository.findChildren(folderId, userId),
      this.folderRepository.findFilesByFolder(folderId, userId),
    ]);
    const result: FolderChildrenResponse = {
      folders: folderRows.map((f) => this.folderRepository.toFolderItem(f)),
      files,
    };
    await this.cache.set(key, result);
    return result;
  }

  async create(userId: string, name: string, parentId: string | null): Promise<FolderItem> {
    if (parentId) {
      const parent = await this.folderRepository.findByIdAndUser(parentId, userId);
      if (!parent) throw new ApiException('FOLDER_NOT_FOUND');
      const depth = await this.folderRepository.getDepth(parentId);
      if (depth >= this.MAX_FOLDER_DEPTH) throw new ApiException('FOLDER_DEPTH_EXCEEDED');
    }
    const row = await this.folderRepository.insert({ userId, name, parentId: parentId ?? null });
    await this.invalidate(userId, parentId ?? null);
    return this.folderRepository.toFolderItem(row);
  }

  async rename(id: string, userId: string, name: string): Promise<FolderItem> {
    const row = await this.folderRepository.rename(id, userId, name);
    if (!row) throw new ApiException('FOLDER_NOT_FOUND');
    await this.invalidate(userId, row.parentId ?? null);
    return this.folderRepository.toFolderItem(row);
  }

  async move(id: string, userId: string, parentId: string | null): Promise<FolderItem> {
    const folder = await this.folderRepository.findByIdAndUser(id, userId);
    if (!folder) throw new ApiException('FOLDER_NOT_FOUND');

    if (parentId !== null) {
      const target = await this.folderRepository.findByIdAndUser(parentId, userId);
      if (!target) throw new ApiException('FOLDER_NOT_FOUND');
      const isDescendant = await this.folderRepository.isDescendant(parentId, id);
      if (isDescendant) throw new ApiException('INVALID_MOVE_TARGET');
    }

    const row = await this.folderRepository.move(id, userId, parentId);
    if (!row) throw new ApiException('FOLDER_NOT_FOUND');

    await Promise.all([this.invalidate(userId, folder.parentId ?? null), this.invalidate(userId, parentId)]);
    return this.folderRepository.toFolderItem(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const folder = await this.folderRepository.findByIdAndUser(id, userId);
    if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
    await this.folderRepository.softDeleteCascade(id, userId);
    await this.invalidate(userId, folder.parentId ?? null);
  }

  async assertBelongsToUser(folderId: string, userId: string): Promise<void> {
    const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
    if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
  }
}

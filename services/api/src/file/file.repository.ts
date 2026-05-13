import { Injectable } from '@nestjs/common';
import { FileItem } from '@terab/contract';
import {
  DatabaseService,
  files,
  Files$Insert,
  Files$Select,
  folders,
  RepositoryCore,
  TransactionContext,
} from '@terab/db';
import { and, eq, ilike, isNull } from 'drizzle-orm';

@Injectable()
export class FileRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  toFileItem(row: Files$Select): FileItem {
    return {
      id: row.id,
      name: row.name,
      folderId: row.folderId ?? null,
      size: row.size,
      mimeType: row.mimeType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByIdAndUser(id: string, userId: string) {
    const [row = null] = await this.conn
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId), isNull(files.softDeletedAt)))
      .limit(1);
    return row;
  }

  async insert(data: Pick<Files$Insert, 'userId' | 'folderId' | 'name' | 'minioKey' | 'size' | 'mimeType'>) {
    const [row] = await this.conn.insert(files).values(data).returning();
    return row;
  }

  async rename(id: string, userId: string, name: string) {
    const [row = null] = await this.conn
      .update(files)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.userId, userId), isNull(files.softDeletedAt)))
      .returning();
    return row;
  }

  async move(id: string, userId: string, folderId: string | null) {
    const [row = null] = await this.conn
      .update(files)
      .set({ folderId, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.userId, userId), isNull(files.softDeletedAt)))
      .returning();
    return row;
  }

  async softDelete(id: string, userId: string): Promise<boolean> {
    const result = await this.conn
      .update(files)
      .set({ softDeletedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.userId, userId), isNull(files.softDeletedAt)))
      .returning({ id: files.id });
    return result.length > 0;
  }

  async folderBelongsToUser(folderId: string, userId: string): Promise<boolean> {
    const [row = null] = await this.conn
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId), isNull(folders.softDeletedAt)))
      .limit(1);
    return row !== null;
  }

  async search(userId: string, query: string, folderId?: string) {
    const conditions = [eq(files.userId, userId), isNull(files.softDeletedAt), ilike(files.name, `%${query}%`)];
    if (folderId) conditions.push(eq(files.folderId, folderId));
    return this.conn
      .select()
      .from(files)
      .where(and(...conditions));
  }
}

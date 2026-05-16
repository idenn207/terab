import { Injectable } from '@nestjs/common';
import { TrashItem } from '@terab/contract';
import { DatabaseService, files, folders, RepositoryCore, TransactionContext } from '@terab/db';
import { and, eq, isNotNull, sql } from 'drizzle-orm';

@Injectable()
export class TrashRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findAllDeleted(userId: string) {
    const [deletedFiles, deletedFolders] = await Promise.all([
      this.conn
        .select()
        .from(files)
        .where(and(eq(files.userId, userId), isNotNull(files.softDeletedAt))),
      this.conn
        .select()
        .from(folders)
        .where(and(eq(folders.userId, userId), isNotNull(folders.softDeletedAt))),
    ]);

    const fileItems: TrashItem[] = deletedFiles.map((f) => ({
      id: f.id,
      type: 'file' as const,
      name: f.name,
      deletedAt: f.softDeletedAt!,
    }));

    const folderItems: TrashItem[] = deletedFolders.map((f) => ({
      id: f.id,
      type: 'folder' as const,
      name: f.name,
      deletedAt: f.softDeletedAt!,
    }));

    return [...fileItems, ...folderItems].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }

  async findDeletedFile(id: string, userId: string) {
    const [row = null] = await this.conn
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId), isNotNull(files.softDeletedAt)))
      .limit(1);
    return row;
  }

  async findDeletedFolder(id: string, userId: string) {
    const [row = null] = await this.conn
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNotNull(folders.softDeletedAt)))
      .limit(1);
    return row;
  }

  async restoreFile(id: string, userId: string): Promise<boolean> {
    const result = await this.conn
      .update(files)
      .set({ softDeletedAt: null })
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .returning({ id: files.id });
    return result.length > 0;
  }

  async restoreFolder(id: string, userId: string): Promise<void> {
    await this.conn.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      ),
      update_folders As (
        UPDATE folders SET soft_deleted_at = NULL
        WHERE id IN (SELECT id FROM subtree)
      )
      UPDATE files SET soft_deleted_at = NULL
      WHERE folder_id IN (SELECT id FROM subtree)
    `);
  }

  async permanentDeleteFile(id: string, userId: string): Promise<string | null> {
    const [row = null] = await this.conn
      .delete(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .returning({ minioKey: files.minioKey });
    return row?.minioKey ?? null;
  }

  async permanentDeleteFolderTree(id: string, userId: string): Promise<string[]> {
    const fileKeys = await this.conn.execute<{ minio_key: string }>(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      ),
      deleted_files AS (
        DELETE FROM files AS f
        USING subtree s
        WHERE f.folder_id = s.id AND f.user_id = ${userId}
        RETURNING f.minio_key
      ),
      deleted_folders AS (
        DELETE FROM folders 
        WHERE id IN (SELECT id FROM subtree)
        RETURNING id
      )
      SELECT minio_key FROM deleted_files;
    `);

    return fileKeys.rows.map((r) => r.minio_key);
  }
}

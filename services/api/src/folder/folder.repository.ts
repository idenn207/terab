import { Injectable } from '@nestjs/common';
import { FileItem, FolderItem } from '@terab/contract';
import {
  DatabaseService,
  files,
  folders,
  Folders$Insert,
  Folders$Select,
  RepositoryCore,
  TransactionContext,
} from '@terab/db';
import { and, eq, isNull, sql } from 'drizzle-orm';

@Injectable()
export class FolderRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  toFolderItem(row: Folders$Select): FolderItem {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ───── CRUD ──────────────────────────────
  async findRootChildren(userId: string) {
    return this.conn
      .select()
      .from(folders)
      .where(and(eq(folders.userId, userId), isNull(folders.parentId), isNull(folders.softDeletedAt)));
  }

  async findChildren(folderId: string, userId: string) {
    return this.conn
      .select()
      .from(folders)
      .where(and(eq(folders.userId, userId), eq(folders.parentId, folderId), isNull(folders.softDeletedAt)));
  }

  async findByIdAndUser(id: string, userId: string) {
    const [row = null] = await this.conn
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNull(folders.softDeletedAt)))
      .limit(1);
    return row;
  }

  async insert(data: Pick<Folders$Insert, 'userId' | 'name' | 'parentId'>) {
    const [row] = await this.conn.insert(folders).values(data).returning();
    return row;
  }

  async rename(id: string, userId: string, name: string) {
    const [row = null] = await this.conn
      .update(folders)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNull(folders.softDeletedAt)))
      .returning();
    return row;
  }

  async move(id: string, userId: string, parentId: string | null) {
    const [row = null] = await this.conn
      .update(folders)
      .set({ parentId, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNull(folders.softDeletedAt)))
      .returning();
    return row;
  }

  // ───── Business ──────────────────────────────
  async findRootFiles(userId: string): Promise<FileItem[]> {
    const rows = await this.conn
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), isNull(files.folderId), isNull(files.softDeletedAt)));
    return rows.map((r) => ({ ...r, folderId: r.folderId ?? null }));
  }

  async findFilesByFolder(folderId: string, userId: string): Promise<FileItem[]> {
    const rows = await this.conn
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), eq(files.folderId, folderId), isNull(files.softDeletedAt)));
    return rows.map((r) => ({ ...r, folderId: r.folderId ?? null }));
  }

  async getDepth(folderId: string): Promise<number> {
    const result = await this.conn.execute(sql`
      WITH RECURSIVE ancestors(id, parent_id) AS (
        SELECT id, parent_id FROM folders WHERE id = ${folderId}
        UNION ALL
        SELECT f.id, f.parent_id FROM folders f
        JOIN ancestors a ON a.parent_id = f.id
      )
      SELECT COUNT(*) - 1 AS depth FROM ancestors
    `);
    const row = result.rows[0] as { depth: string | number } | undefined;
    return row ? Number(row.depth) : 0;
  }

  async isDescendant(folderId: string, potentialAncestorId: string): Promise<boolean> {
    const result = await this.conn.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id FROM folders WHERE id = ${folderId}
        UNION ALL
        SELECT f.id, f.parent_id FROM folders f
        INNER JOIN ancestors a ON f.id = a.parent_id
      )
      SELECT 1 FROM ancestors WHERE id = ${potentialAncestorId} LIMIT 1
    `);
    return result.rows.length > 0;
  }

  async softDeleteCascade(id: string, userId: string): Promise<void> {
    const now = new Date();
    await this.conn.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      ),
      update_folders AS (
        UPDATE folders SET soft_deleted_at = ${now}
        WHERE id IN (SELECT id FROM subtree)
      )
      UPDATE files SET soft_deleted_at = ${now}
      WHERE folder_id IN (SELECT id FROM subtree)
    `);
  }
}

import { Injectable } from '@nestjs/common';
import { backupCodes, BackupCodes$Insert, DatabaseService, RepositoryCore, TransactionContext } from '@terab/db';
import { and, eq, isNull } from 'drizzle-orm';

@Injectable()
export class BackupCodeRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findUnusedByUserId(userId: string) {
    return this.conn
      .select({ id: backupCodes.id, codeHash: backupCodes.codeHash })
      .from(backupCodes)
      .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
  }

  async insertMany(userId: BackupCodes$Insert['userId'], codeHashes: BackupCodes$Insert['codeHash'][]): Promise<void> {
    await this.conn.insert(backupCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })));
  }

  async markUsed(id: string, usedAt: BackupCodes$Insert['usedAt']): Promise<void> {
    await this.conn.update(backupCodes).set({ usedAt }).where(eq(backupCodes.id, id));
  }
}

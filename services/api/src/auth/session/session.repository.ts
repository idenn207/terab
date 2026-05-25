import { Injectable } from '@nestjs/common';
import { DatabaseService, RefreshTokens$Insert, refreshTokens, RepositoryCore, TransactionContext } from '@terab/db';
import { and, eq, gt, isNull } from 'drizzle-orm';

@Injectable()
export class SessionRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findActiveByHash(tokenHash: string, now: Date) {
    const [row = null] = await this.conn
      .select()
      .from(refreshTokens)
      .where(
        and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)),
      )
      .limit(1);
    return row;
  }

  async insert(data: Pick<RefreshTokens$Insert, 'userId' | 'tokenHash' | 'expiresAt'>): Promise<void> {
    await this.conn.insert(refreshTokens).values(data);
  }

  async revokeById(id: string, revokedAt: RefreshTokens$Insert['revokedAt']): Promise<void> {
    await this.conn.update(refreshTokens).set({ revokedAt }).where(eq(refreshTokens.id, id));
  }
}

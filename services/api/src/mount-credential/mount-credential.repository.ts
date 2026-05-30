import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
  MountCredentials$Insert,
  MountCredentials$Select,
  RepositoryCore,
  TransactionContext,
  mountCredentials,
} from '@terab/db';
import { and, eq, isNull } from 'drizzle-orm';

@Injectable()
export class MountCredentialRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findActiveByUserId(userId: string): Promise<MountCredentials$Select[]> {
    return this.conn
      .select()
      .from(mountCredentials)
      .where(and(eq(mountCredentials.userId, userId), isNull(mountCredentials.revokedAt)));
  }

  async findActiveByDriveAndProtocol(
    driveId: string,
    userId: string,
    protocol: string,
  ): Promise<MountCredentials$Select | null> {
    const [row = null] = await this.conn
      .select()
      .from(mountCredentials)
      .where(
        and(
          eq(mountCredentials.driveId, driveId),
          eq(mountCredentials.userId, userId),
          eq(mountCredentials.protocol, protocol),
          isNull(mountCredentials.revokedAt),
        ),
      )
      .limit(1);
    return row;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<MountCredentials$Select | null> {
    const [row = null] = await this.conn
      .select()
      .from(mountCredentials)
      .where(and(eq(mountCredentials.id, id), eq(mountCredentials.userId, userId)))
      .limit(1);
    return row;
  }

  async insertIssued(data: MountCredentials$Insert): Promise<MountCredentials$Select> {
    const [row] = await this.conn.insert(mountCredentials).values(data).returning();
    return row;
  }

  async softRevoke(id: string, now: Date): Promise<void> {
    await this.conn
      .update(mountCredentials)
      .set({ revokedAt: now, updatedAt: now })
      .where(eq(mountCredentials.id, id));
  }
}

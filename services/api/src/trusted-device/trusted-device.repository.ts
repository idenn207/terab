import { Injectable } from '@nestjs/common';
import { DatabaseService, RepositoryCore, TransactionContext, trustedDevices } from '@terab/db';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class TrustedDeviceRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async insert(userId: string, tokenHash: string, userAgent: string | undefined, expiresAt: Date): Promise<void> {
    await this.conn.insert(trustedDevices).values({ userId, tokenHash, userAgent, expiresAt });
  }

  async findByTokenHash(tokenHash: string) {
    const [row = null] = await this.conn
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.tokenHash, tokenHash));
    return row;
  }

  async findByUserId(userId: string) {
    return this.conn.select().from(trustedDevices).where(eq(trustedDevices.userId, userId));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const [row = null] = await this.conn
      .select()
      .from(trustedDevices)
      .where(and(eq(trustedDevices.id, id), eq(trustedDevices.userId, userId)));
    return row;
  }

  async deleteById(id: string): Promise<void> {
    await this.conn.delete(trustedDevices).where(eq(trustedDevices.id, id));
  }
}

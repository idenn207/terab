import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
  RepositoryCore,
  TransactionContext,
  twoFaTotp,
  TwoFaTotp$Insert,
  TwoFaTotp$Select,
} from '@terab/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class TotpRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findByUserId(userId: string): Promise<TwoFaTotp$Select | null> {
    const [row = null] = await this.conn.select().from(twoFaTotp).where(eq(twoFaTotp.userId, userId)).limit(1);
    return row;
  }

  async findById(id: string): Promise<TwoFaTotp$Select | null> {
    const [row = null] = await this.conn.select().from(twoFaTotp).where(eq(twoFaTotp.id, id)).limit(1);
    return row;
  }

  async insert(data: TwoFaTotp$Insert): Promise<TwoFaTotp$Select> {
    const [row] = await this.conn.insert(twoFaTotp).values(data).returning();
    return row;
  }

  async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
    const rows = await this.conn.delete(twoFaTotp).where(eq(twoFaTotp.id, id)).returning({ userId: twoFaTotp.userId });
    return rows.length === 1 && rows[0].userId === userId;
  }

  async updateLastUsedAt(id: string, lastUsedAt: Date): Promise<void> {
    await this.conn.update(twoFaTotp).set({ lastUsedAt }).where(eq(twoFaTotp.id, id));
  }
}

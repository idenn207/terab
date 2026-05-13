import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
  RepositoryCore,
  TransactionContext,
  uploadSessions,
  UploadSessions$Insert,
  UploadSessions$Select,
} from '@terab/db';
import { eq, lt, sql } from 'drizzle-orm';

@Injectable()
export class UploadSessionRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findById(id: string): Promise<UploadSessions$Select | null> {
    const [row = null] = await this.conn.select().from(uploadSessions).where(eq(uploadSessions.id, id)).limit(1);
    return row;
  }

  async findByIdForUpdate(id: string): Promise<UploadSessions$Select | null> {
    const [row = null] = await this.conn
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, id))
      .limit(1)
      .for('update');
    return row;
  }

  async insert(data: UploadSessions$Insert): Promise<UploadSessions$Select> {
    const [row] = await this.conn.insert(uploadSessions).values(data).returning();
    return row;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.conn
      .delete(uploadSessions)
      .where(eq(uploadSessions.id, id))
      .returning({ id: uploadSessions.id });
    return result.length > 0;
  }

  async findExpiredForCleanup(graceMs: number, limit: number): Promise<UploadSessions$Select[]> {
    // expires_at + graceMs interval < now()
    return this.conn
      .select()
      .from(uploadSessions)
      .where(lt(sql`${uploadSessions.expiresAt} + (${graceMs} * interval '1 millisecond')`, sql`now()`))
      .limit(limit)
      .for('update', { skipLocked: true });
  }
}

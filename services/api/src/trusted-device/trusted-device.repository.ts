import { Injectable } from '@nestjs/common';
import { DatabaseService, RepositoryCore, TransactionContext, trustedDevices } from '@terab/db';
import { and, asc, count, eq, gt, inArray } from 'drizzle-orm';

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

  async countActiveByUserId(userId: string, now: Date): Promise<number> {
    const [row] = await this.conn
      .select({ value: count() })
      .from(trustedDevices)
      .where(and(eq(trustedDevices.userId, userId), gt(trustedDevices.expiresAt, now)));
    return Number(row?.value ?? 0);
  }

  // PG는 DELETE ... ORDER BY ... LIMIT 미지원 → select 후 inArray로 일괄 삭제
  async deleteOldestByUserId(userId: string, deleteCount: number): Promise<void> {
    if (deleteCount <= 0) return;
    const rows = await this.conn
      .select({ id: trustedDevices.id })
      .from(trustedDevices)
      .where(eq(trustedDevices.userId, userId))
      .orderBy(asc(trustedDevices.createdAt))
      .limit(deleteCount);
    if (!rows.length) return;
    await this.conn.delete(trustedDevices).where(
      inArray(
        trustedDevices.id,
        rows.map((r) => r.id),
      ),
    );
  }

  async refreshExpiresAt(id: string, expiresAt: Date): Promise<void> {
    await this.conn.update(trustedDevices).set({ expiresAt }).where(eq(trustedDevices.id, id));
  }
}

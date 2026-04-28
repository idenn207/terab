import { Injectable } from '@nestjs/common';
import { DatabaseService, trustedDevices } from '@terab/db';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class TrustedDeviceRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(userId: string, tokenHash: string, userAgent: string | undefined, expiresAt: Date): Promise<void> {
    await this.database.db.insert(trustedDevices).values({ userId, tokenHash, userAgent, expiresAt });
  }

  async findByTokenHash(tokenHash: string) {
    const [row = null] = await this.database.db
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.tokenHash, tokenHash));
    return row;
  }

  async findByUserId(userId: string) {
    return this.database.db.select().from(trustedDevices).where(eq(trustedDevices.userId, userId));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const [row = null] = await this.database.db
      .select()
      .from(trustedDevices)
      .where(and(eq(trustedDevices.id, id), eq(trustedDevices.userId, userId)));
    return row;
  }

  async deleteById(id: string): Promise<void> {
    await this.database.db.delete(trustedDevices).where(eq(trustedDevices.id, id));
  }
}

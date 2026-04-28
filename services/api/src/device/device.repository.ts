import { Injectable } from '@nestjs/common';
import { DatabaseService, devices } from '@terab/db';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DeviceRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsert(userId: string, pushToken: string, userAgent?: string): Promise<void> {
    await this.database.db.insert(devices).values({ userId, pushToken, userAgent }).onConflictDoUpdate({
      target: devices.pushToken,
      set: { userId, userAgent },
    });
  }

  async findByUserId(userId: string) {
    return this.database.db.select().from(devices).where(eq(devices.userId, userId));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const [row = null] = await this.database.db
      .select()
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.userId, userId)))
      .limit(1);
    return row;
  }

  async deleteById(id: string): Promise<void> {
    await this.database.db.delete(devices).where(eq(devices.id, id));
  }
}

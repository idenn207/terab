import { Injectable } from '@nestjs/common';
import { DatabaseService, drives, Drives$Insert, Drives$Select, RepositoryCore, TransactionContext } from '@terab/db';
import { and, eq } from 'drizzle-orm';

const KIND_PRIVATE = 'PRIVATE';

@Injectable()
export class DriveRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findPersonalByOwnerId(ownerId: string): Promise<Drives$Select | null> {
    const [row = null] = await this.conn
      .select()
      .from(drives)
      .where(and(eq(drives.ownerId, ownerId), eq(drives.kind, KIND_PRIVATE)))
      .limit(1);
    return row;
  }

  async findById(id: string): Promise<Drives$Select | null> {
    const [row = null] = await this.conn.select().from(drives).where(eq(drives.id, id)).limit(1);
    return row;
  }

  async create(data: Drives$Insert): Promise<Drives$Select> {
    const [row] = await this.conn.insert(drives).values(data).returning();
    return row;
  }
}

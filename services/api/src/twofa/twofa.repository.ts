import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
  RepositoryCore,
  TransactionContext,
  twoFaChallenges,
  type TwoFaChallenges$Insert,
} from '@terab/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class TwoFaRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async insert(data: Pick<TwoFaChallenges$Insert, 'userId' | 'options' | 'correctNum' | 'expiresAt'>) {
    const [row] = await this.conn.insert(twoFaChallenges).values(data).returning();
    return row;
  }

  async findById(id: string) {
    const [twoFa] = await this.conn.select().from(twoFaChallenges).where(eq(twoFaChallenges.id, id));
    return twoFa;
  }

  async updateStatus(
    id: string,
    status: NonNullable<TwoFaChallenges$Insert['status']>,
    respondedAt?: TwoFaChallenges$Insert['respondedAt'],
  ): Promise<void> {
    await this.conn.update(twoFaChallenges).set({ status, respondedAt }).where(eq(twoFaChallenges.id, id));
  }
}

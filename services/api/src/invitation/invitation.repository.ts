import { Injectable } from '@nestjs/common';
import { DatabaseService, invitations, Invitations$Insert, RepositoryCore, TransactionContext } from '@terab/db';
import { and, eq, isNull } from 'drizzle-orm';

@Injectable()
export class InvitationRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async insert(data: Pick<Invitations$Insert, 'createdBy' | 'expiresAt'>) {
    const [row] = await this.conn.insert(invitations).values(data).returning();
    return row;
  }

  async findByToken(token: string) {
    const [row = null] = await this.conn.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    return row;
  }

  async deactivate(token: string): Promise<boolean> {
    const result = await this.conn
      .update(invitations)
      .set({ deactivatedAt: new Date() })
      .where(eq(invitations.token, token))
      .returning({ id: invitations.id });
    return result.length > 0;
  }

  async consume(token: string, usedBy: NonNullable<Invitations$Insert['usedBy']>): Promise<{ id: string } | null> {
    const [row = null] = await this.conn
      .update(invitations)
      .set({ usedAt: new Date(), usedBy })
      .where(and(eq(invitations.token, token), isNull(invitations.usedAt)))
      .returning({ id: invitations.id });
    return row;
  }
}

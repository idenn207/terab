import { Injectable } from '@nestjs/common';
import { DatabaseService, invitations, Invitations$Insert } from '@terab/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class InvitationRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(data: Pick<Invitations$Insert, 'createdBy' | 'expiresAt'>) {
    const [row] = await this.database.db.insert(invitations).values(data).returning();
    return row;
  }

  async findByToken(token: string) {
    const [row = null] = await this.database.db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    return row;
  }

  async deactivate(token: string): Promise<boolean> {
    const result = await this.database.db
      .update(invitations)
      .set({ deactivatedAt: new Date() })
      .where(eq(invitations.token, token))
      .returning({ id: invitations.id });
    return result.length > 0;
  }

  async markUsed(token: string, usedBy: NonNullable<Invitations$Insert['usedBy']>) {
    await this.database.db.update(invitations).set({ usedAt: new Date(), usedBy }).where(eq(invitations.token, token));
  }
}

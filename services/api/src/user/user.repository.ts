import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import {
  DatabaseService,
  RepositoryCore,
  TransactionContext,
  Users$Insert,
  Users$Select,
  users,
} from '@terab/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class UserRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findById(id: string): Promise<Users$Select | null> {
    const [row = null] = await this.conn.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  async findByUsername(username: string): Promise<Users$Select | null> {
    const [row = null] = await this.conn
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return row;
  }

  async insert(
    data: Pick<Users$Insert, 'username' | 'nickname' | 'password'>,
  ): Promise<{ id: string }> {
    const [row] = await this.conn.insert(users).values(data).returning({ id: users.id });
    if (!row) throw new ApiException('REGISTRATION_FAILED');
    return row;
  }
}

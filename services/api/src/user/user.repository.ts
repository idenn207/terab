import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, RepositoryCore, TransactionContext, Users$Insert, Users$Select, users } from '@terab/db';
import { count, desc, eq } from 'drizzle-orm';

export type AdminUserRow = Pick<Users$Select, 'id' | 'username' | 'nickname' | 'createdAt'>;

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
    const [row = null] = await this.conn.select().from(users).where(eq(users.username, username)).limit(1);
    return row;
  }

  async insert(data: Pick<Users$Insert, 'username' | 'nickname' | 'password'>): Promise<{ id: string }> {
    const [row] = await this.conn.insert(users).values(data).returning({ id: users.id });
    if (!row) throw new ApiException('REGISTRATION_FAILED');
    return row;
  }

  async listUsers(limit: number, offset: number): Promise<{ items: AdminUserRow[]; total: number }> {
    const items = await this.conn
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    const [countRow] = await this.conn.select({ value: count() }).from(users);
    return { items, total: Number(countRow?.value ?? 0) };
  }
}

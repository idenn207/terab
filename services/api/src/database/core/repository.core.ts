import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DatabaseService } from '../database.service';
import * as schema from '../schema';
import { TransactionContext } from '../transaction-context';
import type { DrizzleTx } from '../types/database.type';

export abstract class RepositoryCore {
  constructor(
    protected readonly database: DatabaseService,
    protected readonly txContext: TransactionContext,
  ) {}

  protected get conn(): DrizzleTx | NodePgDatabase<typeof schema> {
    return this.txContext.current ?? this.database.db;
  }
}

import { DatabaseService } from '../database.service';
import { TransactionContext } from '../transaction-context';

export abstract class ServiceCore {
  constructor(
    protected readonly database: DatabaseService,
    protected readonly txContext: TransactionContext,
  ) {}

  protected runInTx<T>(fn: () => Promise<T>): Promise<T> {
    if (this.txContext.current) {
      return fn();
    }
    return this.database.db.transaction((tx) => this.txContext.run(tx, fn));
  }
}

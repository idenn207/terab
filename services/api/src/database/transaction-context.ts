import { AsyncLocalStorage } from 'node:async_hooks';
import type { DrizzleTx } from './types/database.type';

export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<DrizzleTx>();

  get current(): DrizzleTx | undefined {
    return this.storage.getStore();
  }

  run<T>(tx: DrizzleTx, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(tx, fn);
  }
}

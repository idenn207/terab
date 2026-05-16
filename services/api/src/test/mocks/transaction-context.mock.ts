import type { DrizzleTx } from '@terab/db';

export const mockTransactionContext = {
  current: undefined as DrizzleTx | undefined,
  run: jest.fn((_tx: unknown, fn: () => Promise<unknown>) => fn()),
};

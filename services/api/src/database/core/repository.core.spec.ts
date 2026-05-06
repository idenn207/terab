import { DatabaseService } from '../database.service';
import { TransactionContext } from '../transaction-context';
import type { DrizzleTx } from '../types/database.type';
import { RepositoryCore } from './repository.core';

class TestRepository extends RepositoryCore {
  getConn() {
    return this.conn;
  }
}

describe('RepositoryCore', () => {
  const mockTxCtx = { current: undefined as DrizzleTx | undefined };
  const mockDb = { db: {} };
  let repo: TestRepository;

  beforeEach(() => {
    mockTxCtx.current = undefined;
    repo = new TestRepository(mockDb as unknown as DatabaseService, mockTxCtx as unknown as TransactionContext);
  });

  it('tx 컨텍스트가 없으면 conn은 database.db를 반환한다', () => {
    expect(repo.getConn()).toBe(mockDb.db);
  });

  it('tx 컨텍스트가 있으면 conn은 해당 tx를 반환한다', () => {
    const fakeTx = {} as DrizzleTx;
    mockTxCtx.current = fakeTx;
    expect(repo.getConn()).toBe(fakeTx);
  });
});

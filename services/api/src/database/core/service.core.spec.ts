import { DatabaseService } from '../database.service';
import { TransactionContext } from '../transaction-context';
import type { DrizzleTx } from '../types/database.type';
import { ServiceCore } from './service.core';

class TestService extends ServiceCore {
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.runInTx(fn);
  }
}

describe('ServiceCore', () => {
  const mockTransaction = jest.fn();
  const mockTxCtx = {
    current: undefined as DrizzleTx | undefined,
    run: jest.fn((_tx: DrizzleTx, fn: () => Promise<unknown>) => fn()),
  };
  const mockDb = { db: { transaction: mockTransaction } };
  let service: TestService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTxCtx.current = undefined;
    mockTxCtx.run.mockImplementation((_tx: DrizzleTx, fn: () => Promise<unknown>) => fn());
    service = new TestService(mockDb as unknown as DatabaseService, mockTxCtx as unknown as TransactionContext);
  });

  it('인스턴스가 생성된다', () => {
    expect(service).toBeDefined();
  });

  it('tx 컨텍스트가 없으면 database.db.transaction을 호출한다', async () => {
    const fakeTx = {} as DrizzleTx;
    const fn = jest.fn().mockResolvedValue('result');
    mockTransaction.mockImplementation((cb: (tx: DrizzleTx) => Promise<unknown>) => cb(fakeTx));

    await service.execute(fn);

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockTxCtx.run).toHaveBeenCalledWith(fakeTx, fn);
  });

  it('이미 tx 컨텍스트가 있으면 새 트랜잭션 없이 fn을 직접 실행한다', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    mockTxCtx.current = {} as DrizzleTx;

    await service.execute(fn);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });

  it('runInTx의 반환값을 그대로 전달한다', async () => {
    const fakeTx = {} as DrizzleTx;
    const fn = jest.fn().mockResolvedValue('expected-value');
    mockTransaction.mockImplementation((cb: (tx: DrizzleTx) => Promise<unknown>) => cb(fakeTx));

    const result = await service.execute(fn);

    expect(result).toBe('expected-value');
  });
});
